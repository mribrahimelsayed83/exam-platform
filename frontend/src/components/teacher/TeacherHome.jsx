import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

export default function TeacherHome() {
  const [stats, setStats]   = useState(null);
  const [exams, setExams]   = useState([]);
  const [subs, setSubs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/teacher/stats'),
      api.get('/exams/all'),
      api.get('/submissions'),
    ]).then(([s, e, sub]) => {
      setStats(s.data);
      setExams(e.data.slice(0, 5));
      setSubs(sub.data.slice(0, 5));
    }).finally(() => setLoading(false));
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

      {/* Recent Exams */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700">📄 آخر الامتحانات</h3>
          <button onClick={() => navigate('/teacher/exams')} className="btn-primary btn-sm">
            + إنشاء
          </button>
        </div>
        {exams.length === 0
          ? <p className="text-sm text-slate-400 text-center py-4">لا توجد امتحانات بعد</p>
          : <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['العنوان','الصف','الأسئلة','الإجابات'].map(h =>
                      <th key={h} className="text-right text-xs font-bold text-slate-400 pb-2 px-1">{h}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {exams.map(e => (
                    <tr key={e.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 px-1 font-semibold text-slate-700">{e.title}</td>
                      <td className="py-2 px-1"><span className="badge badge-blue">{gradeLabel(e.grade)}</span></td>
                      <td className="py-2 px-1 text-slate-500">{e.question_count}</td>
                      <td className="py-2 px-1 text-slate-500">{e.submission_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Recent Submissions */}
      <div className="card">
        <h3 className="font-bold text-slate-700 mb-4">📊 آخر الإجابات</h3>
        {subs.length === 0
          ? <p className="text-sm text-slate-400 text-center py-4">لا توجد إجابات بعد</p>
          : <div className="space-y-2">
              {subs.map(s => {
                const pass = s.score >= s.pass_score;
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <span className="font-semibold text-sm text-slate-700">{s.student_name}</span>
                      <span className="text-xs text-slate-400 mr-2">— {s.exam_title}</span>
                    </div>
                    <span className={`badge ${pass ? 'badge-green' : 'badge-red'}`}>{s.score}%</span>
                  </div>
                );
              })}
            </div>
        }
      </div>
    </div>
  );
}

const gradeLabel = g => ({4:'رابع ابتدائي', 5:'خامس ابتدائي', 6:'سادس ابتدائي', 7:'أول إعدادي', 8:'ثاني إعدادي', 9:'ثالث إعدادي', 10:'أول ثانوي', 11:'ثاني ثانوي', 12:'ثالث ثانوي'}[g] || '—');
const Spinner = () => (
  <div className="flex justify-center py-20">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);
