import { useState, useEffect } from 'react';
import api from '../../utils/api';

const GRADES = {4:'رابع ابتدائي',5:'خامس ابتدائي',6:'سادس ابتدائي',7:'أول إعدادي',8:'ثاني إعدادي',9:'ثالث إعدادي',10:'أول ثانوي',11:'ثاني ثانوي',12:'ثالث ثانوي'};

export default function NotificationsSender() {
  const [sent, setSent]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]       = useState({ title:'', body:'', grade:'' });
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]     = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const load = () => {
    api.get('/notifications/sent')
      .then(r => setSent(r.data))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!form.title || !form.body) return setError('العنوان والمحتوى مطلوبان');
    setSending(true); setError(''); setSuccess('');
    try {
      await api.post('/notifications', {
        title: form.title,
        body:  form.body,
        grade: form.grade ? Number(form.grade) : null,
      });
      setSuccess('✅ تم إرسال الإشعار بنجاح');
      setForm({ title:'', body:'', grade:'' });
      load();
      setTimeout(() => setSuccess(''), 3000);
    } catch(err) {
      setError(err.response?.data?.message || 'خطأ في الإرسال');
    } finally { setSending(false); }
  };

  const deleteNotif = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الإشعار؟')) return;
    await api.delete(`/notifications/${id}`);
    load();
  };

  return (
    <div>
      <h2 className="text-xl font-extrabold text-slate-800 mb-5">الإشعارات</h2>

      {/* Send form */}
      <div className="card mb-6">
        <h3 className="font-bold text-slate-700 mb-4">إرسال إشعار جديد</h3>
        <form onSubmit={handleSend} className="space-y-4">
          {error   && <div className="alert alert-danger">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">عنوان الإشعار *</label>
              <input className="input" placeholder="مثال: تذكير بموعد الامتحان"
                value={form.title} onChange={e=>set('title',e.target.value)}/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">إرسال لـ</label>
              <select className="input" value={form.grade} onChange={e=>set('grade',e.target.value)}>
                <option value="">كل الطلاب</option>
                {Object.entries(GRADES).map(([k,v])=>(
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">محتوى الإشعار *</label>
            <textarea className="input resize-none" rows={3}
              placeholder="اكتب نص الإشعار هنا..."
              value={form.body} onChange={e=>set('body',e.target.value)}/>
          </div>

          <button type="submit" className="btn-primary" disabled={sending}>
            {sending
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : '📢 إرسال الإشعار'
            }
          </button>
        </form>
      </div>

      {/* Sent notifications */}
      <div className="card">
        <h3 className="font-bold text-slate-700 mb-4">الإشعارات المُرسَلة</h3>
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : sent.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <div className="text-4xl mb-2">📢</div>
            <p className="text-sm">لم يتم إرسال أي إشعارات بعد</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sent.map(n => (
              <div key={n.id} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-bold text-slate-800 text-sm">{n.title}</span>
                      <span className={`badge text-xs ${n.grade ? 'badge-blue' : 'badge-gray'}`}>
                        {n.grade ? GRADES[n.grade] : 'كل الطلاب'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed mb-2">{n.body}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span>{new Date(n.created_at).toLocaleDateString('ar-EG',{
                        year:'numeric', month:'short', day:'numeric',
                        hour:'2-digit', minute:'2-digit'
                      })}</span>
                      <span>•</span>
                      <span>قرأه {n.read_count} طالب</span>
                    </div>
                  </div>
                  <button onClick={() => deleteNotif(n.id)} className="btn-ghost btn-sm text-red-500 flex-shrink-0">
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
