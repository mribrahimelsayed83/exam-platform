import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

// Resize & compress image → base64 JPEG (max 800px wide, 70% quality)
function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxW = 800;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function ArticlesList() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showNew, setShowNew]   = useState(false);
  const [editing, setEditing]   = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/articles/manage/all').then(r => setArticles(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const move = async (article, dir) => {
    const sorted = [...articles].sort((a,b) => a.position - b.position);
    const idx = sorted.findIndex(a => a.id === article.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    await api.put('/articles/manage/reorder', { ids: reordered.map(a => a.id) });
    load();
  };

  const togglePublish = async (article) => {
    await api.patch(`/articles/manage/${article.id}/publish`);
    load();
  };

  const remove = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا المقال؟')) return;
    await api.delete(`/articles/manage/${id}`);
    load();
  };

  const sorted = [...articles].sort((a,b) => a.position - b.position);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
        <h2 className="text-xl font-extrabold text-slate-800">المقالات ونصائح الدراسة</h2>
        <button onClick={() => setShowNew(true)} className="btn-primary btn-sm">+ مقال جديد</button>
      </div>
      <p className="text-xs text-slate-400 mb-5">
        هذا القسم يظهر للطلاب فقط لو تم تفعيله من "الإعدادات". المقالات غير المنشورة (مسودة) لا يراها الطلاب أبدًا.
      </p>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-3">📰</div>
          <h3 className="text-lg font-bold text-slate-600 mb-2">لا توجد مقالات بعد</h3>
          <button onClick={() => setShowNew(true)} className="btn-primary btn-sm">إضافة مقال</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map(a => (
            <div key={a.id} className="card p-0 overflow-hidden">
              <div className="relative bg-slate-200 aspect-video overflow-hidden">
                {a.cover_image ? (
                  <img src={a.cover_image} alt={a.title} className="w-full h-full object-cover"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-amber-100 to-orange-200">
                    <span className="text-5xl">📰</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className={`badge text-xs bg-white/90 ${a.is_published ? 'badge-green' : 'badge-gray'}`}>
                    {a.is_published ? '✅ منشور' : '📝 مسودة'}
                  </span>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-slate-800 mb-1">{a.title}</h3>
                {a.summary && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{a.summary}</p>}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setEditing(a)} className="btn-secondary btn-sm">✏️ تعديل</button>
                  <button onClick={() => move(a, -1)} className="btn-secondary btn-sm">↑</button>
                  <button onClick={() => move(a, 1)}  className="btn-secondary btn-sm">↓</button>
                  <button
                    onClick={() => togglePublish(a)}
                    className={`btn-sm text-xs font-bold ${a.is_published ? 'bg-slate-100 text-slate-600 hover:bg-slate-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                    {a.is_published ? 'إخفاء' : 'نشر'}
                  </button>
                  <button onClick={() => remove(a.id)} className="btn-danger btn-sm">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNew && (
        <ArticleModal onClose={() => setShowNew(false)} onSave={() => { setShowNew(false); load(); }}/>
      )}
      {editing && (
        <ArticleModal article={editing} onClose={() => setEditing(null)} onSave={() => { setEditing(null); load(); }}/>
      )}
    </div>
  );
}

// ── Article Create/Edit Modal ───────────────────────────────────────────────
function ArticleModal({ article, onClose, onSave }) {
  const [form, setForm] = useState({
    title:       article?.title       || '',
    summary:     article?.summary     || '',
    content:     article?.content     || '',
    cover_image: article?.cover_image || '',
  });
  const [loading, setLoading]     = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState('');
  const fileRef = useRef();
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }));

  const handleImageFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const base64 = await resizeImage(file);
    set('cover_image', base64);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return setError('العنوان مطلوب');
    setLoading(true);
    setError('');
    try {
      if (article) {
        await api.put(`/articles/manage/${article.id}`, form);
      } else {
        await api.post('/articles/manage', form);
      }
      onSave();
    } catch (err) {
      setError(err.response?.data?.message || 'خطأ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-slate-800">{article ? 'تعديل المقال' : 'مقال جديد'}</h3>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>
        {error && <div className="alert alert-danger mb-4">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">عنوان المقال *</label>
            <input className="input" placeholder="مثال: 5 نصائح للمذاكرة الفعّالة" value={form.title}
              onChange={e => set('title', e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">ملخص قصير (يظهر في القائمة)</label>
            <textarea className="input resize-none" rows={2} value={form.summary}
              onChange={e => set('summary', e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">محتوى المقال *</label>
            <textarea className="input resize-none" rows={8} placeholder="اكتب المقال هنا..." value={form.content}
              onChange={e => set('content', e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">صورة الغلاف (اختياري)</label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile}/>
            <div className="flex gap-2 mb-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="btn-secondary btn-sm flex items-center gap-1.5 flex-1">
                {uploading
                  ? <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/> جاري الرفع...</>
                  : <>📁 ارفع من الجهاز</>}
              </button>
              {form.cover_image && (
                <button type="button" onClick={() => set('cover_image', '')} className="btn-danger btn-sm px-2" title="حذف الصورة">✕</button>
              )}
            </div>
            {form.cover_image && (
              <img src={form.cover_image} alt="معاينة" className="w-full h-32 object-cover rounded-lg border border-slate-200"/>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={handleSave} className="btn-primary flex-1" disabled={loading}>
            {loading
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : (article ? 'حفظ التعديلات' : 'إضافة المقال')
            }
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
