# Kafile Yönetim Sistemi - Ölçülebilir Kabul Koşulları (Acceptance Criteria)

Bu doküman, sistemin tesliminde ve kabul testlerinde doğrulanması gereken somut, ölçülebilir ve otomatik testlerle kanıtlanabilir kabul koşullarını tanımlar.

---

## 1. Veri Doğrulama ve Bütünlük Kriterleri

### AC-01: Mükerrer Plaka Engelleme
- **Koşul:** Farklı boşluk veya harf biçiminde girilen eşdeğer plakalar normalize edilerek aynı kabul edilmelidir.
- **Beklenen Davranış:** `' 35  abc   123 '` girdisi `'35 ABC 123'` değerine dönüştürülmeli; sistemde bu plaka varken yeni bir `'35 abc 123'` eklenmek istendiğinde API `409 Conflict` hatası döndürmelidir.

### AC-02: Otobüs Kapasitesi Sınırlandırması
- **Koşul:** Otobüs koltuk kapasitesi yalnızca 41, 46 veya 54 olabilir.
- **Beklenen Davranış:** 41, 46 veya 54 dışındaki (örn. 30, 40, 50, -46) kayıt denemeleri hem Zod şemasında hem de veritabanı `check_bus_capacity` kısıtında reddedilmelidir (`400 Bad Request`).

### AC-03: Zaman Aralığı Çakışması Engeli (Trip Overlap)
- **Koşul:** Aynı otobüse, zaman aralığı kesişen ve iptal edilmemiş iki aktif sefer atanamaz.
- **Beklenen Davranış:** Bir otobüsün `10:00 - 18:00` aralığında seferi varken, `12:00 - 16:00` veya `08:00 - 12:00` aralığında aynı otobüse yeni sefer atanması `409 Conflict` ile engellenmelidir. İptal edilmiş (`CANCELLED`) seferler bu çakışma kontrolüne dahil edilmez.

### AC-04: Tarihsel Snapshot Koruması
- **Koşul:** Bir otobüsün sahibi güncellendiğinde, geçmişte yapılmış seferlerin kayıtları değişmemelidir.
- **Beklenen Davranış:** Mehmet Yılmaz'a ait otobüsle yapılan seferin ardından otobüsün sahibi Ahmet Kaya olarak değiştirilirse; eski seferin `ownerId`, `ownerNameSnapshot` ve mali kayıtları Mehmet Yılmaz üzerinde kalmaya devam etmelidir.

---

## 2. Finansal Hesaplama ve Güvenlik Kriterleri

### AC-05: Matematiksel Bakiye ve Kalan Tutar Doğrulaması
- **Koşul:** Kalan tutar = Anlaşılan Sefer Ücreti - Yapılan Ödemeler Toplamı.
- **Beklenen Davranış:** 18.000,00 TL anlaşılan ücrete sahip bir sefere 5.000,00 TL ödeme eklendiğinde, kalan borç bakiyesi her ekranda ve raporda tam **13.000,00 TL** görünmelidir.

### AC-06: Fazla Ödeme Engeli (Overpayment Prevention)
- **Koşul:** Bir sefere yapılan toplam ödeme, anlaşılan sefer ücretini aşamaz.
- **Beklenen Davranış:** Kalan borcu 13.000,00 TL olan bir sefere 13.000,01 TL veya daha yüksek ödeme girilmesi transaction düzeyinde `400 Bad Request` ile engellenmelidir.

### AC-07: Sefer Ücreti Alt Sınır Kuralı
- **Koşul:** Sefer ücreti, o ana kadar yapılmış ödemeler toplamının altına indirilemez.
- **Beklenen Davranış:** 5.000,00 TL ödemesi bulunan bir seferin anlaşılan ücreti 4.999,00 TL yapılmak istendiğinde sunucu işlemi reddetmeli ve açıklayıcı hata mesajı dönmelidir.

---

## 3. Durum Akışı ve İlişki Kriterleri

### AC-08: Sefer Durum Geçiş Akışı
- **Koşul:** Sefer durumları belirlenen iş akışına uymalıdır.
- **Beklenen Davranış:**
  - `PLANNED` &rarr; `ON_ROAD` (Geçerli)
  - `PLANNED` &rarr; `CANCELLED` (Geçerli)
  - `ON_ROAD` &rarr; `COMPLETED` (Geçerli)
  - `ON_ROAD` &rarr; `CANCELLED` (Geçerli)
  - `PLANNED` &rarr; `COMPLETED` (Geçersiz, doğrudan tamamlanamaz)
  - `COMPLETED` veya `CANCELLED` durumundan başka bir duruma geçiş yapılamaz (Nihai durumlar).

### AC-09: Ödemesi Olan Seferin İptal Edilememesi
- **Koşul:** İçinde ödeme hareketi bulunan bir sefer iptal edilemez.
- **Beklenen Davranış:** Ödeme kaydı olan bir sefer iptal edilmek istendiğinde sistem işlemi durdurmalı ve önce ödemelerin silinmesi/düzenlenmesi gerektiği bilgisini vermelidir.

### AC-10: İlişkili Kayıtların Silinmesi Yerine Pasife Alınması
- **Koşul:** Bağlı seferi veya aracı bulunan araç sahibi ya da bağlı seferi olan otobüs silinemez.
- **Beklenen Davranış:** Silme (`DELETE`) isteği `400 Bad Request` ile reddedilmeli; kayıtların `isActive: false` yapılarak pasife alınması zorunlu tutulmalıdır.

---

## 4. Güvenlik, Zaman Dilimi ve Raporlama Kriterleri

### AC-11: Kimliksiz ve Yetkisiz API Erişimi Engeli
- **Koşul:** Giriş yapmamış veya hesabı pasif olan kullanıcılar korumalı verilere erişemez.
- **Beklenen Davranış:**
  - Token içermeyen veya geçersiz token içeren istekler: `401 Unauthorized`.
  - AppUser tablosunda tanımlı olmayan veya `isActive: false` olan kullanıcılar: `403 Forbidden`.

### AC-12: İstanbul Saat Dilimi (Europe/Istanbul) Gün Sınırları
- **Koşul:** Sunucunun yerel saatine bakılmaksızın "bugün" ve tarih aralığı filtreleri `Europe/Istanbul` saat dilimini baz almalıdır.
- **Beklenen Davranış:** İstanbul saatiyle gün başlangıcı `00:00:00+03:00` ve gün bitişi `23:59:59.999+03:00` olarak hesaplanmalı; gece yarısı sınırındaki seferler doğru güne atanmalıdır.

### AC-13: Güvenli CSV Dışa Aktarma
- **Koşul:** İndirilen CSV raporu formül enjeksiyonuna (Formula Injection / CSV Injection) karşı korunmalıdır.
- **Beklenen Davranış:** Hücreler `=`, `+`, `-`, `@` gibi sembollerle başladığında otomatik olarak tek tırnakla kaçırılmalı; dosya Excel uyumlu `UTF-8 BOM` ile üretilmelidir.
