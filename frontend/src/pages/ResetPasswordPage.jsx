import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

export default function ResetPasswordPage() {
  const [form, setForm]       = useState({ password:'', confirm:'' });
  const [token, setToken]     = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) setError('الرابط غير صالح');
    else setToken(t);
  }, []);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) return setError('كلمتا المرور غير متطابقتان');
    if (form.password.length < 6) return setError('كلمة المرور 6 حروف على الأقل');
    setLoading(true); setError('');
    try {
      const { data } = await api.post('/auth/reset-password', {
        token, password: form.password
      });
      setSuccess(data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch(err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 via-blue-600 to-blue-400 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔑</div>
          <h2 className="text-xl font-extrabold text-slate-800">تعيين كلمة مرور جديدة</h2>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="alert alert-success text-center">
              <div className="text-3xl mb-2">✅</div>
              <p className="font-bold">{success}</p>
              <p className="text-xs mt-1">جاري التحويل لصفحة الدخول...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="alert alert-danger">{error}</div>}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور الجديدة</label>
              <input type="password" className="input" placeholder="6 حروف على الأقل"
                value={form.password} onChange={e=>set('password',e.target.value)} required/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">تأكيد كلمة المرور</label>
              <input type="password" className="input" placeholder="أعد الكتابة"
                value={form.confirm} onChange={e=>set('confirm',e.target.value)} required/>
            </div>
            <button type="submit" className="btn-primary btn-block btn-lg"
              disabled={loading || !token}>
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : '💾 حفظ كلمة المرور'
              }
            </button>
            <Link to="/login" className="block text-center text-sm text-blue-600 hover:underline">
              رجوع للدخول
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
