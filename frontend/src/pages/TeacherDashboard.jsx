import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar          from '../components/shared/Navbar';
import TeacherHome     from '../components/teacher/TeacherHome';
import CreateExam      from '../components/teacher/CreateExam';
import ExamsList       from '../components/teacher/ExamsList';
import SubmissionsList from '../components/teacher/SubmissionsList';
import StudentsList    from '../components/teacher/StudentsList';
import AssistantsList  from '../components/teacher/AssistantsList';
import TeacherSettings from '../components/teacher/TeacherSettings';
import VideosList            from '../components/teacher/VideosList';
import NotificationsSender from '../components/teacher/NotificationsSender';
import LandingEditor       from '../components/teacher/LandingEditor';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isTeacher = user?.role === 'teacher';

  const activePath = location.pathname.replace('/teacher/', '').replace('/teacher', '') || '';

  const allNavItems = [
    { path:'',            label:'الرئيسية',    icon:'🏠',  teacherOnly: false },
    { path:'create',      label:'إنشاء امتحان', icon:'✏️',  teacherOnly: false },
    { path:'exams',       label:'الامتحانات',   icon:'📄',  teacherOnly: false },
    { path:'submissions', label:'الإجابات',     icon:'📊',  teacherOnly: false },
    { path:'students',    label:'الطلاب',       icon:'👥',  teacherOnly: false },
    { path:'videos',        label:'الفيديوهات',   icon:'🎬',  teacherOnly: false },
    { path:'notifications', label:'الإشعارات',    icon:'🔔',  teacherOnly: false },
    { path:'assistants',  label:'المساعدون',    icon:'🤝',  teacherOnly: false },
    { path:'landing',     label:'الصفحة الرئيسية', icon:'🌐', teacherOnly: true  },
    { path:'settings',    label:'الإعدادات',    icon:'⚙️',  teacherOnly: true  },
  ];

  const navItems = allNavItems.filter(item => !item.teacherOnly || isTeacher);

  const go = (path) => navigate(path ? `/teacher/${path}` : '/teacher');

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex gap-5 items-start">

          {/* Sidebar */}
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
                    <span>{item.icon}</span>{item.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Mobile nav */}
          <div className="md:hidden w-full mb-2">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {navItems.map(item=>(
                <button key={item.path} onClick={()=>go(item.path)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all
                    ${activePath===item.path?'bg-blue-600 text-white':'bg-white text-slate-500 border border-slate-200'}`}>
                  <span>{item.icon}</span>{item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Main */}
          <main className="flex-1 min-w-0">
            <Routes>
              <Route index           element={<TeacherHome />} />
              <Route path="create"   element={<CreateExam />} />
              <Route path="exams"    element={<ExamsList />} />
              <Route path="submissions" element={<SubmissionsList />} />
              <Route path="students" element={<StudentsList />} />
              <Route path="videos"        element={<VideosList />} />
              <Route path="notifications" element={<NotificationsSender />} />
              {isTeacher && <>
                <Route path="assistants" element={<AssistantsList />} />
                <Route path="settings"   element={<TeacherSettings />} />
                <Route path="landing"    element={<LandingEditor />} />
              </>}
            </Routes>
          </main>
        </div>
      </div>
    </div>
  );
}
