import crypto from 'crypto';

export type VnpayParams = Record<string, string | number | undefined | null>;

const HASH_KEYS = new Set(['vnp_SecureHash', 'vnp_SecureHashType']);

export function encodeVnpayValue(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+').replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

export function canonicalVnpayQuery(params: VnpayParams): string {
  return Object.keys(params)
    .filter(key => !HASH_KEYS.has(key))
    .filter(key => params[key] !== undefined && params[key] !== null && String(params[key]) !== '')
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
    .map(key => `${encodeVnpayValue(key)}=${encodeVnpayValue(String(params[key]))}`)
    .join('&');
}

export function signVnpayParams(params: VnpayParams, secret: string): string {
  return crypto
    .createHmac('sha512', secret)
    .update(canonicalVnpayQuery(params), 'utf8')
    .digest('hex');
}

export function verifyVnpaySignature(params: VnpayParams, secret: string): boolean {
  const provided = String(params.vnp_SecureHash ?? '').trim().toLowerCase();
  if (!provided) return false;
  const expected = signVnpayParams(params, secret).toLowerCase();
  const left = Buffer.from(provided, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

/** VNPAY requires GMT+7 timestamps in yyyyMMddHHmmss. */
export function formatVnpayDate(date: Date): string {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return [
    shifted.getUTCFullYear(),
    pad(shifted.getUTCMonth() + 1),
    pad(shifted.getUTCDate()),
    pad(shifted.getUTCHours()),
    pad(shifted.getUTCMinutes()),
    pad(shifted.getUTCSeconds()),
  ].join('');
}
