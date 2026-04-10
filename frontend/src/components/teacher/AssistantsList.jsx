import { useState, useEffect } from 'react';
import api from '../../utils/api';

export default function AssistantsList() {
  const [assistants, setAssistants] = useState([]);
  const [form, setForm]   = useState({name:'',username:'',password:''});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = () => api.get('/teacher/assistants').then(r=>setAssistants(r.data));
  useEffect(()=>{ load(); }, []);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleAdd = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      await api.post('/teacher/assistants', form);
      setSuccess('✅ تم إضافة المساعد');
      setForm({name:'',username:'',password:''});
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
              <input className="input" placeholder="للدخول" value={form.username}
                onChange={e=>set('username',e.target.value)} required/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">كلمة المرور</label>
              <input type="password" className="input" placeholder="6 حروف+" value={form.password}
                onChange={e=>set('password',e.target.value)} required/>
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

      {/* صلاحيات المساعد */}
      <div className="alert alert-info mb-5">
        <strong>صلاحيات المساعد:</strong> موافقة/رفض الطلاب — تعديل/حذف الطلاب — عرض الإجابات — إنشاء امتحانات.
        لا يقدر يضيف مساعدين أو يغير إعدادات المنصة.
      </div>

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
                    <td className="px-4 py-3">
                      <button onClick={()=>remove(a.id)} className="btn-danger btn-sm">حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
