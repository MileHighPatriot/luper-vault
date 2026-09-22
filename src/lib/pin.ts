/**
 * Admin PIN helpers. The stored value is a short non-cryptographic digest so
 * the plain PIN does not sit in the localStorage snapshot. A four-digit PIN
 * cannot be made secure this way; it keeps parents' PIN out of casual view.
 * TODO(prod-auth): real hashing + server-side auth is a later ticket.
 */

/** Used when neither VITE_ADMIN_PIN nor a stored PIN exists. */
export const FALLBACK_ADMIN_PIN = '2580'

export const PIN_MIN_LENGTH = 4
export const PIN_MAX_LENGTH = 8

const PIN_SALT = 'luper-ledger:pin:v1:'

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_MIN_LENGTH},${PIN_MAX_LENGTH}}$`).test(pin)
}

/** FNV-1a (32-bit) over the salted PIN, hex encoded. */
export function hashPin(pin: string): string {
  const input = PIN_SALT + pin.trim()
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

export function pinMatches(pin: string, storedHash: string): boolean {
  return hashPin(pin) === storedHash
}
