import { useState, useEffect } from 'react';
import api from '../../utils/api';

const PERMISSIONS = [
  { key:'exams',         label:'📄 الامتحانات' },
  { key:'submissions',   label:'📊 الإجابات' },
  { key:'students',      label:'👥 الطلاب' },
  { key:'videos',        label:'🎬 الفيديوهات' },
  { key:'chat',          label:'💬 الرسائل' },
  { key:'notifications', label:'🔔 الإشعارات' },
  { key:'payments',      label:'💰 المدفوعات' },
];
const ALL_KEYS = PERMISSIONS.map(p => p.key);

function PermissionGrid({ selected, onToggle }) {
  return (
    <div className="grid sm:grid-cols-2 gap-2">
      {PERMISSIONS.map(p => (
        <label key={p.key} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={selected.includes(p.key)} onChange={()=>onToggle(p.key)} className="w-4 h-4"/>
          {p.label}
        </label>
      ))}
    </div>
  );
}

export default function AssistantsList() {
  const [assistants, setAssistants] = useState([]);
  const [form, setForm]   = useState({name:'',username:'',password:'',permissions:[...ALL_KEYS]});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null); // assistant being edited, or null
  const [editPerms, setEditPerms] = useState([]);
  const [savingPerms, setSavingPerms] = useState(false);

  const load = () => api.get('/teacher/assistants').then(r=>setAssistants(r.data));
  useEffect(()=>{ load(); }, []);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const toggleFormPerm = (key) => setForm(f=>({
    ...f, permissions: f.permissions.includes(key) ? f.permissions.filter(k=>k!==key) : [...f.permissions, key],
  }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      await api.post('/teacher/assistants', form);
      setSuccess('✅ تم إضافة المساعد');
      setForm({name:'',username:'',password:'',permissions:[...ALL_KEYS]});
      setShowForm(false);
      load();
    } catch(err) {
      setError(err.response?.data?.message || 'حدث خطأ');
    } finally { setLoading(false); }
  };

  const remove = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المساعد؟')) return;
    await api.delete(`/teacher/assistants/${id}`);
    load();
  };

  const openEdit = (a) => { setEditing(a); setEditPerms(a.permissions || []); };
  const toggleEditPerm = (key) => setEditPerms(p => p.includes(key) ? p.filter(k=>k!==key) : [...p, key]);
  const savePerms = async () => {
    setSavingPerms(true);
    try {
      await api.put(`/teacher/assistants/${editing.id}/permissions`, { permissions: editPerms });
      setEditing(null);
      load();
    } catch (err) {
      alert(err.response?.data?.message || 'حدث خطأ');
    } finally { setSavingPerms(false); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-extrabold text-slate-800">المساعدون</h2>
        <button onClick={()=>setShowForm(s=>!s)} className="btn-primary btn-sm">
          {showForm ? 'إلغاء' : '+ إضافة مساعد'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card mb-5">
          <h3 className="font-bold text-slate-700 mb-4">إضافة مساعد جديد</h3>
          {error   && <div className="alert alert-danger mb-3">{error}</div>}
          {success && <div className="alert alert-success mb-3">{success}</div>}
          <form onSubmit={handleAdd} className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">الاسم</label>
              <input className="input" placeholder="اسم المساعد" value={form.name}
                onChange={e=>set('name',e.target.value)} required/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">اسم المستخدم</label>
              <input className="input" placeholder="للدخول — إنجليزي فقط" value={form.username} dir="ltr"
                onChange={e=>set('username', e.target.value.replace(/[^a-zA-Z0-9_.@-]/g, '').toLowerCase())} required/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور</label>
              <input type="password" className="input" placeholder="6 حروف+" value={form.password}
                onChange={e=>set('password',e.target.value)} required/>
            </div>
            <div className="sm:col-span-3">
              <label className="block text-xs font-bold text-slate-500 mb-2">الصلاحيات — الأقسام اللي يقدر يدخلها</label>
              <PermissionGrid selected={form.permissions} onToggle={toggleFormPerm}/>
            </div>
            <div className="sm:col-span-3">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                  : 'إضافة'
                }
              </button>
            </div>
          </form>
        </div>
      )}

      {assistants.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-3">🤝</div>
          <h3 className="text-base font-bold text-slate-600">لا يوجد مساعدون بعد</h3>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {['الاسم','اسم المستخدم','تاريخ الإضافة','إجراءات'].map(h=>(
                    <th key={h} className="text-right text-xs font-bold text-slate-500 px-4 py-3 border-b border-slate-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {assistants.map(a=>(
                  <tr key={a.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-800">{a.name}</td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{a.username}</td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(a.created_at).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <button onClick={()=>openEdit(a)} className="btn-secondary btn-sm">🔑 صلاحيات</button>
                      <button onClick={()=>remove(a.id)} className="btn-danger btn-sm">حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit-permissions modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setEditing(null)}>
          <div className="bg-white rounded-2xl p-5 w-full max-w-md" onClick={e=>e.stopPropagation()}>
            <h3 className="font-bold text-slate-800 mb-1">صلاحيات {editing.name}</h3>
            <p className="text-xs text-slate-400 mb-4">تحديد الأقسام اللي يقدر المساعد يدخلها في لوحة التحكم</p>
            <PermissionGrid selected={editPerms} onToggle={toggleEditPerm}/>
            <div className="flex gap-2 mt-5">
              <button onClick={savePerms} className="btn-primary flex-1" disabled={savingPerms}>
                {savingPerms ? '...جاري الحفظ' : 'حفظ'}
              </button>
              <button onClick={()=>setEditing(null)} className="btn-secondary flex-1">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
