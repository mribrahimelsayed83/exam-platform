import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import TeacherNotificationBell from './TeacherNotificationBell';
import StudentChat from './StudentChat';
import SearchModal from './SearchModal';
import api from '../../utils/api';

const GRADES = {9:'ثالث إعدادي',10:'أول ثانوي',11:'ثاني ثانوي',12:'ثالث ثانوي'};

function ChangePasswordModal({ onClose }) {
  const [form, setForm]   = useState({ old: '', new: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.new !== form.confirm) return setError('كلمة المرور الجديدة غير متطابقة');
    if (form.new.length < 6)       return setError('كلمة المرور 6 حروف على الأقل');
    setSaving(true);
    try {
      await api.post('/auth/change-password', { oldPassword: form.old, newPassword: form.new });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في تغيير كلمة المرور');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-slate-800">🔑 تغيير كلمة المرور</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>
        {success ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-2">✅</div>
            <p className="font-bold text-emerald-600">تم تغيير كلمة المرور بنجاح</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور القديمة</label>
              <input type="password" className="input" placeholder="••••••"
                value={form.old} onChange={e => set('old', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور الجديدة</label>
              <input type="password" className="input" placeholder="6 حروف على الأقل"
                value={form.new} onChange={e => set('new', e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">تأكيد كلمة المرور الجديدة</label>
              <input type="password" className="input" placeholder="••••••"
                value={form.confirm} onChange={e => set('confirm', e.target.value)} required />
            </div>
            {error && <div className="alert alert-danger text-sm">{error}</div>}
            <button type="submit" disabled={saving} className="btn-primary btn-block">
              {saving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto"/>
                : 'حفظ'
              }
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function StudentProfileMenu({ user, navigate, onLogout }) {
  const [open, setOpen]             = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showChat, setShowChat]     = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/chat/unread-count');
        setChatUnread(data.count);
      } catch {}
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (path) => { navigate(path); setOpen(false); };

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(o => !o)}
          className="relative w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white text-base transition-colors"
          title={user?.name}>
          👤
          {chatUnread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {chatUnread > 9 ? '9+' : chatUnread}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute left-0 top-10 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden min-w-[190px] z-[999]" dir="rtl">
            <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs text-slate-400">مرحباً</p>
              <p className="text-sm font-bold text-slate-800 truncate">{user?.name}</p>
              {user?.grade && <p className="text-xs text-blue-600 mt-0.5">{GRADES[user.grade]}</p>}
              {user?.email && <p className="text-xs text-slate-400 mt-0.5 truncate">{user.email}</p>}
              {user?.created_at && (
                <p className="text-xs text-slate-400 mt-0.5">
                  انضم: {new Date(user.created_at).toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' })}
                </p>
              )}
            </div>
            <button onClick={() => { setShowChat(true); setOpen(false); }}
              className="w-full text-right px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2 justify-between">
              <span className="flex items-center gap-2">💬 اسأل المعلم</span>
              {chatUnread > 0 && (
                <span className="w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {chatUnread > 9 ? '9+' : chatUnread}
                </span>
              )}
            </button>
            <button onClick={() => go('/student/my-report')}
              className="w-full text-right px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
              📋 تقرير عني
            </button>
            <button onClick={() => go('/student/videos')}
              className="w-full text-right px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
              🎬 الفيديوهات
            </button>
            <button onClick={() => go('/student?tab=exams')}
              className="w-full text-right px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
              📝 امتحانات منفصلة
            </button>
            <button onClick={() => go('/student?tab=results')}
              className="w-full text-right px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
              📊 نتائجي
            </button>
            <div className="border-t border-slate-100"/>
            <button onClick={() => { setShowChangePw(true); setOpen(false); }}
              className="w-full text-right px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2">
              🔑 تغيير كلمة المرور
            </button>
            <div className="border-t border-slate-100"/>
            <button onClick={onLogout}
              className="w-full text-right px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">
              🚪 خروج
            </button>
          </div>
        )}
      </div>
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
      {showChat && (
        <StudentChat
          onClose={() => setShowChat(false)}
          onRead={() => setChatUnread(0)}
        />
      )}
    </>
  );
}

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);
  return [dark, setDark];
}

export default function Navbar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isStudentHome = location.pathname === '/student' && !location.search;
  const [dark, setDark] = useDarkMode();
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
    {showSearch && <SearchModal onClose={() => setShowSearch(false)} />}
    <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"/>
          <span className="font-extrabold text-blue-600 text-base">
            {title || user?.platform_name || 'منصة الامتحانات'}
          </span>
          {user?.role === 'student' && !isStudentHome && (
            <button
              onClick={() => navigate('/student')}
              className="text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
            >
              🏠 الصفحة الرئيسية
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {user?.role !== 'student' && user?.grade && (
            <span className="badge badge-blue text-xs">{GRADES[user.grade]}</span>
          )}
          {user?.role === 'teacher' && (
            <span className="badge badge-amber text-xs">👨‍🏫 مدرس</span>
          )}
          {user?.role === 'assistant' && (
            <span className="badge badge-blue text-xs">🤝 مساعد</span>
          )}
          {user?.role !== 'student' && (
            <span className="text-sm font-semibold text-slate-600 hidden sm:block">{user?.name}</span>
          )}
          {/* Search button */}
          {user && (
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-500 dark:text-slate-300 text-xs font-medium transition-colors"
              title="بحث (Ctrl+K)"
            >
              <span>🔍</span>
              <span className="hidden sm:inline">بحث</span>
              <kbd className="hidden sm:inline text-[10px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 px-1 rounded opacity-70">K</kbd>
            </button>
          )}
          {/* Dark mode toggle */}
          <button
            onClick={() => setDark(d => !d)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-lg"
            title={dark ? 'الوضع النهاري' : 'الوضع الليلي'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
          {/* Bell only for students */}
          {user?.role === 'student' && <NotificationBell/>}
          {/* Bell for teacher and assistant */}
          {(user?.role === 'teacher' || user?.role === 'assistant') && <TeacherNotificationBell/>}
          {/* Profile dropdown for students */}
          {user?.role === 'student'
            ? <StudentProfileMenu user={user} navigate={navigate} onLogout={handleLogout}/>
            : <button onClick={handleLogout} className="btn-ghost btn-sm">خروج</button>
          }
        </div>
      </div>
    </nav>
    </>
  );
}
