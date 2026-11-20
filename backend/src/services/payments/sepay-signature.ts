import crypto from 'crypto';

const SIGNED_FIELDS = [
  'order_amount',
  'merchant',
  'currency',
  'operation',
  'order_description',
  'order_invoice_number',
  'customer_id',
  'payment_method',
  'success_url',
  'error_url',
  'cancel_url',
] as const;

export type SepayFields = Record<string, string | number | undefined | null>;

export function signSepayFields(fields: SepayFields, secretKey: string): string {
  const signed = SIGNED_FIELDS
    .filter(field => {
      const value = fields[field];
      return value !== undefined && value !== null && String(value) !== '' && String(value) !== '0';
    })
    .map(field => `${field}=${String(fields[field])}`)
    .join(',');
  return crypto.createHmac('sha256', secretKey).update(signed, 'utf8').digest('base64');
}

export function timingSafeEqualText(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * SePay bank-webhook HMAC: sha256={HMAC_SHA256(secret, `${timestamp}.${rawBody}`)}.
 * Timestamp is Unix seconds; reject requests older than 5 minutes.
 */
export function verifySepayWebhookSignature(
  rawBody: string,
  signature: string | undefined,
  timestamp: string | undefined,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  if (!signature || !timestamp || !secret) return false;
  const timestampNumber = Number(timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  if (Math.abs(nowSeconds - timestampNumber) > 300) return false;
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex')}`;
  return timingSafeEqualText(signature, expected);
}

export function buildSepayQrUrl(input: {
  baseUrl: string;
  bankCode: string;
  accountNumber: string;
  amount: string | number;
  content: string;
}): string {
  const amount = Math.round(Number(input.amount));
  return `${input.baseUrl}?acc=${encodeURIComponent(input.accountNumber)}&bank=${encodeURIComponent(input.bankCode)}&amount=${amount}&des=${encodeURIComponent(input.content)}&template=compact`;
}
