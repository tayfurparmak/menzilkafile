import type { H3Event } from 'h3'
import { getHeader, getCookie, createError } from 'h3'
import { createHmac } from 'crypto'
import { prisma } from './prisma'
import { getSupabaseServerClient } from './supabase'

export interface AuthenticatedUserContext {
  userId: string
  email?: string
  displayName: string
  isActive: boolean
}

const SERVER_SECRET = process.env.DATABASE_URL || 'kafile-internal-secret-2026'

export function createInternalToken(userId: string): string {
  const timestamp = Date.now().toString()
  const payload = `${userId}.${timestamp}`
  const signature = createHmac('sha256', SERVER_SECRET).update(payload).digest('hex')
  return `app_token.${userId}.${timestamp}.${signature}`
}

export function verifyInternalToken(token: string): string | null {
  if (!token.startsWith('app_token.')) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const userId = parts[1]
  const timestampStr = parts[2]
  const signature = parts[3]
  if (!userId || !timestampStr || !signature) return null

  const timestamp = parseInt(timestampStr, 10)

  // 7 gün geçerlilik süresi
  if (isNaN(timestamp) || Date.now() - timestamp > 7 * 24 * 60 * 60 * 1000) {
    return null
  }

  const payload = `${userId}.${timestampStr}`
  const expectedSignature = createHmac('sha256', SERVER_SECRET).update(payload).digest('hex')
  if (signature === expectedSignature) {
    return userId
  }
  return null
}

export async function requireAuthUser(event: H3Event): Promise<AuthenticatedUserContext> {
  // Test ortamı için güvenli test bypass (Sadece test ve vitest ortamında aktiftir)
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) {
    const testUserId = getHeader(event, 'x-test-user-id')
    if (testUserId) {
      const appUser = await prisma.appUser.findUnique({
        where: { id: testUserId },
      })
      if (!appUser || !appUser.isActive) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Yetkisiz erişim: Kullanıcı aktif değil veya bulunamadı.',
        })
      }
      return {
        userId: appUser.id,
        email: 'test@kafile.com',
        displayName: appUser.displayName,
        isActive: appUser.isActive,
      }
    }
  }

  // 1. Token'ı Authorization başlığından veya Cookie'den çıkar
  const authHeader = getHeader(event, 'authorization')
  let token: string | undefined

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim()
  } else {
    token = getCookie(event, 'sb-access-token') || getCookie(event, 'sb:token')
  }

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Kimlik doğrulama gerekli. Lütfen giriş yapın.',
    })
  }

  // 2. Önce iç imzalı token olup olmadığını kontrol et
  const internalUserId = verifyInternalToken(token)
  if (internalUserId) {
    const appUser = await prisma.appUser.findUnique({
      where: { id: internalUserId },
    })

    if (!appUser || !appUser.isActive) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Bu kullanıcı hesabı pasiftir veya erişim yetkisi bulunmamaktadır.',
      })
    }

    // auth.users'dan email bilgisini isteğe bağlı çek
    let email: string | undefined = undefined
    try {
      const authUser: any = await prisma.$queryRawUnsafe(
        `SELECT email FROM auth.users WHERE id = $1::uuid LIMIT 1;`,
        internalUserId
      )
      if (authUser && authUser[0]) email = authUser[0].email
    } catch { }

    return {
      userId: appUser.id,
      email,
      displayName: appUser.displayName,
      isActive: appUser.isActive,
    }
  }

  // 3. Supabase Auth JWT token'ı doğrula
  try {
    const supabase = getSupabaseServerClient()
    const { data, error } = await supabase.auth.getUser(token)

    if (error || !data?.user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Geçersiz veya süresi dolmuş oturum. Lütfen yeniden giriş yapın.',
      })
    }

    // Veritabanından AppUser aktiflik kontrolü
    const appUser = await prisma.appUser.findUnique({
      where: { id: data.user.id },
    })

    if (!appUser || !appUser.isActive) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Bu kullanıcı hesabı pasiftir veya erişim yetkisi tanımlanmamıştır.',
      })
    }

    return {
      userId: appUser.id,
      email: data.user.email,
      displayName: appUser.displayName,
      isActive: appUser.isActive,
    }
  } catch (err: any) {
    if (err.statusCode) throw err
    throw createError({
      statusCode: 401,
      statusMessage: 'Oturum doğrulanamadı. Lütfen giriş yapın.',
    })
  }
}
