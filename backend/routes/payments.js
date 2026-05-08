const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

const PAYMOB_API_KEY        = process.env.PAYMOB_API_KEY;
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;
const PAYMOB_IFRAME_ID      = process.env.PAYMOB_IFRAME_ID;
const PAYMOB_HMAC_SECRET    = process.env.PAYMOB_HMAC_SECRET;
const BASE                  = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com/api';
const IFRAME_BASE           = process.env.PAYMOB_IFRAME_BASE || 'https://accept.paymob.com/api';

// ── Helper: POST to PayMob ───────────────────────────────────────────────────
async function pm(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `PayMob ${res.status}`);
  return json;
}

// ── POST /api/payments/initiate ──────────────────────────────────────────────
// Student initiates payment → returns PayMob iframe URL
router.post('/initiate', auth('student'), async (req, res) => {
  try {
    const { examId } = req.body;
    const student    = req.user;

    if (!PAYMOB_API_KEY || !PAYMOB_INTEGRATION_ID || !PAYMOB_IFRAME_ID) {
      return res.status(503).json({ message: 'خدمة الدفع غير مُفعَّلة بعد — تواصل مع المدرس' });
    }

    // Fetch exam
    const { rows: [exam] } = await pool.query(
      'SELECT id, title, price FROM exams WHERE id=$1', [examId]
    );
    if (!exam)                         return res.status(404).json({ message: 'الامتحان غير موجود' });
    if (!exam.price || exam.price <= 0) return res.status(400).json({ message: 'هذا الامتحان مجاني' });

    // Already paid?
    const { rows: paid } = await pool.query(
      `SELECT id FROM payments WHERE exam_id=$1 AND student_id=$2 AND status='paid'`,
      [examId, student.id]
    );
    if (paid.length) return res.status(400).json({ message: 'دفعت هذا الامتحان بالفعل', alreadyPaid: true });

    const amountCents = exam.price * 100;

    // Step 1 — Auth token
    const { token: authToken } = await pm('/auth/tokens', { api_key: PAYMOB_API_KEY });

    // Step 2 — Register order
    const order = await pm('/ecommerce/orders', {
      auth_token:       authToken,
      delivery_needed:  false,
      amount_cents:     amountCents,
      currency:         'EGP',
      merchant_order_id: `exam_${examId}_stu_${student.id}_${Date.now()}`,
      items: [{ name: exam.title, amount_cents: amountCents, description: exam.title, quantity: 1 }],
    });

    // Upsert pending payment row
    await pool.query(
      `INSERT INTO payments (student_id, exam_id, amount, paymob_order_id, status)
       VALUES ($1,$2,$3,$4,'pending')
       ON CONFLICT (student_id, exam_id)
       DO UPDATE SET paymob_order_id=$4, status='pending', created_at=NOW()`,
      [student.id, examId, exam.price, String(order.id)]
    );

    // Step 3 — Payment key
    const nameParts = (student.name || 'Student').split(' ');
    const { token: paymentToken } = await pm('/acceptance/payment_keys', {
      auth_token:     authToken,
      amount_cents:   amountCents,
      expiration:     3600,
      order_id:       order.id,
      currency:       'EGP',
      integration_id: Number(PAYMOB_INTEGRATION_ID),
      billing_data: {
        first_name:      nameParts[0]           || 'Student',
        last_name:       nameParts.slice(1).join(' ') || 'User',
        email:           student.email          || 'student@exam.com',
        phone_number:    student.phone          || '+201000000000',
        apartment:       'NA', floor: 'NA', street: 'NA',
        building:        'NA', city: 'Cairo',  state: 'Cairo',
        country:         'EG', postal_code: 'NA',
        shipping_method: 'NA',
      },
    });

    const iframeUrl = `${IFRAME_BASE}/acceptance/iframes/${PAYMOB_IFRAME_ID}?payment_token=${paymentToken}`;
    res.json({ iframeUrl, orderId: order.id, amount: exam.price, title: exam.title });

  } catch (err) {
    console.error('PayMob initiate error:', err.message);
    res.status(500).json({ message: 'خطأ في بدء عملية الدفع: ' + err.message });
  }
});

// ── POST /api/payments/callback ──────────────────────────────────────────────
// PayMob webhook — called by PayMob servers when a transaction completes
router.post('/callback', async (req, res) => {
  try {
    const data = req.body;

    // Verify HMAC signature (if secret is set)
    if (PAYMOB_HMAC_SECRET && data.hmac) {
      const concat = [
        data.amount_cents, data.created_at, data.currency, data.error_occured,
        data.has_parent_transaction, data.id, data.integration_id,
        data.is_3d_secure, data.is_auth, data.is_capture, data.is_refunded,
        data.is_standalone_payment, data.is_voided,
        data.order?.id, data.owner, data.pending,
        data.source_data?.pan, data.source_data?.sub_type, data.source_data?.type,
        data.success,
      ].map(v => String(v ?? '')).join('');

      const expected = crypto.createHmac('sha512', PAYMOB_HMAC_SECRET)
        .update(concat).digest('hex');

      if (data.hmac !== expected) {
        console.warn('PayMob HMAC mismatch');
        return res.status(400).json({ message: 'invalid hmac' });
      }
    }

    const success  = data.success === true || data.success === 'true';
    const orderId  = String(data.order?.id || '');
    const txId     = String(data.id || '');

    if (success && orderId) {
      await pool.query(
        `UPDATE payments
         SET status='paid', paymob_transaction_id=$1, paid_at=NOW()
         WHERE paymob_order_id=$2`,
        [txId, orderId]
      );
    } else if (orderId) {
      await pool.query(
        `UPDATE payments SET status='failed' WHERE paymob_order_id=$1 AND status='pending'`,
        [orderId]
      );
    }

    res.json({ received: true });
  } catch (err) {
    console.error('PayMob callback error:', err.message);
    res.status(500).json({ message: 'error' });
  }
});

// ── GET /api/payments/check/:examId ─────────────────────────────────────────
// Student checks if they have access to a specific exam
router.get('/check/:examId', auth('student'), async (req, res) => {
  try {
    const { rows: [exam] } = await pool.query(
      'SELECT id, price FROM exams WHERE id=$1', [req.params.examId]
    );
    if (!exam) return res.status(404).json({ message: 'غير موجود' });

    if (!exam.price || exam.price <= 0) return res.json({ paid: true, free: true });

    const { rows: [payment] } = await pool.query(
      `SELECT id FROM payments WHERE exam_id=$1 AND student_id=$2 AND status='paid'`,
      [req.params.examId, req.user.id]
    );
    res.json({ paid: !!payment, free: false, price: exam.price });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── GET /api/payments/exam/:examId — teacher sees who paid ──────────────────
router.get('/exam/:examId', auth.staff, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.id, p.amount, p.status, p.paid_at, p.created_at,
              s.name AS student_name, s.grade, p.paymob_transaction_id
       FROM   payments p
       JOIN   students s ON s.id = p.student_id
       WHERE  p.exam_id = $1
       ORDER  BY p.created_at DESC`,
      [req.params.examId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

// ── POST /api/payments/mark-paid — teacher marks a student as paid manually ─
router.post('/mark-paid', auth.staff, async (req, res) => {
  try {
    const { studentId, examId } = req.body;
    const { rows: [exam] } = await pool.query(
      'SELECT price FROM exams WHERE id=$1', [examId]
    );
    if (!exam) return res.status(404).json({ message: 'الامتحان غير موجود' });

    await pool.query(
      `INSERT INTO payments (student_id, exam_id, amount, status, paid_at)
       VALUES ($1,$2,$3,'paid',NOW())
       ON CONFLICT (student_id, exam_id)
       DO UPDATE SET status='paid', paid_at=NOW()`,
      [studentId, examId, exam.price || 0]
    );
    res.json({ message: 'تم تفعيل الوصول يدوياً' });
  } catch (err) {
    res.status(500).json({ message: 'خطأ في السيرفر' });
  }
});

module.exports = router;
