import { execSync } from 'node:child_process'

try {
  console.log('• Generating Prisma Client...')
  execSync('prisma generate', { stdio: 'inherit' })
} catch (error) {
  if (process.env.VERCEL || process.env.CI) {
    console.error('Prisma generate failed in CI/Vercel environment.')
    process.exit(1)
  }
  console.warn('[Uyarı] Yerel ortamda aktif dev sunucusu nedeniyle Prisma generate atlandı. Mevcut istemci ile derlemeye devam ediliyor.')
}

console.log('• Building Nuxt for production...')
execSync('nuxt build', { stdio: 'inherit' })
