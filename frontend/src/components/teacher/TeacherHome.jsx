import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

const STAT_CARDS = [
  { key:'exams',       label:'امتحان',      icon:'📄', iconBg:'bg-blue-100',    iconText:'text-blue-600' },
  { key:'students',    label:'طالب',        icon:'👥', iconBg:'bg-violet-100',  iconText:'text-violet-600' },
  { key:'submissions', label:'إجابة',       icon:'📊', iconBg:'bg-slate-200',   iconText:'text-slate-700' },
  { key:'passRate',    label:'نسبة النجاح', icon:'🏆', iconBg:'bg-emerald-100', iconText:'text-emerald-600', suffix:'%' },
];

const QUICK_ACTIONS = [
  { label:'امتحان جديد',  icon:'📝', path:'/teacher/exams',         color:'hover:border-blue-300 hover:text-blue-600' },
  { label:'إرسال إشعار',  icon:'🔔', path:'/teacher/notifications', color:'hover:border-amber-300 hover:text-amber-600' },
  { label:'إضافة فيديو',  icon:'🎬', path:'/teacher/videos',        color:'hover:border-violet-300 hover:text-violet-600' },
  { label:'عرض الطلاب',   icon:'👥', path:'/teacher/students',      color:'hover:border-emerald-300 hover:text-emerald-600' },
];

export default function TeacherHome() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/teacher/stats')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const today = new Date().toLocaleDateString('ar-EG', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  return (
    <div>
      {/* Greeting header */}
      <div className="mb-6">
        <h2 className="text-2xl font-extrabold text-slate-800">أهلاً بيك يا {user?.name || 'أستاذ'} 👋</h2>
        <p className="text-sm text-slate-400 mt-1">{today}</p>
      </div>

      {/* Pending approvals callout */}
      {stats?.pending > 0 && (
        <button onClick={() => navigate('/teacher/students')}
          className="w-full flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-right hover:bg-amber-100/70 transition-colors">
          <div className="w-11 h-11 rounded-xl bg-amber-100 flex items-center justify-center text-xl flex-shrink-0">⏳</div>
          <div className="flex-1">
            <p className="font-bold text-amber-800 text-sm">
              عندك {stats.pending} {stats.pending === 1 ? 'طالب في انتظار الموافقة' : 'طلاب في انتظار الموافقة'}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">اضغط للمراجعة والقبول أو الرفض</p>
          </div>
          <span className="text-amber-400 text-lg">←</span>
        </button>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {STAT_CARDS.map(s => (
          <div key={s.key} className="card-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className={`w-10 h-10 rounded-xl ${s.iconBg} flex items-center justify-center text-lg mb-3`}>
              {s.icon}
            </div>
            <div className={`text-3xl font-extrabold ${s.iconText}`}>
              {stats?.[s.key] ?? '—'}{s.suffix && stats?.[s.key] != null ? s.suffix : ''}
            </div>
            <div className="text-xs text-slate-500 font-semibold mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h3 className="text-sm font-bold text-slate-500 mb-3">إجراءات سريعة</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {QUICK_ACTIONS.map(a => (
            <button key={a.path} onClick={() => navigate(a.path)}
              className={`card-sm flex flex-col items-center justify-center gap-2 py-5 text-slate-600 border-2 border-transparent transition-all ${a.color}`}>
              <span className="text-2xl">{a.icon}</span>
              <span className="text-xs font-bold">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const Spinner = () => (
  <div className="flex justify-center py-20">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);
