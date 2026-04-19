import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import api from '../utils/api';

export default function PersonalExamResultPage() {
  const { id }         = useParams();
  const { state }      = useLocation();
  const navigate       = useNavigate();
  const [result,  setResult]  = useState(state || null);
  const [detail,  setDetail]  = useState(null);
  const [loading, setLoading] = useState(!state);

  useEffect(() => {
    api.get(`/personal-exam/result/${id}`)
      .then(r => {
        setResult(r.data);
        setDetail(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading || !result) return <Spinner />;

  const score  = result.score  ?? result.score;
  const total  = result.total  ?? result.total;
  const correct = result.correct ?? result.correct_count;
  const pass   = score >= 60;
  const review = detail?.review || [];

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar />
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Result summary */}
        <div className={`card text-center mb-6 border-t-4 ${pass ? 'border-t-emerald-500' : 'border-t-red-500'}`}>
          <div className="text-6xl mb-4">{pass ? '🎉' : '💪'}</div>
          <h1 className="text-2xl font-extrabold text-slate-800 mb-1">
            {pass ? 'أحسنت!' : 'واصل المراجعة!'}
          </h1>
          <div className={`text-5xl font-extrabold my-4 ${pass ? 'text-emerald-600' : 'text-red-500'}`}>
            {score}%
          </div>
          <div className="text-slate-500 mb-2 font-semibold">
            {correct} صحيح من {total} سؤال
          </div>
          <div className={`inline-block px-4 py-1 rounded-full text-sm font-bold mb-6
            ${pass ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {pass ? '✅ نتيجة جيدة' : '❌ تحتاج مراجعة أكثر'}
          </div>

          <div className="flex gap-3 justify-center flex-wrap">
            <button onClick={() => navigate('/student/personal-exam/take')} className="btn-primary">
              🔄 حاول مرة أخرى
            </button>
            <button onClick={() => navigate('/student/personal-exam')} className="btn-secondary">
              📋 صفحة الامتحان الخاص
            </button>
          </div>
        </div>

        {/* Answer review */}
        {review.length > 0 && (
          <div className="card">
            <h2 className="font-bold text-slate-700 mb-5">📋 مراجعة الإجابات</h2>
            <div className="space-y-4">
              {review.map((q, i) => (
                <div key={q.questionId}
                  className={`rounded-xl border-2 p-4
                    ${q.isCorrect ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                  <div className="flex items-start gap-2 mb-3">
                    <span className="text-lg">{q.isCorrect ? '✅' : '❌'}</span>
                    <p className="font-semibold text-slate-800 text-sm leading-relaxed">
                      {i + 1}. {q.question}
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    {q.options.map((opt, oi) => {
                      const isRight  = oi === q.correct;
                      const isChosen = oi === q.chosen;
                      return (
                        <div key={oi}
                          className={`text-xs px-3 py-2 rounded-lg flex items-center gap-2 font-medium
                            ${isRight
                              ? 'bg-emerald-100 text-emerald-800 font-bold'
                              : isChosen && !q.isCorrect
                                ? 'bg-red-100 text-red-700'
                                : 'bg-white/60 text-slate-500'}`}>
                          {isRight  && <span>✓</span>}
                          {isChosen && !q.isCorrect && <span>✗</span>}
                          {!isRight && (!isChosen || q.isCorrect) && <span className="w-3" />}
                          {opt}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
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
