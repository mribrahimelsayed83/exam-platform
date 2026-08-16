import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function TeacherHome() {
  const [stats, setStats]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/teacher/stats')
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h2 className="text-xl font-extrabold text-slate-800 mb-5">لوحة التحكم</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'امتحان',     val: stats?.exams,       color: 'text-blue-600' },
          { label: 'طالب',       val: stats?.students,    color: 'text-violet-600' },
          { label: 'إجابة',      val: stats?.submissions, color: 'text-slate-700' },
          { label: 'نسبة النجاح', val: `${stats?.passRate}%`, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="card-sm text-center">
            <div className={`text-3xl font-extrabold ${s.color}`}>{s.val ?? '—'}</div>
            <div className="text-xs text-slate-500 font-semibold mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const Spinner = () => (
  <div className="flex justify-center py-20">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);
