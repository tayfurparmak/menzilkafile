# menzilkafile

Kafile Yönetim Sistemi - Nuxt 4, Prisma 6, Supabase PostgreSQL ve Tailwind CSS ile geliştirilmiş filo, kafile ve sefer yönetim platformu.

## Özellikler
- **Araç Sahibi ve Otobüs Yönetimi:** Plaka normalizasyonu, 41/46/54 koltuk kapasitesi kısıtı, aktif/pasif yönetimi.
- **Kafile ve Sefer Planlama:** Çakışma (overlap) koruması, ardışık sefer desteği, tarihsel snapshot dondurma.
- **Durum Geçişleri:** `PLANNED` &rarr; `ON_ROAD` &rarr; `COMPLETED` / `CANCELLED` güvenli durum akışı.
- **Finans ve Bakiye Takibi:** Sefer bazlı ödeme takibi, kalan borç hesaplaması, Decimal.js kuruş hassasiyeti, ödeme alt sınır koruması.
- **CSV Dışa Aktarma:** Excel uyumlu UTF-8 BOM, RFC 4180 kaçışları ve formül enjeksiyonu (CSV injection) koruması.
- **Operasyon Gösterge Paneli:** İstanbul saatine göre günlük seferler, yoldaki araçlar ve dönemsel mali özetler.
- **Güvenlik:** Supabase Auth, sunucu tarafı erişim kontrolü, Row Level Security (RLS).

## Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Otomatik testleri çalıştırın (85 test)
npm test

# Tip kontrolü
npm run typecheck

# Üretim derlemesi
npm run build
```
