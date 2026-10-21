# Kafile Yönetim Sistemi - Kullanıcı Arayüzü Spesifikasyonu (UI Spec)

Bu doküman; uygulamanın tasarım sistemini, sayfa düzenlerini, form alanlarını, etkileşim kurallarını ve görsel standartlarını tanımlar.

---

## 1. Tasarım İlkeleri ve Görsel Standartlar

- **Genel Tema:** Sade, göz yormayan, son derece hızlı ve işlevsel bir kurumsal yönetim paneli.
- **Arka Plan:** Doğal açık tonlar (`bg-slate-50` / `#f8fafc`).
- **Ana Vurgu Rengi:** Kurumsal zümrüt yeşili (`#16a34a` / `emerald-600`).
- **Yazı Tipi:** Okunabilir modern sans-serif (`Segoe UI`, `Inter`, sistem fontları).
- **Para Formatı:** `tr-TR` standartlarında sembol sonda: örn. `18.000,00 ₺`.
- **Tarih Formatı:** `Europe/Istanbul` saat diliminde gün-ay-yıl ve saat: örn. `21 Eki 2026, 08:00`.
- **Durum Rozetleri (Badges):**
  - `PLANNED` (Planlandı): Mavi rozet (`bg-blue-50 text-blue-700 border-blue-200`)
  - `ON_ROAD` (Yolda): Canlı yeşil rozet (`bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse`)
  - `COMPLETED` (Tamamlandı): Gri rozet (`bg-slate-100 text-slate-700 border-slate-200`)
  - `CANCELLED` (İptal): Kırmızı rozet (`bg-rose-50 text-rose-700 border-rose-200`)
- **Ödeme Rozetleri:**
  - `Ödenmedi`: Açık kırmızı
  - `Kısmi ödendi`: Amber/turuncu
  - `Tamamı ödendi`: Zümrüt yeşili
  - `Ödeme gerekmiyor`: Nötr gri

---

## 2. Navigasyon ve Düzen Mimarisi

### Masaüstü Düzeni:
- Solda 240px genişliğinde sabit sidebar:
  - Üstte "Kafile Yönetimi" logosu ve yeşil ikon.
  - Menü Linkleri: Gösterge Paneli (`/`), Seferler (`/trips`), Araç Sahipleri (`/owners`), Otobüsler (`/buses`), Kafileler (`/convoys`).
  - Altta aktif kullanıcı profil kartı ve "Çıkış Yap" butonu.
- Sağda geniş içerik alanı, üstte sayfa başlığı ve ana aksiyon butonu.

### Mobil Düzen:
- Üst bar: Logo ve hamburger menü butonu.
- Tıklandığında soldan açılan kayar çekmece (slide-over drawer) menü.
- Tablolar mobilde okunabilir bilgi kartlarına dönüşür; yatay kaydırma gereksinimi en aza indirilir.

---

## 3. Sayfalar ve Form Detayları

### 1. Giriş Ekranı (`/login`)
- **Bileşenler:** E-posta girişi, parola girişi, "Giriş Yap" butonu.
- **Hata Yönetimi:** Hatalı giriş durumunda Türkçe açıklayıcı uyarı kutusu (`⚠️ E-posta adresi veya parola hatalı`).
- **Güvenlik:** Giriş sırasında buton `disabled` durumuna geçer ve çift tıklama engellenir.

### 2. Gösterge Paneli (`/`)
- **KPI Kartları:**
  - Aktif Otobüs Sayısı
  - Bugün Başlayan Sefer Sayısı (İstanbul saatiyle)
  - Yoldaki Sefer Sayısı
  - Seçilen Döneme Ait Toplam Sefer Ücreti
  - Aynı Seferlere Yapılmış Ödeme Toplamı
  - Kalan Borç Bakiyesi
- **Mali Dönem Filtresi:** Başlangıç ve bitiş tarihi seçicisi.
- **İki Kolonlu Liste:** Yaklaşan en yakın 5 sefer ve ödeme bekleyen borçlu seferler listesi.

### 3. Araç Sahipleri (`/owners` ve `/owners/[id]`)
- **Liste:** İsim, telefon, aktif otobüs sayısı, toplam sefer, hakediş, ödenen, kalan borç, aktiflik durumu.
- **Arama & Filtre:** Metin araması ve Aktif/Pasif filtresi.
- **Ekleme/Düzenleme Modalı:** Kişi/Firma adı (zorunlu, min 2 karakter), telefon, notlar.
- **Detay Sayfası:** Sahibe ait otobüsler listesi, tarihsel sefer geçmişi, mali toplamlar.

### 4. Otobüs Yönetimi (`/buses` ve `/buses/[id]`)
- **Liste:** Plaka, koltuk kapasitesi (41/46/54), araç sahibi, sefer sayısı, aktiflik.
- **Filtreler:** Plakaya göre arama, araç sahibi seçimi, kapasite seçimi (41, 46, 54), aktiflik filtresi.
- **Form Modalı:**
  - Plaka: Otomatik büyük harfe ve boşluksuz düzene çevrilir.
  - Kapasite: Yalnızca açılır kutudan 41, 46 veya 54 seçilebilir.
  - Araç Sahibi: Yalnızca aktif araç sahipleri listelenir.
- **Detay Sayfası:** Sefer geçmişi ve doğrudan "+ Bu Otobüse Yeni Sefer Oluştur" aksiyonu.

### 5. Kafile Yönetimi (`/convoys` ve `/convoys/[id]`)
- **Liste:** Kafile adı, otobüs sayısı, sefer sayısı, sefer bazlı toplam yolcu koltuk kapasitesi, toplam ücret, ödenen, kalan bakiye.
- **Detay Sayfası:** Kafileye atanmış tüm seferler, güzergâhlar ve mali özet.

### 6. Sefer Yönetimi (`/trips`, `/trips/new` ve `/trips/[id]`)
- **Liste (`/trips`):**
  - Tarih aralığı, plaka, araç sahibi, kafile, sefer durumu ve ödeme durumu filtreleri.
  - **CSV İndir Butonu:** Aktif filtrelere göre Excel uyumlu UTF-8 CSV çıktısı üretir.
- **Yeni Sefer (`/trips/new`):**
  - Otobüs seçimi yapıldığında ekranda anlık snapshot bilgisi (plaka, kapasite, araç sahibi) dondurularak önizlenir.
  - Kalkış ve varış yerleri, başlangıç ve bitiş zamanı.
  - Anlaşılan toplam sefer ücreti (koltuk başına değil, otobüs için toplam tutar).
- **Sefer Detayı (`/trips/[id]`):**
  - Güzergâh ve araç bilgileri, durum geçiş butonları.
  - Anlaşılan ücret (ücret düzenleme modalı).
  - Yapılan ödemeler tablosu (Ödeme ekleme/düzenleme modalı, silme onay modalı).
  - Dinamik kalan borç göstergesi.
