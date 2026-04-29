import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';

// ── Shuffle helpers ───────────────────────────────────────────────────────────
function shuffleArr(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleExamData(data) {
  const { shuffle_questions, shuffle_options } = data.exam;
  let questions = shuffle_questions ? shuffleArr(data.questions) : [...data.questions];
  questions = questions.map(q => {
    if (!shuffle_options || q.type === 'essay' || !q.options?.length) return q;
    const origIndices = q.options.map((_, i) => i);
    const shuffledMap = shuffleArr(origIndices);
    return { ...q, options: shuffledMap.map(i => q.options[i]), _shuffleMap: shuffledMap };
  });
  return { ...data, questions };
}

// ── Draft persistence (localStorage) ─────────────────────────────────────────
const draftKey = (examId) => `exam_draft_${examId}`;

function loadDraft(examId) {
  try { return JSON.parse(localStorage.getItem(draftKey(examId))); }
  catch { return null; }
}
function saveDraft(examId, data) {
  try { localStorage.setItem(draftKey(examId), JSON.stringify(data)); }
  catch {}
}
function clearDraft(examId) {
  try { localStorage.removeItem(draftKey(examId)); }
  catch {}
}

export default function TakeExamPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [examData, setExamData]       = useState(null);
  const [answers, setAnswers]         = useState({});
  const [timeLeft, setTimeLeft]       = useState(0);
  const [loading, setLoading]         = useState(true);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState('');
  const [resumed, setResumed]         = useState(false);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);
  const timerRef    = useRef(null);
  const examDataRef = useRef(null);
  const answersRef  = useRef({});

  useEffect(() => { examDataRef.current = examData; }, [examData]);
  useEffect(() => { answersRef.current  = answers;  }, [answers]);

  useEffect(() => {
    api.get(`/exams/${id}/questions`)
      .then(r => {
        const duration = r.data.exam.duration * 60;
        const draft    = loadDraft(id);

        if (draft && draft.examData) {
          setExamData(draft.examData);
          setAnswers(draft.answers || {});
          setTimeLeft(draft.timeLeft ?? duration);
          setResumed(true);
        } else {
          const shuffled = shuffleExamData(r.data);
          setExamData(shuffled);
          setTimeLeft(duration);
          saveDraft(id, { examData: shuffled, answers: {}, timeLeft: duration });
        }
      })
      .catch(err => setError(err.response?.data?.message || 'خطأ في تحميل الامتحان'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!examData) return;
    const draft = loadDraft(id);
    if (draft) saveDraft(id, { ...draft, answers });
  }, [answers, id, examData]);

  useEffect(() => {
    if (!examData || timeLeft <= 0) return;
    const draft = loadDraft(id);
    if (draft) saveDraft(id, { ...draft, timeLeft });
  }, [Math.floor(timeLeft / 10), id, examData]); // eslint-disable-line

  useEffect(() => {
    if (!examData || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [examData]);

  const handleSubmit = useCallback(async (forced = false) => {
    if (submitting) return;
    if (!forced) {
      const q = examDataRef.current?.questions || [];
      const a = answersRef.current;
      const incomplete = q.some(question =>
        question.type === 'essay'
          ? !a[question.id]?.trim()
          : a[question.id] === undefined
      );
      if (incomplete) return;
    }
    clearInterval(timerRef.current);
    setSubmitting(true);
    setShowConfirm(false);
    try {
      const currentAnswers  = answersRef.current;
      const currentExamData = examDataRef.current;
      const remapped = {};
      for (const [qId, displayIdx] of Object.entries(currentAnswers)) {
        const q = currentExamData?.questions.find(q => String(q.id) === String(qId));
        remapped[qId] = q?._shuffleMap ? q._shuffleMap[displayIdx] : displayIdx;
      }
      clearDraft(id);
      const { data } = await api.post('/submissions', { examId: Number(id), answers: remapped });
      navigate(`/student/result/${data.submissionId}`, { state: data });
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في التسليم');
      setSubmitting(false);
    }
  }, [id, submitting, navigate]);

  const questions  = examData?.questions || [];
  const total      = questions.length;
  const answered   = questions.filter(q =>
    q.type === 'essay'
      ? answers[q.id]?.trim()?.length > 0
      : answers[q.id] !== undefined
  ).length;
  const allAnswered = answered === total && total > 0;
  const pct  = total ? Math.round((answered / total) * 100) : 0;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2, '0');
  const secs = String(timeLeft % 60).padStart(2, '0');
  const currentQuestion = questions[currentIdx];
  const isFirst = currentIdx === 0;
  const isLast  = currentIdx === total - 1;

  function isAnswered(q) {
    return q.type === 'essay'
      ? answers[q.id]?.trim()?.length > 0
      : answers[q.id] !== undefined;
  }

  if (loading) return <Spinner />;
  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-sm w-full text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="font-bold text-slate-700 mb-4">{error}</p>
        <button onClick={() => navigate('/student')} className="btn-primary btn-block">العودة</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100" dir="rtl">
      {/* ── Sticky Header ────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-2">
          {/* Title + Timer */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-700 text-sm truncate">{examData?.exam?.title}</span>
            <span className={`font-extrabold text-lg tabular-nums ${timeLeft <= 60 ? 'text-red-600 animate-pulse' : 'text-slate-600'}`}>
              ⏱ {mins}:{secs}
            </span>
          </div>

          {/* Question number grid */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            {questions.map((q, i) => {
              const answered_q = isAnswered(q);
              const isCurrent  = i === currentIdx;
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border-2
                    ${isCurrent
                      ? 'bg-blue-600 text-white border-blue-700 scale-110 shadow'
                      : answered_q
                        ? 'bg-green-100 text-green-700 border-green-400'
                        : 'bg-slate-100 text-slate-500 border-slate-300 hover:border-blue-300'
                    }`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{answered} / {total} مُجاب</span>
            <span>السؤال {currentIdx + 1} من {total}</span>
          </div>
        </div>
      </div>

      {/* ── Main Content ─────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Resume banner */}
        {resumed && currentIdx === 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-blue-700 text-sm font-semibold flex items-center gap-2 mb-4">
            <span>🔄</span>
            <span>تم استكمال الامتحان من حيث توقفت — إجاباتك محفوظة</span>
          </div>
        )}

        {/* Current question card */}
        {currentQuestion && (
          currentQuestion.type === 'essay'
            ? (
              <EssayCard
                key={currentQuestion.id}
                question={currentQuestion}
                index={currentIdx}
                value={answers[currentQuestion.id] || ''}
                onChange={v => setAnswers(a => ({ ...a, [currentQuestion.id]: v }))}
              />
            ) : (
              <MCQCard
                key={currentQuestion.id}
                question={currentQuestion}
                index={currentIdx}
                selected={answers[currentQuestion.id]}
                onSelect={v => setAnswers(a => ({ ...a, [currentQuestion.id]: v }))}
              />
            )
        )}

        {/* ── Navigation ───────────────────────────────────────── */}
        <div className="flex items-center justify-between mt-4 gap-3">
          <button
            onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
            disabled={isFirst}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border-2
              ${isFirst
                ? 'bg-slate-100 text-slate-300 border-slate-200 cursor-not-allowed'
                : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:text-blue-600'
              }`}
          >
            &#8594; السابق
          </button>

          {isLast ? (
            <button
              onClick={() => setShowConfirm(true)}
              disabled={submitting || !allAnswered}
              className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all
                ${allAnswered
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
            >
              {submitting
                ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : '✅ تسليم الامتحان'
              }
            </button>
          ) : (
            <button
              onClick={() => setCurrentIdx(i => Math.min(total - 1, i + 1))}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow transition-all"
            >
              التالي &#8592;
            </button>
          )}
        </div>

        {/* Warning if not all answered on last question */}
        {isLast && !allAnswered && (
          <p className="text-sm text-red-500 font-semibold mt-3 text-center">
            ⚠️ باقي {total - answered} سؤال — اضغط على الأرقام فوق للإجابة
          </p>
        )}
      </div>

      {/* ── Confirm Submit Modal ──────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <div className="text-4xl mb-3">📝</div>
            <h2 className="font-extrabold text-slate-800 text-lg mb-2">تأكيد التسليم</h2>
            <p className="text-slate-500 text-sm mb-5">
              هل أنت متأكد من تسليم الامتحان؟ لن تتمكن من التعديل بعد ذلك.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-bold text-sm hover:border-slate-300"
              >
                إلغاء
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold text-sm shadow"
              >
                {submitting
                  ? <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : 'نعم، سلّم'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Question Cards ────────────────────────────────────────────────────────────

function MCQCard({ question, index, selected, onSelect }) {
  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 text-xs font-extrabold flex items-center justify-center">
          {index + 1}
        </span>
        <p className="text-xs font-bold text-slate-400">
          {question.type === 'truefalse' ? 'صح أو خطأ' : 'اختيار من متعدد'}
        </p>
      </div>
      <p className="font-bold text-slate-800 mb-5 leading-relaxed text-base">{question.text}</p>
      <div className="space-y-2.5">
        {question.options.map((opt, oi) => (
          <label
            key={oi}
            onClick={() => onSelect(oi)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
              ${selected === oi
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'
              }`}
          >
            <input
              type="radio"
              name={`q-${question.id}`}
              checked={selected === oi}
              onChange={() => onSelect(oi)}
              className="accent-blue-600 w-4 h-4 shrink-0"
            />
            <span className="text-sm font-medium">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function EssayCard({ question, index, value, onChange }) {
  return (
    <div className="card border-amber-200">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 text-xs font-extrabold flex items-center justify-center">
            {index + 1}
          </span>
          <p className="text-xs font-bold text-slate-400">سؤال مقالي</p>
        </div>
        <span className="badge badge-amber text-xs">{question.max_score} درجة</span>
      </div>
      <p className="font-bold text-slate-800 mb-4 leading-relaxed text-base">{question.text}</p>
      <textarea
        className="input resize-none text-sm leading-relaxed"
        rows={6}
        placeholder="اكتب إجابتك هنا..."
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);
