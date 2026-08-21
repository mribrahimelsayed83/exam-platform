import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { computePaymobHmac } from './paymobHmac.js';

const SECRET = 'test-hmac-secret';

const SAMPLE_TX = {
  amount_cents: 5000,
  created_at: '2026-01-01T10:00:00.000000',
  currency: 'EGP',
  error_occured: false,
  has_parent_transaction: false,
  id: 123456789,
  integration_id: 5623982,
  is_3d_secure: true,
  is_auth: false,
  is_capture: false,
  is_refunded: false,
  is_standalone_payment: true,
  is_voided: false,
  order: { id: 987654321 },
  owner: 111222,
  pending: false,
  source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
  success: true,
};

describe('computePaymobHmac', () => {
  it('produces a stable hash for a known transaction (regression lock)', () => {
    // Computed independently here from the documented field order, not
    // copied from the implementation — if this test needs to change, the
    // field order genuinely changed, not just "made it pass".
    const concat = [
      SAMPLE_TX.amount_cents, SAMPLE_TX.created_at, SAMPLE_TX.currency, SAMPLE_TX.error_occured,
      SAMPLE_TX.has_parent_transaction, SAMPLE_TX.id, SAMPLE_TX.integration_id,
      SAMPLE_TX.is_3d_secure, SAMPLE_TX.is_auth, SAMPLE_TX.is_capture, SAMPLE_TX.is_refunded,
      SAMPLE_TX.is_standalone_payment, SAMPLE_TX.is_voided,
      SAMPLE_TX.order.id, SAMPLE_TX.owner, SAMPLE_TX.pending,
      SAMPLE_TX.source_data.pan, SAMPLE_TX.source_data.sub_type, SAMPLE_TX.source_data.type,
      SAMPLE_TX.success,
    ].map(v => String(v ?? '')).join('');
    const expected = crypto.createHmac('sha512', SECRET).update(concat).digest('hex');

    expect(computePaymobHmac(SAMPLE_TX, SECRET)).toBe(expected);
  });

  it('changes if any single field changes (amount tampering would be caught)', () => {
    const original = computePaymobHmac(SAMPLE_TX, SECRET);
    const tampered  = computePaymobHmac({ ...SAMPLE_TX, amount_cents: 999999 }, SECRET);
    expect(tampered).not.toBe(original);
  });

  it('changes if the secret is wrong', () => {
    const withRightSecret = computePaymobHmac(SAMPLE_TX, SECRET);
    const withWrongSecret = computePaymobHmac(SAMPLE_TX, 'wrong-secret');
    expect(withWrongSecret).not.toBe(withRightSecret);
  });

  it('handles missing nested fields (order/source_data absent) without throwing', () => {
    const minimal = { amount_cents: 100, success: false };
    expect(() => computePaymobHmac(minimal, SECRET)).not.toThrow();
  });

  it('treats null/undefined fields as empty strings, not the literal "null"/"undefined"', () => {
    // obj.order?.id is undefined when order itself is absent — the map()
    // must coerce that to '' via ?? '', not "undefined" the string.
    const withOrder    = computePaymobHmac({ ...SAMPLE_TX, order: { id: '' } }, SECRET);
    const withoutOrder = computePaymobHmac({ ...SAMPLE_TX, order: undefined }, SECRET);
    expect(withOrder).toBe(withoutOrder);
  });
});
