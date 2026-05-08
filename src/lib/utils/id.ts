/**
 * Short, URL-safe, collision-resistant ids.
 *
 * `crypto.randomUUID` is preferred where available; the fallback keeps the
 * module usable in older Safari and in non-secure contexts (plain-http LAN
 * testing on a phone, which is exactly how you check a Live2D rig on mobile).
 */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function createId(prefix = ''): string {
  const cryptoObj = globalThis.crypto;
  let body: string;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    body = cryptoObj.randomUUID().replace(/-/g, '').slice(0, 12);
  } else if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = cryptoObj.getRandomValues(new Uint8Array(12));
    body = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  } else {
    body = Math.random().toString(36).slice(2, 14).padEnd(12, '0');
  }

  return prefix ? `${prefix}_${body}` : body;
}

/** Stable slug for persona names and model ids. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    // Strip combining diacritics left behind by NFKD decomposition.
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}
