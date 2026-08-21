const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.FROM_EMAIL || 'onboarding@resend.dev';

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendPasswordReset(toEmail, studentName, resetLink) {
  try {
    // The Resend SDK resolves with { data, error } instead of rejecting on
    // API-level failures (e.g. invalid key, unverified domain) — so a bare
    // await here would silently "succeed" even when nothing was sent.
    const result = await resend.emails.send({
      from: FROM,
      to:   toEmail,
      subject: 'إعادة تعيين كلمة المرور — منصة الفاروق',
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px">
          <h2 style="color:#2563eb">منصة الفاروق</h2>
          <p>مرحباً ${escHtml(studentName)}،</p>
          <p>تلقّينا طلباً لإعادة تعيين كلمة المرور الخاصة بك.</p>
          <p>اضغط على الزر التالي لإعادة التعيين:</p>
          <a href="${resetLink}"
            style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
            إعادة تعيين كلمة المرور
          </a>
          <p style="color:#666;font-size:13px">الرابط صالح لمدة <strong>30 دقيقة</strong> فقط.</p>
          <p style="color:#666;font-size:13px">لو لم تطلب إعادة التعيين، تجاهل هذا الإيميل.</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#999;font-size:12px">منصة الفاروق التعليمية</p>
        </div>
      `
    });
    if (result.error) {
      console.error('Email send error:', result.error.message || result.error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Email send error:', err.message);
    return false;
  }
}

module.exports = { sendPasswordReset };
