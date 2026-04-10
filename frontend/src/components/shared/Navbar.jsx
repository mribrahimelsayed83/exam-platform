import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import NotificationBell from './NotificationBell';
import TeacherNotificationBell from './TeacherNotificationBell';

const GRADES = { 4:'رابع ابتدائي', 5:'خامس ابتدائي', 6:'سادس ابتدائي', 7:'أول إعدادي', 8:'ثاني إعدادي', 9:'ثالث إعدادي', 10:'أول ثانوي', 11:'ثاني ثانوي', 12:'ثالث ثانوي' };

export default function Navbar({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block"/>
          <span className="font-extrabold text-blue-600 text-base">
            {title || 'منصة الامتحانات'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {user?.grade && (
            <span className="badge badge-blue text-xs">{GRADES[user.grade]}</span>
          )}
          {user?.role === 'teacher' && (
            <span className="badge badge-amber text-xs">👨‍🏫 مدرس</span>
          )}
          {user?.role === 'assistant' && (
            <span className="badge badge-blue text-xs">🤝 مساعد</span>
          )}
          <span className="text-sm font-semibold text-slate-600 hidden sm:block">{user?.name}</span>
          {/* Bell only for students */}
          {user?.role === 'student' && <NotificationBell/>}
          {/* Bell for teacher and assistant */}
          {(user?.role === 'teacher' || user?.role === 'assistant') && <TeacherNotificationBell/>}
          <button onClick={handleLogout} className="btn-ghost btn-sm">خروج</button>
        </div>
      </div>
    </nav>
  );
}
