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
  const [examData, setExamData]     = useState(null);
  const [answers, setAnswers]       = useState({});
  const [timeLeft, setTimeLeft]     = useState(0);
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [resumed, setResumed]       = useState(false);
  const timerRef    = useRef(null);
  const examDataRef = useRef(null);   // stable ref for handleSubmit
  const answersRef  = useRef({});

  // Keep refs in sync so handleSubmit always sees latest values
  useEffect(() => { examDataRef.current = examData; }, [examData]);
  useEffect(() => { answersRef.current  = answers;  }, [answers]);

  useEffect(() => {
    api.get(`/exams/${id}/questions`)
      .then(r => {
        const duration = r.data.exam.duration * 60;
        const draft    = loadDraft(id);

        if (draft && draft.startedAt) {
          // Restore: recalc time from wall-clock start
          const elapsed   = Math.floor((Date.now() - draft.startedAt) / 1000);
          const remaining = Math.max(0, duration - elapsed);
          setExamData(draft.examData);
          setAnswers(draft.answers || {});
          setTimeLeft(remaining);
          setResumed(true);
        } else {
          // Fresh start
          const shuffled = shuffleExamData(r.data);
          setExamData(shuffled);
          setTimeLeft(duration);
          saveDraft(id, { examData: shuffled, answers: {}, startedAt: Date.now() });
        }
      })
      .catch(err => setError(err.response?.data?.message || 'خطأ في تحميل الامتحان'))
      .finally(() => setLoading(false));
  }, [id]);

  // Persist answers on every change
  useEffect(() => {
    if (!examData) return;
    const draft = loadDraft(id);
    if (draft) saveDraft(id, { ...draft, answers });
  }, [answers, id, examData]);

  useEffect(() => {
    if (!examData || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [examData]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    clearInterval(timerRef.current);
    setSubmitting(true);
    try {
      const currentAnswers  = answersRef.current;
      const currentExamData = examDataRef.current;
      // Remap display indices → original indices for backend grading
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

  const mcqQuestions   = examData?.questions?.filter(q => q.type === 'mcq')   || [];
  const essayQuestions = examData?.questions?.filter(q => q.type === 'essay') || [];
  const answered = Object.keys(answers).length;
  const total    = examData?.questions?.length || 0;
  const pct      = total ? Math.round((answered / total) * 100) : 0;
  const mins = String(Math.floor(timeLeft / 60)).padStart(2,'0');
  const secs = String(timeLeft % 60).padStart(2,'0');

  if (loading) return <Spinner/>;
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
    <div className="min-h-screen bg-slate-100">
      {/* Sticky header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-700 text-sm truncate">{examData?.exam?.title}</span>
            <span className={`font-extrabold text-lg tabular-nums ${timeLeft<=60?'text-red-600 animate-pulse':'text-slate-600'}`}>
              ⏱ {mins}:{secs}
            </span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{width:`${pct}%`}}/>
          </div>
          <div className="flex justify-between text-xs text-slate-400 mt-1">
            <span>{answered} / {total} مُجاب</span>
            {essayQuestions.length > 0 && (
              <span className="text-amber-600 font-semibold">
                يشمل {essayQuestions.length} سؤال مقالي
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Resume banner */}
        {resumed && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-blue-700 text-sm font-semibold flex items-center gap-2">
            <span>🔄</span>
            <span>تم استكمال الامتحان من حيث توقفت — إجاباتك محفوظة</span>
          </div>
        )}
        {/* MCQ Section */}
        {mcqQuestions.length > 0 && (
          <div>
            {essayQuestions.length > 0 && (
              <h3 className="font-extrabold text-slate-600 text-sm mb-3 flex items-center gap-2">
                <span className="badge badge-blue">اختيار من متعدد</span>
                <span className="text-slate-400">— بيتصحح تلقائياً</span>
              </h3>
            )}
            {examData.questions.filter(q=>q.type==='mcq'||q.type==='truefalse').map((q, qi) => (
              <MCQCard key={q.id} question={q} index={qi} selected={answers[q.id]}
                onSelect={v => setAnswers(a=>({...a,[q.id]:v}))} />
            ))}
          </div>
        )}

        {/* Essay Section */}
        {essayQuestions.length > 0 && (
          <div>
            <h3 className="font-extrabold text-slate-600 text-sm mb-3 flex items-center gap-2">
              <span className="badge badge-amber">أسئلة مقالية</span>
              <span className="text-slate-400">— بيصححها المدرس</span>
            </h3>
            {examData.questions.filter(q=>q.type==='essay').map((q, qi) => (
              <EssayCard key={q.id} question={q} index={qi} value={answers[q.id]||''}
                onChange={v => setAnswers(a=>({...a,[q.id]:v}))} />
            ))}
          </div>
        )}

        <div className="pt-2 text-center">
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary btn-lg px-10">
            {submitting
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : '✅ تسليم الامتحان'
            }
          </button>
          {answered < total && (
            <p className="text-xs text-amber-600 mt-2">⚠️ {total - answered} سؤال لم تجب عليه</p>
          )}
        </div>
      </div>
    </div>
  );
}

function MCQCard({ question, index, selected, onSelect }) {
  return (
    <div className="card mb-4">
      <p className="text-xs font-bold text-slate-400 mb-2">السؤال {index+1}</p>
      <p className="font-bold text-slate-800 mb-4 leading-relaxed">{question.text}</p>
      <div className="space-y-2">
        {question.options.map((opt,oi) => (
          <label key={oi} onClick={()=>onSelect(oi)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
              ${selected===oi?'border-blue-500 bg-blue-50 text-blue-700':'border-slate-200 hover:border-blue-300 hover:bg-slate-50 text-slate-700'}`}>
            <input type="radio" name={`q-${question.id}`} checked={selected===oi}
              onChange={()=>onSelect(oi)} className="accent-blue-600 w-4 h-4"/>
            <span className="text-sm font-medium">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function EssayCard({ question, index, value, onChange }) {
  return (
    <div className="card mb-4 border-amber-200">
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-bold text-slate-400">سؤال مقالي {index+1}</p>
        <span className="badge badge-amber text-xs">{question.max_score} درجة</span>
      </div>
      <p className="font-bold text-slate-800 mb-3 leading-relaxed">{question.text}</p>
      <textarea
        className="input resize-none text-sm leading-relaxed"
        rows={5}
        placeholder="اكتب إجابتك هنا..."
        value={value}
        onChange={e=>onChange(e.target.value)}
      />
    </div>
  );
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
  </div>
);
