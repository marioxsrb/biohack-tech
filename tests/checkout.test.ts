import { describe, expect, it } from 'vitest'
import { emptyOrder, isValidCui, normalizeOrder, validateOrder, type OrderForm } from '@/lib/checkout'

const person: OrderForm = {
  ...emptyOrder,
  firstName: 'Ana',
  lastName: 'Popescu',
  email: 'ana@exemplu.ro',
  phone: '0722 123 456',
  address: 'Str. Lalelelor 10',
  city: 'Cluj-Napoca',
  county: 'Cluj',
  postalCode: '400001',
}
const both = { card: true, transfer: true }

describe('isValidCui', () => {
  it('accepts real fiscal codes, with or without RO', () => {
    expect(isValidCui('14399840')).toBe(true)
    expect(isValidCui('RO14399840')).toBe(true)
    expect(isValidCui('ro 14399840')).toBe(true)
  })
  it('rejects a wrong check digit, letters and bad lengths', () => {
    expect(isValidCui('14399841')).toBe(false)
    expect(isValidCui('RO1439984A')).toBe(false)
    expect(isValidCui('1')).toBe(false)
    expect(isValidCui('12345678901')).toBe(false)
  })
})

describe('validateOrder', () => {
  it('passes a complete individual order', () => {
    expect(validateOrder(person, true, both)).toEqual({})
  })
  it('requires terms, a first name, a real email, a phone and a 6-digit postal code', () => {
    const e = validateOrder({ ...person, firstName: '', email: 'ana@', phone: '123', postalCode: '4000' }, false, both)
    expect(Object.keys(e).sort()).toEqual(['acceptedTerms', 'email', 'firstName', 'phone', 'postalCode'])
  })
  it('requires company name and a valid CUI for companies, Reg. Com. stays optional', () => {
    expect(Object.keys(validateOrder({ ...person, buyerType: 'pj' }, true, both)).sort()).toEqual(['company', 'cui'])
    expect(validateOrder({ ...person, buyerType: 'pj', company: 'Exemplu SRL', cui: 'RO14399840' }, true, both)).toEqual({})
  })
  it('validates the delivery address only when it differs', () => {
    expect(Object.keys(validateOrder({ ...person, sameAddress: false }, true, both)).sort()).toEqual([
      'shipAddress',
      'shipCity',
      'shipCounty',
      'shipPostalCode',
    ])
  })
  it('rejects a payment method that is not configured', () => {
    expect(validateOrder({ ...person, paymentMethod: 'transfer' }, true, { card: true, transfer: false })).toHaveProperty('paymentMethod')
  })
})

describe('normalizeOrder', () => {
  it('trims, bounds and coerces untrusted input', () => {
    const o = normalizeOrder({ firstName: '  Ana   Maria ', email: 'ANA@EXEMPLU.RO', buyerType: 'hacker', paymentMethod: 'crypto', cui: 'ro 123', notes: 'x'.repeat(1000), extra: 1 })
    expect(o.firstName).toBe('Ana Maria')
    expect(o.marketingConsent).toBe(false)
    expect(o.email).toBe('ana@exemplu.ro')
    expect(o.buyerType).toBe('pf')
    expect(o.paymentMethod).toBe('card')
    expect(o.cui).toBe('RO123')
    expect(o.notes).toHaveLength(400)
    expect(o).not.toHaveProperty('extra')
  })
})
