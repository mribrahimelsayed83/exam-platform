import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../utils/api';

export default function ForgotPasswordPage() {
  const [form, setForm]       = useState({ username:'', email:'' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', form);
      setSuccess(data.message);
    } catch(err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 via-blue-600 to-blue-400 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🔐</div>
          <h2 className="text-xl font-extrabold text-slate-800">نسيت كلمة المرور؟</h2>
          <p className="text-slate-500 text-sm mt-1">أدخل بياناتك وهنبعتلك رابط على بريدك</p>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="alert alert-success text-center">
              <div className="text-3xl mb-2">📧</div>
              <p className="font-bold">{success}</p>
              <p className="text-xs mt-1">تحقق من بريدك (وفولدر الـ Spam)</p>
            </div>
            <Link to="/login" className="btn-primary btn-block text-center block">
              رجوع للدخول
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="alert alert-danger">{error}</div>}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">اسم المستخدم *</label>
              <input className="input" placeholder="اسم المستخدم بتاعك"
                value={form.username} onChange={e=>set('username',e.target.value)} required/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">البريد الإلكتروني *</label>
              <input type="email" className="input" placeholder="example@gmail.com"
                value={form.email} onChange={e=>set('email',e.target.value)} required/>
            </div>
            <button type="submit" className="btn-primary btn-block btn-lg" disabled={loading}>
              {loading
                ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : '📧 إرسال رابط الاستعادة'
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
