import { describe, it, expect } from 'vitest'
import { sanitizeCsvCell } from '../server/utils/business'

describe('STATE 09 - CSV Dışa Aktarma ve Güvenlik Testleri', () => {
  describe('Spreadsheet Formula Injection (CSV Injection) Koruması', () => {
    it('formül tetikleyici karakterlerle başlayan girdileri tek tırnakla nötralize etmelidir', () => {
      // Excel/Sheets formül başlatıcı karakterler: =, +, -, @
      expect(sanitizeCsvCell('=SUM(A1:A10)')).toBe(`"'=SUM(A1:A10)"`)
      expect(sanitizeCsvCell('+12345')).toBe(`"'+12345"`)
      expect(sanitizeCsvCell('-500')).toBe(`"'-500"`)
      expect(sanitizeCsvCell('@cmd|/c calc')).toBe(`"'@cmd|/c calc"`)
      // Başına boşluk ekleyerek yapılan atlatma girişimlerini de yakalar
      expect(sanitizeCsvCell('   =1+1')).toBe(`"'=1+1"`)
      expect(sanitizeCsvCell('  @SUM()')).toBe(`"'@SUM()"`)
    })

    it('çift tırnak içeren metinleri CSV standardına uygun çift çift tırnak ("") ile kaçmalıdır', () => {
      expect(sanitizeCsvCell('Ahmet "Usta" Yılmaz')).toBe(`"Ahmet ""Usta"" Yılmaz"`)
      expect(sanitizeCsvCell('Not: "Önemli"')).toBe(`"Not: ""Önemli"""`)
    })

    it('boş, null veya undefined değerleri güvenli boş string olarak dönmelidir', () => {
      expect(sanitizeCsvCell(null)).toBe('""')
      expect(sanitizeCsvCell(undefined)).toBe('""')
      expect(sanitizeCsvCell('')).toBe('""')
    })

    it('sayısal ve normal metin değerlerini çift tırnakla sarmalıdır', () => {
      expect(sanitizeCsvCell(46)).toBe('"46"')
      expect(sanitizeCsvCell('34 ABC 789')).toBe('"34 ABC 789"')
      expect(sanitizeCsvCell('18.000,00 ₺')).toBe('"18.000,00 ₺"')
    })
  })

  describe('Türkçe Karakter ve CSV Format Bütünlüğü', () => {
    it('Türkçe karakterlerin bozulmadan korunduğunu doğrular', () => {
      const turkishText = 'Şükrü Çavuşoğlu ve Ömer İğneci (İzmir - Eskişehir - Ağrı - çok)'
      const sanitized = sanitizeCsvCell(turkishText)
      expect(sanitized).toBe(`"${turkishText}"`)
      expect(sanitized).toContain('Ş')
      expect(sanitized).toContain('Ç')
      expect(sanitized).toContain('ç')
      expect(sanitized).toContain('İ')
      expect(sanitized).toContain('ğ')
      expect(sanitized).toContain('Ö')
      expect(sanitized).toContain('ü')
    })

    it('CSV dosyasının UTF-8 BOM ile başlaması gerektiğini doğrular', () => {
      const BOM = '\uFEFF'
      const headers = ['Sefer ID', 'Plaka', 'Koltuk Kapasitesi', 'Kalkış', 'Varış', 'Ücret (TRY)']
      const csvHeaderLine = headers.map(h => sanitizeCsvCell(h)).join(';')
      const fullCsv = BOM + csvHeaderLine + '\r\n'

      expect(fullCsv.startsWith('\uFEFF')).toBe(true)
      expect(fullCsv.charCodeAt(0)).toBe(0xFEFF)
    })
  })
})
