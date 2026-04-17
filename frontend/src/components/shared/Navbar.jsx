import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import TeacherNotificationBell from './TeacherNotificationBell';

const GRADES = { 4:'رابع ابتدائي', 5:'خامس ابتدائي', 6:'سادس ابتدائي', 7:'أول إعدادي', 8:'ثاني إعدادي', 9:'ثالث إعدادي', 10:'أول ثانوي', 11:'ثاني ثانوي', 12:'ثالث ثانوي' };

function StudentProfileMenu({ user, navigate, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (path) => { navigate(path); setOpen(false); };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-700 flex items-center justify-center text-white text-base transition-colors"
        title={user?.name}>
        👤
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
          <button onClick={onLogout}
            className="w-full text-right px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors flex items-center gap-2">
            🚪 خروج
          </button>
        </div>
      )}
    </div>
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

  const handleLogout = () => {
    const isStudent = user?.role === 'student';
    logout();
    navigate(isStudent ? '/' : '/login');
  };

  return (
    <nav className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm sticky top-0 z-50 transition-colors duration-200">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"/>
          <span className="font-extrabold text-blue-600 text-base">
            {title || 'منصة الامتحانات'}
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
  );
}
