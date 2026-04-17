import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function TeacherSettings() {
  const [form, setForm] = useState({
    name: '', subject: '', platformName: '',
    whatsappInstance: '', whatsappToken: '',
  });
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [showToken, setShowToken] = useState(false);

  useEffect(() => {
    api.get('/teacher/settings').then(r => {
      setForm({
        name:             r.data.name              || '',
        subject:          r.data.subject           || '',
        platformName:     r.data.platform_name     || '',
        whatsappInstance: r.data.whatsapp_instance || '',
        whatsappToken:    r.data.whatsapp_token    || '',
      });
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSuccess(''); setError('');
    setLoading(true);
    try {
      await api.put('/teacher/settings', form);
      setSuccess('✅ تم حفظ الإعدادات بنجاح');
      setTimeout(() => setSuccess(''), 3000);
    } catch {
      setError('حدث خطأ أثناء الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div>
      <h2 className="text-xl font-extrabold text-slate-800 mb-5">الإعدادات</h2>

      <form onSubmit={handleSave}>
        <div className="card mb-4">
          <h3 className="font-bold text-slate-700 mb-4">معلومات المنصة</h3>

          {success && <div className="alert alert-success mb-4">{success}</div>}
          {error   && <div className="alert alert-danger mb-4">{error}</div>}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المنصة</label>
              <input className="input" placeholder="منصة الامتحانات" value={form.platformName}
                onChange={e => set('platformName', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المادة</label>
              <input className="input" placeholder="مثال: الرياضيات" value={form.subject}
                onChange={e => set('subject', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">اسمك (يظهر للطلاب)</label>
              <input className="input" placeholder="اسم المدرس" value={form.name}
                onChange={e => set('name', e.target.value)} />
            </div>
          </div>

          <button type="submit" className="btn-primary mt-5" disabled={loading}>
            {loading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : '💾 حفظ الإعدادات'
            }
          </button>
        </div>

        {/* WhatsApp Settings */}
        <div className="card mb-4">
          <h3 className="font-bold text-slate-700 mb-1">📲 إعدادات واتساب</h3>
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-xs text-green-800 space-y-1">
            <p className="font-bold">🆓 مجاني — Green API (5000 رسالة/شهر)</p>
            <p>١. اشترك مجانًا على <a href="https://console.green-api.com" target="_blank" rel="noreferrer" className="underline font-semibold">console.green-api.com</a></p>
            <p>٢. أنشئ Instance جديد واسكن الـ QR بواتساب موبايلك</p>
            <p>٣. انسخ الـ <strong>idInstance</strong> والـ <strong>apiTokenInstance</strong> وحطهم هنا</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Instance ID</label>
              <input className="input" dir="ltr" placeholder="مثال: instance12345"
                value={form.whatsappInstance}
                onChange={e => set('whatsappInstance', e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">Token</label>
              <div className="relative">
                <input
                  className="input pl-10"
                  dir="ltr"
                  type={showToken ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={form.whatsappToken}
                  onChange={e => set('whatsappToken', e.target.value)}
                />
                <button type="button"
                  onClick={() => setShowToken(s => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">
                  {showToken ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Login credentials info */}
      <div className="card bg-amber-50 border-amber-200">
        <h3 className="font-bold text-amber-800 mb-2">🔐 بيانات دخول المدرس</h3>
        <p className="text-sm text-amber-700 mb-3">
          بيانات دخولك محددة في ملف <code className="bg-amber-100 px-1 rounded">.env</code> على السيرفر.
          لتغييرها عدّل المتغيرات وأعد تشغيل السيرفر، ثم نفذ:
        </p>
        <code className="block bg-amber-100 text-amber-900 text-xs p-3 rounded-lg font-mono">
          node db/seed.js
        </code>
      </div>
    </div>
  );
}
