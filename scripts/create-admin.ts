import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@kafile.com'
  const password = 'Admin12345!'
  const displayName = 'Sistem Yöneticisi'

  console.log(`Supabase için yönetici kullanıcısı kontrol ediliyor (${email})...`)

  try {
    const existing: any = await prisma.$queryRawUnsafe(
      `SELECT id FROM auth.users WHERE email = $1 LIMIT 1;`,
      email
    )

    let userId: string

    if (existing.length > 0) {
      userId = existing[0].id
      console.log('Kullanıcı auth.users içinde mevcut:', userId)

      // Parolayı güncelle
      await prisma.$executeRawUnsafe(`
        UPDATE auth.users 
        SET encrypted_password = crypt('${password}', gen_salt('bf')),
            email_confirmed_at = NOW(),
            updated_at = NOW()
        WHERE id = '${userId}';
      `)
    } else {
      const insertResult: any = await prisma.$queryRawUnsafe(`
        INSERT INTO auth.users (
          instance_id,
          id,
          aud,
          role,
          email,
          encrypted_password,
          email_confirmed_at,
          raw_app_meta_data,
          raw_user_meta_data,
          created_at,
          updated_at,
          confirmation_token
        ) VALUES (
          '00000000-0000-0000-0000-000000000000',
          gen_random_uuid(),
          'authenticated',
          'authenticated',
          '${email}',
          crypt('${password}', gen_salt('bf')),
          NOW(),
          '{"provider":"email","providers":["email"]}',
          '{"name":"${displayName}"}',
          NOW(),
          NOW(),
          ''
        ) RETURNING id;
      `)
      userId = insertResult[0].id
    }

    // auth.identities tablosunu kontrol et / ekle
    const existingIdentity: any = await prisma.$queryRawUnsafe(
      `SELECT id FROM auth.identities WHERE user_id = $1::uuid LIMIT 1;`,
      userId
    )

    if (existingIdentity.length === 0) {
      await prisma.$executeRawUnsafe(`
        INSERT INTO auth.identities (
          id,
          provider_id,
          user_id,
          identity_data,
          provider,
          last_sign_in_at,
          created_at,
          updated_at
        ) VALUES (
          gen_random_uuid(),
          '${userId}',
          '${userId}',
          json_build_object('sub', '${userId}', 'email', '${email}')::jsonb,
          'email',
          NOW(),
          NOW(),
          NOW()
        );
      `)
      console.log('auth.identities kaydı oluşturuldu.')
    }

    // AppUser tablosuna yöneticiyi yetkilendir
    await prisma.appUser.upsert({
      where: { id: userId },
      update: {
        displayName,
        isActive: true,
      },
      create: {
        id: userId,
        displayName,
        isActive: true,
      },
    })
    console.log('AppUser tablosunda aktif yönetici yetkisi tanımlandı.')

    console.log('\n=============================================')
    console.log('YÖNETİCİ GİRİŞ BİLGİLERİ (HAZIR):')
    console.log(`E-posta: ${email}`)
    console.log(`Parola:  ${password}`)
    console.log(`User ID: ${userId}`)
    console.log('=============================================\n')
  } catch (err: any) {
    console.error('Hata:', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
