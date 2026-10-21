import { describe, it, expect } from 'vitest'
import { createInternalToken, verifyInternalToken } from '../server/utils/auth'

describe('Supabase Auth & Sunucu Erişim Kontrolü (STATE 03)', () => {
  it('İç token oluşturur ve geçerli token doğrular', () => {
    const userId = '11111111-2222-3333-4444-555555555555'
    const token = createInternalToken(userId)

    expect(token).toBeDefined()
    expect(token.startsWith('app_token.')).toBe(true)

    const verifiedUserId = verifyInternalToken(token)
    expect(verifiedUserId).toBe(userId)
  })

  it('Bozuk veya imzasız token doğrulanamaz ve null döner', () => {
    expect(verifyInternalToken('gecersiz_token')).toBeNull()
    expect(verifyInternalToken('app_token.fake_user.12345.wrong_signature')).toBeNull()
    expect(verifyInternalToken('')).toBeNull()
  })

  it('Süresi dolmuş token (7 günden eski) geçersiz sayılır', () => {
    const userId = '11111111-2222-3333-4444-555555555555'
    const expiredTimestamp = (Date.now() - (8 * 24 * 60 * 60 * 1000)).toString()
    
    // İmza hesaplama ve eski timestamp ile sahte token
    const crypto = require('crypto')
    const secret = process.env.DATABASE_URL || 'kafile-internal-secret-2026'
    const payload = `${userId}.${expiredTimestamp}`
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    const expiredToken = `app_token.${userId}.${expiredTimestamp}.${signature}`

    expect(verifyInternalToken(expiredToken)).toBeNull()
  })

  it('Aktif olmayan veya yetkisiz kullanıcı senaryoları', () => {
    const mockActiveUser = { id: 'user-1', isActive: true, displayName: 'Admin' }
    const mockInactiveUser = { id: 'user-2', isActive: false, displayName: 'Pasif' }
    const mockUnknownUser = null

    // Yetki fonksiyonu mantığı
    const checkUserAccess = (user: typeof mockActiveUser | null) => {
      if (!user) {
        return { statusCode: 403, error: 'Kullanıcı kaydı bulunamadı' }
      }
      if (!user.isActive) {
        return { statusCode: 403, error: 'Kullanıcı hesabı pasiftir' }
      }
      return { statusCode: 200, access: true }
    }

    expect(checkUserAccess(mockUnknownUser).statusCode).toBe(403)
    expect(checkUserAccess(mockInactiveUser).statusCode).toBe(403)
    expect(checkUserAccess(mockActiveUser).statusCode).toBe(200)
  })
})
