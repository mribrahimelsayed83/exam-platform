import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import api from '../utils/api';

const gradeLabel = {1:'أول ثانوي',2:'ثاني ثانوي',3:'ثالث ثانوي'};

export default function StudentDashboard() {
  const [exams, setExams]     = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const initTab  = new URLSearchParams(location.search).get('tab');
  const [view, setView] = useState(initTab === 'results' ? 'results' : 'exams');

  useEffect(() => {
    Promise.all([api.get('/exams'), api.get('/submissions/mine')])
      .then(([e,s])=>{ setExams(e.data); setResults(s.data); })
      .finally(()=>setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar/>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-800">
            {view==='exams'?'الامتحانات المتاحة':'نتائجي'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {view==='exams'?'امتحانات صفك الدراسي':`${results.length} امتحان مُنجز`}
          </p>
        </div>

        {view==='exams' && (
          exams.length===0
            ? <Empty icon="📭" title="لا توجد امتحانات" desc="لم يتم إضافة امتحانات لصفك بعد"/>
            : <div className="grid sm:grid-cols-2 gap-4">
                {exams.map(exam=><ExamCard key={exam.id} exam={exam} onStart={()=>navigate(`/student/exam/${exam.id}`)}/>)}
              </div>
        )}

        {view==='results' && (
          results.length===0
            ? <Empty icon="📊" title="لا توجد نتائج" desc="لم تؤدِ أي امتحانات حتى الآن"/>
            : <div className="space-y-3">
                {results.map(sub=><ResultRow key={sub.id} sub={sub} onView={()=>navigate(`/student/result/${sub.id}`)}/>)}
              </div>
        )}
      </div>
    </div>
  );
}

function ExamCard({ exam, onStart }) {
  const done = !!exam.submission_id;
  const gradingStatus = exam.grading_status;
  const finalScore    = exam.final_score;
  const isPending     = done && gradingStatus && gradingStatus !== 'fully_graded';

  return (
    <div className={`card border-r-4 ${done ? (isPending?'border-r-amber-400':'border-r-emerald-500') : 'border-r-blue-500'}`}>
      <div className="flex items-start justify-between mb-3">
        <span className={`badge ${done?(isPending?'badge-amber':'badge-green'):'badge-blue'}`}>
          {done?(isPending?'⏳ قيد التصحيح':'✅ مُنجز'):'🔵 جديد'}
        </span>
        <span className="text-xs text-slate-400">{exam.duration} دقيقة</span>
      </div>
      <h3 className="font-bold text-slate-800 mb-1">{exam.title}</h3>
      {exam.description && <p className="text-sm text-slate-500 mb-3">{exam.description}</p>}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
        <span className="text-xs text-slate-400">{exam.question_count} سؤال</span>
        {done
          ? finalScore !== null
            ? <span className={`font-bold text-sm ${finalScore>=exam.pass_score?'text-emerald-600':'text-red-600'}`}>
                {finalScore}% — {finalScore>=exam.pass_score?'ناجح ✓':'راسب ✗'}
              </span>
            : <span className="text-xs text-amber-600 font-bold">المقالي قيد التصحيح</span>
          : <button onClick={onStart} className="btn-primary btn-sm">ابدأ الامتحان ←</button>
        }
      </div>
    </div>
  );
}

function ResultRow({ sub, onView }) {
  const isDone    = sub.grading_status === 'fully_graded';
  const finalScore = sub.final_score;
  const pass = isDone && finalScore >= sub.pass_score;

  return (
    <div className={`card border-r-4 ${isDone?(pass?'border-r-emerald-500':'border-r-red-500'):'border-r-amber-400'} cursor-pointer hover:shadow-md transition-shadow`}
      onClick={onView}>
      <div className="flex items-center justify-between">
        <div>
          <div className="font-bold text-slate-800">{sub.exam_title}</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {new Date(sub.submitted_at).toLocaleDateString('ar-EG',{year:'numeric',month:'long',day:'numeric'})}
          </div>
          {sub.essay_total > 0 && (
            <div className="text-xs text-amber-600 mt-1">
              {isDone ? `✅ تم التصحيح` : `⏳ ${sub.essay_graded}/${sub.essay_total} مقالي صُحّح`}
            </div>
          )}
        </div>
        <div className="text-center">
          {isDone
            ? <><div className={`text-2xl font-extrabold ${pass?'text-emerald-600':'text-red-600'}`}>{finalScore}%</div>
               <span className={`badge ${pass?'badge-green':'badge-red'} text-xs`}>{pass?'ناجح':'راسب'}</span></>
            : <><div className="text-2xl font-extrabold text-amber-500">⏳</div>
               <span className="badge badge-amber text-xs">قيد التصحيح</span></>
          }
        </div>
      </div>
    </div>
  );
}

function Empty({ icon, title, desc }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-slate-600 mb-1">{title}</h3>
      <p className="text-sm">{desc}</p>
    </div>
  );
}
