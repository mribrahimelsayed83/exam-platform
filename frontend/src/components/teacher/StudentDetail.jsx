import { useState, useEffect } from 'react';
import api from '../../utils/api';

const gradeLabel    = { 
  4:'رابع ابتدائي', 5:'خامس ابتدائي', 6:'سادس ابتدائي',
  7:'أول إعدادي', 8:'ثاني إعدادي', 9:'ثالث إعدادي',
  10:'أول ثانوي', 11:'ثاني ثانوي'
};
const gradingLabels = {
  fully_graded: { label:'مصحّح',        cls:'badge-green'  },
  auto_graded:  { label:'قيد التصحيح', cls:'badge-amber'  },
  partial:      { label:'جزئي',         cls:'badge-amber'  },
};

export default function StudentDetail({ studentId, onBack }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState(null); // expanded submission id

  useEffect(() => {
    api.get(`/teacher/students/${studentId}`)
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );
  if (!data) return null;

  const { student, submissions } = data;
  const approved = submissions.filter(s => s.grading_status === 'fully_graded');
  const avgScore = approved.length
    ? Math.round(approved.reduce((a,s) => a + s.final_score, 0) / approved.length)
    : null;

  return (
    <div>
      {/* Back */}
      <button onClick={onBack} className="btn-ghost btn-sm mb-4">
        ← رجوع لقائمة الطلاب
      </button>

      {/* Student info card */}
      <div className="card mb-4">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center font-extrabold text-blue-600">
                {student.name.charAt(0)}
              </div>
              <div>
                <h2 className="font-extrabold text-slate-800 text-lg">{student.name}</h2>
                <p className="text-xs text-slate-400">@{student.username}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="badge badge-blue">{gradeLabel[student.grade]}</span>
              <span className={`badge ${student.status==='approved'?'badge-green':student.status==='pending'?'badge-amber':'badge-red'}`}>
                {student.status==='approved'?'مقبول':student.status==='pending'?'في الانتظار':'مرفوض'}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-slate-50 rounded-xl p-3 min-w-[80px]">
              <div className="text-2xl font-extrabold text-blue-600">{submissions.length}</div>
              <div className="text-xs text-slate-500">امتحان</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 min-w-[80px]">
              <div className={`text-2xl font-extrabold ${avgScore !== null ? (avgScore>=50?'text-emerald-600':'text-red-600') : 'text-slate-400'}`}>
                {avgScore !== null ? `${avgScore}%` : '—'}
              </div>
              <div className="text-xs text-slate-500">متوسط</div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-100 text-sm">
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-0.5">تليفون الطالب</span>
            <span className="text-slate-700">{student.phone || '—'}</span>
          </div>
          <div>
            <span className="text-xs font-bold text-slate-400 block mb-0.5">تليفون ولي الأمر</span>
            <span className="text-slate-700">{student.parent_phone || '—'}</span>
          </div>
        </div>
      </div>

      {/* Submissions */}
      <h3 className="font-bold text-slate-700 mb-3">
        الامتحانات المُنجزة ({submissions.length})
      </h3>

      {submissions.length === 0 ? (
        <div className="text-center py-10 text-slate-400">
          <div className="text-4xl mb-2">📭</div>
          <p>لم يؤدِ الطالب أي امتحان بعد</p>
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
                {/* Header row */}
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
                        <span>مقالي: {sub.grading_status==='fully_graded' ? `${sub.essay_score}/${sub.essay_max}` : 'قيد التصحيح'}</span>
                      )}
                    </div>
                    {sub.exam_comment && (
                      <p className="text-xs text-slate-500 mt-1 italic">💬 {sub.exam_comment}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mr-3">
                    {sub.final_score !== null
                      ? <span className={`font-extrabold text-lg ${pass?'text-emerald-600':'text-red-600'}`}>
                          {sub.final_score}%
                        </span>
                      : <span className="text-amber-500 font-bold text-sm">⏳</span>
                    }
                    <span className={`text-slate-400 transition-transform duration-200 ${isOpen?'rotate-180':''}`}>
                      ▼
                    </span>
                  </div>
                </div>

                {/* Expanded review */}
                {isOpen && review.length > 0 && (
                  <div className="border-t border-slate-100 p-4 bg-slate-50">
                    <p className="text-xs font-bold text-slate-500 mb-3">تفاصيل الإجابات</p>
                    <div className="space-y-3">
                      {review.map((r, ri) => (
                        r.type === 'mcq'
                          ? <MCQReviewRow key={ri} r={r} index={ri} />
                          : <EssayReviewRow key={ri} r={r} index={ri} />
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
  );
}

function MCQReviewRow({ r, index }) {
  const icon = r.chosen === null ? '⚠️' : r.isCorrect ? '✅' : '❌';
  return (
    <div className="bg-white rounded-xl p-3 border border-slate-200">
      <div className="flex items-start gap-2 mb-2">
        <span>{icon}</span>
        <p className="text-xs font-semibold text-slate-700 flex-1 leading-relaxed">
          {index+1}. {r.question}
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
              ${isCorrect?'bg-emerald-100 text-emerald-800 font-semibold'
              :isWrong?'bg-red-100 text-red-800 font-semibold'
              :'text-slate-400'}`}>
              <span>{isCorrect?'✅':isWrong?'❌':isChosen?'☑️':'○'}</span>
              <span>{opt}</span>
              {isCorrect && <span className="mr-auto text-emerald-600">✓ صحيح</span>}
              {isChosen && !isCorrect && <span className="mr-auto text-red-500">← إجابة الطالب</span>}
            </div>
          );
        })}
        {r.chosen === null && <p className="text-xs text-amber-600">لم يجب</p>}
      </div>
    </div>
  );
}

function EssayReviewRow({ r, index }) {
  return (
    <div className="bg-white rounded-xl p-3 border border-amber-200">
      <div className="flex items-start justify-between mb-2 gap-2">
        <div className="flex items-start gap-2 flex-1">
          <span>{r.graded ? '📝' : '⏳'}</span>
          <p className="text-xs font-semibold text-slate-700 leading-relaxed">
            {index+1}. {r.question}
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
        {r.answer || <span className="italic text-slate-400">لم يكتب إجابة</span>}
      </div>
      {r.graded && r.comment && (
        <p className="text-xs text-emerald-700 mr-5">
          <span className="font-bold">تعليق: </span>{r.comment}
        </p>
      )}
    </div>
  );
}
