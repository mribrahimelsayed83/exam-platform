import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const emptyMCQ   = () => ({ type:'mcq',   text:'', options:['','','',''], correct:0 });
const emptyEssay = () => ({ type:'essay', text:'', maxScore:10 });
const emptyTF    = () => ({ type:'truefalse', text:'', correct:0 }); // 0=صح, 1=خطأ

export default function CreateExam({ onSuccess }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title:'', description:'', grade:'4', duration:30, passScore:50,
    startsAt:'', endsAt:'', examComment:'',
  });
  const [questions, setQuestions]       = useState([emptyMCQ()]);
  const [useTimeWindow, setUseTimeWindow] = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  // Exam type: standalone | lesson | playlist
  const [examType, setExamType]               = useState('standalone');
  const [allPlaylists, setAllPlaylists]       = useState([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('');
  const [allLessons, setAllLessons]           = useState([]);
  const [selectedLessonId, setSelectedLessonId]     = useState('');
  const [loadingPlaylists, setLoadingPlaylists] = useState(false);
  const [loadingLessons, setLoadingLessons]     = useState(false);

  useEffect(() => {
    if (examType === 'standalone') return;
    setLoadingPlaylists(true);
    setSelectedPlaylistId('');
    setAllLessons([]);
    setSelectedLessonId('');
    api.get('/videos/manage/playlists')
      .then(r => setAllPlaylists(r.data || []))
      .catch(() => setAllPlaylists([]))
      .finally(() => setLoadingPlaylists(false));
  }, [examType]);

  useEffect(() => {
    if (examType !== 'lesson' || !selectedPlaylistId) { setAllLessons([]); setSelectedLessonId(''); return; }
    setLoadingLessons(true);
    setSelectedLessonId('');
    api.get(`/videos/manage/playlists/${selectedPlaylistId}/subs`)
      .then(r => setAllLessons(r.data?.subs || r.data || []))
      .catch(() => setAllLessons([]))
      .finally(() => setLoadingLessons(false));
  }, [selectedPlaylistId, examType]);

  const setF = (k,v) => setForm(f=>({...f,[k]:v}));
  const addMCQ   = () => setQuestions(q=>[...q, emptyMCQ()]);
  const addEssay = () => setQuestions(q=>[...q, emptyEssay()]);
  const removeQ  = (i) => setQuestions(q=>q.filter((_,idx)=>idx!==i));

  const updateQ = (i, k, v) => setQuestions(q=>q.map((x,idx)=>idx===i?{...x,[k]:v}:x));
  const updateOpt = (qi,oi,v) => setQuestions(q=>q.map((x,idx)=>idx===qi
    ?{...x,options:x.options.map((o,i)=>i===oi?v:o)}:x));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    for (let i=0; i<questions.length; i++) {
      const q=questions[i];
      if (!q.text.trim()) return setError(`السؤال ${i+1}: النص فاضي`);
      if (q.type==='mcq' && q.options.some(o=>!o.trim()))
        return setError(`السؤال ${i+1}: جميع خيارات الـ MCQ مطلوبة`);
      if (q.type==='essay' && (!q.maxScore || q.maxScore<1))
        return setError(`السؤال ${i+1}: الدرجة القصوى مطلوبة`);
    }
    if (useTimeWindow && (!form.startsAt || !form.endsAt))
      return setError('يرجى تحديد وقت البداية والنهاية');
    if (useTimeWindow && new Date(form.startsAt) >= new Date(form.endsAt))
      return setError('وقت النهاية لازم بعد وقت البداية');

    if (examType === 'lesson' && !selectedLessonId)
      return setError('يرجى اختيار الدرس');
    if (examType === 'playlist' && !selectedPlaylistId)
      return setError('يرجى اختيار القائمة');

    setLoading(true);
    try {
      const { data: created } = await api.post('/exams', {
        title:form.title, description:form.description,
        grade:Number(form.grade), duration:Number(form.duration),
        passScore:Number(form.passScore),
        startsAt: useTimeWindow?form.startsAt:null,
        endsAt:   useTimeWindow?form.endsAt:null,
        examComment: form.examComment,
        questions: questions.map(q=>
          q.type==='mcq'
            ? {type:'mcq',      text:q.text, options:q.options, correct:q.correct}
            : q.type==='truefalse'
            ? {type:'truefalse', text:q.text, options:['صح','خطأ'], correct:Number(q.correct)}
            : {type:'essay',    text:q.text, maxScore:Number(q.maxScore)}
        ),
      });
      // Attach exam to lesson or playlist if needed
      if (examType === 'lesson' && selectedLessonId && created.examId) {
        await api.post(`/videos/manage/playlists/${selectedLessonId}/items`, {
          type: 'exam', title: form.title, description: form.description,
          exam_id: created.examId,
        }).catch(() => {});
      } else if (examType === 'playlist' && selectedPlaylistId && created.examId) {
        await api.post(`/videos/manage/playlists/${selectedPlaylistId}/items`, {
          type: 'exam', title: form.title, description: form.description,
          exam_id: created.examId,
        }).catch(() => {});
      }
      if (onSuccess) onSuccess();
      else navigate('/teacher/exams');
    } catch(err) {
      setError(err.response?.data?.message||'خطأ في الحفظ');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="text-xl font-extrabold text-slate-800 mb-5">إنشاء امتحان جديد</h2>

      {/* Exam Type */}
      <div className="card mb-4">
        <h3 className="font-bold text-slate-700 mb-4">نوع الامتحان</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { value:'standalone', label:'🔒 امتحان منفصل',      desc:'يظهر في قائمة الامتحانات المستقلة' },
            { value:'lesson',     label:'📚 داخل درس',           desc:'يُضاف لمحتوى درس في وحدة' },
            { value:'playlist',   label:'📂 داخل قائمة مباشرة', desc:'يُضاف مباشرةً لقائمة فيديوهات' },
          ].map(opt => (
            <label key={opt.value}
              className={`flex-1 min-w-[120px] cursor-pointer p-3 rounded-xl border-2 transition-all
                ${examType === opt.value ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
              <input type="radio" name="examType" value={opt.value}
                checked={examType === opt.value}
                onChange={() => setExamType(opt.value)}
                className="sr-only"/>
              <div className="font-bold text-sm text-slate-800">{opt.label}</div>
              <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
            </label>
          ))}
        </div>

        {/* Playlist selector */}
        {examType !== 'standalone' && (
          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">
              {examType === 'lesson' ? 'اختر الوحدة / القائمة الأم' : 'اختر القائمة'}
            </label>
            {loadingPlaylists ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block"/>
                جاري تحميل القوائم...
              </div>
            ) : (
              <select className="input" value={selectedPlaylistId}
                onChange={e => setSelectedPlaylistId(e.target.value)}>
                <option value="">-- اختر قائمة --</option>
                {allPlaylists.map(pl => (
                  <option key={pl.id} value={pl.id}>{pl.title}</option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Lesson selector */}
        {examType === 'lesson' && selectedPlaylistId && (
          <div className="mt-4">
            <label className="block text-xs font-bold text-slate-500 mb-1.5">اختر الدرس</label>
            {loadingLessons ? (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin inline-block"/>
                جاري تحميل الدروس...
              </div>
            ) : allLessons.length === 0 ? (
              <p className="text-sm text-slate-400">لا توجد دروس في هذه القائمة</p>
            ) : (
              <select className="input" value={selectedLessonId}
                onChange={e => setSelectedLessonId(e.target.value)}>
                <option value="">-- اختر درس --</option>
                {allLessons.map(sub => (
                  <option key={sub.id} value={sub.id}>{sub.title}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="card mb-4">
        <h3 className="font-bold text-slate-700 mb-4">بيانات الامتحان</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">عنوان الامتحان *</label>
            <input className="input" value={form.title} onChange={e=>setF('title',e.target.value)} required/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">الصف *</label>
            <select className="input" value={form.grade} onChange={e=>setF('grade',e.target.value)}>
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
            <label className="block text-xs font-bold text-slate-500 mb-1.5">المدة (دقائق)</label>
            <input type="number" className="input" min="5" max="180"
              value={form.duration} onChange={e=>setF('duration',e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1.5">درجة النجاح (%)</label>
            <input type="number" className="input" min="1" max="100"
              value={form.passScore} onChange={e=>setF('passScore',e.target.value)}/>
          </div>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-500 mb-1.5">وصف (اختياري)</label>
          <textarea className="input resize-none" rows={2}
            value={form.description} onChange={e=>setF('description',e.target.value)}/>
        </div>
        <div className="mt-4">
          <label className="block text-xs font-bold text-slate-500 mb-1.5">
            💬 تعليق على الامتحان (اختياري)
          </label>
          <textarea className="input resize-none" rows={2}
            placeholder="تعليق هيظهر للطالب في نتيجته بعد التسليم..."
            value={form.examComment} onChange={e=>setF('examComment',e.target.value)}/>
        </div>
        {/* Time window */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input type="checkbox" className="accent-blue-600 w-4 h-4"
              checked={useTimeWindow} onChange={e=>setUseTimeWindow(e.target.checked)}/>
            <span className="text-sm font-bold text-slate-700">🕒 تحديد نافذة زمنية (اختياري)</span>
          </label>
          {useTimeWindow && (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">وقت البداية</label>
                <input type="datetime-local" className="input"
                  value={form.startsAt} onChange={e=>setF('startsAt',e.target.value)}/>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">وقت النهاية</label>
                <input type="datetime-local" className="input"
                  value={form.endsAt} onChange={e=>setF('endsAt',e.target.value)}/>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Questions */}
      <div className="card mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-700">الأسئلة ({questions.length})</h3>
          <div className="flex gap-2">
            <button type="button" onClick={addMCQ}   className="btn-primary btn-sm">+ MCQ</button>
            <button type="button" onClick={addEssay} className="btn-secondary btn-sm">+ مقالي</button>
            <button type="button" onClick={()=>setQuestions(q=>[...q, emptyTF()])} className="btn-secondary btn-sm">+ صح/خطأ</button>
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((q,qi)=>(
            <div key={qi} className={`rounded-xl border p-4 ${q.type==='essay'?'bg-amber-50 border-amber-200':'bg-slate-50 border-slate-200'}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className={`badge ${q.type==='mcq'?'badge-blue':'badge-amber'}`}>
                    {q.type==='mcq'?'MCQ':q.type==='truefalse'?'صح/خطأ':'مقالي'}
                  </span>
                  <span className="font-bold text-sm text-slate-600">السؤال {qi+1}</span>
                </div>
                {questions.length>1 && (
                  <button type="button" onClick={()=>removeQ(qi)}
                    className="text-red-500 hover:text-red-700 text-xs font-bold">حذف ✕</button>
                )}
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
              ) : q.type==='truefalse' ? (
                <div>
                  <p className="text-xs font-bold text-slate-400 mb-2">الإجابة الصحيحة</p>
                  <div className="flex gap-3">
                    {['صح','خطأ'].map((opt,oi)=>(
                      <label key={oi} className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-all
                        ${Number(q.correct)===oi?'border-emerald-500 bg-emerald-50 text-emerald-700':'border-slate-200 hover:border-slate-300'}`}>
                        <input type="radio" name={`tf-${qi}`} checked={Number(q.correct)===oi}
                          onChange={()=>updateQ(qi,'correct',oi)} className="accent-emerald-600"/>
                        <span className="font-bold">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1.5">الدرجة القصوى</label>
                  <input type="number" className="input bg-white max-w-[120px]" min="1" max="100"
                    value={q.maxScore} onChange={e=>updateQ(qi,'maxScore',e.target.value)}/>
                  <p className="text-xs text-slate-400 mt-1">الطالب هيكتب إجابته وأنت بتصححها يدوياً</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}
      <div className="flex gap-3">
        <button type="submit" className="btn-primary btn-lg" disabled={loading}>
          {loading
            ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
            : '💾 حفظ الامتحان'
          }
        </button>
        <button type="button" onClick={()=>navigate('/teacher/exams')} className="btn-secondary">إلغاء</button>
      </div>
    </form>
  );
}
