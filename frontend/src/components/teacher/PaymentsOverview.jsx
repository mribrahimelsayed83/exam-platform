import { useState, useEffect } from 'react';
// xlsx loaded dynamically on first export to keep teacher bundle lean
import api from '../../utils/api';
import { gradeLabel } from '../../utils/grades';

const statusMap = {
  paid:    { label: 'مدفوع', cls: 'badge-green' },
  pending: { label: 'معلّق', cls: 'badge-amber' },
  failed:  { label: 'فشل',   cls: 'badge-red'   },
};

const typeMap = {
  exam:     { label: 'امتحان', icon: '📝' },
  playlist: { label: 'قائمة',  icon: '🎬' },
};

export default function PaymentsOverview() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [filterGrade, setFilterGrade]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType]     = useState('');

  const load = () => {
    setLoading(true);
    return api.get('/payments/overview')
      .then(({ data }) => setData(data))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  if (!data) return null;

  const { totals, byGrade, payments } = data;
  const grades = [...new Set(payments.map(p => p.grade))].sort((a,b) => a-b);

  const filtered = payments.filter(p =>
    (!filterGrade || String(p.grade) === filterGrade) &&
    (!filterStatus || p.status === filterStatus) &&
    (!filterType || p.item_type === filterType)
  );

  const maxGradeRevenue = Math.max(1, ...byGrade.map(g => g.revenue));

  const exportExcel = async () => {
    const XLSX = (await import('xlsx')).default || await import('xlsx');
    const rows = filtered.map(p => ({
      'اسم الطالب':  p.student_name,
      'الصف':        gradeLabel(p.grade),
      'النوع':       typeMap[p.item_type]?.label || p.item_type,
      'اسم العنصر':  p.item_title,
      'المبلغ':      p.amount,
      'الحالة':      statusMap[p.status]?.label || p.status,
      'تاريخ الدفع': p.paid_at ? new Date(p.paid_at).toLocaleDateString('ar-EG') : '—',
    }));
    const ws = XLSX.utils.json_to_sheet(rows, {
      header: ['اسم الطالب', 'الصف', 'النوع', 'اسم العنصر', 'المبلغ', 'الحالة', 'تاريخ الدفع'],
    });
    ws['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 10 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'المدفوعات');
    XLSX.writeFile(wb, 'المدفوعات.xlsx');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-extrabold text-slate-800">المدفوعات</h2>
        {filtered.length > 0 && (
          <button onClick={exportExcel} className="btn-secondary btn-sm flex items-center gap-1.5">
            📥 تصدير Excel
          </button>
        )}
      </div>
      <p className="text-slate-500 text-sm mb-5">إيرادات الامتحانات والقوائم المدفوعة</p>

      <ActivateByCode onActivated={load} />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="card-sm text-center">
          <p className="text-xs text-slate-400 mb-1">إجمالي الإيرادات</p>
          <p className="text-2xl font-extrabold text-slate-800">{totals.total_revenue} <span className="text-sm font-semibold text-slate-400">جنيه</span></p>
        </div>
        <div className="card-sm text-center">
          <p className="text-xs text-slate-400 mb-1">اليوم</p>
          <p className="text-2xl font-extrabold text-emerald-600">{totals.today_revenue} <span className="text-sm font-semibold text-slate-400">جنيه</span></p>
        </div>
        <div className="card-sm text-center">
          <p className="text-xs text-slate-400 mb-1">هذا الأسبوع</p>
          <p className="text-2xl font-extrabold text-blue-600">{totals.week_revenue} <span className="text-sm font-semibold text-slate-400">جنيه</span></p>
        </div>
        <div className="card-sm text-center">
          <p className="text-xs text-slate-400 mb-1">هذا الشهر</p>
          <p className="text-2xl font-extrabold text-violet-600">{totals.month_revenue} <span className="text-sm font-semibold text-slate-400">جنيه</span></p>
        </div>
      </div>

      {/* Status counts */}
      <div className="flex flex-wrap gap-3 mb-6 text-sm">
        <span className="badge badge-green">✓ مدفوع: {totals.paid_count}</span>
        <span className="badge badge-amber">⏳ معلّق: {totals.pending_count}</span>
        <span className="badge badge-red">✕ فشل: {totals.failed_count}</span>
      </div>

      {/* Grade breakdown */}
      {byGrade.length > 0 && (
        <div className="card mb-6">
          <h3 className="font-bold text-slate-700 text-sm mb-4">الإيرادات حسب الصف</h3>
          <div className="space-y-3">
            {byGrade.map(g => (
              <div key={g.grade} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 w-24 flex-shrink-0">{gradeLabel(g.grade)}</span>
                <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                  <div className="bg-blue-500 h-full rounded-full transition-all"
                    style={{ width: `${(g.revenue / maxGradeRevenue) * 100}%` }}/>
                </div>
                <span className="text-xs font-bold text-slate-700 w-20 flex-shrink-0 text-left">{g.revenue} جنيه</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      {grades.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          <button onClick={() => setFilterGrade('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
              ${filterGrade === ''
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-slate-400'}`}>
            كل الصفوف
          </button>
          {grades.map(g => (
            <button key={g} onClick={() => setFilterGrade(String(g))}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all
                ${filterGrade === String(g)
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white text-slate-500 border border-slate-200 hover:border-blue-300 hover:text-blue-600'}`}>
              {gradeLabel(g)}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-3 mb-5">
        <select className="input max-w-[160px]" value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
          <option value="">كل الحالات</option>
          <option value="paid">مدفوع</option>
          <option value="pending">معلّق</option>
          <option value="failed">فشل</option>
        </select>
        <select className="input max-w-[160px]" value={filterType} onChange={e=>setFilterType(e.target.value)}>
          <option value="">الكل (امتحانات وقوائم)</option>
          <option value="exam">امتحانات فقط</option>
          <option value="playlist">قوائم فقط</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">💳</div>
          <h3 className="text-lg font-bold text-slate-600">لا توجد مدفوعات</h3>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['الطالب','الصف','النوع','العنصر','المبلغ','الحالة','التاريخ'].map(h=>(
                    <th key={h} className="text-right text-xs font-bold text-slate-500 px-4 py-3 border-b border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => {
                  const st = statusMap[p.status] || statusMap.pending;
                  const tp = typeMap[p.item_type] || { label: p.item_type, icon: '📄' };
                  return (
                    <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-700">{p.student_name}</td>
                      <td className="px-4 py-3"><span className="badge badge-blue text-xs">{gradeLabel(p.grade)}</span></td>
                      <td className="px-4 py-3 text-xs">{tp.icon} {tp.label}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs">{p.item_title}</td>
                      <td className="px-4 py-3 font-semibold text-slate-700">{p.amount} جنيه</td>
                      <td className="px-4 py-3"><span className={`badge ${st.cls} text-xs`}>{st.label}</span></td>
                      <td className="px-4 py-3 text-xs text-slate-400">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString('ar-EG') : new Date(p.created_at).toLocaleDateString('ar-EG')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Activate a paid exam/course for a student using their personal code ────
// Useful when the student paid outside the platform (cash / Vodafone Cash)
// and dictates their code to the teacher over the phone.
function ActivateByCode({ onActivated }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [code, setCode] = useState('');
  const [selected, setSelected] = useState(''); // "exam-3" or "playlist-7"
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  useEffect(() => {
    if (open && !items) {
      api.get('/payments/payable-items').then(({ data }) => setItems(data)).catch(() => setItems({ exams: [], playlists: [] }));
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!code.trim() || !selected) return;
    const [type, id] = selected.split('-');
    setLoading(true);
    setMessage(null);
    try {
      const { data } = await api.post('/payments/activate-by-code', {
        code: code.trim(),
        ...(type === 'exam' ? { examId: Number(id) } : { playlistId: Number(id) }),
      });
      setMessage({ ok: true, text: data.message });
      setCode(''); setSelected('');
      onActivated?.();
    } catch (err) {
      setMessage({ ok: false, text: err.response?.data?.message || 'حدث خطأ' });
    } finally { setLoading(false); }
  };

  return (
    <div className="card mb-6">
      <button onClick={() => setOpen(o => !o)} className="flex items-center justify-between w-full text-right">
        <h3 className="font-bold text-slate-700 text-sm flex items-center gap-2">🔑 تفعيل بالكود</h3>
        <span className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="mt-4">
          <p className="text-xs text-slate-400 mb-3">
            لطالب دفع خارج المنصة (كاش / فودافون كاش) — استخدم كود التفعيل الخاص به (موجود في صفحة بياناته) لتفعيل امتحان أو قائمة مدفوعة يدويًا.
          </p>
          <form onSubmit={submit} className="grid sm:grid-cols-3 gap-3">
            <input className="input font-mono" dir="ltr" placeholder="كود الطالب" value={code}
              onChange={e => setCode(e.target.value.toUpperCase())} required />
            <select className="input" value={selected} onChange={e => setSelected(e.target.value)} required>
              <option value="">اختر امتحان أو قائمة مدفوعة</option>
              {items?.exams?.length > 0 && (
                <optgroup label="📝 امتحانات">
                  {items.exams.map(e => (
                    <option key={`exam-${e.id}`} value={`exam-${e.id}`}>{e.title} ({e.price} جنيه)</option>
                  ))}
                </optgroup>
              )}
              {items?.playlists?.length > 0 && (
                <optgroup label="🎬 قوائم">
                  {items.playlists.map(p => (
                    <option key={`playlist-${p.id}`} value={`playlist-${p.id}`}>{p.title} ({p.price} جنيه)</option>
                  ))}
                </optgroup>
              )}
            </select>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '...جاري التفعيل' : 'تفعيل'}
            </button>
          </form>
          {message && (
            <p className={`text-sm font-semibold mt-3 ${message.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {message.ok ? '✅' : '⚠️'} {message.text}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
