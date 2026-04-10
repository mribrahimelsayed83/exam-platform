import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../utils/api';

export default function ExamResultPage() {
  const { state } = useLocation();
  const { id }    = useParams();
  const navigate  = useNavigate();
  const [sub, setSub]         = useState(state || null);
  const [loading, setLoading] = useState(!state);

  useEffect(() => {
    if (!state && id) {
      api.get(`/submissions/mine/${id}`)
        .then(r => setSub(r.data))
        .finally(() => setLoading(false));
    }
  }, []);

  if (loading) return <Spinner />;
  if (!sub) { navigate('/student'); return null; }

  const gradingStatus = sub.gradingStatus || sub.grading_status;
  const isFullGraded  = gradingStatus === 'fully_graded';
  const isPending     = gradingStatus === 'auto_graded';
  const isPartial     = gradingStatus === 'partial';

  const finalScore = sub.finalScore  ?? sub.final_score;
  const mcqScore   = sub.mcqScore    ?? sub.mcq_score;
  const mcqCorrect = sub.mcqCorrect  ?? sub.mcq_correct;
  const mcqTotal   = sub.mcqTotal    ?? sub.mcq_total;
  const essayTotal = sub.essayTotal  ?? sub.essay_total;
  const essayMax   = sub.essayMax    ?? sub.essay_max;
  const essayScore = sub.essay_score ?? sub.essayScore;
  const essayGraded= sub.essay_graded?? sub.essayGraded;
  const passScore  = sub.passScore   ?? sub.pass_score;
  const examComment= sub.examComment || sub.exam_comment || '';
  const review     = sub.review || [];
  const passed     = finalScore !== null && finalScore >= passScore;

  const circleColor = finalScore === null
    ? 'border-amber-400 text-amber-500'
    : finalScore >= 80        ? 'border-emerald-500 text-emerald-600'
    : finalScore >= passScore ? 'border-amber-500 text-amber-600'
    : 'border-red-500 text-red-600';

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4">
      <div className="max-w-xl mx-auto space-y-4">

        {/* ── Score Card ── */}
        <div className="card text-center">
          <div className={`w-28 h-28 rounded-full border-8 ${circleColor} flex items-center justify-center mx-auto mb-4`}>
            {finalScore !== null
              ? <span className="text-3xl font-extrabold">{finalScore}%</span>
              : <span className="text-3xl">⏳</span>
            }
          </div>

          {isFullGraded && (
            <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-3
              ${passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {passed ? '🎉 مبروك! نجحت' : '😔 للأسف لم تنجح'}
            </div>
          )}
          {(isPending || isPartial) && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-bold mb-3 bg-amber-100 text-amber-700">
              ⏳ {isPartial ? 'تصحيح جزئي — في انتظار باقي المقالي' : 'المقالي قيد التصحيح'}
            </div>
          )}

          <h2 className="text-lg font-extrabold text-slate-800 mb-1">
            {sub.examTitle || sub.exam_title}
          </h2>
          <p className="text-xs text-slate-400 mb-4">درجة النجاح: {passScore}%</p>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-4 text-right">
            {mcqTotal > 0 && (
              <div className="bg-blue-50 rounded-xl p-3">
                <div className="text-xs font-bold text-blue-400 mb-1">اختيار من متعدد</div>
                <div className="text-2xl font-extrabold text-blue-600">{mcqScore}%</div>
                <div className="text-xs text-blue-500">{mcqCorrect} / {mcqTotal} صحيح</div>
              </div>
            )}
            {essayTotal > 0 && (
              <div className="bg-amber-50 rounded-xl p-3">
                <div className="text-xs font-bold text-amber-400 mb-1">مقالي</div>
                {isFullGraded
                  ? <div className="text-2xl font-extrabold text-amber-600">{essayScore} / {essayMax}</div>
                  : <div className="text-2xl font-extrabold text-amber-400">قيد التصحيح</div>
                }
                <div className="text-xs text-amber-500">{essayGraded} / {essayTotal} تم تصحيحه</div>
              </div>
            )}
          </div>

          {/* Exam comment from teacher */}
          {examComment && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-right mb-4">
              <p className="text-xs font-bold text-slate-500 mb-1">💬 تعليق المدرس على الامتحان</p>
              <p className="text-sm text-slate-700 leading-relaxed">{examComment}</p>
            </div>
          )}

          <button onClick={() => navigate('/student')} className="btn-primary btn-block">
            العودة للرئيسية
          </button>
        </div>

        {/* ── Questions Review ── */}
        {review.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-slate-700 mb-1">مراجعة الإجابات</h3>
            <p className="text-xs text-slate-400 mb-4">تفاصيل كل سؤال وإجابتك</p>
            <div className="space-y-3">
              {review.map((r, i) => (
                r.type === 'essay'
                  ? <EssayReview key={i} r={r} index={i} />
                  : <MCQReview key={i} r={r} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── MCQ Review ────────────────────────────────────────────────────────────
function MCQReview({ r, index }) {
  const statusIcon = r.chosen === null ? '⚠️'
    : r.isCorrect ? '✅' : '❌';
  const statusColor = r.chosen === null ? 'border-amber-300 bg-amber-50'
    : r.isCorrect ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50';

  return (
    <div className={`rounded-xl border-2 p-4 ${statusColor}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusIcon}</span>
          <span className="badge badge-blue text-xs">MCQ</span>
        </div>
        <span className="text-xs text-slate-400">سؤال {index + 1}</span>
      </div>
      <p className="font-semibold text-sm text-slate-800 mb-3 leading-relaxed">{r.question}</p>
      <div className="space-y-1.5">
        {r.options?.map((opt, oi) => {
          const isCorrect = oi === r.correct;
          const isChosen  = oi === r.chosen;
          const isWrong   = isChosen && !r.isCorrect;
          return (
            <div key={oi} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium
              ${isCorrect ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
              : isWrong   ? 'bg-red-100 text-red-800 border border-red-300'
              : 'text-slate-400 bg-white border border-slate-100'}`}>
              <span className="text-sm">
                {isCorrect ? '✅' : isWrong ? '❌' : isChosen ? '☑️' : '○'}
              </span>
              <span>{opt}</span>
              {isCorrect && <span className="mr-auto font-bold text-emerald-600">الإجابة الصحيحة</span>}
              {isChosen && !isCorrect && <span className="mr-auto font-bold text-red-600">إجابتك</span>}
            </div>
          );
        })}
      </div>
      {r.chosen === null && (
        <p className="text-xs text-amber-600 mt-2 font-semibold">⚠️ لم تجب على هذا السؤال</p>
      )}
    </div>
  );
}

// ── Essay Review ──────────────────────────────────────────────────────────
function EssayReview({ r, index }) {
  const isGraded = r.graded;
  return (
    <div className={`rounded-xl border-2 p-4 ${isGraded ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{isGraded ? '📝' : '⏳'}</span>
          <span className="badge badge-amber text-xs">مقالي</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">سؤال {index + 1}</span>
          {isGraded
            ? <span className="font-extrabold text-sm text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                {r.earnedScore} / {r.maxScore}
              </span>
            : <span className="text-xs text-amber-600 font-bold bg-amber-100 px-2 py-0.5 rounded-lg">
                قيد التصحيح
              </span>
          }
        </div>
      </div>

      <p className="font-semibold text-sm text-slate-800 mb-2 leading-relaxed">{r.question}</p>

      {/* Student answer */}
      <div className="bg-white rounded-lg p-3 border border-slate-200 text-sm text-slate-700 leading-relaxed mb-2">
        <p className="text-xs font-bold text-slate-400 mb-1">إجابتك:</p>
        {r.answer
          ? <p>{r.answer}</p>
          : <p className="italic text-slate-400">لم تكتب إجابة</p>
        }
      </div>

      {/* Grader comment */}
      {isGraded && r.comment && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <p className="text-xs font-bold text-emerald-600 mb-0.5">تعليق المصحح:</p>
          <p className="text-xs text-emerald-800">{r.comment}</p>
        </div>
      )}
    </div>
  );
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
  </div>
);
