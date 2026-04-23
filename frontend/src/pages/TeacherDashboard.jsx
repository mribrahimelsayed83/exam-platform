import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import Navbar          from '../components/shared/Navbar';
import TeacherHome     from '../components/teacher/TeacherHome';
import ExamsList       from '../components/teacher/ExamsList';
import SubmissionsList from '../components/teacher/SubmissionsList';
import StudentsList    from '../components/teacher/StudentsList';
import AssistantsList  from '../components/teacher/AssistantsList';
import TeacherSettings from '../components/teacher/TeacherSettings';
import VideosList            from '../components/teacher/VideosList';
import NotificationsSender from '../components/teacher/NotificationsSender';
import LandingEditor       from '../components/teacher/LandingEditor';
import TeacherChat         from '../components/teacher/TeacherChat';

// ── Combined Settings + Landing page ─────────────────────────────────────
function CombinedSettings() {
  const [tab, setTab] = useState('settings');
  return (
    <div>
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5 w-fit">
        {[
          { k:'settings', label:'⚙️ إعدادات المنصة' },
          { k:'landing',  label:'🌐 الصفحة الرئيسية' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className={`px-4 py-2 text-sm font-bold rounded-lg transition-all
              ${tab === t.k ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'settings' && <TeacherSettings />}
      {tab === 'landing'  && <LandingEditor />}
    </div>
  );
}

// ── Teacher Dashboard ─────────────────────────────────────────────────────
export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isTeacher = user?.role === 'teacher';

  const activePath = location.pathname.replace('/teacher/', '').replace('/teacher', '') || '';

  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    const endpoint = user?.role === 'assistant'
      ? '/chat/assistant/unread-count'
      : '/chat/teacher/unread-count';
    const load = async () => {
      try { const { data } = await api.get(endpoint); setChatUnread(data.count); } catch {}
    };
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [user?.role]);

  const allNavItems = [
    { path:'',            label:'الرئيسية',    icon:'🏠',  teacherOnly: false },
    { path:'exams',       label:'الامتحانات',   icon:'📄',  teacherOnly: false },
    { path:'submissions', label:'الإجابات',     icon:'📊',  teacherOnly: false },
    { path:'students',    label:'الطلاب',       icon:'👥',  teacherOnly: false },
    { path:'videos',      label:'الفيديوهات',   icon:'🎬',  teacherOnly: false },
    { path:'chat',         label:'الرسائل',      icon:'💬',  teacherOnly: false },
    { path:'notifications', label:'الإشعارات',  icon:'🔔',  teacherOnly: false },
    { path:'assistants',  label:'المساعدون',    icon:'🤝',  teacherOnly: true  },
    { path:'settings',    label:'الإعدادات',    icon:'⚙️',  teacherOnly: true  },
  ];

  const navItems = allNavItems.filter(item => !item.teacherOnly || isTeacher);
  const go = (path) => navigate(path ? `/teacher/${path}` : '/teacher');

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-5 items-start">

          {/* Desktop Sidebar */}
          <aside className="w-52 flex-shrink-0 hidden md:block">
            <div className="card-sm">
              <div className="text-center pb-4 mb-3 border-b border-slate-100">
                <div className={`w-12 h-12 ${isTeacher?'bg-amber-100':'bg-blue-100'} rounded-xl flex items-center justify-center text-2xl mx-auto mb-2`}>
                  {isTeacher?'👨‍🏫':'🤝'}
                </div>
                <div className="font-bold text-sm text-slate-700">{user?.name}</div>
                <div className="text-xs text-slate-400">{isTeacher?'مدرس':'مساعد'}</div>
              </div>
              <nav className="space-y-1">
                {navItems.map(item=>(
                  <button key={item.path} onClick={()=>go(item.path)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-right transition-all
                      ${activePath===item.path
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}>
                    <span>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.path==='chat' && chatUnread>0 && (
                      <span className="w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                        {chatUnread>9?'9+':chatUnread}
                      </span>
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main — extra bottom padding on mobile so content clears the fixed nav */}
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            <Routes>
              <Route index            element={<TeacherHome />} />
              <Route path="exams"     element={<ExamsList />} />
              <Route path="submissions" element={<SubmissionsList />} />
              <Route path="students"  element={<StudentsList />} />
              <Route path="videos"    element={<VideosList />} />
              <Route path="chat"         element={<TeacherChat />} />
              <Route path="notifications" element={<NotificationsSender />} />
              {isTeacher && <>
                <Route path="assistants" element={<AssistantsList />} />
                <Route path="settings"   element={<CombinedSettings />} />
              </>}
            </Routes>
          </main>
        </div>
      </div>

      {/* Mobile bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.08)] dark:bg-slate-800 dark:border-slate-700">
        <div className="flex">
          {navItems.map(item => (
            <button key={item.path} onClick={() => go(item.path)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-w-0 transition-colors
                ${activePath === item.path
                  ? 'text-blue-600 bg-blue-50 dark:bg-slate-700'
                  : 'text-slate-400 hover:text-slate-600 dark:text-slate-500'}`}>
              <span className="text-xl leading-none">{item.icon}</span>
              <span className="text-[10px] font-bold truncate w-full text-center px-0.5 leading-tight">
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
