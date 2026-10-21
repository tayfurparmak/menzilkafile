import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    const authUsers: any = await prisma.$queryRawUnsafe(`SELECT id, email, created_at FROM auth.users LIMIT 10;`)
    console.log('SUPABASE_AUTH_USERS:', authUsers)

    const appUsers = await prisma.appUser.findMany()
    console.log('APP_USERS:', appUsers)
  } catch (err: any) {
    console.error('Hata:', err.message)
  } finally {
    await prisma.$disconnect()
  }
}

main()
