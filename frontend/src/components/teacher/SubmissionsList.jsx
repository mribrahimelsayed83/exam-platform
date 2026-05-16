import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
// xlsx loaded dynamically on first export to keep teacher bundle lean
import api from '../../utils/api';

const gradeLabel = {
  4:'رابع ابتدائي', 5:'خامس ابتدائي', 6:'سادس ابتدائي', 7:'أول إعدادي', 8:'ثاني إعدادي', 9:'ثالث إعدادي', 10:'أول ثانوي', 11:'ثاني ثانوي', 12:'ثالث ثانوي'
};
const statusMap  = {
  auto_graded:  { label:'قيد التصحيح', cls:'badge-amber' },
  partial:      { label:'تصحيح جزئي',  cls:'badge-amber' },
  fully_graded: { label:'مصحّح',       cls:'badge-green'  },
};

export default function SubmissionsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [subs, setSubs]           = useState([]);
  const [exams, setExams]         = useState([]);
  const [filterExam, setFilterExam]       = useState('');
  const [filterGrade, setFilterGrade]     = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [loading, setLoading]     = useState(true);
  const [grading, setGrading]     = useState(null);

  const openId = searchParams.get('open');
  useEffect(() => {
    if (!openId) return;
    setSearchParams({}, { replace: true });
    api.get(`/submissions/${openId}`).then(({ data }) => setGrading(data)).catch(() => {});
  }, [openId]);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterExam)   params.set('exam_id', filterExam);
    if (filterGrade)  params.set('grade', filterGrade);
    if (filterStatus) params.set('grading_status', filterStatus);
    Promise.all([api.get(`/submissions?${params}`), api.get('/exams/all')])
      .then(([s,e])=>{ setSubs(s.data); setExams(e.data); })
      .finally(()=>setLoading(false));
  };

  useEffect(load, [filterExam, filterGrade, filterStatus]);

  const grades = [...new Set(exams.map(e => e.grade))].sort((a,b) => a-b);
  const examsForGrade = filterGrade
    ? exams.filter(e => e.grade === Number(filterGrade))
    : exams;

  const handleGradeChange = (grade) => {
    setFilterGrade(grade);
    setFilterExam(''); // reset exam when grade changes
  };

  const openGrading = async (subId) => {
    const { data } = await api.get(`/submissions/${subId}`);
    setGrading(data);
  };

  const allowRetake = async (sub) => {
    if (!confirm(`السماح لـ "${sub.student_name}" بإعادة امتحان "${sub.exam_title}"؟\nسيتم حذف إجابته الحالية.`)) return;
    await api.delete(`/submissions/${sub.id}/retake`);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-extrabold text-slate-800">إجابات الطلاب</h2>
        {subs.length > 0 && (
          <button
            onClick={async () => {
              const XLSX = (await import('xlsx')).default || await import('xlsx');
              const rows = subs.map(s => ({
                'اسم الطالب': s.student_name,
                'اسم الامتحان': s.exam_title,
                'الدرجة': s.final_score !== null ? `${s.final_score}%` : '—',
              }));
              const ws = XLSX.utils.json_to_sheet(rows, { header: ['اسم الطالب', 'اسم الامتحان', 'الدرجة'] });
              ws['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 12 }];
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'الدرجات');
              XLSX.writeFile(wb, 'درجات_الامتحانات.xlsx');
            }}
            className="btn-secondary btn-sm flex items-center gap-1.5"
          >
            📥 تصدير Excel
          </button>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-5">عرض وتصحيح إجابات الطلاب</p>

      {/* Grade tabs */}
      {grades.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          <button onClick={() => handleGradeChange('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
              ${filterGrade === ''
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
            كل الصفوف
          </button>
          {grades.map(g => (
            <button key={g} onClick={() => handleGradeChange(String(g))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${filterGrade === String(g)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}>
              {gradeLabel[g] || `صف ${g}`}
            </button>
          ))}
        </div>
      )}

      {/* Exam + Status filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select className="input max-w-xs" value={filterExam} onChange={e=>setFilterExam(e.target.value)}>
          <option value="">كل الامتحانات</option>
          {examsForGrade.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <select className="input max-w-[160px]" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="auto_graded">قيد التصحيح</option>
          <option value="partial">تصحيح جزئي</option>
          <option value="fully_graded">مصحّح</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : subs.length===0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📊</div>
          <h3 className="text-lg font-bold text-slate-600">لا توجد إجابات</h3>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['الطالب','الصف','الامتحان','MCQ','المقالي','الدرجة النهائية','الحالة',''].map(h=>(
                    <th key={h} className="text-right text-xs font-bold text-slate-500 px-4 py-3 border-b border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subs.map(s=>{
                  const pass = s.final_score !== null && s.final_score >= s.pass_score;
                  const st   = statusMap[s.grading_status] || statusMap.auto_graded;
                  return (
                    <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-700">{s.student_name}</td>
                      <td className="px-4 py-3"><span className="badge badge-blue text-xs">{gradeLabel[s.student_grade]}</span></td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{s.exam_title}</td>
                      <td className="px-4 py-3 text-sm">
                        {s.mcq_total > 0 ? <span className="font-semibold text-blue-600">{s.mcq_score}%</span> : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {s.essay_total > 0
                          ? <span className="text-xs text-amber-600 font-semibold">{s.essay_graded}/{s.essay_total} صُحّح</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {s.final_score !== null
                          ? <span className={`badge ${pass?'badge-green':'badge-red'}`}>{s.final_score}%</span>
                          : <span className="text-xs text-amber-500">في الانتظار</span>
                        }
                      </td>
                      <td className="px-4 py-3"><span className={`badge ${st.cls} text-xs`}>{st.label}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1.5">
                          <button onClick={()=>openGrading(s.id)}
                            className={`btn-sm ${s.grading_status==='fully_graded'?'btn-secondary':'btn-primary'}`}>
                            {s.grading_status==='fully_graded'?'عرض':'تصحيح'}
                          </button>
                          <button onClick={()=>allowRetake(s)}
                            className="btn-sm btn-danger" title="إعادة الامتحان">
                            🔄
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Grading Modal */}
      {grading && (
        <GradingModal
          sub={grading}
          onClose={()=>setGrading(null)}
          onSave={()=>{ setGrading(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Grading Modal ─────────────────────────────────────────────────────────
function GradingModal({ sub, onClose, onSave }) {
  const essayReview = sub.review.filter(r=>r.type==='essay');
  const [grades, setGrades] = useState(() => {
    const init = {};
    essayReview.forEach(r=>{
      init[r.questionId] = { score: r.earnedScore??'', comment: r.comment??'' };
    });
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const setG = (qId,k,v) => setGrades(g=>({...g,[qId]:{...g[qId],[k]:v}}));

  const handleSave = async () => {
    setError('');
    for (const r of essayReview) {
      const g = grades[r.questionId];
      if (g.score==='' || g.score===undefined) return setError(`يرجى إدخال درجة السؤال: ${r.question.slice(0,30)}...`);
      if (Number(g.score) < 0 || Number(g.score) > r.maxScore)
        return setError(`الدرجة لازم تكون من 0 إلى ${r.maxScore}`);
    }
    setSaving(true);
    try {
      const payload = {};
      essayReview.forEach(r=>{
        payload[r.questionId] = { score: Number(grades[r.questionId].score), comment: grades[r.questionId].comment };
      });
      await api.put(`/submissions/${sub.id}/grade-essay`, { grades: payload });
      onSave();
    } catch(err) {
      setError(err.response?.data?.message||'خطأ في الحفظ');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e=>e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="font-extrabold text-slate-800">{sub.student_name}</h3>
            <p className="text-xs text-slate-400">{sub.exam_title}</p>
            {sub.exam_comment && (
              <p className="text-xs text-blue-600 mt-0.5">💬 {sub.exam_comment}</p>
            )}
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm text-lg">✕</button>
        </div>

        <div className="p-6 space-y-6">
          {/* MCQ summary */}
          {sub.mcq_total > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-xs font-bold text-blue-700 mb-1">نتيجة اختيار من متعدد (تلقائي)</p>
              <p className="text-2xl font-extrabold text-blue-700">{sub.mcq_score}%</p>
              <p className="text-xs text-blue-500">{sub.mcq_correct} / {sub.mcq_total} صحيح</p>
            </div>
          )}

          {/* Essay grading */}
          {essayReview.length === 0 ? (
            <div>
              <p className="text-center text-slate-400 py-4">لا توجد أسئلة مقالية في هذا الامتحان</p>
              {/* Show MCQ review */}
              <div className="space-y-3 mt-4">
                {sub.review.filter(r=>r.type==='mcq').map((r,i)=>(
                  <div key={i} className="bg-slate-50 rounded-xl p-3">
                    <p className="font-semibold text-sm mb-2">{i+1}. {r.question}</p>
                    {r.options?.map((opt,oi)=>(
                      <div key={oi} className={`text-xs px-2 py-1 rounded mb-1
                        ${oi===r.correct?'bg-emerald-100 text-emerald-800':oi===r.chosen&&!r.isCorrect?'bg-red-100 text-red-800':'text-slate-400'}`}>
                        {oi===r.correct?'✅':oi===r.chosen&&!r.isCorrect?'❌':'○'} {opt}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <h4 className="font-bold text-slate-700">تصحيح الأسئلة المقالية</h4>
              {essayReview.map((r,i)=>(
                <div key={r.questionId} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start justify-between mb-2">
                    <p className="font-semibold text-slate-800 text-sm flex-1 ml-4">{i+1}. {r.question}</p>
                    <span className="badge badge-amber text-xs whitespace-nowrap">من {r.maxScore}</span>
                  </div>
                  {/* Student answer */}
                  <div className="bg-white rounded-lg p-3 border border-slate-200 text-sm text-slate-700 mb-3 leading-relaxed min-h-[60px]">
                    {r.answer || <span className="text-slate-400 italic">لم يكتب إجابة</span>}
                  </div>
                  {/* Grading inputs */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1">الدرجة (من {r.maxScore})</label>
                      <input type="number" className="input bg-white text-center font-bold"
                        min="0" max={r.maxScore}
                        value={grades[r.questionId]?.score}
                        onChange={e=>setG(r.questionId,'score',e.target.value)}/>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-slate-500 mb-1">تعليق (اختياري)</label>
                      <input className="input bg-white" placeholder="تعليق على الإجابة..."
                        value={grades[r.questionId]?.comment}
                        onChange={e=>setG(r.questionId,'comment',e.target.value)}/>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <div className="alert alert-danger">{error}</div>}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-slate-200 px-6 py-4 flex gap-3 rounded-b-2xl">
          {essayReview.length > 0 && (
            <button onClick={handleSave} className="btn-primary flex-1" disabled={saving}>
              {saving
                ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : '💾 حفظ التصحيح'
              }
            </button>
          )}
          <button onClick={onClose} className="btn-secondary flex-1">إغلاق</button>
        </div>
      </div>
    </div>
  );
}
