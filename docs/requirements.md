# Kafile Yönetim Sistemi - Gereksinim ve Kapsam Dokümanı

## 1. Proje Amacı ve Kapsamı
Bu uygulama, tek bir organizasyonun iç operasyonlarında kullanılmak üzere tasarlanmış, güvenli bir "Kafile ve Araç Yönetim Sistemi"dir.

### Temel Hedefler:
- Araç sahiplerini (şahıs veya firma) iletişim ve operasyonel notlarıyla kaydetmek.
- 41, 46 veya 54 kişilik otobüsleri benzersiz plaka ve araç sahibi atamasıyla kaydetmek.
- Otobüsleri kafilelere ve seferlere atamak.
- Her sefer için kalkış, varış, başlangıç/bitiş zamanı ve anlaşılan toplam ücreti girmek.
- Seferlerin operasyonel durumlarını (`PLANNED`, `ON_ROAD`, `COMPLETED`, `CANCELLED`) takip etmek.
- Araç sahiplerine yapılan ödemeleri (banka havalesi veya nakit) kuruşu kuruşuna izlemek ve kalan borcu dinamik görmek.

### Kapsam Dışı Bırakılan Özellikler:
- Canlı GPS takibi
- Koltuk rezervasyonu ve yolcu listesi
- Harita entegrasyonu
- SMS ve e-fatura entegrasyonu
- Müşteri tahsilatı
- Çok kiracılı (multi-tenant) SaaS mimarisi

---

## 2. Kullanıcı Akışları (User Workflows)

### Akış 1: Araç Sahibi ve Otobüs Kaydı
1. Yönetici sisteme giriş yapar.
2. "Araç Sahipleri" menüsünden kişi veya firma adını girerek yeni araç sahibi tanımlar.
3. "Otobüsler" menüsünden otobüsün plakasını (`35 ABC 123`), koltuk kapasitesini (41, 46 veya 54) ve araç sahibini seçerek kaydeder.
4. Plaka sunucuda normalize edilir (boşluklar temizlenir, Türkçe büyük harfe çevrilir) ve mükerrer kayıt engellenir.

### Akış 2: Kafile ve Sefer Oluşturma
1. Yönetici grup organizasyonu için bir "Kafile" tanımlar (örn. "Kasım Kafilesi").
2. "Yeni Sefer Oluştur" ekranından otobüsü seçer; o anki plaka, kapasite ve araç sahibi bilgileri ekranda snapshot olarak önizlenir.
3. Kalkış (örn. "İzmir"), varış (örn. "Konya"), başlangıç ve bitiş zamanı girilir.
4. Anlaşılan toplam sefer ücreti (örn. 18.000 TL) girilir.
5. Sunucu otobüsün belirtilen zaman aralığında çakışan başka bir aktif seferi olup olmadığını doğrular ve seferi `PLANNED` durumuyla kaydeder.

### Akış 3: Sefer Durum Takibi ve Ödeme Yönetimi
1. Sefer vakti geldiğinde durum `PLANNED` &rarr; `ON_ROAD` yapılır.
2. Sefer başladıktan sonra otobüs ve tarihsel araç sahibi değiştirilemez.
3. Sefer detayından araç sahibine ödeme eklenir (örn. 5.000 TL Garanti Bankası Havalesi).
4. Kalan borç anında `18.000 - 5.000 = 13.000 TL` olarak güncellenir ve ödeme durumu `Kısmi ödendi` rozetini alır.
5. Sefer tamamlandığında durum `COMPLETED` olarak işaretlenir.

---

## 3. Temel İş Kuralları

1. **Mükerrer Plaka Engelleme:**
   - Otobüs plakaları sunucuda baştaki, sondaki ve ardışık boşluklar temizlenerek ve Türkçe karakter kurallarına göre büyük harfe (`tr-TR`) çevrilerek normalize edilir (örn. `' 35  abc   123 '` &rarr; `'35 ABC 123'`).
   - Sistemde benzersizlik kontrolü bu normalize değer üzerinden yapılır; eşdeğer plakaların mükerrer kaydına izin verilmez.

2. **Kapasite Sınırlandırması:**
   - Otobüs koltuk kapasitesi yalnızca **41**, **46** veya **54** olabilir.
   - Bu sınır hem sunucu tarafında (Zod) hem de veritabanı `CHECK` kısıtıyla zorunlu tutulur.

3. **Çakışan Sefer Atamama (Concurrency-Safe Overlap):**
   - Aynı otobüse, zaman aralığı (`startsAt` - `endsAt`) çakışan ve iptal edilmemiş (`status != 'CANCELLED'`) iki sefer atanamaz.
   - Çakışma kontrolü eşzamanlı isteklerde de güvenli olmalıdır (veritabanı transaction ve kontrol sorgusuyla yarış durumları engellenir).

4. **Tarihsel Araç Sahibi ve Snapshot Güvencesi:**
   - Sefer oluşturulduğu an otobüsün sahibi `ownerId` olarak dondurulur; `plateSnapshot`, `capacitySnapshot` ve `ownerNameSnapshot` alanları sefere yazılır.
   - Otobüsün sahibi gelecekte değişse veya araç el değiştirse dahi, geçmiş seferlerin araç sahibi ve mali kayıtları kesinlikle değişmez.
   - Sefer başladıktan (`ON_ROAD`, `COMPLETED`) sonra otobüs ve tarihsel araç sahibi değiştirilemez.

5. **İlişkili Kayıtları Silmek Yerine Pasife Alma:**
   - Sistemde ilişkili kaydı (otobüs veya sefer) bulunan bir araç sahibi silinemez.
   - İlişkili sefer kaydı bulunan bir otobüs silinemez.
   - Bu kayıtlar silinmek yerine `isActive: false` yapılarak pasife alınır. Pasif araç veya pasif araç sahibiyle yeni sefer açılamaz.

6. **Ödemesi Olan Seferi İptal Etmeme:**
   - Seferler doğrudan silinemez; yalnızca iptal edilebilir (`CANCELLED`).
   - İçinde kayıtlı en az bir ödeme bulunan seferin iptal edilmesi ilk sürümde engellenir. Kullanıcıya "Bu sefere ait ödemeler bulunmaktadır. İptal etmeden önce ödemeleri silmeli veya düzenlemelisiniz" uyarısı gösterilir.
   - İptal edilmiş bir sefere yeni ödeme eklenemez.

7. **Fazla Ödeme Engelleme:**
   - Yapılan ödemeler toplamı, anlaşılan sefer ücretini aşamaz (`Mevcut Ödemeler + Yeni Ödeme <= Anlaşılan Ücret`).
   - Kalan tutardan büyük bir ödeme girişi işlem (transaction) düzeyinde engellenir.

8. **Sefer Ücretini Mevcut Ödemelerin Altına Düşürmeme:**
   - Bir seferin anlaşılan ücreti güncellenirken, yeni girilen tutar o güne kadar yapılmış ödemeler toplamından daha düşük olamaz.

9. **Para ve Saat Dilimi Standartları:**
   - Para birimi: **TRY (₺)**, sayı formatı: `tr-TR`.
   - JavaScript kayan noktalı sayı (`float`) aritmetiği yerine `Decimal` (`decimal.js` ve Prisma Decimal) kullanılır. API'de parasal değerler iki basamaklı string olarak taşınır.
   - Operasyon saat dilimi: **Europe/Istanbul**. Tarihler veritabanında UTC saklanır; arayüz ve gün başlangıcı/bitişi hesaplarında İstanbul yerel saati kullanılır.
