import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../../utils/api';

const GRADES = {4:'رابع ابتدائي',5:'خامس ابتدائي',6:'سادس ابتدائي',7:'أول إعدادي',8:'ثاني إعدادي',9:'ثالث إعدادي',10:'أول ثانوي',11:'ثاني ثانوي',12:'ثالث ثانوي'};

/*
  Excel format expected:
  Row 1: headers (ignored)
  Row 2+: question data
  Columns:
    A: نوع السؤال (mcq / truefalse / essay)
    B: نص السؤال
    C: الخيار 1 (MCQ only)
    D: الخيار 2
    E: الخيار 3
    F: الخيار 4
    G: الإجابة الصحيحة (MCQ: 1-4 | truefalse: صح/خطأ | essay: درجة قصوى)
*/

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb   = XLSX.read(e.target.result, { type: 'array' });
        const ws   = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        const questions = [];
        // Skip header row
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[0] && !row[1]) continue; // skip empty rows

          const type    = String(row[0] || '').trim().toLowerCase();
          const text    = String(row[1] || '').trim();
          if (!text) continue;

          if (type === 'mcq') {
            const options = [
              String(row[2]||'').trim(),
              String(row[3]||'').trim(),
              String(row[4]||'').trim(),
              String(row[5]||'').trim(),
            ];
            const correctNum = parseInt(row[6]) - 1; // 1-based to 0-based
            if (options.some(o=>!o) || isNaN(correctNum) || correctNum<0 || correctNum>3) {
              throw new Error(`السطر ${i+1}: بيانات MCQ ناقصة`);
            }
            questions.push({ type:'mcq', text, options, correct: correctNum });

          } else if (type === 'truefalse') {
            const ans = String(row[6]||'').trim();
            const correct = ans === 'صح' ? 0 : ans === 'خطأ' ? 1 : -1;
            if (correct === -1) throw new Error(`السطر ${i+1}: الإجابة لازم تكون "صح" أو "خطأ"`);
            questions.push({ type:'truefalse', text, options:['صح','خطأ'], correct });

          } else if (type === 'essay') {
            const maxScore = parseInt(row[6]) || 10;
            questions.push({ type:'essay', text, maxScore });

          } else {
            throw new Error(`السطر ${i+1}: نوع السؤال "${row[0]}" غير معروف — استخدم mcq أو truefalse أو essay`);
          }
        }

        if (!questions.length) throw new Error('الملف لا يحتوي على أسئلة');
        resolve(questions);
      } catch(err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsArrayBuffer(file);
  });
}

export default function ImportExamModal({ onClose, onSave }) {
  const [step, setStep]       = useState(1); // 1=upload, 2=preview, 3=details
  const [file, setFile]       = useState(null);
  const [questions, setQuestions] = useState([]);
  const [parseError, setParseError] = useState('');
  const [form, setForm]       = useState({ title:'', grade:'4', duration:30, passScore:50 });
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const inputRef = useRef(null);
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleFile = async (f) => {
    setFile(f); setParseError('');
    try {
      const qs = await parseExcel(f);
      setQuestions(qs);
      setStep(2);
    } catch(err) {
      setParseError(err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSave = async () => {
    if (!form.title) return setError('العنوان مطلوب');
    setSaving(true);
    try {
      await api.post('/exams', {
        title: form.title, grade: Number(form.grade),
        duration: Number(form.duration), passScore: Number(form.passScore),
        questions,
      });
      onSave();
    } catch(err) {
      setError(err.response?.data?.message || 'خطأ في الحفظ');
    } finally { setSaving(false); }
  };

  // Download template
  const downloadTemplate = () => {
    const data = [
      ['النوع', 'نص السؤال', 'خيار 1', 'خيار 2', 'خيار 3', 'خيار 4', 'الإجابة الصحيحة / الدرجة القصوى'],
      ['mcq',       'ما هي عاصمة مصر؟',    'الإسكندرية', 'القاهرة', 'أسوان', 'الجيزة', '2'],
      ['mcq',       'كم عدد أيام الأسبوع؟', '5',          '6',       '7',     '8',      '3'],
      ['truefalse', 'الشمس تشرق من الغرب', '',            '',        '',      '',       'خطأ'],
      ['truefalse', 'الماء يغلي عند 100 درجة', '',         '',        '',      '',       'صح'],
      ['essay',     'اشرح ظاهرة الاحتباس الحراري', '',    '',        '',      '',       '10'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch:12},{wch:35},{wch:15},{wch:15},{wch:15},{wch:15},{wch:20}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'أسئلة');
    XLSX.writeFile(wb, 'template_exam.xlsx');
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="font-extrabold text-slate-800">📊 استيراد امتحان من Excel</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {step===1?'رفع الملف':step===2?`معاينة — ${questions.length} سؤال`:'بيانات الامتحان'}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost btn-sm text-lg">✕</button>
        </div>

        <div className="p-6">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Template download */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-800 mb-1">📥 حمّل النموذج الأول</p>
                <p className="text-xs text-blue-600 mb-3">
                  افتح الملف في Excel، أضيف أسئلتك، بعدين ارفعه هنا.
                </p>
                <button onClick={downloadTemplate} className="btn-primary btn-sm">
                  ⬇️ تحميل نموذج Excel
                </button>
              </div>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={e=>e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div className="text-5xl mb-3">📂</div>
                <p className="font-bold text-slate-700 mb-1">اسحب الملف هنا أو اضغط للاختيار</p>
                <p className="text-xs text-slate-400">يدعم .xlsx و .xls</p>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" className="hidden"
                  onChange={e=>e.target.files[0] && handleFile(e.target.files[0])}/>
              </div>

              {parseError && <div className="alert alert-danger">{parseError}</div>}

              {/* Format guide */}
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-600 mb-2">تنسيق الملف:</p>
                <div className="overflow-x-auto">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-slate-200">
                        {['A: النوع','B: السؤال','C-F: الخيارات','G: الإجابة/الدرجة'].map(h=>(
                          <th key={h} className="px-2 py-1 text-right font-bold">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['mcq','نص السؤال','الخيارات الأربعة','رقم الإجابة (1-4)'],
                        ['truefalse','نص السؤال','—','صح أو خطأ'],
                        ['essay','نص السؤال','—','الدرجة القصوى'],
                      ].map((r,i)=>(
                        <tr key={i} className="border-t border-slate-200">
                          {r.map((c,j)=><td key={j} className="px-2 py-1 text-slate-600">{c}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex gap-2">
                  <span className="badge badge-blue">{questions.filter(q=>q.type==='mcq').length} MCQ</span>
                  <span className="badge badge-green">{questions.filter(q=>q.type==='truefalse').length} صح/خطأ</span>
                  <span className="badge badge-amber">{questions.filter(q=>q.type==='essay').length} مقالي</span>
                </div>
                <button onClick={()=>setStep(1)} className="btn-ghost btn-sm text-xs">← تغيير الملف</button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-3">
                {questions.map((q,i)=>(
                  <div key={i} className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge text-xs ${q.type==='mcq'?'badge-blue':q.type==='truefalse'?'badge-green':'badge-amber'}`}>
                        {q.type==='mcq'?'MCQ':q.type==='truefalse'?'صح/خطأ':'مقالي'}
                      </span>
                      <span className="text-xs text-slate-400">س{i+1}</span>
                    </div>
                    <p className="text-sm text-slate-700">{q.text}</p>
                    {q.type==='mcq' && (
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {q.options.map((o,oi)=>(
                          <span key={oi} className={`text-xs px-1.5 py-0.5 rounded ${oi===q.correct?'bg-emerald-100 text-emerald-700 font-bold':'text-slate-400'}`}>
                            {oi===q.correct?'✓ ':''}{o}
                          </span>
                        ))}
                      </div>
                    )}
                    {q.type==='truefalse' && (
                      <p className="text-xs text-emerald-600 mt-1">✓ {q.correct===0?'صح':'خطأ'}</p>
                    )}
                    {q.type==='essay' && (
                      <p className="text-xs text-amber-600 mt-1">الدرجة القصوى: {q.maxScore}</p>
                    )}
                  </div>
                ))}
              </div>

              <button onClick={()=>setStep(3)} className="btn-primary btn-block">
                التالي — إدخال بيانات الامتحان →
              </button>
            </div>
          )}

          {/* Step 3: Details */}
          {step === 3 && (
            <div className="space-y-4">
              <button onClick={()=>setStep(2)} className="btn-ghost btn-sm text-xs">← رجوع للمعاينة</button>
              {error && <div className="alert alert-danger">{error}</div>}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">عنوان الامتحان *</label>
                <input className="input" placeholder="مثال: امتحان الفصل الأول"
                  value={form.title} onChange={e=>set('title',e.target.value)}/>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الصف</label>
                  <select className="input" value={form.grade} onChange={e=>set('grade',e.target.value)}>
                    {Object.entries(GRADES).map(([k,v])=>(
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">المدة (د)</label>
                  <input type="number" className="input" min="5" max="180"
                    value={form.duration} onChange={e=>set('duration',e.target.value)}/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">النجاح (%)</label>
                  <input type="number" className="input" min="1" max="100"
                    value={form.passScore} onChange={e=>set('passScore',e.target.value)}/>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-600">
                <p className="font-bold mb-1">ملخص:</p>
                <p>{questions.length} سؤال — {GRADES[form.grade]} — {form.duration} دقيقة — نجاح {form.passScore}%</p>
              </div>

              <button onClick={handleSave} className="btn-primary btn-block btn-lg" disabled={saving}>
                {saving
                  ? <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  : '💾 حفظ الامتحان'
                }
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
