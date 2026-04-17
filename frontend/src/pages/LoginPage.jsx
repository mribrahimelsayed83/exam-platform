import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const TABS = [
  { key:'student',   label:'👨‍🎓 طالب',    endpoint:'/auth/student/login'   },
  { key:'teacher',   label:'👨‍🏫 مدرس',    endpoint:'/auth/teacher/login'   },
  { key:'assistant', label:'🤝 مساعد',   endpoint:'/auth/assistant/login' },
];

export default function LoginPage() {
  const [tab, setTab]     = useState('student');
  const [form, setForm]   = useState({ username:'', password:'' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate  = useNavigate();

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    const endpoint = TABS.find(t=>t.key===tab).endpoint;
    try {
      const { data } = await api.post(endpoint, form);
      login(data.token, data.user);
      const role = data.user.role;
      navigate(role==='student' ? '/student/videos' : '/teacher', { replace:true });
    } catch(err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 via-blue-600 to-blue-400 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-7">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3">📚</div>
          <h1 className="text-xl font-extrabold text-slate-800">منصة الامتحانات</h1>
          <p className="text-slate-500 text-sm mt-1">الامتحانات الإلكترونية التفاعلية</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-slate-100 rounded-xl p-1 mb-6 gap-1">
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>{setTab(t.key);setError('');}}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all
                ${tab===t.key?'bg-white text-blue-600 shadow':'text-slate-500 hover:text-slate-700'}`}>
              {t.label}
            </button>
          ))}
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
            <input type="password" className="input" placeholder="••••••••"
              value={form.password} onChange={e=>set('password',e.target.value)} required />
          </div>
          <button type="submit" className="btn-primary btn-lg btn-block mt-2" disabled={loading}>
            {loading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : 'دخول'
            }
          </button>
          {tab==='student' && (
            <>
              <div className="flex items-center justify-between">
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
            </>
          )}
        </form>
      </div>
    </div>
  );
}
