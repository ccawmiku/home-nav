const encoder = new TextEncoder()
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(a)), crypto.subtle.digest('SHA-256', encoder.encode(b))])
  // Web Crypto verifies a fixed-length MAC without a JavaScript string comparison.
  const key = await crypto.subtle.importKey('raw', x, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  const signature = await crypto.subtle.sign('HMAC', key, y)
  return crypto.subtle.verify('HMAC', key, signature, x)
}
function b64(value: Uint8Array): string { return btoa(String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
function unb64(value: string): Uint8Array<ArrayBuffer> { return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)) }
async function key(secret: string) { return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']) }
export async function signSession(secret: string, epoch: string, now = Date.now()): Promise<string> {
  const payload = b64(encoder.encode(JSON.stringify({ exp: now + 30 * 86400000, epoch, nonce: crypto.randomUUID() })))
  return payload + '.' + b64(new Uint8Array(await crypto.subtle.sign('HMAC', await key(secret), encoder.encode(payload))))
}
export async function verifySession(token: string, secret: string, epoch: string, now = Date.now()): Promise<boolean> {
  try {
    const [payload, signature, extra] = token.split('.')
    if (!payload || !signature || extra || token.length > 2048) return false
    if (!await crypto.subtle.verify('HMAC', await key(secret), unb64(signature), encoder.encode(payload))) return false
    const value = JSON.parse(new TextDecoder().decode(unb64(payload)))
    return typeof value.exp === 'number' && value.exp > now && value.epoch === epoch
  } catch { return false }
}
export async function hashPassword(password: string, salt: string): Promise<string> {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return b64(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000 }, material, 256)))
}
