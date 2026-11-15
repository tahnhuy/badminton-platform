import { describe, expect, it } from 'vitest';
import {
  canonicalVnpayQuery,
  formatVnpayDate,
  signVnpayParams,
  verifyVnpaySignature,
} from '../services/payments/vnpay-signature';

describe('VNPAY signature (PAY-01)', () => {
  const secret = 'test-secret';
  const payload = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: 'TEST',
    vnp_Amount: 10000000,
    vnp_TxnRef: 'TOPUP-1',
    vnp_OrderInfo: 'Nạp ví cầu lông',
    vnp_ReturnUrl: 'http://localhost:5173/payment/vnpay-return',
  };

  it('builds a sorted, encoded canonical query', () => {
    expect(canonicalVnpayQuery(payload)).toBe(
      'vnp_Amount=10000000&vnp_Command=pay&vnp_OrderInfo=N%E1%BA%A1p+v%C3%AD+c%E1%BA%A7u+l%C3%B4ng&vnp_ReturnUrl=http%3A%2F%2Flocalhost%3A5173%2Fpayment%2Fvnpay-return&vnp_TmnCode=TEST&vnp_TxnRef=TOPUP-1&vnp_Version=2.1.0',
    );
  });

  it('signs and verifies, and rejects tampering', () => {
    const hash = signVnpayParams(payload, secret);
    expect(verifyVnpaySignature({ ...payload, vnp_SecureHash: hash }, secret)).toBe(true);
    expect(verifyVnpaySignature({ ...payload, vnp_Amount: 1, vnp_SecureHash: hash }, secret)).toBe(false);
    expect(verifyVnpaySignature({ ...payload, vnp_SecureHash: '' }, secret)).toBe(false);
  });

  it('formats VNPAY dates in GMT+7', () => {
    expect(formatVnpayDate(new Date('2026-11-15T17:00:00.000Z'))).toBe('20261116000000');
  });
});
