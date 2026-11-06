/**
 * TBI Bank Fusion Pay (RO): the encryption of the `data` parameter, as in TBI's Cryptor.php.
 * AES-256-CTR; the key is the binary SHA-256 of the merchant's encryption key; a random 16-byte IV is put in
 * front of the ciphertext and the whole is Base64 (Base64(IV || ciphertext)). The same scheme is used both ways:
 * RegisterApplication's `data` we send and the `data` of TBI's status updates to our statusURL.
 * Server-only: the encryption key never reaches the browser.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-ctr'
const IV_BYTES = 16

const keyHash = (key: string) => createHash('sha256').update(key, 'utf8').digest()

export function tbiEncrypt(plain: string, key: string, iv: Buffer = randomBytes(IV_BYTES)): string {
  if (!key) throw new Error('tbi: encryption key missing')
  if (iv.length !== IV_BYTES) throw new Error('tbi: iv must be 16 bytes')
  const c = createCipheriv(ALGO, keyHash(key), iv)
  return Buffer.concat([iv, c.update(plain, 'utf8'), c.final()]).toString('base64')
}

export function tbiDecrypt(b64: string, key: string): string {
  if (!key) throw new Error('tbi: encryption key missing')
  const raw = Buffer.from(String(b64).trim(), 'base64')
  if (raw.length < IV_BYTES) throw new Error(`tbi: data length ${raw.length} is less than iv length ${IV_BYTES}`)
  const d = createDecipheriv(ALGO, keyHash(key), raw.subarray(0, IV_BYTES))
  return Buffer.concat([d.update(raw.subarray(IV_BYTES)), d.final()]).toString('utf8')
}

/** Decrypts and parses JSON; throws when the key is wrong (CTR gives garbage, not an error, so JSON is the check). */
export function tbiDecryptJson<T = unknown>(b64: string, key: string): T {
  const text = tbiDecrypt(b64, key)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('tbi: decrypted data is not JSON (wrong encryption key?)')
  }
}
