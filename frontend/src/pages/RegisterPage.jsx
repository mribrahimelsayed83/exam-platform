import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../utils/api';

const GRADES = {4:'رابع ابتدائي',5:'خامس ابتدائي',6:'سادس ابتدائي',7:'أول إعدادي',8:'ثاني إعدادي',9:'ثالث إعدادي',10:'أول ثانوي',11:'ثاني ثانوي',12:'ثالث ثانوي'};

export default function RegisterPage() {
  const [form, setForm] = useState({
    first_name:'', last_name:'', username:'', email:'',
    grade:'', phone:'', parent_phone:'', password:'', confirm:''
  });
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass]       = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const navigate = useNavigate();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess('');
    if (form.password !== form.confirm) return setError('كلمتا المرور غير متطابقتان');
    setLoading(true);
    try {
      await api.post('/auth/register', {
        first_name:   form.first_name,
        last_name:    form.last_name,
        username:     form.username,
        email:        form.email,
        password:     form.password,
        grade:        Number(form.grade),
        phone:        form.phone,
        parent_phone: form.parent_phone,
      });
      setSuccess('✅ تم إرسال طلب التسجيل — في انتظار موافقة المدرس');
      setTimeout(() => navigate('/login'), 2500);
    } catch(err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-700 via-blue-600 to-blue-400 p-4 py-10">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-lg">
        <Link to="/login" className="text-blue-600 text-sm font-bold flex items-center gap-1 mb-5 hover:underline">
          ← رجوع للدخول
        </Link>
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">📝</div>
          <h2 className="text-xl font-extrabold text-slate-800">إنشاء حساب طالب</h2>
          <p className="text-slate-500 text-sm mt-1">الحساب يحتاج موافقة المدرس قبل التفعيل</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error   && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">الاسم الأول *</label>
              <input className="input" placeholder="أحمد" value={form.first_name}
                onChange={e=>set('first_name',e.target.value)} required/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">الاسم الأخير *</label>
              <input className="input" placeholder="محمد" value={form.last_name}
                onChange={e=>set('last_name',e.target.value)} required/>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">اسم المستخدم *</label>
            <input className="input" placeholder="بدون مسافات" value={form.username}
              onChange={e=>set('username',e.target.value)} required/>
            <p className="text-xs text-slate-400 mt-1">هيُستخدم للدخول — لا يمكن تغييره</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">البريد الإلكتروني *</label>
            <input type="email" className="input" placeholder="example@gmail.com" value={form.email}
              onChange={e=>set('email',e.target.value)} required/>
            <p className="text-xs text-slate-400 mt-1">يُستخدم لاستعادة كلمة المرور</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">الصف الدراسي *</label>
            <select className="input" value={form.grade} onChange={e=>set('grade',e.target.value)} required>
              <option value="">اختار الصف</option>
              {Object.entries(GRADES).map(([k,v])=>(
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Phone row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">تليفون الطالب *</label>
              <input className="input" placeholder="01xxxxxxxxx" value={form.phone}
                onChange={e=>set('phone',e.target.value.replace(/\D/g,'').slice(0,11))}
                pattern="01[0-9]{9}" maxLength={11} inputMode="numeric" required/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">تليفون ولي الأمر *</label>
              <input className="input" placeholder="01xxxxxxxxx" value={form.parent_phone}
                onChange={e=>set('parent_phone',e.target.value.replace(/\D/g,'').slice(0,11))}
                pattern="01[0-9]{9}" maxLength={11} inputMode="numeric" required/>
            </div>
          </div>

          {/* Password row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور *</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} className="input pl-10" placeholder="6+ حروف"
                  value={form.password} onChange={e=>set('password',e.target.value)} required/>
                <button type="button" onClick={()=>setShowPass(v=>!v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showPass
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">تأكيد كلمة المرور *</label>
              <div className="relative">
                <input type={showConfirm ? 'text' : 'password'} className="input pl-10" placeholder="أعد الكتابة"
                  value={form.confirm} onChange={e=>set('confirm',e.target.value)} required/>
                <button type="button" onClick={()=>setShowConfirm(v=>!v)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showConfirm
                    ? <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
            </div>
          </div>

          <button type="submit" className="btn-primary btn-lg btn-block" disabled={loading}>
            {loading
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : 'إرسال طلب التسجيل'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
