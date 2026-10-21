import { z } from 'zod'
import { prisma } from '../../utils/prisma'
import { createInternalToken } from '../../utils/auth'

const loginSchema = z.object({
  username: z.string().optional(),
  email: z.string().optional(),
  password: z.string().min(1, 'Şifre zorunludur.'),
}).refine((data) => !!(data.username || data.email), {
  message: 'Kullanıcı adı zorunludur.',
  path: ['username'],
})

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'private, no-cache, no-store, must-revalidate')
  setResponseHeader(event, 'Pragma', 'no-cache')
  const body = await readValidatedBody(event, (data) => loginSchema.parse(data))
  const { password } = body
  const identifier = ((body.username || body.email || '') as string).trim().toLowerCase()

  // 1. Supabase auth.users tablosunda kullanıcı adı veya e-posta ile parola kontrolü (PostgreSQL crypt)
  const users: any = await prisma.$queryRawUnsafe(
    `SELECT id, email FROM auth.users 
     WHERE (
       LOWER(email) = $1 
       OR LOWER(email) = $1 || '@kafile.com' 
       OR LOWER(email) = $1 || '@menziltakip.com'
       OR split_part(LOWER(email), '@', 1) = $1
       OR raw_user_meta_data->>'username' = $1
     )
     AND encrypted_password = crypt($2, encrypted_password)
     LIMIT 1;`,
    identifier,
    password
  )

  if (!users || users.length === 0) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Kullanıcı adı veya şifre hatalı.',
    })
  }

  const user = users[0]

  // 2. AppUser yetki kontrolü
  const appUser = await prisma.appUser.findUnique({
    where: { id: user.id },
  })

  if (!appUser || !appUser.isActive) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Bu kullanıcı hesabı pasiftir veya sisteme erişim izni bulunmamaktadır.',
    })
  }

  // 3. Güvenli oturum token'ı oluştur
  const token = createInternalToken(user.id)

  // 4. Cookie'ye yaz
  setCookie(event, 'sb-access-token', token, {
    maxAge: 60 * 60 * 24 * 7,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })

  return {
    success: true,
    token,
    user: {
      id: appUser.id,
      email: user.email,
      displayName: appUser.displayName,
      isActive: appUser.isActive,
    },
  }
})
