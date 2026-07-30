const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const pool    = require('../db/pool');
const auth    = require('../middleware/auth');

const PAYMOB_SECRET_KEY     = process.env.PAYMOB_API_KEY;        // egy_sk_test_...
const PAYMOB_PUBLIC_KEY     = process.env.PAYMOB_PUBLIC_KEY;     // egy_pk_test_...
const PAYMOB_INTEGRATION_ID = process.env.PAYMOB_INTEGRATION_ID;
const PAYMOB_HMAC_SECRET    = process.env.PAYMOB_HMAC_SECRET;
const BASE                  = 'https://accept.paymob.com';

// ── POST /api/payments/initiate ──────────────────────────────────────────────
router.post('/initiate', auth('student'), async (req, res) => {
  try {
    const { examId } = req.body;
    const student    = req.user;

    if (!PAYMOB_SECRET_KEY || !PAYMOB_PUBLIC_KEY || !PAYMOB_INTEGRATION_ID) {
      return res.status(503).json({ message: 'خدمة الدفع غير مُفعَّلة — تواصل مع المدرس' });
    }

    const { rows: [exam] } = await pool.query(
      'SELECT id, title, price FROM exams WHERE id=$1', [examId]
    );
    if (!exam)                          return res.status(404).json({ message: 'الامتحان غير موجود' });
    if (!exam.price || exam.price <= 0) return res.status(400).json({ message: 'هذا الامتحان مجاني' });

    const { rows: paid } = await pool.query(
      `SELECT id FROM payments WHERE exam_id=$1 AND student_id=$2 AND status='paid'`,
      [examId, student.id]
    );
    if (paid.length) return res.status(400).json({ message: 'دفعت هذا الامتحان بالفعل', alreadyPaid: true });

    const amountCents = exam.price * 100;
    const nameParts   = (student.name || 'Student').split(' ');

    // Paymob v2 — Intention API
    const intentRes = await fetch(`${BASE}/v1/intention/`, {
      method:  'POST',
      headers: {
        'Authorization': `Token ${PAYMOB_SECRET_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:          amountCents,
        currency:        'EGP',
        payment_methods: PAYMOB_INTEGRATION_ID.split(',').map(id => Number(id.trim())),
        items: [{
          name:        exam.title,
          amount:      amountCents,
          description: exam.title,
          quantity:    1,
        }],
        billing_data: {
          first_name:  nameParts[0]                || 'Student',
          last_name:   nameParts.slice(1).join(' ') || 'User',
          email:       student.email               || 'student@exam.com',
          phone_number: student.phone              || '+201000000000',
          apartment: 'NA', floor: 'NA', street: 'NA',
          building: 'NA',  city: 'Cairo', state: 'Cairo',
          country: 'EG',   postal_code: 'NA',
        },
      }),
    });

    const intention = await intentRes.json();
    if (!intentRes.ok)
      throw new Error(intention?.detail || intention?.message || `Paymob ${intentRes.status}`);

    const clientSecret = intention.client_secret;
    // Store the numeric PayMob order id (not the "pi_..." intention id) — the
    // transaction-processed webhook only reports back obj.order.id, and the
    // intention response carries that same numeric id as intention_order_id
    // (also mirrored in payment_keys[].order_id), not intention.order.id.
    const orderId      = intention.intention_order_id
                       || intention.payment_keys?.[0]?.order_id
                       || intention.id || '';

    // Save pending payment
    await pool.query(
      `INSERT INTO payments (student_id, exam_id, amount, paymob_order_id, status)
       VALUES ($1,$2,$3,$4,'pending')
       ON CONFLICT (student_id, exam_id)
       DO UPDATE SET paymob_order_id=$4, status='pending', created_at=NOW()`,
      [student.id, examId, exam.price, String(orderId)]
    );

    const iframeUrl = `${BASE}/unifiedcheckout/?publicKey=${PAYMOB_PUBLIC_KEY}&clientSecret=${clientSecret}`;
    res.json({ iframeUrl, orderId, amount: exam.price, title: exam.title });

  } catch (err) {
    console.error('PayMob initiate error:', err.message);
    res.status(500).json({ message: 'خطأ في بدء عملية الدفع: ' + err.message });
  }
});

// ── POST /api/payments/callback ──────────────────────────────────────────────
router.post('/callback', async (req, res) => {
  try {
    // PayMob's "transaction processed" webhook sends the transaction fields
    // nested under body.obj (body = { type: 'TRANSACTION', obj: {...} }),
    // and signs them with an HMAC delivered as a query param, not in the body.
    const obj     = req.body?.obj || {};
    const hmac    = req.query.hmac;
    const success = obj.success === true || obj.success === 'true';
    const orderId = String(obj.order?.id || '');
    const txId    = String(obj.id || '');

    // HMAC verification — always required; reject callback if secret not configured
    if (!PAYMOB_HMAC_SECRET) {
      console.error('PayMob callback rejected: PAYMOB_HMAC_SECRET not configured');
      return res.status(503).json({ message: 'payment verification not configured' });
    }
    if (!hmac) {
      console.warn('PayMob callback missing HMAC');
      return res.status(400).json({ message: 'invalid hmac' });
    }
    const concat = [
      obj.amount_cents, obj.created_at, obj.currency, obj.error_occured,
      obj.has_parent_transaction, obj.id, obj.integration_id,
      obj.is_3d_secure, obj.is_auth, obj.is_capture, obj.is_refunded,
      obj.is_standalone_payment, obj.is_voided,
      obj.order?.id, obj.owner, obj.pending,
      obj.source_data?.pan, obj.source_data?.sub_type, obj.source_data?.type,
      obj.success,
    ].map(v => String(v ?? '')).join('');

    const expected = crypto.createHmac('sha512', PAYMOB_HMAC_SECRET)
      .update(concat).digest('hex');

    if (hmac !== expected) {
      console.warn('PayMob HMAC mismatch');
      return res.status(400).json({ message: 'invalid hmac' });
    }

    if (success && orderId) {
      // Verify amount matches what we stored to prevent amount tampering
      const { rows: [stored] } = await pool.query(
        `SELECT amount FROM payments WHERE paymob_order_id=$1`, [orderId]
      );
      if (stored && obj.amount_cents && Number(obj.amount_cents) !== stored.amount * 100) {
        console.warn(`PayMob amount mismatch: got ${obj.amount_cents}, expected ${stored.amount * 100}`);
        return res.status(400).json({ message: 'amount mismatch' });
      }

      await pool.query(
        `UPDATE payments SET status='paid', paymob_transaction_id=$1, paid_at=NOW()
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
    const { rows: [exam] } = await pool.query('SELECT price FROM exams WHERE id=$1', [examId]);
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
