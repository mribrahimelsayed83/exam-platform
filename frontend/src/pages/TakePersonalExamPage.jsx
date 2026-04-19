import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';

export default function TakePersonalExamPage() {
  const navigate = useNavigate();
  const [questions,   setQuestions]   = useState([]);
  const [answers,     setAnswers]     = useState({});
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  useEffect(() => {
    api.get('/personal-exam/questions')
      .then(r => {
        if (r.data.total === 0) {
          navigate('/student/personal-exam');
        } else {
          setQuestions(r.data.questions);
        }
      })
      .catch(() => setError('خطأ في تحميل الأسئلة'))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleSubmit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/personal-exam/submit', { questions, answers });
      navigate(`/student/personal-exam/result/${data.submissionId}`, { state: data });
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في التسليم');
      setSubmitting(false);
    }
  }, [answers, questions, submitting, navigate]);

  const answered = Object.keys(answers).length;
  const total    = questions.length;
  const pct      = total ? Math.round((answered / total) * 100) : 0;

  if (loading) return <Spinner />;

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card max-w-sm w-full text-center">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="font-bold text-slate-700 mb-4">{error}</p>
        <button onClick={() => navigate('/student/personal-exam')} className="btn-primary btn-block">رجوع</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">

      {/* Sticky header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-slate-700 text-sm">🎯 امتحانك الخاص</span>
            <span className="badge badge-amber">{total} سؤال</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5">
            <div className="bg-amber-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-slate-400 mt-1">{answered} / {total} مُجاب</div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {questions.map((q, qi) => (
          <MCQCard key={q.id} question={q} index={qi}
            selected={answers[q.id]}
            onSelect={v => setAnswers(a => ({ ...a, [q.id]: v }))} />
        ))}

        <div className="pt-2 pb-6 text-center">
          <button onClick={handleSubmit} disabled={submitting} className="btn-primary btn-lg px-10">
            {submitting
              ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : '✅ تسليم الامتحان'
            }
          </button>
          {answered < total && (
            <p className="text-xs text-amber-600 mt-2">
              ⚠️ {total - answered} سؤال لم تجب عليه بعد
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function MCQCard({ question, index, selected, onSelect }) {
  return (
    <div className="card mb-4">
      <p className="text-xs font-bold text-slate-400 mb-2">السؤال {index + 1}</p>
      <p className="font-bold text-slate-800 mb-4 leading-relaxed">{question.text}</p>
      <div className="space-y-2">
        {question.options.map((opt, oi) => (
          <label key={oi} onClick={() => onSelect(oi)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all
              ${selected === oi
                ? 'border-amber-500 bg-amber-50 text-amber-700'
                : 'border-slate-200 hover:border-amber-300 hover:bg-slate-50 text-slate-700'}`}>
            <input type="radio" name={`q-${question.id}`} checked={selected === oi}
              onChange={() => onSelect(oi)} className="accent-amber-500 w-4 h-4" />
            <span className="text-sm font-medium">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
  </div>
);
