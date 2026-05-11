import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Navbar from '../components/shared/Navbar';

const GRADES = {
  9:'ثالث إعدادي',
  10:'أول ثانوي', 11:'ثاني ثانوي', 12:'ثالث ثانوي',
};
const gradingLabels = {
  fully_graded: { label:'مصحّح',        cls:'badge-green' },
  auto_graded:  { label:'قيد التصحيح', cls:'badge-amber' },
  partial:      { label:'جزئي',         cls:'badge-amber' },
};

export default function StudentMyReport() {
  const navigate = useNavigate();
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.get('/submissions/my-report')
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-slate-100">
      <Navbar/>
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    </div>
  );
  if (!data) return null;

  const { student, submissions, video_views = [] } = data;
  const graded  = submissions.filter(s => s.grading_status === 'fully_graded');
  const avgScore = graded.length
    ? Math.round(graded.reduce((a, s) => a + s.final_score, 0) / graded.length)
    : null;
  const passed     = graded.filter(s => s.final_score >= s.pass_score).length;
  const honorScore = avgScore !== null ? avgScore * submissions.length : 0;

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar/>
      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* Back */}
        <button onClick={() => navigate('/student')}
          className="text-slate-500 hover:text-slate-800 text-sm mb-5 flex items-center gap-1 transition-colors">
          ← رجوع للرئيسية
        </button>

        {/* Student info card */}
        <div className="card mb-4">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl font-extrabold text-blue-600">
                  {student.name.charAt(0)}
                </div>
                <div>
                  <h2 className="font-extrabold text-slate-800 text-lg">{student.name}</h2>
                  <p className="text-xs text-slate-400">@{student.username}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-blue">{GRADES[student.grade]}</span>
                <span className="badge badge-green">مقبول</span>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-50 rounded-xl p-3 min-w-[72px]">
                <div className="text-2xl font-extrabold text-blue-600">{submissions.length}</div>
                <div className="text-xs text-slate-500">امتحان</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 min-w-[72px]">
                <div className={`text-2xl font-extrabold ${avgScore !== null ? (avgScore >= 50 ? 'text-emerald-600' : 'text-red-600') : 'text-slate-400'}`}>
                  {avgScore !== null ? `${avgScore}%` : '—'}
                </div>
                <div className="text-xs text-slate-500">متوسط</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-3 min-w-[72px]">
                <div className="text-2xl font-extrabold text-emerald-600">{passed}</div>
                <div className="text-xs text-slate-500">ناجح</div>
              </div>
              <div className="bg-amber-50 rounded-xl p-3 min-w-[72px]" title="النقاط = متوسط الدرجات × عدد الامتحانات">
                <div className="text-2xl font-extrabold text-amber-600">{honorScore}</div>
                <div className="text-xs text-slate-500">🏆 نقاط</div>
              </div>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 text-sm">
            <div>
              <span className="text-xs font-bold text-slate-400 block mb-0.5">تليفون</span>
              <span className="text-slate-700">{student.phone || '—'}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block mb-0.5">تليفون ولي الأمر</span>
              <span className="text-slate-700">{student.parent_phone || '—'}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block mb-0.5">الإيميل</span>
              <span className="text-slate-700">{student.email || '—'}</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-400 block mb-0.5">تاريخ الانضمام</span>
              <span className="text-slate-700">
                {new Date(student.created_at).toLocaleDateString('ar-EG', { year:'numeric', month:'short', day:'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Video Views */}
        <div className="card mb-4">
          <h3 className="font-bold text-slate-700 mb-3">🎬 الفيديوهات اللي شفتها ({video_views.length})</h3>
          {video_views.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">لم تفتح أي فيديو بعد</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {video_views.map((v, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base flex-shrink-0">🎬</span>
                    <span className="text-sm font-semibold text-slate-700 truncate">{v.title}</span>
                  </div>
                  <span className="text-xs text-slate-400 flex-shrink-0 mr-3">
                    {new Date(v.viewed_at).toLocaleDateString('ar-EG', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submissions */}
        <h3 className="font-bold text-slate-700 mb-3">
          📝 الامتحانات المُنجزة ({submissions.length})
        </h3>

        {submissions.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <div className="text-4xl mb-2">📭</div>
            <p>لم تؤدِ أي امتحان بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {submissions.map(sub => {
              const pass   = sub.final_score !== null && sub.final_score >= sub.pass_score;
              const status = gradingLabels[sub.grading_status] || gradingLabels.auto_graded;
              const isOpen = expanded === sub.id;
              const review = sub.review || [];

              return (
                <div key={sub.id} className="card p-0 overflow-hidden">
                  <div
                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => setExpanded(isOpen ? null : sub.id)}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold text-slate-800 text-sm">{sub.exam_title}</span>
                        <span className={`badge ${status.cls} text-xs`}>{status.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{new Date(sub.submitted_at).toLocaleDateString('ar-EG')}</span>
                        {sub.mcq_total > 0 && <span>MCQ: {sub.mcq_score}%</span>}
                        {sub.essay_total > 0 && (
                          <span>مقالي: {sub.grading_status === 'fully_graded' ? `${sub.essay_score}/${sub.essay_max}` : 'قيد التصحيح'}</span>
                        )}
                      </div>
                      {sub.exam_comment && (
                        <p className="text-xs text-slate-500 mt-1 italic">💬 {sub.exam_comment}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mr-3">
                      {sub.final_score !== null
                        ? <span className={`font-extrabold text-lg ${pass ? 'text-emerald-600' : 'text-red-600'}`}>
                            {sub.final_score}%
                          </span>
                        : <span className="text-amber-500 font-bold text-sm">⏳</span>
                      }
                      <span className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </div>

                  {isOpen && review.length > 0 && (
                    <div className="border-t border-slate-100 p-4 bg-slate-50">
                      <p className="text-xs font-bold text-slate-500 mb-3">تفاصيل الإجابات</p>
                      <div className="space-y-3">
                        {review.map((r, ri) => (
                          r.type === 'mcq'
                            ? <MCQRow key={ri} r={r} index={ri}/>
                            : <EssayRow key={ri} r={r} index={ri}/>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function MCQRow({ r, index }) {
  const icon = r.chosen === null ? '⚠️' : r.isCorrect ? '✅' : '❌';
  return (
    <div className="bg-white rounded-xl p-3 border border-slate-200">
      <div className="flex items-start gap-2 mb-2">
        <span>{icon}</span>
        <p className="text-xs font-semibold text-slate-700 flex-1 leading-relaxed">
          {index + 1}. {r.question}
        </p>
        <span className="badge badge-blue text-xs flex-shrink-0">MCQ</span>
      </div>
      <div className="space-y-1 mr-5">
        {r.options?.map((opt, oi) => {
          const isCorrect = oi === r.correct;
          const isChosen  = oi === r.chosen;
          const isWrong   = isChosen && !r.isCorrect;
          return (
            <div key={oi} className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs
              ${isCorrect ? 'bg-emerald-100 text-emerald-800 font-semibold'
              : isWrong   ? 'bg-red-100 text-red-800 font-semibold'
              : 'text-slate-400'}`}>
              <span>{isCorrect ? '✅' : isWrong ? '❌' : isChosen ? '☑️' : '○'}</span>
              <span>{opt}</span>
              {isCorrect && <span className="mr-auto text-emerald-600">✓ صحيح</span>}
              {isChosen && !isCorrect && <span className="mr-auto text-red-500">← إجابتك</span>}
            </div>
          );
        })}
        {r.chosen === null && <p className="text-xs text-amber-600">لم تجب</p>}
      </div>
    </div>
  );
}

function EssayRow({ r, index }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-amber-200">
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-start gap-2 flex-1">
          <span>{r.graded ? '📝' : '⏳'}</span>
          <p className="text-xs font-semibold text-slate-700 leading-relaxed">
            {index + 1}. {r.question}
          </p>
        </div>
        <div className="flex-shrink-0">
          {r.graded
            ? <span className="font-extrabold text-sm text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                {r.earnedScore}/{r.maxScore}
              </span>
            : <span className="text-xs text-amber-600 font-bold">قيد التصحيح</span>
          }
        </div>
      </div>
      <div className="bg-slate-50 rounded-lg p-2 border border-slate-100 text-xs text-slate-700 mb-1 mr-5 leading-relaxed min-h-[32px]">
        {r.answer || <span className="italic text-slate-400">لم تكتب إجابة</span>}
      </div>
      {r.graded && r.comment && (
        <p className="text-xs text-emerald-700 mr-5">
          <span className="font-bold">تعليق المصحح: </span>{r.comment}
        </p>
      )}
    </div>
  );
}
