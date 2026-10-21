# Kafile Yönetim Sistemi - Teknoloji Yığını ve Mimari İlkeler (Tech Stack)

Bu doküman, sistemin geliştirilmesinde kullanılan teknolojileri, kütüphaneleri, sürüm kararlarını ve seçim ilkelerini tanımlar.

---

## 1. Çekirdek Teknoloji Yığını

| Katman | Teknoloji / Kütüphane | Seçilen / Yüklü Gerçek Sürüm | Rol ve Sorumluluk |
|---|---|---|---|
| **Framework** | Nuxt.js | `4.6.2` | Tam sunuculu (SSR) web framework'ü, dosya tabanlı yönlendirme ve Nitro sunucu altyapısı |
| **Ön Yüz Çekirdeği** | Vue.js | `3.5.44` | Vue Composition API (`<script setup>`) ile reaktif bileşen geliştirme |
| **Dil** | TypeScript | `5.8.2` | Uçtan uca tip güvenliği, arayüz ve DTO tanımlamaları (Nuxt 4 / vue-tsc uyumlu) |
| **Tip Denetleyicisi**| vue-tsc | `3.3.13` | Nuxt ve Vue Single File Component (SFC) tip doğrulaması |
| **Stil / Tasarım** | Tailwind CSS (`@nuxtjs/tailwindcss`) | `6.14.0` | Temiz, okunabilir, açık zemin (`#f8fafc`) ve yeşil vurgu (`#16a34a`) odaklı UI tasarımı |
| **Veritabanı** | Supabase PostgreSQL | v15+ | İlişkisel veri saklama, RLS, Transaction Pooler (Port 6543) ve Direct Bağlantı (Port 5432) |
| **Kimlik Doğrulama** | Supabase Auth & JWT | `@supabase/supabase-js 2.49.1` | Güvenli e-posta/şifre oturumu, yetkili iç kullanıcı kontrolü |
| **ORM / Veri Erişimi**| Prisma ORM | `6.4.0` | Yalnızca sunucuda (server/api) çalışan tip güvenli veritabanı erişimi ve migration yönetimi |
| **Veri Doğrulama** | Zod | `3.24.2` | Tüm API girişleri, sorgu parametreleri ve mutation payload'ları için sunucu tarafı şema doğrulaması |
| **Finansal Aritmetik**| Decimal.js | `10.6.0` | Kuruş hassasiyetinde parasal hesaplama; IEEE 754 float hatalarını engelleme |
| **Test Çerçevesi** | Vitest | `5.0.5` | İş kuralları, normalizasyon ve hesaplamalar için otomatik birim/entegrasyon test koşucusu |
| **Çalışma Ortamı** | Vercel (Node.js Runtime) | Node.js 20+ / 24+ | Tam sunuculu serverless deployment (statik export kullanılmaz) |

---

## 2. Sürüm Seçim ve Mimari İlkeleri

1. **Kararlı ve Birbiriyle Uyumlu Sürümler:**
   - Nuxt 4 ve Nitro altyapısıyla tam uyumlu `Prisma 6.4.0` tercih edilmiştir. Farklı Prisma ana sürümleri (Prisma 5 ve Prisma 6/7) kesinlikle karıştırılmaz.
   - Sürümler `package.json` ve `package-lock.json` ile kilitlenmiş, deterministik derleme sağlanmıştır.

2. **Prisma Yalnızca Sunucu Katmanında Çalışır:**
   - Prisma Client tarayıcıya hiçbir koşulda dahil edilmez.
   - İstemci, iş tablolarına doğrudan Supabase PostgREST sorgusu göndermez. Tüm veri akışı Nuxt `/server/api/...` endpoint'leri üzerinden kontrollü yürütülür.

3. **Gizli Anahtarların Korunması:**
   - `DATABASE_URL`, `DIRECT_URL` ve `SUPABASE_SERVICE_ROLE_KEY` kesinlikle sunucu tarafında kalır; Nuxt `runtimeConfig.public` içine sızdırılmaz.
   - İstemciye yalnızca `SUPABASE_URL` ve public `SUPABASE_ANON_KEY` açılır.

4. **Çift Bağlantı Ayrımı (Pooling vs Session):**
   - **DATABASE_URL (Port 6543, pgbouncer=true):** Vercel Serverless ve Nuxt API sorgularında bağlantı tükenmesini önlemek için PgBouncer transaction havuzunu kullanır.
   - **DIRECT_URL (Port 5432, Session):** Tablo kilitleri ve şema değişiklikleri gerektiren `prisma migrate deploy` / `prisma db push` işlemleri için doğrudan PostgreSQL bağlantısını kullanır.

5. **Otomatik Build Süreci:**
   - `package.json` içindeki `postinstall` script'i `prisma generate && nuxt prepare` olarak tanımlıdır; Vercel derleme esnasında Prisma istemcisini otomatik ve hatasız üretir.
