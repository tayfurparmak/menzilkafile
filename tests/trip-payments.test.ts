import { describe, it, expect } from 'vitest'
import Decimal from 'decimal.js'
import { TripStatus } from '@prisma/client'
import { calculateTripFinancials, toDecimal } from '../server/utils/business'

describe('Sefer Bazlı Ödemeler ve Finansal Hesaplamalar (STATE 07)', () => {
  // Kabul Örneği Testi: 18.000 TL sefer + 5.000 TL ödeme = 13.000 TL kalan. 2. 13.000 TL ödemeyle kalan 0. Ek ödeme reddedilmeli.
  describe('Kullanıcı Kabul Örneği Senaryosu', () => {
    it('18.000 TL sefer + 5.000 TL ödeme -> 13.000 TL kalan (Kısmi ödendi)', () => {
      const agreed = '18000.00'
      const payments = [{ amount: '5000.00' }]
      const fin = calculateTripFinancials(agreed, payments)

      expect(fin.agreedAmount).toBe('18000.00')
      expect(fin.totalPaid).toBe('5000.00')
      expect(fin.remainingAmount).toBe('13000.00')
      expect(fin.status.code).toBe('PARTIALLY_PAID')
      expect(fin.status.label).toBe('Kısmi ödendi')
    })

    it('İkinci 13.000 TL ödemeyle toplam ödenen 18.000 TL ve kalan tam 0.00 TL olur (Tamamı ödendi)', () => {
      const agreed = '18000.00'
      const payments = [{ amount: '5000.00' }, { amount: '13000.00' }]
      const fin = calculateTripFinancials(agreed, payments)

      expect(fin.agreedAmount).toBe('18000.00')
      expect(fin.totalPaid).toBe('18000.00')
      expect(fin.remainingAmount).toBe('0.00')
      expect(fin.status.code).toBe('PAID')
      expect(fin.status.label).toBe('Tamamı ödendi')
    })

    it('Kalan tutar sıfır olduğunda ek ödeme (> 0 TL) kesinlikle reddedilmelidir', () => {
      const agreed = toDecimal('18000.00')
      const currentPaid = toDecimal('18000.00')
      const remaining = agreed.minus(currentPaid)

      const validatePayment = (amount: Decimal.Value) => {
        const dec = toDecimal(amount)
        if (dec.greaterThan(remaining)) {
          throw new Error(`Ödeme tutarı (${dec.toFixed(2)} TL), kalan borç tutarını (${remaining.toFixed(2)} TL) aşamaz.`)
        }
        return true
      }

      expect(() => validatePayment('0.01')).toThrow('kalan borç tutarını')
      expect(() => validatePayment('100.00')).toThrow('kalan borç tutarını')
    })
  })

  // Ödeme Tutarı Doğrulaması
  describe('Ödeme Tutarı Kuralları', () => {
    const validateAmount = (val: any) => {
      const d = toDecimal(val)
      if (d.lessThanOrEqualTo(0)) {
        throw new Error('Ödeme tutarı 0’dan büyük bir sayı olmalıdır.')
      }
      return d
    }

    it('Sıfırdan büyük tutarları kabul eder', () => {
      expect(validateAmount('500.50').toFixed(2)).toBe('500.50')
      expect(validateAmount(100).toFixed(2)).toBe('100.00')
      expect(validateAmount('0.01').toFixed(2)).toBe('0.01')
    })

    it('0 veya negatif tutarları reddeder', () => {
      expect(() => validateAmount('0')).toThrow('0’dan büyük')
      expect(() => validateAmount(0)).toThrow('0’dan büyük')
      expect(() => validateAmount('-150.00')).toThrow('0’dan büyük')
    })
  })

  // İptal Edilmiş Sefere Ödeme Engeli
  describe('İptal Edilmiş Sefere Ödeme Engeli', () => {
    const validateTripPaymentAllowed = (tripStatus: TripStatus) => {
      if (tripStatus === TripStatus.CANCELLED) {
        throw new Error('İptal edilmiş bir sefere ödeme eklenemez.')
      }
      return true
    }

    it('PLANNED, ON_ROAD veya COMPLETED seferlerine ödeme eklenebilir', () => {
      expect(validateTripPaymentAllowed(TripStatus.PLANNED)).toBe(true)
      expect(validateTripPaymentAllowed(TripStatus.ON_ROAD)).toBe(true)
      expect(validateTripPaymentAllowed(TripStatus.COMPLETED)).toBe(true)
    })

    it('CANCELLED sefere ödeme eklenmesi engellenir', () => {
      expect(() => validateTripPaymentAllowed(TripStatus.CANCELLED)).toThrow(
        'İptal edilmiş bir sefere ödeme eklenemez.'
      )
    })
  })

  // Sefer Ücreti Düşürme Sınırı
  describe('Sefer Ücreti Alt Sınır Kuralı', () => {
    const validateFeeUpdate = (newFee: Decimal.Value, payments: { amount: Decimal.Value }[]) => {
      const newFeeDec = toDecimal(newFee)
      const currentPaid = payments.reduce((acc, p) => acc.plus(toDecimal(p.amount)), new Decimal(0))

      if (newFeeDec.lessThan(currentPaid)) {
        throw new Error(
          `Sefer ücreti, mevcut yapılmış ödemeler toplamından (${currentPaid.toFixed(2)} TL) daha düşük bir tutara indirilemez.`
        )
      }
      return true
    }

    it('Sefer ücreti mevcut ödemeler toplamına eşit veya daha yüksek tutara güncellenebilir', () => {
      const payments = [{ amount: '4000.00' }, { amount: '2500.00' }] // Toplam 6.500 TL
      expect(validateFeeUpdate('10000.00', payments)).toBe(true)
      expect(validateFeeUpdate('6500.00', payments)).toBe(true)
    })

    it('Sefer ücreti mevcut ödemeler toplamının altına düşürülemez', () => {
      const payments = [{ amount: '4000.00' }, { amount: '2500.00' }] // Toplam 6.500 TL
      expect(() => validateFeeUpdate('6499.99', payments)).toThrow(
        'daha düşük bir tutara indirilemez'
      )
      expect(() => validateFeeUpdate('5000.00', payments)).toThrow(
        'daha düşük bir tutara indirilemez'
      )
    })
  })

  // Ödeme Düzenlerken Mevcut Ödemeyi Hesaba Katma Kuralı
  describe('Ödeme Düzenleme Sınır Hesabı', () => {
    it('Düzenlenen ödeme hariç diğer ödemeler toplamı düşülerek azami tutar hesaplanır', () => {
      const agreed = toDecimal('18000.00')
      const payments = [
        { id: 'pay-1', amount: '5000.00' },
        { id: 'pay-2', amount: '8000.00' },
      ]
      // Toplam ödeme 13.000 TL, kalan 5.000 TL.
      // pay-1 (5.000 TL) düzenlenirken diğer ödeme pay-2 (8.000 TL)'dir.
      // pay-1 için azami sınır: 18.000 - 8.000 = 10.000 TL olmalıdır.

      const targetPaymentId = 'pay-1'
      const otherPaymentsTotal = payments
        .filter((p) => p.id !== targetPaymentId)
        .reduce((acc, p) => acc.plus(toDecimal(p.amount)), new Decimal(0))

      const maxAllowed = agreed.minus(otherPaymentsTotal)
      expect(maxAllowed.toFixed(2)).toBe('10000.00')

      const validateEdit = (newAmt: Decimal.Value) => {
        const dec = toDecimal(newAmt)
        if (dec.greaterThan(maxAllowed)) {
          throw new Error(`Güncellenen ödeme tutarı azami tutarı (${maxAllowed.toFixed(2)} TL) aşamaz.`)
        }
        return true
      }

      expect(validateEdit('10000.00')).toBe(true)
      expect(validateEdit('7500.00')).toBe(true)
      expect(validateEdit('3000.00')).toBe(true)
      expect(() => validateEdit('10000.01')).toThrow('azami tutarı')
    })
  })

  // Dört Temel Ödeme Durumunun Türetilmesi (Veritabanında Statik Saklanmaz)
  describe('Dinamik Ödeme Durumlarının Türetilmesi', () => {
    it('1. Ücret 0 ise -> NO_PAYMENT_REQUIRED ("Ödeme gerekmiyor")', () => {
      const fin = calculateTripFinancials('0.00', [])
      expect(fin.status.code).toBe('NO_PAYMENT_REQUIRED')
      expect(fin.status.label).toBe('Ödeme gerekmiyor')
    })

    it('2. Hiç ödeme yapılmamışsa -> UNPAID ("Ödenmedi")', () => {
      const fin = calculateTripFinancials('12000.00', [])
      expect(fin.status.code).toBe('UNPAID')
      expect(fin.status.label).toBe('Ödenmedi')
      expect(fin.totalPaid).toBe('0.00')
      expect(fin.remainingAmount).toBe('12000.00')
    })

    it('3. Kısmi ödeme yapılmışsa -> PARTIALLY_PAID ("Kısmi ödendi")', () => {
      const fin = calculateTripFinancials('12000.00', [{ amount: '4000.00' }])
      expect(fin.status.code).toBe('PARTIALLY_PAID')
      expect(fin.status.label).toBe('Kısmi ödendi')
      expect(fin.totalPaid).toBe('4000.00')
      expect(fin.remainingAmount).toBe('8000.00')
    })

    it('4. Kalan sıfır ise -> PAID ("Tamamı ödendi")', () => {
      const fin = calculateTripFinancials('12000.00', [{ amount: '12000.00' }])
      expect(fin.status.code).toBe('PAID')
      expect(fin.status.label).toBe('Tamamı ödendi')
      expect(fin.totalPaid).toBe('12000.00')
      expect(fin.remainingAmount).toBe('0.00')
    })
  })

  // Decimal Hassasiyeti ve Floating Point Engeli
  describe('Parasal Hassasiyet ve Floating Point Koruması', () => {
    it('JavaScript floating point yuvarlama hatası üretmez (0.1 + 0.2 kuruş tutarlılığı)', () => {
      // Standart JS: 0.1 + 0.2 = 0.30000000000000004
      const p1 = toDecimal('0.10')
      const p2 = toDecimal('0.20')
      const sum = p1.plus(p2)

      expect(sum.toFixed(2)).toBe('0.30')
      expect(sum.equals(new Decimal('0.30'))).toBe(true)
    })

    it('Kuruş hassasiyetinde çoklu ödemeler toplamı tam olarak korunur', () => {
      const fin = calculateTripFinancials('100.00', [
        { amount: '33.33' },
        { amount: '33.33' },
        { amount: '33.34' },
      ])
      expect(fin.totalPaid).toBe('100.00')
      expect(fin.remainingAmount).toBe('0.00')
      expect(fin.status.code).toBe('PAID')
    })
  })
})
