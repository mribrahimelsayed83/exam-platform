const crypto = require('crypto');

// PayMob's HMAC covers a fixed, ordered list of fields from the transaction
// object — the order matters and is undocumented anywhere except PayMob's
// own reference implementation, so this is exactly the kind of thing that's
// easy to silently break by reordering/renaming during a refactor. Getting
// this wrong doesn't error — it just makes every payment confirmation fail
// with no obvious cause (this happened once already during initial setup).
function computePaymobHmac(obj, secret) {
  const concat = [
    obj.amount_cents, obj.created_at, obj.currency, obj.error_occured,
    obj.has_parent_transaction, obj.id, obj.integration_id,
    obj.is_3d_secure, obj.is_auth, obj.is_capture, obj.is_refunded,
    obj.is_standalone_payment, obj.is_voided,
    obj.order?.id, obj.owner, obj.pending,
    obj.source_data?.pan, obj.source_data?.sub_type, obj.source_data?.type,
    obj.success,
  ].map(v => String(v ?? '')).join('');

  return crypto.createHmac('sha512', secret).update(concat).digest('hex');
}

module.exports = { computePaymobHmac };
