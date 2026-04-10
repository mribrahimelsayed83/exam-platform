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
              <input type="password" className="input" placeholder="6+ حروف" value={form.password}
                onChange={e=>set('password',e.target.value)} required/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">تأكيد كلمة المرور *</label>
              <input type="password" className="input" placeholder="أعد الكتابة" value={form.confirm}
                onChange={e=>set('confirm',e.target.value)} required/>
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
