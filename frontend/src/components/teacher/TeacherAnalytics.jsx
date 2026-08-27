import { useState, useEffect } from 'react';
import api from '../../utils/api';
import { GRADES } from '../../utils/grades';

function daysSince(dateStr) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function TeacherAnalytics() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId]   = useState(null); // student id currently being reminded/deleted
  const [remindedIds, setRemindedIds] = useState(new Set());

  const load = () => {
    api.get('/teacher/analytics').then(r => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const remindStudent = async (student) => {
    setBusyId(student.id);
    try {
      await api.post('/notifications', {
        studentId: student.id,
        title: '👋 وحشتنا!',
        body: 'مذاكرتش من فترة — يلا ارجع كمّل المذاكرة والامتحانات مستنياك',
      });
      setRemindedIds(s => new Set(s).add(student.id));
    } catch {
      alert('تعذّر إرسال التذكير');
    } finally { setBusyId(null); }
  };

  const removeStudent = async (student) => {
    if (!confirm(`حذف حساب "${student.name}"؟ الإجراء ده مينفعش يترجع.`)) return;
    setBusyId(student.id);
    try {
      await api.delete(`/teacher/students/${student.id}`);
      load();
    } catch {
      alert('تعذّر حذف الحساب');
      setBusyId(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  const { weakestExams = [], inactiveStudents = [], topVideos = [] } = data || {};

  return (
    <div>
      <h2 className="text-xl font-extrabold text-slate-800 mb-1">📈 التحليلات</h2>
      <p className="text-sm text-slate-400 mb-6">نظرة على البيانات عشان تاخد قرارات مبنية على أرقام حقيقية</p>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Weakest exams */}
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">📉 أضعف الامتحانات نجاحًا</h3>
          <p className="text-xs text-slate-400 mb-4">امتحانات ممكن تحتاج مراجعة أو شرح إضافي</p>
          {weakestExams.length === 0 ? (
            <EmptyNote text="لا توجد بيانات كافية بعد"/>
          ) : (
            <div className="space-y-2">
              {weakestExams.map(e => (
                <div key={e.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-extrabold text-sm flex-shrink-0
                    ${e.pass_rate >= 70 ? 'bg-emerald-100 text-emerald-700' : e.pass_rate >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                    {e.pass_rate}%
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{e.title}</p>
                    <p className="text-xs text-slate-400">{GRADES[e.grade] || `صف ${e.grade}`} — {e.submission_count} إجابة</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Most watched videos */}
        <div className="card">
          <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">🎬 أكتر المحتوى مشاهدة</h3>
          <p className="text-xs text-slate-400 mb-4">أكتر الفيديوهات والدروس اللي الطلاب بيتفاعلوا معاها</p>
          {topVideos.length === 0 ? (
            <EmptyNote text="لا توجد مشاهدات مسجّلة بعد"/>
          ) : (
            <div className="space-y-2">
              {topVideos.map((v, i) => (
                <div key={v.item_id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                  <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 font-extrabold text-xs flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm truncate">{v.title || 'بدون عنوان'}</p>
                    <p className="text-xs text-slate-400">{v.unique_students} طالب شاهدوه</p>
                  </div>
                  <span className="badge badge-blue text-xs flex-shrink-0">{v.view_count} مشاهدة</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inactive students */}
        <div className="card lg:col-span-2">
          <h3 className="font-bold text-slate-700 mb-1 flex items-center gap-2">⏰ طلاب مذاكروش من فترة</h3>
          <p className="text-xs text-slate-400 mb-4">طلاب مقبولين بس مش داخلين المنصة من 14 يوم أو أكتر — يستاهلوا تذكير</p>
          {inactiveStudents.length === 0 ? (
            <EmptyNote text="كل الطلاب نشيطين — تمام! 🎉"/>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['الاسم', 'الصف', 'آخر دخول', 'إجراءات'].map(h => (
                      <th key={h} className="text-right text-xs font-bold text-slate-400 pb-2 px-2">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inactiveStudents.map(s => {
                    const days = daysSince(s.last_login_at);
                    const busy = busyId === s.id;
                    return (
                      <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 px-2">
                          <div className="font-semibold text-slate-700">{s.name}</div>
                          <div className="text-xs text-slate-400">{s.username}</div>
                        </td>
                        <td className="py-2 px-2"><span className="badge badge-blue text-xs">{GRADES[s.grade] || `صف ${s.grade}`}</span></td>
                        <td className="py-2 px-2">
                          {days === null
                            ? <span className="badge badge-red text-xs">لم يسجل دخول أبدًا</span>
                            : <span className="badge badge-amber text-xs">من {days} يوم</span>}
                        </td>
                        <td className="py-2 px-2">
                          <div className="flex gap-1.5">
                            <button onClick={() => remindStudent(s)} disabled={busy || remindedIds.has(s.id)}
                              className="btn-secondary btn-sm text-xs disabled:opacity-50">
                              {remindedIds.has(s.id) ? '✅ اتبعت' : busy ? '...' : '🔔 تذكير'}
                            </button>
                            <button onClick={() => removeStudent(s)} disabled={busy}
                              className="btn-danger btn-sm text-xs disabled:opacity-50">
                              🗑️ حذف
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const EmptyNote = ({ text }) => (
  <div className="text-center py-8 text-slate-400 text-sm">{text}</div>
);
