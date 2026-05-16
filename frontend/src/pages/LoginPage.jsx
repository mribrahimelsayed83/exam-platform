import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import SEO from '../components/SEO';

const ENDPOINTS = [
  '/auth/student/login',
  '/auth/teacher/login',
  '/auth/assistant/login',
];

export default function LoginPage() {
  const [form, setForm]   = useState({ username:'', password:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [platformName, setPlatformName] = useState('منصة الامتحانات');
  const { login } = useAuth();
  const navigate  = useNavigate();

  useEffect(() => {
    api.get('/auth/platform-name')
      .then(r => { if (r.data.platform_name) setPlatformName(r.data.platform_name); })
      .catch(() => {});
  }, []);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    for (const endpoint of ENDPOINTS) {
      try {
        const { data } = await api.post(endpoint, form);
        login(data.token, data.user);
        navigate(data.user.role === 'student' ? '/student' : '/teacher', { replace: true });
        return;
      } catch {
        // try next endpoint
      }
    }
    setError('اسم المستخدم أو كلمة المرور غير صحيحة');
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 via-blue-600 to-blue-400 p-4">
      <SEO
        title="تسجيل الدخول"
        description="سجّل دخولك إلى منصة مستر إبراهيم فاروق التعليمية — امتحانات إلكترونية وفيديوهات تعليمية."
        url="/login"
      />
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-lg">📚</div>
          <h1 className="text-2xl font-extrabold text-slate-800">{platformName}</h1>
          <p className="text-slate-500 text-sm mt-1">الامتحانات الإلكترونية التفاعلية</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="alert alert-danger">{error}</div>}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">اسم المستخدم</label>
            <input className="input" placeholder="اكتب اسم المستخدم"
              value={form.username} onChange={e=>set('username',e.target.value)} required />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">كلمة المرور</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} className="input pl-10" placeholder="••••••••"
                value={form.password} onChange={e=>set('password',e.target.value)} required />
              <button type="button" onClick={()=>setShowPass(v=>!v)}
                aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPass
                  ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                  : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                }
              </button>
            </div>
          </div>
          <button type="submit" className="btn-primary btn-lg btn-block mt-2" disabled={loading}>
            {loading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : 'دخول'
            }
          </button>
          <div className="flex items-center justify-between pt-1">
            <Link to="/forgot-password" className="text-xs text-blue-600 hover:underline">
              نسيت كلمة المرور؟
            </Link>
          </div>
          <div className="flex items-center gap-3 text-slate-400 text-sm">
            <div className="flex-1 h-px bg-slate-200"/>أو<div className="flex-1 h-px bg-slate-200"/>
          </div>
          <Link to="/register">
            <button type="button" className="btn-secondary btn-block">📝 إنشاء حساب جديد</button>
          </Link>
        </form>
      </div>
    </div>
  );
}
