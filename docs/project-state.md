# Kafile Yönetim Sistemi - Proje Durum Takibi (Project State)

## Proje Durum Özeti

- **currentState:** STATE 11 (Supabase Production ve Vercel Dağıtım Hazırlığı)
- **status:** READY_FOR_DEPLOYMENT
- **nextAction:** docs/deployment.md adımlarına göre projenin Supabase ve Vercel üzerinde canlıya alınması (STATE 12).

---

## completedTasks (Tamamlanan Görevler)

### STATE 00: Dokümantasyon ve Mimari Analiz
- [x] Kapsam, kullanıcı akışları ve iş kurallarını tanımlayan `docs/requirements.md` dokümanının oluşturulması.
- [x] Çekirdek mimari ve sürüm seçim ilkelerini tanımlayan `docs/tech-stack.md` dokümanının güncellenmesi.
- [x] Tablolar, alan tipleri, ilişkiler ve CHECK kısıtlarını tanımlayan `docs/data-model.md` dokümanının oluşturulması.
- [x] Sayfa düzenleri, formlar ve görsel kuralları tanımlayan `docs/ui-spec.md` dokümanının oluşturulması.
- [x] Ölçülebilir kabul kriterlerini tanımlayan `docs/acceptance-criteria.md` dokümanının oluşturulması.
- [x] STATE 00–12 görev matrisini tanımlayan `docs/tasks.md` dokümanının güncellenmesi.
- [x] Dağıtım rehberini tanımlayan `docs/deployment.md` dokümanının hazırlanması.

### STATE 01: Çekirdek Paketler ve UI İskeleti
- [x] Nuxt 4 (`4.6.2`) ve Vue 3 (`3.5.44`) Composition API altyapısının kurulması.
- [x] TypeScript (`5.8.2`) ve `vue-tsc` (`3.3.13`) ile typecheck / lint entegrasyonu (`npm run typecheck`, `npm run lint`).
- [x] Tailwind CSS (`@nuxtjs/tailwindcss 6.14.0`) kurulumu, açık tema (`bg-slate-50` / `#f8fafc`), yeşil vurgu (`emerald-600` / `#16a34a`) ve okunabilir tipografi tasarımı.
- [x] Masaüstü sol menü (sidebar) ve mobil drawer menü içeren responsive layout.
- [x] Ortak UI bileşenleri (`AppButton`, `AppInput`, `AppEmptyState`, `AppErrorAlert`, `StatusBadge`, `PaymentStatusBadge`, `ConfirmModal`).
- [x] Sayfa iskeletleri ve Türkçe arayüz (`/login`, `/`, `/owners`, `/buses`, `/convoys`, `/trips`).

### STATE 02: Prisma 6 Şeması ve Supabase Veri Modeli
- [x] `prisma/schema.prisma` dosyasının tanımlanması (`AppUser`, `VehicleOwner`, `Bus`, `Convoy`, `Trip`, `Payment`).
- [x] Veritabanı seviyesinde CHECK kısıtları (`check_bus_capacity`, `check_trip_ends_after_starts`, `check_trip_agreed_amount`, `check_payment_amount_positive`).
- [x] `prisma/migrations/20261021000000_init/migration.sql` ilk migration SQL dosyasının oluşturulması.
- [x] Supabase iş tablolarında Row Level Security (RLS) etkinleştirilmesi ve tarayıcı istemcilerinden doğrudan erişimin kaldırılması (`REVOKE ALL`).
- [x] Sunucu tarafında singleton Prisma istemcisinin yapılandırılması (`server/utils/prisma.ts`).

### STATE 03: Supabase Auth ve Sunucu Tarafı Erişim Kontrolü
- [x] E-posta ve parola ile giriş (`/api/auth/login`) ve çıkış (`useAuth().logout()`) akışı.
- [x] Herkese açık kayıt ekranı ve API'si kapatıldı; yalnızca yetkili iç kullanıcılar.
- [x] Nuxt SSR ile uyumlu cookie tabanlı oturum yönetimi (`sb-access-token`, `useCookie`).
- [x] Korunan sayfalar için küresel route middleware (`app/middleware/auth.global.ts`).
- [x] Korunan tüm API isteklerinde ortak sunucu yardımcısı (`server/utils/auth.ts` -> `requireAuthUser`).
- [x] Doğrulanmış Auth kullanıcısının aktif `AppUser` kaydı kontrolü (`isActive === true`).
- [x] Kimliksiz istekte `401 Unauthorized`, aktif `AppUser` kaydı olmayan istekte `403 Forbidden` yanıtı.
- [x] Kullanıcıya özel API yanıtlarında `Cache-Control: private, no-cache, no-store, must-revalidate` ve `Pragma: no-cache` başlıkları.

### STATE 04: Araç Sahibi ve Otobüs Yönetimi
- [x] Araç sahibi ve otobüs CRUD akışları, listeleme, arama ve sayfalama.
- [x] Koltuk kapasitesinin yalnızca 41, 46, 54 olarak sınırlandırılması.
- [x] Plaka normalizasyonu (`normalizePlate`) ve mükerrer plaka engeli (`409 Conflict`).
- [x] Pasif araç sahibine otobüs atama engeli ve ilişkili kayıt olduğunda fiziksel silme engeli.
- [x] Otobüs detay sayfası (`/buses/[id]`).

### STATE 05: Kafileler ve Seferlerin Atanması
- [x] **Kafile Yönetimi:**
  - `GET /api/convoys`, `POST /api/convoys`, `PUT /api/convoys/[id]`, `DELETE /api/convoys/[id]`.
  - Kafile detay sayfası (`/convoys/[id]`): Sefer bazlı toplam koltuk kapasitesi, toplam sefer ücreti, yapılan ödemeler ve bağlı seferler.
- [x] **Sefer Oluşturma:**
  - İsteğe bağlı kafile ataması (`convoyId`).
  - Sadece aktif otobüs ve aktif araç sahibine izin verilmesi.
  - `ownerId` ve snapshot alanlarının (`plateSnapshot`, `capacitySnapshot`, `ownerNameSnapshot`) istemciden alınmayıp sunucuda otobüs kaydından dondurulması.
  - İlk durumun `PLANNED` olarak başlatılması.
- [x] **Eşzamanlılık ve Çakışma (Overlap) Koruması:**
  - Yarı-açık `[başlangıç, bitiş)` zaman aralığı mantığı (`startsAt < endsAtDate && endsAt > startsAtDate`).
  - Bir seferin bittiği tam anda diğerinin başlaması çakışma sayılmaz (ardışık sefer planlaması mümkün).
  - Eşzamanlı yarış durumlarını (race condition) engellemek için PostgreSQL satır kilidi (`SELECT id FROM "Bus" WHERE id = $1 FOR UPDATE;`) kullanımı.
  - Çakışan sefer durumunda `409 Conflict` ve İstanbul yerel saatiyle bilgilendirici hata mesajı.
- [x] **Sefer Düzenleme ve Snapshot Güncelleme:**
  - `PLANNED` seferler güncellenebilir.
  - Sefer başladıktan sonra (`ON_ROAD` veya `COMPLETED`) otobüs ve tarihsel araç sahibi değiştirilemez.
  - Planlanan seferde otobüs değişirse snapshot alanları sunucuda yeni araç verileriyle güncellenir.
- [x] **Saat Dilimi Desteği:**
  - Form saatlerinin `Europe/Istanbul` kabul edilip UTC'ye dönüştürülmesi (`parseIstanbulDateInput`).
  - Otobüs detay sayfasından (`/buses/[id]`) doğrudan önceden seçili otobüs parametresiyle (`/trips/new?busId=...`) yeni sefer oluşturulması.

### STATE 06: Sefer Listesi, Detay Ekranı ve Güvenli Durum Geçişleri
- [x] **Sefer Listesi ve Filtreleme (`/trips`):**
  - Tarih aralığı, plaka, araç sahibi, kafile, sefer durumu ve ödeme durumu filtreleri.
  - Sunucu tarafı filtreleme ve sayfalama; tüm filtre ve sayfa durumunun URL query parametrelerinde saklanması (`router.replace`).
  - Sıralama alanlarının sunucu seviyesinde allowlist ile sınırlandırılması (`sortBy`: `startsAt`, `endsAt`, `agreedAmount`, `createdAt`; `sortOrder`: `asc`, `desc`).
- [x] **Güvenli Durum Akışı:**
  - Geçerli akış: `PLANNED → ON_ROAD`, `PLANNED → CANCELLED`, `ON_ROAD → COMPLETED`, `ON_ROAD → CANCELLED`.
  - Terminal durumlar: `COMPLETED` ve `CANCELLED` son durumdur; hiçbir duruma geçiş yapılamaz.
  - Geçersiz geçişlerin hem UI hem API seviyesinde (`400 Bad Request`) engellenmesi (`canTransitionTripStatus`).
  - Fiziksel silme yerine iptal zorunluluğu (`DELETE /api/trips/[id]` işlemi `400` döner).
  - Ödemesi bulunan (`paymentCount > 0`) seferlerin iptalinin engellenmesi (`400 Bad Request`).
  - İptal işleminde onay penceresi (`ConfirmModal`) ile doğrulama istenmesi.
  - Eşzamanlı güncellemeler için PostgreSQL satır kilidi (`SELECT ... FOR UPDATE`) ve eski duruma dayalı işlemlerde `409 Conflict` koruması (`currentStatus`).
- [x] **Sefer Detay Ekranı (`/trips/[id]`):**
  - Araç, dondurulmuş tarihsel araç sahibi, güzergâh, tarihler, ücret, durum rozeti ve ödeme geçmişi.
  - Durum aksiyon butonları (`Seferi Başlat`, `Seferi Tamamla`, `Seferi İptal Et`), terminal durum rozetleri.
- [x] **Mobil Uyum ve Boş Durumlar:**
  - Mobil kart görünümü, `AppEmptyState`, sayfalama ve 409 eşzamanlılık uyarısında otomatik yenileme.
- [x] **Otomatik Test Paketi:**
### STATE 07: Araç Sahibine Yapılan Sefer Bazlı Ödemelerin Takibi
- [x] **Sefer Detayı Finansal Paneli (`/trips/[id]`):**
  - Anlaşılan toplam ücret, yapılan ödemeler toplamı, kalan borç tutarı ve ödeme durumu rozeti.
  - Ödeme hareketleri tablosu (Ödeme zamanı, tutar, ödeme yöntemi: Banka Havalesi veya Nakit, açıklama/dekont notu).
  - Ödeme ekleme, düzenleme ve onay pencereli silme (`ConfirmModal`).
- [x] **Ödeme İş Kuralları ve Güvenlik:**
  - Tutar sıfırdan büyük olmalıdır (`amount > 0`).
  - İptal edilmiş (`CANCELLED`) sefere ödeme eklenemez ve düzenlenemez.
  - Toplam ödeme sefer ücretini aşamaz (kalan borcu aşan tutarlar reddedilir).
  - Sefer ücreti, mevcut yapılmış ödemeler toplamının altına düşürülemez (`PUT /api/trips/[id]`).
  - Ödeme düzenlerken düzenlenen ödemenin tutarı hesaba katılarak azami sınır belirlenir (`maxAllowed = agreed - otherPaymentsTotal`).
  - Eşzamanlı ödeme ve ücret değişikliklerini korumak için transaction içinde `SELECT id, "agreedAmount", status FROM "Trip" WHERE id = $1 FOR UPDATE;` satır kilitleme stratejisi.
  - Veritabanında `Decimal(12, 2)` kullanılır, API yanıtlarında parasal tutarlar string olarak taşınır.
  - JavaScript floating-point yuvarlama hatalarını önlemek için tüm hesaplamalarda `Decimal.js` kullanılır.
  - Kalan tutar ve ödeme durumu veritabanında ayrı bir sütunda saklanmaz; her sorguda dinamik türetilir.
- [x] **Dinamik 4 Ödeme Durumu:**
  - `NO_PAYMENT_REQUIRED`: Ücret sıfır ise ("Ödeme gerekmiyor").
  - `UNPAID`: Hiç ödeme yapılmamışsa ("Ödenmedi").
  - `PARTIALLY_PAID`: Ödeme yapılmış ve kalan > 0 ise ("Kısmi ödendi").
  - `PAID`: Kalan borç sıfır ise ("Tamamı ödendi").
- [x] **Sefer Listesi Entegrasyonu (`/trips`):**
  - Listede Anlaşılan Ücret, Ödenen ve Kalan Borç sütunları.
  - Ödeme durumu filtresi (`paymentStatus`: `ALL`, `UNPAID`, `PARTIALLY_PAID`, `PAID`, `NO_PAYMENT_REQUIRED`) ve URL query senkronizasyonu.
### STATE 08: Gösterge Paneli ve Detay Raporlama
- [x] **Operasyon Gösterge Paneli (`/`, `/api/dashboard`):**
  - Aktif otobüs sayısı (`activeBusesCount`).
  - İstanbul saat dilimine göre bugün başlayan, iptal edilmemiş sefer sayısı (`todayTripsCount`, `getIstanbulDayRange`).
  - Yoldaki aktif seferler (`onRoadTripsCount`).
  - Seçilen dönemdeki toplam anlaşılan ücret, bu seferlere bağlı yapılan ödemeler ve kalan borç tutarı.
  - İptal edilmiş seferlerin mali toplamlardan tamamen çıkarılması.
  - Mali hesaplamanın anlamının ekranda açıkça belirtilmesi.
  - Yaklaşan seferler (en yakın 5 sefer) ve ödeme bekleyen seferler (kalan borcu olanlar).
- [x] **Araç Sahibi Detay Raporlaması (`/owners/[id]`, `/api/owners/[id]`):**
  - Güncel kayıtlı otobüsler listesi.
  - Tarihsel olarak kendisine ait seferler (geçmiş dondurulmuş veriler).
  - Dönemlik filtreleme (`startDate`, `endDate`) ve döneme ait ücret, ödeme ve kalan toplamları.
- [x] **Kafile Detay Raporlaması (`/convoys/[id]`, `/api/convoys/[id]`):**
  - Bağlı seferler ve sefer sayısı.
  - Benzersiz otobüs sayısı (`uniqueBuses.size`).
  - Sefer bazında toplam koltuk kapasitesi (asla "yolcu sayısı" olarak adlandırılmaz).
  - Kafile bazında anlaşılan ücret, yapılan ödemeler ve kalan borç toplamları.
- [x] **Performans ve Bütünlük:**
  - Mali toplamların sayfalanmış listeden değil, sunucuda tüm filtrelenen kayıtlardan hesaplanması.
  - N+1 sorgularının önlenmesi.
  - Ödeme veya sefer değiştiğinde özetlerin anında dinamik yenilenmesi.
- [x] **Otomatik Test Paketi:**
  - `tests/dashboard-reporting.test.ts` (9/9 test başarılı).

### STATE 09: Kullanıcı Arayüzü İyileştirmeleri ve CSV Dışa Aktarımı
- [x] **Arayüz Tutarlılığı ve Türkçe Terminoloji:**
  - Tüm ekranlarda tutarlı Türkçe alan adları, etiketler ve alan bazlı açıklayıcı hata mesajları.
  - İşlem sırasında butonların kilitlenmesi (`isSubmitting`, `isSavingPayment`, `isExportingCsv`).
  - İptal, silme ve durum geçişlerinde `ConfirmModal` onayı ve `Escape` klavye desteği.
  - Klavye erişimi ve belirgin odak stilleri (`:focus-visible` outline).
  - Mobil açılır menü (drawer), responsive formlar, mobil kart görünümleri ve yatay taşma koruması.
  - `formatMoney` ile tutarlı `18.000,00 ₺` (`tr-TR`, TRY) para birimi gösterimi.
  - `formatIstanbulDateTime` ile `Europe/Istanbul` (UTC+3) tarih/saat gösterimi.
  - Seferler, Araç Sahipleri, Otobüsler ve Kafileler listelerinde "Filtreleri Temizle" butonu ve ortak `AppPagination` bileşeni.
  - Kapasite terminolojisi kuralı: Asla "yolcu sayısı" olarak adlandırılmaz, "Koltuk Kapasitesi" olarak kullanılır.
- [x] **Sefer Listesi CSV Dışa Aktarımı (`/api/trips?format=csv`):**
  - Tüm aktif filtrelerin (tarih aralığı, plaka, araç sahibi, kafile, sefer durumu, ödeme durumu, sıralama) sunucuda eksiksiz uygulanması.
  - Yalnızca görünen sayfayı değil, filtrelenmiş tüm kayıtları dışa aktarma (`take: 5000`).
  - Sunucu tarafında oturum ve yetki kontrolü (`requireAuthUser(event)`).
  - Excel'de Türkçe karakterlerin (ı, İ, ş, Ş, ğ, Ğ, ç, Ç, ö, Ö, ü, Ü) bozulmaması için UTF-8 BOM (`\uFEFF`) eklenmesi.
  - Standart CSV tırnak kaçışları (`""`) ve noktalı virgül delimiter.
  - Spreadsheet formula injection engelleme (`=`, `+`, `-`, `@` ve boşluklu varyasyonları tek tırnakla nötralize etme).
  - Büyük çıktılarda bellek taşmasını önlemek amacıyla azami 5.000 kayıt güvenlik tavanı.
- [x] **Otomatik Test Paketi:**
  - `tests/csv-export-ui.test.ts` (6/6 test başarılı).

### STATE 10: Yayın Öncesi Doğrulama ve Şeffaf Raporlama
- [x] **Komut Doğrulamaları:**
  - `npm run typecheck` (0 hata, başarıyla tamamlandı).
  - `npm run lint` (0 hata, başarıyla tamamlandı).
  - `npm test` (8 test dosyası, 85/85 test başarılı).
  - `npm run build` (`app/pages/owners/[id].vue` ve `app/pages/index.vue` şablonlarındaki eksik `</div>` hataları düzeltildi, production build 8.57s içinde sıfır hatayla derlendi).
- [x] **12 Temel İş Kuralı:**
  - Mükerrer plaka, 41/46/54 kapasite, çakışan sefer engeli, eşzamanlı satır kilidi, tarihsel snapshot koruması, geçersiz durum geçişi engeli, fazla ödeme engeli, ücret alt sınır kuralı, ödemeli sefer iptal engeli, kimliksiz API engeli, İstanbul saat dilimi gün sınırları ve filtrelenmiş mali toplamlar test paketleriyle doğrulandı.
- [ ] **Canlı Tarayıcı Akışı ve Staging DB (Beklemede):**
  - Otomatik Playwright alt ajanı Azure CDN 404 sürücü kısıtı nedeniyle tarayıcı başlatamadı.
  - Canlı Supabase üretim veritabanının kirletilmemesi kuralı uygulandı; ayrı staging DB sağlandığında veya yetkili kullanıcı tarafından manuel kabul testiyle tamamlanacak.
- [x] **Doğrulama Dokümanı:**
  - Tüm gerçek çıktılar, çalıştırılan ve çalıştırılamayan adımlar `docs/verification.md` içinde belgelendi.

### STATE 11: Supabase Production ve Vercel Dağıtım Hazırlığı
- [x] **Ortam Değişkenleri ve Gizlilik İzolasyonu:**
  - `.env.example` güncellendi; değişkenler `SERVER-ONLY` (Private) ve `PUBLIC` olarak açıkça ayrıldı.
  - `DATABASE_URL` (Port 6543, `?pgbouncer=true` pooled) ve `DIRECT_URL` (Port 5432 session) rolleri dokümante edildi.
  - `SUPABASE_SERVICE_ROLE_KEY` gizli tutuldu ve Nuxt public runtime config'e asla dahil edilmedi.
  - `.gitignore` ile `.env` ve `.env.*` dosyalarının git deposuna eklenmesi engellendi.
- [x] **Prisma ve Nuxt Derleme Entegrasyonu:**
  - `package.json` `"build"` komutuna `prisma generate` dahil edildi (`scripts/build.mjs`).
  - Nuxt `ssr: true` olarak tam sunuculu (SSR) yapılandırıldı; statik export kullanılmadı.
  - Node.js LTS uyumluluğu için `package.json` dosyasına `"engines": { "node": ">=20.0.0" }` eklendi.
  - Üretim migration komutu `npm run prisma:migrate` (`prisma migrate deploy`) olarak hazırlandı.
  - Derleme sırasında migration veya seed'in otomatik çalıştırılması engellendi.
- [x] **Ortam İzolasyonu ve Güvenlik:**
  - Vercel Preview ortamlarının canlı Production veritabanından izole edilmesi stratejisi belirlendi.
  - `prisma/seed.ts` dosyasına `NODE_ENV === 'production'`, `VERCEL` ve `VERCEL_ENV` kalkanları eklenerek canlı ortamda çalışması engellendi.
  - Supabase RLS ve PostgREST tablo yetkilerinin kapatılması SQL komutları hazırlandı.
- [x] **Kapsamlı Dağıtım Rehberi (`docs/deployment.md`):**
  - 10 bölümden oluşan eksiksiz canlıya alma, bölge eşleştirme (`eu-central-1` & `fra1`), ilk yönetici tanımlama, redirect URL yapılandırması, yayın sonrası testler ve rollback stratejisi yazıldı.
- [x] **Production Build Doğrulaması:**
  - `npm run build` ile `.output/server/index.mjs` ve `.output/public` sıfır hatayla derlendi.

---

## activeConnections (Çalışan ve Bağlı Olan Kısımlar)
1. **Canlı Sefer ve Kafile Akışı:** Canlı veritabanında kafile oluşturma, bağımsız/kafileli sefer oluşturma ve çakışma kontrolleri başarıyla doğrulanmıştır.
2. **Çakışma ve Ardışık Planlama:**
   - 10:00 - 14:00 saatli sefere 12:00 - 16:00 aralığında çakışan sefer istendiğinde `409 Conflict` fırlatıldığı,
   - 14:00 - 18:00 saatli ardışık sefer istendiğinde başarıyla oluşturulduğu canlı ortamda doğrulanmıştır.
3. **Snapshot İzolasyonu:** Sefer oluşturulduğu anda o anki araç sahibi ve otobüs verileri dondurulmakta, araç devredilse de eski sefer maliyetleri bozulmamaktadır.
4. **Eşzamanlılık Kilitlemesi:** PostgreSQL `SELECT ... FOR UPDATE` ile aynı otobüse, sefere ve ödemelere yapılan eşzamanlı istekler sıraya dizilerek yarış durumları engellenmiştir.
5. **Raporlama Bütünlüğü:** Gösterge paneli, araç sahibi ve kafile detayında mali toplamlar filtrelenen tüm kayıtlar üzerinden dinamik hesaplanır.
6. **CSV Güvenliği ve İhracat:** Aktif filtreleri sunucuda uygulayan, yetki korumalı, UTF-8 BOM'lu ve CSV formula injection korumalı dışa aktarım canlı olarak çalışmaktadır.
7. **Production Server Derlemesi:** `.output/server/index.mjs` dağıtıma hazır durumdadır.

---

## checksRun (Çalıştırılan Kontroller ve Sonuçlar)
- **Birim Testleri (`npm test`):** 85/85 test başarılı (`tests/csv-export-ui.test.ts`, `tests/dashboard-reporting.test.ts`, `tests/trip-payments.test.ts`, `tests/trip-status-flow.test.ts`, `tests/trips-convoys.test.ts`, `tests/owners-buses.test.ts`, `tests/business-rules.test.ts`, `tests/auth-access.test.ts`).
- **Tip Kontrolü (`npm run typecheck`):** 0 hata.
- **Kod Denetimi (`npm run lint`):** 0 hata.
- **Üretim Derlemesi (`npm run build`):** Başarılı.
