/**
 * TBI Fusion Pay encryption (lib/tbi/cryptor.ts). Always: round trip, IV prefix, wrong key, short data.
 * With TBI_TEST_ENCRYPTION_KEY (TBI's UAT test key from "API documentation - RO Fusion Pay", never in git):
 * also the documentation's RegisterApplication and status-update examples decrypt to their published JSON.
 */
import { describe, expect, it } from 'vitest'
import { tbiDecrypt, tbiDecryptJson, tbiEncrypt } from '@/lib/tbi/cryptor'

const TEST_KEY = 'unit-test-only-key'
const DOC_KEY = process.env.TBI_TEST_ENCRYPTION_KEY ?? ''
const DOC_REGISTER_DATA = 'UlMtiadUYAEjXinCjxARZxN1cyZ546kas3apZQ6qkE9est7cJJjk3n8qP6IQQHazGcx7y2R5zVzr0GQ9g2SEX3vY9h1OfKJIo1jsS8Q/b6kACPfbmQFiiR/lWuPSiNk2EHqlt/EBYafCynn4i8tSFL3uIz0DT3BJBN34DJ/fHp/n67tVyyFQ/i+dXog7G55g7AVuR7dromSDr7wmz/KMtOtz+fZ4VKjKtmIKnrQ84Qw9OfJwRGvEbGjG9eDPAP6zjyxs9L4shpdOq98+hv/I/DGEYZp1TrE0qe41icWmAw0yO1siQDgiX87661YFYQ+0oYfQhlwzIorf874rMYe1HuPc+Anw9swtoQp1qKtb1IUwrQD7WWK2qLsqDvWpOw/fze3QaKoh6j/e9RAzKDflMs/yO5t6XTpOz/kzSWBc3A68QrJu2kd9xNhivS6hqEV26vY9wtS2/U9h+aAp66l89VUZ5CkZOgAhy248bX/MhtDfuHWXy2m0/trpZ4uE6N73P9yAfRuNkYInMVknB6soj1HQyyiWo1bS0msExPnzovSiqxmjMVJRkiqj4AwDQaNpiWtIskeLpj4tQtYsJuQ0NbcS6mDlp7j8ereTbzGfCXVREQet5q+RVSvdbGJOW65hUvPn3kYTb/BObfwQeSNyg6vfNy98yTXG/EV6OjDFggl2DDFYzHMb+gkj7lhTyHgLISJEQqfTd+jRmLjO465XZMI+ex8R9Fx7MxMe3SwgUpjELUfBONpHsg2O4+a8+N4JxJfNFI5fOuACWDbafSDz3y0i5ZbWIOqvU01O7KeyT0PPDWiWMOqicLA3nhf5EN8EnCC9yTWuZOIHjDiJLAppd7steQZuqpSY'
const DOC_STATUS_DATA = 'PjNkxkVpNX5iXOR5lxYFqK5snsGQuczdOjzzahzUEnovwV4PKuKF3B+dr0JG5YhKW4DNj4O8j+VsFaoVUk0YHujAcKRppBdcS+d6sGT+4+d3UfTKm31isMOmxJTVaLkEkb2OOZUxTG2EsgVxzathTVepFw/jzWl2qPQY0KV74vyXc+T3E0vtxDmZz2gMyvq0PrTM'

describe.skipIf(!DOC_KEY)('TBI documentation vectors (TBI_TEST_ENCRYPTION_KEY)', () => {
it('decrypts the documentation RegisterApplication example to its JSON', () => {
  const j = tbiDecryptJson<{ orderid: string; items: { sku: string; category: string }[] }>(DOC_REGISTER_DATA, DOC_KEY)
  expect(j.orderid).toBe('1')
  expect(j.items.map((i) => i.sku)).toEqual(['DTZ1MCBBM', 'MK8E3HC/A'])
  expect(j.items[1].category).toBe('7')
})

it('decrypts the documentation status update (snake_case keys, numeric status)', () => {
  expect(tbiDecryptJson(DOC_STATUS_DATA, DOC_KEY)).toEqual({
    command: 'update_status',
    order_id: '2371998',
    status: 0,
    message: 'Comanda anulata TBI',
    motive: '',
    contract_id: '20266032281',
  })
})
})

it('round-trips with a random IV prefixed (Base64(IV || ciphertext)), like Cryptor.php', () => {
  const plain = JSON.stringify({ orderid: 'BTR-1', items: [{ name: 'NEUROS Calm', qty: 1, price: 3900 }] })
  const a = tbiEncrypt(plain, TEST_KEY)
  const b = tbiEncrypt(plain, TEST_KEY)
  expect(a).not.toBe(b)
  expect(Buffer.from(a, 'base64').length).toBe(16 + Buffer.byteLength(plain))
  expect(tbiDecrypt(a, TEST_KEY)).toBe(plain)
})

it('a fixed IV gives a fixed output and a wrong key never parses as JSON', () => {
  const iv = Buffer.alloc(16, 7)
  expect(tbiEncrypt('{"a":1}', TEST_KEY, iv)).toBe(tbiEncrypt('{"a":1}', TEST_KEY, iv))
  expect(() => tbiDecryptJson(tbiEncrypt('{"a":1}', TEST_KEY), 'not-the-key')).toThrow(/not JSON/)
  expect(() => tbiDecrypt('AAAA', TEST_KEY)).toThrow(/less than iv/)
})
