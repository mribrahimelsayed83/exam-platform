const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.FROM_EMAIL   || 'onboarding@resend.dev';
const TO     = (process.env.BACKUP_EMAIL || '').split(',').map(e => e.trim()).filter(Boolean);

// Best-effort — called from crash/error handlers, so it must never throw
// and never block whatever cleanup/exit is happening around it.
async function alertAdmin(subject, detail) {
  if (!process.env.RESEND_API_KEY || TO.length === 0) return;
  try {
    await resend.emails.send({
      from: FROM,
      to:   TO,
      subject: `🚨 ${subject}`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px">
          <h2 style="color:#dc2626">🚨 تنبيه من السيرفر</h2>
          <p><strong>${subject}</strong></p>
          <pre style="background:#f1f5f9;padding:12px;border-radius:8px;font-size:12px;white-space:pre-wrap;direction:ltr;text-align:left">${String(detail || '').slice(0, 3000)}</pre>
          <p style="color:#666;font-size:12px">${new Date().toISOString()}</p>
        </div>
      `,
    });
  } catch {
    // Nothing more we can do if the alert itself fails to send.
  }
}

module.exports = { alertAdmin };
