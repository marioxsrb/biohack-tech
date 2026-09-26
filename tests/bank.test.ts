import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBankDetails, getOrderWebhook, isValidIban } from '@/config/bank'

afterEach(() => vi.unstubAllEnvs())

describe('isValidIban', () => {
  it('accepts valid IBANs (ISO 13616 example values)', () => {
    expect(isValidIban('RO49AAAA1B31007593840000')).toBe(true)
    expect(isValidIban('RO49 AAAA 1B31 0075 9384 0000')).toBe(true)
    expect(isValidIban('GB82WEST12345698765432')).toBe(true)
  })
  it('rejects a wrong checksum or a Romanian IBAN of the wrong length', () => {
    expect(isValidIban('RO49AAAA1B31007593840001')).toBe(false)
    expect(isValidIban('RO49AAAA1B3100759384000')).toBe(false)
  })
})

describe('bank transfer configuration', () => {
  it('is off unless every required value is set', () => {
    vi.stubEnv('BANK_IBAN', 'RO49AAAA1B31007593840000')
    vi.stubEnv('BANK_NAME', '')
    vi.stubEnv('BANK_BENEFICIARY', 'Exemplu SRL')
    expect(getBankDetails()).toBeNull()
  })
  it('is off when the IBAN is invalid', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('BANK_IBAN', 'RO00AAAA1B31007593840000')
    vi.stubEnv('BANK_NAME', 'Banca Exemplu')
    vi.stubEnv('BANK_BENEFICIARY', 'Exemplu SRL')
    expect(getBankDetails()).toBeNull()
  })
  it('formats the IBAN in groups of four', () => {
    vi.stubEnv('BANK_IBAN', 'RO49AAAA1B31007593840000')
    vi.stubEnv('BANK_NAME', 'Banca Exemplu')
    vi.stubEnv('BANK_BENEFICIARY', 'Exemplu SRL')
    expect(getBankDetails()).toEqual({ iban: 'RO49 AAAA 1B31 0075 9384 0000', bank: 'Banca Exemplu', beneficiary: 'Exemplu SRL', swift: undefined })
  })
  it('needs an http(s) webhook for orders', () => {
    vi.stubEnv('ORDER_WEBHOOK_URL', 'ftp://x')
    expect(getOrderWebhook()).toBeNull()
    vi.stubEnv('ORDER_WEBHOOK_URL', 'https://hooks.example.com/orders')
    expect(getOrderWebhook()).toEqual({ url: 'https://hooks.example.com/orders', secret: undefined })
  })
})
