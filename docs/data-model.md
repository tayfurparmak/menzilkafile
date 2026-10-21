# Kafile Yönetim Sistemi - Veri Modeli ve Şema Mimarisi (Data Model)

Bu doküman, sistemin PostgreSQL veritabanı şemasını, tabloları, alan tiplerini, kısıtları, indeksleri ve modeller arası ilişkileri tanımlar.

---

## 1. Veritabanı Modelleri ve Alanları

### `AppUser` (Yetkili İç Kullanıcı)
Supabase Auth kullanıcılarıyla senkronize çalışan, sisteme giriş izni bulunan iç yönetim kullanıcıları.
- `id`: UUID (Primary Key, Supabase `auth.users.id` ile eşleşir)
- `displayName`: String (Zorunlu)
- `isActive`: Boolean (Varsayılan: `true`)
- `createdAt`: DateTime (Varsayılan: `now()`)
- *İndeksler:* `@@index([isActive])`

### `VehicleOwner` (Araç Sahibi)
Otobüs sahibi şahıs veya firmalar.
- `id`: String (Primary Key, cuid)
- `name`: String (Zorunlu, kişi veya firma adı)
- `phone`: String? (İsteğe bağlı iletişim numarası)
- `notes`: String? (Operasyonel notlar)
- `isActive`: Boolean (Varsayılan: `true`, silinme yerine pasife alma kuralı)
- `createdAt`: DateTime (Varsayılan: `now()`)
- `updatedAt`: DateTime (Otomatik güncelleme)
- *İlişkiler:* `buses` (Bus[]), `trips` (Trip[] - tarihsel sefer referansı)
- *İndeksler:* `@@index([isActive])`, `@@index([name])`

### `Bus` (Otobüs)
Sistemde kayıtlı araçlar.
- `id`: String (Primary Key, cuid)
- `plate`: String (Zorunlu, Unique, sunucuda normalize edilmiş, ör. `"35 ABC 123"`)
- `capacity`: Int (Yalnızca 41, 46 veya 54 - CHECK constraint)
- `ownerId`: String (Foreign Key -> VehicleOwner.id, ON DELETE RESTRICT)
- `notes`: String? (Model yılı, şasi vb.)
- `isActive`: Boolean (Varsayılan: `true`, silinme yerine pasife alma kuralı)
- `createdAt`: DateTime (Varsayılan: `now()`)
- `updatedAt`: DateTime
- *İlişkiler:* `owner` (VehicleOwner), `trips` (Trip[])
- *İndeksler:* `@@unique([plate])`, `@@index([ownerId])`, `@@index([isActive])`
- *Kısıt:* `CONSTRAINT "check_bus_capacity" CHECK ("capacity" IN (41, 46, 54))`

### `Convoy` (Kafile)
Grup organizasyonları ve kafile kayıtları.
- `id`: String (Primary Key, cuid)
- `name`: String (Zorunlu, ör. "2026 Kasım Kafilesi")
- `notes`: String?
- `isActive`: Boolean (Varsayılan: `true`)
- `createdAt`: DateTime (Varsayılan: `now()`)
- `updatedAt`: DateTime
- *İlişkiler:* `trips` (Trip[])
- *İndeksler:* `@@index([isActive])`

### `Trip` (Sefer)
Otobüslerin gerçekleştirdiği belirli güzergâh ve tarihli seferler.
- `id`: String (Primary Key, cuid)
- `convoyId`: String? (Foreign Key -> Convoy.id, İsteğe bağlı, ON DELETE SET NULL)
- `busId`: String (Foreign Key -> Bus.id, ON DELETE RESTRICT)
- `ownerId`: String (Foreign Key -> VehicleOwner.id, ON DELETE RESTRICT - Sefer oluşturulurken otobüsün sahibinden alınan tarihsel referans)
- `plateSnapshot`: String (Sefer oluşturulduğu andaki normalize plaka)
- `capacitySnapshot`: Int (Sefer anındaki kapasite: 41/46/54)
- `ownerNameSnapshot`: String (Sefer anındaki araç sahibi adı)
- `departureLocation`: String (Zorunlu kalkış yeri, ör. "İzmir")
- `arrivalLocation`: String (Zorunlu varış yeri, ör. "Konya")
- `startsAt`: DateTime (Zorunlu başlangıç zamanı, UTC)
- `endsAt`: DateTime (Zorunlu bitiş zamanı, UTC, `endsAt > startsAt`)
- `status`: Enum `TripStatus` (`PLANNED`, `ON_ROAD`, `COMPLETED`, `CANCELLED` - Varsayılan: `PLANNED`)
- `agreedAmount`: Decimal(12, 2) (Zorunlu, >= 0, araç sahibine ödenecek toplam sefer ücreti)
- `notes`: String?
- `createdAt`: DateTime (Varsayılan: `now()`)
- `updatedAt`: DateTime
- *İlişkiler:* `convoy` (Convoy?), `bus` (Bus), `owner` (VehicleOwner), `payments` (Payment[])
- *İndeksler:* `@@index([busId])`, `@@index([ownerId])`, `@@index([convoyId])`, `@@index([startsAt])`, `@@index([status])`
- *Kısıtlar:*
  - `CONSTRAINT "check_trip_ends_after_starts" CHECK ("endsAt" > "startsAt")`
  - `CONSTRAINT "check_trip_agreed_amount" CHECK ("agreedAmount" >= 0)`
  - `CONSTRAINT "check_trip_capacity_snapshot" CHECK ("capacitySnapshot" IN (41, 46, 54))`

### `Payment` (Ödeme Hareketi)
Bir sefer karşılığında araç sahibine yapılan ödemeler.
- `id`: String (Primary Key, cuid)
- `tripId`: String (Foreign Key -> Trip.id, ON DELETE RESTRICT)
- `amount`: Decimal(12, 2) (Zorunlu, > 0)
- `paidAt`: DateTime (Zorunlu, UTC)
- `method`: Enum `PaymentMethod` (`BANK_TRANSFER`, `CASH`)
- `notes`: String? (Dekont no, banka vb.)
- `createdAt`: DateTime (Varsayılan: `now()`)
- `updatedAt`: DateTime
- *İlişkiler:* `trip` (Trip)
- *İndeksler:* `@@index([tripId])`, `@@index([paidAt])`
- *Kısıt:* `CONSTRAINT "check_payment_amount_positive" CHECK ("amount" > 0)`

---

## 2. Hesaplanan Dinamik Alanlar (Veritabanında Tutulmaz)

1. **Kalan Tutar (Remaining Amount):**
   `Kalan Tutar = Trip.agreedAmount - SUM(Payment.amount)`
2. **Ödeme Durumu (Payment Status):**
   - `agreedAmount == 0` &rarr; `NO_PAYMENT_REQUIRED` ("Ödeme gerekmiyor")
   - `SUM(Payment.amount) == 0` &rarr; `UNPAID` ("Ödenmedi")
   - `SUM(Payment.amount) < agreedAmount` &rarr; `PARTIALLY_PAID` ("Kısmi ödendi")
   - `SUM(Payment.amount) == agreedAmount` &rarr; `PAID` ("Tamamı ödendi")

---

## 3. RLS ve Yetki Politikası
- Supabase üzerinde tüm iş tablolarında (`AppUser`, `VehicleOwner`, `Bus`, `Convoy`, `Trip`, `Payment`) `ROW LEVEL SECURITY` aktifleştirilmiştir (`ENABLE ROW LEVEL SECURITY`).
- `anon` ve `authenticated` Supabase rollerinden tüm doğrudan erişimler (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) `REVOKE ALL ON <table> FROM anon, authenticated;` ile tamamen kaldırılmıştır.
- Bu sayede tarayıcı üzerinden Supabase JavaScript SDK veya doğrudan PostgREST API uç noktaları kullanılarak iş tablolarına erişilmesi kesin olarak engellenir.

---

## 4. Prisma Bağlantı Rolü ve Çift Bağlantı (Dual-Connection) Mimarisi

1. **Bağlantı Rolü ve RLS Davranışı:**
   - Prisma istemcisi sunucuda doğrudan Supabase `postgres` rolü ile bağlantı kurar.
   - PostgreSQL üzerinde `postgres` superuser / service rolü varsayılan olarak `BYPASSRLS` niteliğine sahiptir. Bu nedenle sunucu tarafındaki Prisma sorguları RLS filtrelerine takılmaksızın güvenle çalışır.
   - Güvenlik ve yetkilendirme, istemcinin doğrudan veritabanına erişmesi engellenerek tamamen Nuxt Nitro sunucusundaki Zod şemaları ve `server/utils/auth.ts` oturum doğrulayıcısı ile garanti altına alınır.

2. **DATABASE_URL (Port 6543, Transaction Pooler):**
   - Vercel Serverless ve Nuxt API runtime sorgularında PgBouncer havuzunu kullanır (`?pgbouncer=true`).
   - Binlerce eşzamanlı serverless fonksiyonda PostgreSQL bağlantı tükenmesini (connection exhaustion) önler.

3. **DIRECT_URL (Port 5432, Session Pooler / Doğrudan Bağlantı):**
   - `prisma migrate deploy`, `prisma db push` ve DDL şema değişiklikleri için session modunda doğrudan bağlantı sağlar.
   - Prisma'nın migration kilitleri (`_prisma_migrations`) ve `ALTER TABLE` komutları için gereklidir.

---

## 5. Eşzamanlılık Koruması ve Zaman Aralığı Çakışma Stratejisi

1. **Yarı-Açık Zaman Aralığı Mantığı `[başlangıç, bitiş)`:**
   - Seferler `[startsAt, endsAt)` yarı-açık aralık kuralıyla planlanır.
   - İki seferin çakışma koşulu:
     ```sql
     candidate.startsAt < existing.endsAt AND candidate.endsAt > existing.startsAt
     ```
   - Bu mantık sayesinde bir seferin bittiği tam anda (`14:00`) diğer seferin başlaması (`14:00 - 18:00`) çakışma sayılmaz ve ardışık operasyonlara izin verilir.
   - İptal edilmiş (`status = 'CANCELLED'`) seferler çakışma değerlendirmesine katılmaz.

2. **Eşzamanlı İsteklerde Yarış Durumu (Race Condition) Koruması:**
   - İki farklı kullanıcının aynı anda aynı otobüse çakışan iki sefer oluşturmasını engellemek için PostgreSQL satır kilitleme mekanizması (`FOR UPDATE`) kullanılır.
   - Sefer oluşturma veya güncelleme işlemi Prisma `$transaction` bloğunda yürütülür:
     ```sql
     SELECT id FROM "Bus" WHERE id = $1 FOR UPDATE;
     ```
   - **Neden bu strateji seçildi?**
     - Tüm tabloyu kilitlemek (`LOCK TABLE`) sistem genelinde diğer otobüslerin eşzamanlı planlanmasını yavaşlatır.
     - Satır kilitleme (`SELECT ... FOR UPDATE`), yalnızca hedeflenen otobüsün kaydını transaction süresince kilitler. Diğer otobüslere ait seferler eşzamanlı olarak milisaniyeler içinde oluşturulmaya devam ederken, aynı otobüse yapılan eşzamanlı çakışan istekler sıraya girer ve ilk işlem commit edildikten sonra ikinci istek çakışmayı tespit ederek `409 Conflict` fırlatır.

3. **Tarihsel Snapshot Dokunulmazlığı:**
   - Sefer oluşturulduğu anda o anki `ownerId`, `plateSnapshot`, `capacitySnapshot` ve `ownerNameSnapshot` değerleri dondurulur.
   - Sefer başladıktan sonra (`ON_ROAD` veya `COMPLETED`) otobüs ve tarihsel araç sahibi değiştirilemez.
   - Planlanan seferde otobüs değiştirilirse sunucu yeni otobüsün güncel snapshot değerlerini otomatik üretir.
