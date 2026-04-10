import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';
import ImportExamModal from './ImportExamModal';

const gradeLabel = { 1:'أول ثانوي', 2:'ثاني ثانوي', 3:'ثالث ثانوي' };

export default function ExamsList() {
  const [exams, setExams]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState(null);
  const [editing, setEditing]       = useState(null);
  const [importing, setImporting]   = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    api.get('/exams/all').then(r => setExams(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const deleteExam = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الامتحان؟')) return;
    await api.delete(`/exams/${id}`); load();
  };
  const toggleExam = async (id) => {
    await api.put(`/exams/${id}/toggle`); load();
  };

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-extrabold text-slate-800">الامتحانات</h2>
        <div className="flex gap-2"><button onClick={() => setImporting(true)} className="btn-secondary btn-sm">📊 استيراد Excel</button><button onClick={() => navigate('/teacher/create')} className="btn-primary btn-sm">+ امتحان جديد</button></div>
      </div>

      {exams.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📄</div>
          <h3 className="text-lg font-bold text-slate-600 mb-4">لا توجد امتحانات</h3>
          <button onClick={() => navigate('/teacher/create')} className="btn-primary">إنشاء امتحان</button>
        </div>
      ) : (
        <div className="space-y-3">
          {exams.map(exam => (
            <div key={exam.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-slate-800">{exam.title}</h3>
                    <span className="badge badge-blue">{gradeLabel[exam.grade]}</span>
                    <span className={`badge ${exam.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {exam.is_active ? '● مفعّل' : '○ موقوف'}
                    </span>
                    {exam.essay_count > 0 && <span className="badge badge-amber">{exam.essay_count} مقالي</span>}
                  </div>
                  {exam.description && <p className="text-xs text-slate-500 mb-1">{exam.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                    <span>{exam.question_count} سؤال</span>
                    <span>•</span><span>{exam.duration} دقيقة</span>
                    <span>•</span><span>نجاح {exam.pass_score}%</span>
                    <span>•</span><span>{exam.submission_count} إجابة</span>
                    {exam.starts_at && <><span>•</span>
                      <span>من {new Date(exam.starts_at).toLocaleString('ar-EG',{hour:'2-digit',minute:'2-digit',month:'short',day:'numeric'})}</span></>}
                  </div>
                  {exam.exam_comment && (
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <p className="text-xs font-bold text-slate-400 mb-0.5">💬 التعليق:</p>
                      <p className="text-xs text-slate-600">{exam.exam_comment}</p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-wrap pt-3 border-t border-slate-100 mt-2">
                <button onClick={() => toggleExam(exam.id)}
                  className={`btn-sm ${exam.is_active ? 'btn-secondary' : 'btn-primary'}`}>
                  {exam.is_active ? 'إيقاف' : 'تفعيل'}
                </button>
                <button onClick={() => setEditing({...exam, tab:'info'})} className="btn-secondary btn-sm">✏️ تعديل</button>
                <button onClick={() => setEditing({...exam, tab:'questions'})} className="btn-secondary btn-sm">❓ الأسئلة</button>
                <button onClick={() => navigate('/teacher/submissions')} className="btn-secondary btn-sm">📊 إجابات</button>
                <button onClick={() => setCommenting(exam)} className="btn-secondary btn-sm">
                  💬 {exam.exam_comment ? 'تعديل التعليق' : 'إضافة تعليق'}
                </button>
                <button onClick={() => deleteExam(exam.id)} className="btn-danger btn-sm">حذف</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {commenting && <CommentModal exam={commenting} onClose={()=>setCommenting(null)} onSave={()=>{setCommenting(null);load();}}/>}
      {editing    && <EditExamModal exam={editing} onClose={()=>setEditing(null)} onSave={()=>{setEditing(null);load();}}/>}
      {importing  && <ImportExamModal onClose={()=>setImporting(false)} onSave={()=>{setImporting(false);load();navigate('/teacher/exams');}}/>}
    </div>
  );
}

// ══════════════════════════════════════════════════
// Edit Exam Modal — with tabs: بيانات | أسئلة
// ══════════════════════════════════════════════════
function EditExamModal({ exam, onClose, onSave }) {
  const [tab, setTab] = useState(exam.tab || 'info');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl"
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 pt-5 pb-0 rounded-t-2xl z-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-extrabold text-slate-800">تعديل: {exam.title}</h3>
            <button onClick={onClose} className="btn-ghost btn-sm text-lg">✕</button>
          </div>
          <div className="flex gap-1">
            {[{k:'info',label:'📋 البيانات'},{k:'questions',label:'❓ الأسئلة'}].map(t=>(
              <button key={t.k} onClick={()=>setTab(t.k)}
                className={`px-4 py-2 text-sm font-bold rounded-t-lg border-b-2 transition-all
                  ${tab===t.k?'border-blue-600 text-blue-600 bg-blue-50':'border-transparent text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {tab==='info'      && <EditInfoTab      exam={exam} onSave={onSave}/>}
          {tab==='questions' && <EditQuestionsTab exam={exam} onSave={onSave}/>}
        </div>
      </div>
    </div>
  );
}

// ── Tab 1: بيانات الامتحان ────────────────────────────────────────────────
function EditInfoTab({ exam, onSave }) {
  const [form, setForm] = useState({
    title:       exam.title,
    description: exam.description || '',
    grade:       exam.grade,
    duration:    exam.duration,
    passScore:   exam.pass_score,
    examComment: exam.exam_comment || '',
    startsAt:    exam.starts_at ? exam.starts_at.slice(0,16) : '',
    endsAt:      exam.ends_at   ? exam.ends_at.slice(0,16)   : '',
  });
  const [useTime, setUseTime] = useState(!!(exam.starts_at||exam.ends_at));
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    if (!form.title) return setError('العنوان مطلوب');
    setLoading(true);
    try {
      await api.put(`/exams/${exam.id}`, {
        title: form.title, description: form.description,
        grade: Number(form.grade), duration: Number(form.duration),
        passScore: Number(form.passScore), examComment: form.examComment,
        startsAt: useTime?form.startsAt:null, endsAt: useTime?form.endsAt:null,
      });
      onSave();
    } catch(err) {
      setError(err.response?.data?.message||'خطأ في الحفظ');
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      {error && <div className="alert alert-danger">{error}</div>}
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">العنوان *</label>
        <input className="input" value={form.title} onChange={e=>set('title',e.target.value)}/>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">الصف</label>
          <select className="input" value={form.grade} onChange={e=>set('grade',e.target.value)}>
              <option value="4">رابع ابتدائي</option>
              <option value="5">خامس ابتدائي</option>
              <option value="6">سادس ابتدائي</option>
              <option value="7">أول إعدادي</option>
              <option value="8">ثاني إعدادي</option>
              <option value="9">ثالث إعدادي</option>
              <option value="10">أول ثانوي</option>
              <option value="11">ثاني ثانوي</option>
              <option value="12">ثالث ثانوي</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">المدة (دقائق)</label>
          <input type="number" className="input" value={form.duration} onChange={e=>set('duration',e.target.value)}/>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">درجة النجاح (%)</label>
          <input type="number" className="input" value={form.passScore} onChange={e=>set('passScore',e.target.value)}/>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">وصف</label>
        <textarea className="input resize-none" rows={2} value={form.description} onChange={e=>set('description',e.target.value)}/>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 mb-1">💬 تعليق على الامتحان</label>
        <textarea className="input resize-none" rows={2} value={form.examComment}
          onChange={e=>set('examComment',e.target.value)} placeholder="يظهر للطالب في نتيجته..."/>
      </div>
      <div className="pt-2 border-t border-slate-100">
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input type="checkbox" className="accent-blue-600 w-4 h-4"
            checked={useTime} onChange={e=>setUseTime(e.target.checked)}/>
          <span className="text-sm font-bold text-slate-700">🕒 نافذة زمنية</span>
        </label>
        {useTime && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">البداية</label>
              <input type="datetime-local" className="input" value={form.startsAt} onChange={e=>set('startsAt',e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">النهاية</label>
              <input type="datetime-local" className="input" value={form.endsAt} onChange={e=>set('endsAt',e.target.value)}/>
            </div>
          </div>
        )}
      </div>
      <button onClick={handleSave} className="btn-primary w-full" disabled={loading}>
        {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '💾 حفظ البيانات'}
      </button>
    </div>
  );
}

// ── Tab 2: تعديل الأسئلة ─────────────────────────────────────────────────
function EditQuestionsTab({ exam, onSave }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    api.get(`/exams/${exam.id}/questions/edit`)
      .then(r => setQuestions(r.data.map(q => ({
        ...q,
        options: q.options || ['','','',''],
        maxScore: q.max_score || 10,
      }))))
      .finally(() => setLoading(false));
  }, []);

  const addMCQ   = () => setQuestions(q=>[...q, {type:'mcq',   text:'', options:['','','',''], correct:0}]);
  const addEssay = () => setQuestions(q=>[...q, {type:'essay', text:'', maxScore:10}]);
  const removeQ  = (i) => { if(questions.length<=1){alert('لازم يكون فيه سؤال واحد على الأقل');return;} setQuestions(q=>q.filter((_,idx)=>idx!==i)); };

  const updateQ   = (i,k,v) => setQuestions(q=>q.map((x,idx)=>idx===i?{...x,[k]:v}:x));
  const updateOpt = (qi,oi,v) => setQuestions(q=>q.map((x,idx)=>idx===qi?{...x,options:x.options.map((o,i)=>i===oi?v:o)}:x));

  const handleSave = async () => {
    setError('');
    for (let i=0; i<questions.length; i++) {
      const q=questions[i];
      if (!q.text.trim()) return setError(`السؤال ${i+1}: النص فاضي`);
      if (q.type==='mcq' && q.options.some(o=>!o.trim())) return setError(`السؤال ${i+1}: جميع الخيارات مطلوبة`);
      if (q.type==='essay' && (!q.maxScore||q.maxScore<1)) return setError(`السؤال ${i+1}: الدرجة القصوى مطلوبة`);
    }
    setSaving(true);
    try {
      await api.put(`/exams/${exam.id}/questions`, {
        questions: questions.map(q=>
          q.type==='mcq'
            ? {type:'mcq',   text:q.text, options:q.options, correct:q.correct}
            : {type:'essay', text:q.text, maxScore:Number(q.maxScore)}
        )
      });
      onSave();
    } catch(err) {
      setError(err.response?.data?.message||'خطأ في الحفظ');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold text-slate-600">{questions.length} سؤال</span>
        <div className="flex gap-2">
          <button type="button" onClick={addMCQ}   className="btn-primary btn-sm">+ MCQ</button>
          <button type="button" onClick={addEssay} className="btn-secondary btn-sm">+ مقالي</button>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      <div className="space-y-4 mb-5">
        {questions.map((q,qi)=>(
          <div key={qi} className={`rounded-xl border p-4 ${q.type==='essay'?'bg-amber-50 border-amber-200':'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`badge ${q.type==='mcq'?'badge-blue':'badge-amber'}`}>
                  {q.type==='mcq'?'MCQ':'مقالي'}
                </span>
                <span className="font-bold text-sm text-slate-600">السؤال {qi+1}</span>
              </div>
              <button type="button" onClick={()=>removeQ(qi)}
                className="text-red-500 hover:text-red-700 text-xs font-bold">حذف ✕</button>
            </div>

            <input className="input bg-white mb-3" placeholder="نص السؤال..."
              value={q.text} onChange={e=>updateQ(qi,'text',e.target.value)}/>

            {q.type==='mcq' ? (
              <>
                <p className="text-xs font-bold text-slate-400 mb-2">الخيارات — اختر الصحيح</p>
                {q.options.map((opt,oi)=>(
                  <div key={oi} className="flex items-center gap-2 mb-2">
                    <label className="flex items-center gap-1.5 text-xs text-emerald-600 font-bold whitespace-nowrap cursor-pointer">
                      <input type="radio" name={`correct-${qi}`} checked={q.correct===oi}
                        onChange={()=>updateQ(qi,'correct',oi)} className="accent-emerald-600"/>
                      صحيح
                    </label>
                    <input className="input bg-white text-sm flex-1" placeholder={`الخيار ${oi+1}`}
                      value={opt} onChange={e=>updateOpt(qi,oi,e.target.value)}/>
                  </div>
                ))}
              </>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">الدرجة القصوى</label>
                <input type="number" className="input bg-white max-w-[120px]" min="1" max="100"
                  value={q.maxScore} onChange={e=>updateQ(qi,'maxScore',e.target.value)}/>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-700">
        ⚠️ تعديل الأسئلة مش هيأثر على الإجابات اللي اتسلمت قبل التعديل
      </div>

      <button onClick={handleSave} className="btn-primary w-full" disabled={saving}>
        {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '💾 حفظ الأسئلة'}
      </button>
    </div>
  );
}

// ── Comment Modal ─────────────────────────────────────────────────────────
function CommentModal({ exam, onClose, onSave }) {
  const [comment, setComment] = useState(exam.exam_comment || '');
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/exams/${exam.id}/comment`, { examComment: comment });
      onSave();
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-extrabold text-slate-800">تعليق على الامتحان</h3>
            <p className="text-xs text-slate-400 mt-0.5">{exam.title}</p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm text-lg">✕</button>
        </div>
        <textarea className="input resize-none mb-4" rows={4}
          placeholder="تعليق هيظهر للطالب في نتيجته..."
          value={comment} onChange={e=>setComment(e.target.value)}/>
        <div className="flex gap-3">
          <button onClick={handleSave} className="btn-primary flex-1" disabled={loading}>
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '💾 حفظ'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

const Spinner = () => (
  <div className="flex justify-center py-20">
    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
  </div>
);
