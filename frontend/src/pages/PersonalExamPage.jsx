import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import api from '../utils/api';

export default function PersonalExamPage() {
  const [total,   setTotal]   = useState(0);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get('/personal-exam/questions'),
      api.get('/personal-exam/history'),
    ]).then(([q, h]) => {
      setTotal(q.data.total);
      setHistory(h.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const hasQuestions = total > 0;

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        <button onClick={() => navigate('/student')}
          className="text-slate-500 hover:text-slate-800 text-sm mb-5 flex items-center gap-1 transition-colors">
          ← رجوع للرئيسية
        </button>

        {/* Hero card */}
        <div className="card text-center mb-6">
          <div className="text-6xl mb-4">🎯</div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-2">امتحانك الخاص</h1>
          <p className="text-slate-500 mb-6 text-sm leading-relaxed">
            امتحان مُخصَّص تلقائياً من كل الأسئلة التي أخطأت فيها في الامتحانات والواجبات السابقة
          </p>

          {hasQuestions ? (
            <div>
              <div className="inline-flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-6 py-4 mb-6">
                <span className="text-4xl font-extrabold text-amber-600">{total}</span>
                <div className="text-right">
                  <div className="font-bold text-amber-700">سؤال ينتظرك</div>
                  <div className="text-xs text-amber-500">من إجاباتك الخاطئة السابقة</div>
                </div>
              </div>
              <div>
                <button onClick={() => navigate('/student/personal-exam/take')}
                  className="btn-primary btn-lg px-12">
                  🎯 ابدأ الامتحان الخاص
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
              <div className="text-4xl mb-3">🌟</div>
              <p className="font-bold text-emerald-700 mb-1">ممتاز! لا توجد أسئلة خاطئة</p>
              <p className="text-emerald-600 text-sm">
                أدِّ المزيد من الامتحانات وستظهر هنا الأسئلة التي تحتاج للمراجعة
              </p>
            </div>
          )}
        </div>

        {/* Attempt history */}
        {history.length > 0 && (
          <div className="card">
            <h2 className="font-bold text-slate-700 mb-4">📋 محاولاتك السابقة</h2>
            <div className="space-y-1">
              {history.map(h => {
                const pass = h.score >= 60;
                return (
                  <div key={h.id}
                    className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div>
                      <div className="text-sm font-semibold text-slate-700">
                        {h.correct_count} / {h.total} إجابة صحيحة
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {new Date(h.submitted_at).toLocaleDateString('ar-EG', {
                          year: 'numeric', month: 'long', day: 'numeric',
                        })}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className={`text-xl font-extrabold ${pass ? 'text-emerald-600' : 'text-red-500'}`}>
                        {h.score}%
                      </div>
                      <span className={`badge ${pass ? 'badge-green' : 'badge-red'} text-xs`}>
                        {pass ? 'ممتاز' : 'راجع'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Empty history hint */}
        {history.length === 0 && hasQuestions && (
          <div className="text-center text-slate-400 text-sm py-4">
            لم تُجرِ أي محاولة بعد — ابدأ الآن!
          </div>
        )}
      </div>
    </div>
  );
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
);
