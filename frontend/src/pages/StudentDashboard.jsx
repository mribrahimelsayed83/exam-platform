import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

const GRADES = { 4:'رابع ابتدائي', 5:'خامس ابتدائي', 6:'سادس ابتدائي', 7:'أول إعدادي', 8:'ثاني إعدادي', 9:'ثالث إعدادي', 10:'أول ثانوي', 11:'ثاني ثانوي', 12:'ثالث ثانوي' };

export default function StudentDashboard() {
  const [exams, setExams]     = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab'); // null | 'exams' | 'results'

  useEffect(() => {
    Promise.all([api.get('/exams'), api.get('/submissions/mine')])
      .then(([e,s])=>{ setExams(e.data); setResults(s.data); })
      .finally(()=>setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  // ── Home view (no tab) ──────────────────────────────────────────────────
  if (!tab) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
        <Navbar/>
        <div className="max-w-3xl mx-auto px-4 py-12">

          {/* Welcome */}
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-5 shadow-lg shadow-blue-200">
              👋
            </div>
            <h1 className="text-3xl font-extrabold text-slate-800 mb-2">
              أهلاً، {user?.name}
            </h1>
            {user?.grade && (
              <span className="inline-block bg-blue-100 text-blue-700 text-sm font-bold px-4 py-1 rounded-full">
                {GRADES[user.grade]}
              </span>
            )}
            <p className="text-slate-500 mt-3 text-base">ماذا تريد أن تفعل اليوم؟</p>
          </div>

          {/* 4 Big Blocks */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <HomeBlock
              icon="🎬"
              title="الفيديوهات"
              desc="الدروس والمحتوى التعليمي"
              gradient="from-blue-500 to-blue-700"
              shadow="shadow-blue-200"
              onClick={() => navigate('/student/videos')}
            />
            <HomeBlock
              icon="📝"
              title="امتحانات"
              desc={exams.length > 0 ? `${exams.length} امتحان متاح` : 'لا توجد امتحانات حالياً'}
              gradient="from-violet-500 to-violet-700"
              shadow="shadow-violet-200"
              onClick={() => navigate('/student?tab=exams')}
            />
            <HomeBlock
              icon="📊"
              title="نتائجي"
              desc={results.length > 0 ? `${results.length} امتحان مُنجز` : 'لم تؤدِ أي امتحانات بعد'}
              gradient="from-emerald-500 to-emerald-700"
              shadow="shadow-emerald-200"
              onClick={() => navigate('/student?tab=results')}
            />
            <HomeBlock
              icon="🎯"
              title="امتحانك الخاص"
              desc="أسئلة من إجاباتك الخاطئة"
              gradient="from-amber-500 to-orange-600"
              shadow="shadow-amber-200"
              onClick={() => navigate('/student/personal-exam')}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Exams / Results views ───────────────────────────────────────────────
  const view = tab === 'results' ? 'results' : 'exams';

  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar/>
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Back + Title */}
        <div className="mb-6">
          <button onClick={() => navigate('/student')}
            className="text-slate-500 hover:text-slate-800 text-sm mb-3 flex items-center gap-1 transition-colors">
            ← رجوع للرئيسية
          </button>
          <h1 className="text-2xl font-extrabold text-slate-800">
            {view === 'exams' ? '📝 الامتحانات المتاحة' : '📊 نتائجي'}
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {view === 'exams' ? 'امتحانات صفك الدراسي' : `${results.length} امتحان مُنجز`}
          </p>
        </div>

        {view === 'exams' && (
          exams.length === 0
            ? <Empty icon="📭" title="لا توجد امتحانات" desc="لم يتم إضافة امتحانات لصفك بعد"/>
            : <div className="space-y-3">
                {exams.map(exam => <ExamCard key={exam.id} exam={exam} onStart={() => navigate(`/student/exam/${exam.id}`)}/>)}
              </div>
        )}

        {view === 'results' && (
          results.length === 0
            ? <Empty icon="📊" title="لا توجد نتائج" desc="لم تؤدِ أي امتحانات حتى الآن"/>
            : <div className="space-y-3">
                {results.map(sub => <ResultRow key={sub.id} sub={sub} onView={() => navigate(`/student/result/${sub.id}`)}/>)}
              </div>
        )}
      </div>
    </div>
  );
}

// ── Home Block ────────────────────────────────────────────────────────────
function HomeBlock({ icon, title, desc, gradient, shadow, onClick }) {
  return (
    <div onClick={onClick}
      className={`cursor-pointer rounded-3xl bg-gradient-to-br ${gradient} p-8 text-white text-center
        hover:shadow-2xl hover:-translate-y-2 transition-all duration-200 shadow-lg ${shadow}`}>
      <div className="text-6xl mb-4 drop-shadow">{icon}</div>
      <h2 className="text-xl font-extrabold mb-2">{title}</h2>
      <p className="text-white/70 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}

// ── Exam Card ─────────────────────────────────────────────────────────────
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

// ── Result Row ────────────────────────────────────────────────────────────
function ResultRow({ sub, onView }) {
  const isDone     = sub.grading_status === 'fully_graded';
  const finalScore = sub.final_score;
  const pass       = isDone && finalScore >= sub.pass_score;

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
              {isDone ? '✅ تم التصحيح' : `⏳ ${sub.essay_graded}/${sub.essay_total} مقالي صُحّح`}
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

// ── Empty State ───────────────────────────────────────────────────────────
function Empty({ icon, title, desc }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <div className="text-5xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-slate-600 mb-1">{title}</h3>
      <p className="text-sm">{desc}</p>
    </div>
  );
}
