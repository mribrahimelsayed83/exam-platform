import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import StudentDetail from './StudentDetail';

const GRADES = {9:'ثالث إعدادي',10:'أول ثانوي',11:'ثاني ثانوي',12:'ثالث ثانوي'};
const gradeLabel = (g) => GRADES[g] || '—';

const statusMap = {
  pending:  { label:'في الانتظار', cls:'badge-amber' },
  approved: { label:'مقبول',       cls:'badge-green' },
  rejected: { label:'مرفوض',       cls:'badge-red'   },
};

export default function StudentsList() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [students, setStudents] = useState([]);
  const [filter, setFilter]         = useState('all');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [scoreSort, setScoreSort]   = useState(null);
  const [honorSort, setHonorSort]   = useState(null);
  const [loading, setLoading]       = useState(true);
  const [editing, setEditing]       = useState(null);
  const [detailId, setDetailId]     = useState(null);
  const [resetPw, setResetPw]       = useState(null);

  const openId = searchParams.get('open');
  useEffect(() => {
    if (openId) {
      setDetailId(Number(openId));
      setSearchParams({}, { replace: true });
    }
  }, [openId]);

  const load = () => {
    setLoading(true);
    api.get(`/teacher/students?status=${filter}`)
      .then(r => setStudents(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, [filter]);

  const approve = async (id) => { await api.put(`/teacher/students/${id}/approve`); load(); };
  const reject  = async (id) => { await api.put(`/teacher/students/${id}/reject`);  load(); };
  const remove  = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطالب؟')) return;
    await api.delete(`/teacher/students/${id}`); load();
  };

  const filtered = (gradeFilter === 'all'
    ? students
    : students.filter(s => String(s.grade) === gradeFilter)
  ).slice().sort((a, b) => {
    if (honorSort) {
      const av = a.avg_score != null ? a.avg_score * a.submission_count : -1;
      const bv = b.avg_score != null ? b.avg_score * b.submission_count : -1;
      return honorSort === 'asc' ? av - bv : bv - av;
    }
    if (scoreSort) {
      const av = a.avg_score ?? -1;
      const bv = b.avg_score ?? -1;
      return scoreSort === 'asc' ? av - bv : bv - av;
    }
    return 0;
  });

  // Export CSV
  const exportExcel = () => {
    const rows = [
      ['الاسم','اسم المستخدم','الصف','تليفون الطالب','تليفون ولي الأمر','الحالة','الامتحانات','متوسط الدرجات','تاريخ التسجيل'],
      ...filtered.map(s => [
        s.name, s.username, gradeLabel(s.grade),
        s.phone, s.parent_phone,
        statusMap[s.status]?.label || s.status,
        s.submission_count, s.avg_score ?? '—',
        new Date(s.created_at).toLocaleDateString('ar-EG'),
      ])
    ];
    const csv = '\uFEFF' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `طلاب_${filter}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  if (detailId) return <StudentDetail studentId={detailId} onBack={() => setDetailId(null)} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-extrabold text-slate-800">الطلاب</h2>
        <button onClick={exportExcel} className="btn-secondary btn-sm">📥 تصدير Excel</button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          {key:'pending', label:'⏳ في الانتظار'},
          {key:'approved',label:'✅ مقبولون'},
          {key:'rejected',label:'❌ مرفوضون'},
          {key:'all',     label:'الكل'},
        ].map(f=>(
          <button key={f.key} onClick={()=>setFilter(f.key)}
            className={`btn-sm ${filter===f.key?'btn-primary':'btn-secondary'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Grade filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={()=>setGradeFilter('all')}
          className={`btn-sm text-xs ${gradeFilter==='all'?'bg-slate-700 text-white':'btn-secondary'}`}>
          كل الصفوف
        </button>
        {Object.entries(GRADES).map(([k,v])=>(
          <button key={k} onClick={()=>setGradeFilter(k)}
            className={`btn-sm text-xs ${gradeFilter===k?'bg-slate-700 text-white':'btn-secondary'}`}>
            {v}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">👥</div>
          <h3 className="text-lg font-bold text-slate-600">لا يوجد طلاب</h3>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(GRADES).map(([gradeKey, gradeName]) => {
            const list = filtered.filter(s => String(s.grade) === gradeKey);
            if (gradeFilter !== 'all' && gradeFilter !== gradeKey) return null;
            if (list.length === 0) return null;
            return (
              <div key={gradeKey}>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="font-extrabold text-slate-700">{gradeName}</h3>
                  <span className="badge badge-blue">{list.length} طالب</span>
                </div>
                <div className="card overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          {['الاسم','التليفون','ولي الأمر','الحالة','الامتحانات'].map(h=>(
                            <th key={h} className="text-right text-xs font-bold text-slate-500 px-4 py-3 border-b border-slate-200">{h}</th>
                          ))}
                          <th className="text-right text-xs font-bold text-slate-500 px-4 py-3 border-b border-slate-200">
                            <button
                              onClick={() => { setScoreSort(s => s === 'desc' ? 'asc' : 'desc'); setHonorSort(null); }}
                              className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                            >
                              المتوسط
                              <span className="text-base leading-none">
                                {scoreSort === 'desc' ? '↓' : scoreSort === 'asc' ? '↑' : '↕'}
                              </span>
                            </button>
                          </th>
                          <th className="text-right text-xs font-bold text-slate-500 px-4 py-3 border-b border-slate-200">
                            <button
                              onClick={() => { setHonorSort(s => s === 'desc' ? 'asc' : 'desc'); setScoreSort(null); }}
                              className="flex items-center gap-1 hover:text-amber-600 transition-colors"
                            >
                              🏆 نقاط
                              <span className="text-base leading-none">
                                {honorSort === 'desc' ? '↓' : honorSort === 'asc' ? '↑' : '↕'}
                              </span>
                            </button>
                          </th>
                          <th className="text-right text-xs font-bold text-slate-500 px-4 py-3 border-b border-slate-200">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map(st=>(
                          <tr key={st.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="font-semibold text-slate-800">{st.name}</div>
                              <div className="text-xs text-slate-400">{st.username}</div>
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{st.phone}</td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{st.parent_phone}</td>
                            <td className="px-4 py-3">
                              <span className={`badge ${statusMap[st.status]?.cls}`}>
                                {statusMap[st.status]?.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{st.submission_count}</td>
                            <td className="px-4 py-3">
                              {st.avg_score != null
                                ? <span className={`font-bold ${st.avg_score>=50?'text-emerald-600':'text-red-600'}`}>{st.avg_score}%</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              {st.avg_score != null && st.submission_count > 0
                                ? <span className="font-bold text-amber-600">{Math.round(st.avg_score * st.submission_count)}</span>
                                : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1.5 flex-wrap">
                                {st.status==='pending' && <>
                                  <button onClick={()=>approve(st.id)} className="btn-success btn-sm">قبول</button>
                                  <button onClick={()=>reject(st.id)}  className="btn-danger btn-sm">رفض</button>
                                </>}
                                {st.status==='rejected' && <button onClick={()=>approve(st.id)} className="btn-success btn-sm">قبول</button>}
                                {st.status==='approved' && <button onClick={()=>reject(st.id)} className="btn-secondary btn-sm">إيقاف</button>}
                                <button onClick={()=>setEditing(st)} className="btn-secondary btn-sm">تعديل</button>
                                <button onClick={()=>setResetPw(st)} className="btn-secondary btn-sm" title="تغيير كلمة المرور">🔑</button>
                                <button onClick={()=>setDetailId(st.id)} className="btn-secondary btn-sm">📋</button>
                                <button onClick={()=>remove(st.id)} className="btn-danger btn-sm">حذف</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <EditStudentModal student={editing} onClose={()=>setEditing(null)} onSave={()=>{setEditing(null);load();}}/>
      )}
      {resetPw && (
        <ResetPasswordModal student={resetPw} onClose={()=>setResetPw(null)}/>
      )}
    </div>
  );
}

function ResetPasswordModal({ student, onClose }) {
  const [password, setPassword] = useState('');
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) return setError('كلمة المرور 6 أحرف على الأقل');
    setLoading(true);
    try {
      await api.post(`/teacher/students/${student.id}/reset-password`, { password });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في التغيير');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl" onClick={e => e.stopPropagation()} dir="rtl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-extrabold text-slate-800">🔑 تغيير كلمة المرور</h3>
            <p className="text-xs text-slate-400 mt-0.5">{student.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-2">✅</div>
            <p className="font-bold text-emerald-600">تم تغيير كلمة المرور بنجاح</p>
          </div>
        ) : (
          <form onSubmit={handle} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور الجديدة</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  className="input pl-10"
                  placeholder="6 أحرف على الأقل"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  dir="ltr"
                  autoFocus
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {show ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button type="submit" disabled={loading} className="btn-primary flex-1">
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"/>
                  : 'تغيير'}
              </button>
              <button type="button" onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function EditStudentModal({ student, onClose, onSave }) {
  const [form, setForm] = useState({
    name:         student.name        || '',
    username:     student.username    || '',
    grade:        student.grade,
    phone:        student.phone       || '',
    parent_phone: student.parent_phone|| '',
    email:        student.email       || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError('');
    setLoading(true);
    try {
      await api.put(`/teacher/students/${student.id}`, form);
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ في الحفظ');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ label, children }) => (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-slate-800">تعديل بيانات الطالب</h3>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        <div className="space-y-3">
          <Field label="الاسم الكامل">
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)}/>
          </Field>

          <Field label="اسم المستخدم">
            <input className="input" value={form.username}
              onChange={e => set('username', e.target.value.replace(/[^a-zA-Z0-9_.@-]/g, '').toLowerCase())}
              dir="ltr"/>
          </Field>

          <Field label="الصف الدراسي">
            <select className="input" value={form.grade} onChange={e => set('grade', Number(e.target.value))}>
              {Object.entries(GRADES).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="تليفون الطالب">
              <input className="input" value={form.phone} inputMode="numeric" maxLength={11}
                onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 11))}/>
            </Field>
            <Field label="تليفون ولي الأمر">
              <input className="input" value={form.parent_phone} inputMode="numeric" maxLength={11}
                onChange={e => set('parent_phone', e.target.value.replace(/\D/g, '').slice(0, 11))}/>
            </Field>
          </div>

          <Field label="البريد الإلكتروني">
            <input className="input" type="email" value={form.email} dir="ltr"
              onChange={e => set('email', e.target.value)}/>
          </Field>

        </div>

        {error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} className="btn-primary flex-1" disabled={loading}>
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block"/>
              : 'حفظ التعديلات'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
