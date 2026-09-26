/**
 * Test-only prices, so every path (priced, unpriced, with variants) can be exercised.
 * They are fixtures, never shown to customers; the real values live in src/config/prices.ts.
 */
export const TEST_PRICES = {
  'balance-wave': null,
  'brainlink-pro': 249000,
  'ochelari-biohack': 19950,
}
