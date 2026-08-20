import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export default function TeacherSettings() {
  const { user } = useAuth();
  const isTeacher = user?.role === 'teacher';
  const [form, setForm] = useState({ name: '', subject: '', platformName: '' });
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isTeacher) return;
    api.get('/teacher/settings').then(r => {
      setForm({
        name:         r.data.name         || '',
        subject:      r.data.subject      || '',
        platformName: r.data.platform_name|| '',
      });
    });
  }, [isTeacher]);

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

      {isTeacher && (
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
        </form>
      )}

      {isTeacher && <BackupCard />}
      <ChangePasswordCard />
    </div>
  );
}

// ── On-demand database backup (teacher-only) ────────────────────────────────
function BackupCard() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');

  const handleBackup = async () => {
    setSuccess(''); setError(''); setLoading(true);
    try {
      await api.post('/teacher/backup-now');
      setSuccess('✅ تم إرسال نسخة احتياطية كاملة على البريد الإلكتروني');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError(err.response?.data?.message || 'تعذّر إنشاء النسخة الاحتياطية');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card mb-4">
      <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">💾 نسخة احتياطية</h3>
      <p className="text-xs text-slate-400 mb-4">
        بيانات المنصة (الطلاب، الامتحانات، الإجابات، المدفوعات) بتتنسخ احتياطيًا تلقائيًا كل يوم وتتبعت على البريد الإلكتروني.
        تقدر كمان تطلب نسخة فورية دلوقتي، مثلاً قبل ما تعمل تعديل كبير.
      </p>
      {success && <div className="alert alert-success mb-3">{success}</div>}
      {error   && <div className="alert alert-danger mb-3">{error}</div>}
      <button onClick={handleBackup} className="btn-secondary" disabled={loading}>
        {loading
          ? <span className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
          : '📥 إنشاء نسخة احتياطية الآن'
        }
      </button>
    </div>
  );
}

// ── Change Password (self-service, teacher or assistant) ───────────────────
function ChangePasswordCard() {
  const [form, setForm]       = useState({ oldPassword: '', newPassword: '', confirm: '' });
  const [show, setShow]       = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess(''); setError('');
    if (form.newPassword !== form.confirm) return setError('كلمتا المرور الجديدتان غير متطابقتين');
    setLoading(true);
    try {
      await api.post('/auth/change-password-staff', {
        oldPassword: form.oldPassword,
        newPassword: form.newPassword,
      });
      setSuccess('✅ تم تغيير كلمة المرور بنجاح');
      setForm({ oldPassword: '', newPassword: '', confirm: '' });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">🔐 تغيير كلمة المرور</h3>
      <p className="text-xs text-slate-400 mb-4">لأمان حسابك، اختر كلمة مرور قوية ولا تشاركها مع أحد</p>

      {success && <div className="alert alert-success mb-4">{success}</div>}
      {error   && <div className="alert alert-danger mb-4">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">كلمة المرور الحالية</label>
          <input type={show ? 'text' : 'password'} className="input" dir="ltr" autoComplete="current-password"
            value={form.oldPassword} onChange={e => set('oldPassword', e.target.value)} required/>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">كلمة المرور الجديدة</label>
          <input type={show ? 'text' : 'password'} className="input" dir="ltr" autoComplete="new-password"
            placeholder="6 أحرف على الأقل"
            value={form.newPassword} onChange={e => set('newPassword', e.target.value)} required/>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1.5">تأكيد كلمة المرور الجديدة</label>
          <input type={show ? 'text' : 'password'} className="input" dir="ltr" autoComplete="new-password"
            value={form.confirm} onChange={e => set('confirm', e.target.value)} required/>
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
          <input type="checkbox" className="accent-blue-600 w-4 h-4" checked={show} onChange={e => setShow(e.target.checked)}/>
          <span className="text-xs font-semibold text-slate-500">إظهار كلمات المرور</span>
        </label>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading
            ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            : 'تغيير كلمة المرور'
          }
        </button>
      </form>
    </div>
  );
}
