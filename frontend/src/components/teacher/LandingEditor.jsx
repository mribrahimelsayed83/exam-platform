import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

const TAB_LIST = [
  { key:'hero',         label:'🖼️ Hero' },
  { key:'stats',        label:'📊 الأرقام' },
  { key:'features',     label:'✨ المميزات' },
  { key:'testimonials', label:'💬 آراء الطلاب' },
  { key:'cta',          label:'🎯 CTA' },
  { key:'contact',      label:'📱 التواصل' },
];

function resizeImage(file, maxPx = 800, quality = 0.75) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = img.width  * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function LandingEditor() {
  const [tab, setTab]       = useState('hero');
  const [form, setForm]     = useState(null);
  const imgInputRef         = useRef();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError]   = useState('');

  useEffect(() => {
    api.get('/landing').then(r => {
      const d = r.data;
      setForm({
        ...d,
        features:     Array.isArray(d.features)     ? d.features     : JSON.parse(d.features     || '[]'),
        testimonials: Array.isArray(d.testimonials) ? d.testimonials : JSON.parse(d.testimonials || '[]'),
      });
    }).finally(() => setLoading(false));
  }, []);

  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await api.put('/landing', form);
      setSuccess('✅ تم الحفظ بنجاح');
      setTimeout(() => setSuccess(''), 3000);
    } catch(err) {
      setError(err.response?.data?.message || 'خطأ في الحفظ');
    } finally { setSaving(false); }
  };

  // Features helpers
  const addFeature    = () => setForm(f=>({...f, features:[...f.features,{icon:'⭐',title:'',desc:''}]}));
  const removeFeature = (i) => setForm(f=>({...f, features:f.features.filter((_,idx)=>idx!==i)}));
  const setFeature    = (i,k,v) => setForm(f=>({...f, features:f.features.map((x,idx)=>idx===i?{...x,[k]:v}:x)}));

  // Testimonials helpers
  const addTest    = () => setForm(f=>({...f, testimonials:[...f.testimonials,{name:'',text:'',grade:''}]}));
  const removeTest = (i) => setForm(f=>({...f, testimonials:f.testimonials.filter((_,idx)=>idx!==i)}));
  const setTest    = (i,k,v) => setForm(f=>({...f, testimonials:f.testimonials.map((x,idx)=>idx===i?{...x,[k]:v}:x)}));

  if (loading || !form) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">تعديل الصفحة الرئيسية</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            <a href="/" target="_blank" className="text-blue-500 hover:underline">معاينة الصفحة ↗</a>
          </p>
        </div>
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '💾 حفظ التعديلات'}
        </button>
      </div>

      {error   && <div className="alert alert-danger mb-4">{error}</div>}
      {success && <div className="alert alert-success mb-4">{success}</div>}

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap mb-5 bg-slate-100 p-1 rounded-xl">
        {TAB_LIST.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`px-3 py-2 text-xs font-bold rounded-lg transition-all
              ${tab===t.key?'bg-white text-blue-600 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="card space-y-5">
        {/* ── Hero Tab ── */}
        {tab==='hero' && <>
          <Row label="اسم المدرس">
            <input className="input" value={form.hero_name} onChange={e=>set('hero_name',e.target.value)}/>
          </Row>
          <Row label="اللقب / التخصص">
            <input className="input" value={form.hero_title} onChange={e=>set('hero_title',e.target.value)}
              placeholder="مثال: مدرس الرياضيات"/>
          </Row>
          <Row label="اسم المنصة">
            <input className="input" value={form.platform_tagline} onChange={e=>set('platform_tagline',e.target.value)}/>
          </Row>
          <Row label="الوصف">
            <textarea className="input resize-none" rows={3} value={form.hero_desc}
              onChange={e=>set('hero_desc',e.target.value)}/>
          </Row>
          <Row label="لون الخلفية">
            <div className="flex items-center gap-3">
              <input type="color" className="w-12 h-10 rounded-lg border border-slate-200 cursor-pointer p-1"
                value={form.hero_bg_color} onChange={e=>set('hero_bg_color',e.target.value)}/>
              <input className="input flex-1" value={form.hero_bg_color} onChange={e=>set('hero_bg_color',e.target.value)}/>
            </div>
          </Row>
          <Row label="صورة المدرس">
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="أو الصق رابط صورة https://..."
                  value={form.hero_image?.startsWith('data:') ? '' : (form.hero_image || '')}
                  onChange={e => set('hero_image', e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => imgInputRef.current?.click()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 whitespace-nowrap"
                >
                  📁 رفع صورة
                </button>
              </div>
              <input
                ref={imgInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;
                  const base64 = await resizeImage(file);
                  set('hero_image', base64);
                  e.target.value = '';
                }}
              />
              {form.hero_image && (
                <div className="relative w-32">
                  <img src={form.hero_image} alt="preview"
                    className="w-32 h-32 object-cover rounded-xl border border-slate-200"/>
                  <button
                    type="button"
                    onClick={() => set('hero_image', '')}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full text-xs font-bold hover:bg-red-600"
                  >✕</button>
                </div>
              )}
            </div>
          </Row>
        </>}

        {/* ── Stats Tab ── */}
        {tab==='stats' && (
          <div className="grid grid-cols-2 gap-4">
            {[[1],[2],[3],[4]].map(([n])=>(
              <div key={n} className="bg-slate-50 rounded-xl p-4 space-y-3">
                <p className="font-bold text-slate-600 text-sm">الإحصائية {n}</p>
                <div>
                  <label className="text-xs text-slate-400 font-bold mb-1 block">الرقم</label>
                  <input className="input" value={form[`stat${n}_num`]}
                    onChange={e=>set(`stat${n}_num`,e.target.value)} placeholder="مثال: 1000+"/>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold mb-1 block">التسمية</label>
                  <input className="input" value={form[`stat${n}_label`]}
                    onChange={e=>set(`stat${n}_label`,e.target.value)} placeholder="مثال: طالب"/>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Features Tab ── */}
        {tab==='features' && <>
          <div className="space-y-4">
            {form.features.map((f,i)=>(
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-600 text-sm">ميزة {i+1}</span>
                  <button onClick={()=>removeFeature(i)} className="text-red-500 text-xs hover:underline">حذف</button>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-1 block">أيقونة</label>
                    <input className="input text-center text-2xl" value={f.icon}
                      onChange={e=>setFeature(i,'icon',e.target.value)} placeholder="🎬"/>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-slate-400 font-bold mb-1 block">العنوان</label>
                    <input className="input" value={f.title}
                      onChange={e=>setFeature(i,'title',e.target.value)}/>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="text-xs text-slate-400 font-bold mb-1 block">الوصف</label>
                  <textarea className="input resize-none" rows={2} value={f.desc}
                    onChange={e=>setFeature(i,'desc',e.target.value)}/>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addFeature} className="btn-secondary btn-sm">+ إضافة ميزة</button>
        </>}

        {/* ── Testimonials Tab ── */}
        {tab==='testimonials' && <>
          <div className="space-y-4">
            {form.testimonials.map((t,i)=>(
              <div key={i} className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-slate-600 text-sm">رأي {i+1}</span>
                  <button onClick={()=>removeTest(i)} className="text-red-500 text-xs hover:underline">حذف</button>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-1 block">اسم الطالب</label>
                    <input className="input" value={t.name} onChange={e=>setTest(i,'name',e.target.value)}/>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 font-bold mb-1 block">الصف</label>
                    <input className="input" value={t.grade} onChange={e=>setTest(i,'grade',e.target.value)}
                      placeholder="مثال: أول ثانوي"/>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 font-bold mb-1 block">الرأي</label>
                  <textarea className="input resize-none" rows={2} value={t.text}
                    onChange={e=>setTest(i,'text',e.target.value)}/>
                </div>
              </div>
            ))}
          </div>
          <button onClick={addTest} className="btn-secondary btn-sm">+ إضافة رأي</button>
        </>}

        {/* ── CTA Tab ── */}
        {tab==='cta' && <>
          <Row label="عنوان CTA">
            <input className="input" value={form.cta_title} onChange={e=>set('cta_title',e.target.value)}/>
          </Row>
          <Row label="وصف CTA">
            <textarea className="input resize-none" rows={2} value={form.cta_desc}
              onChange={e=>set('cta_desc',e.target.value)}/>
          </Row>
        </>}

        {/* ── Contact Tab ── */}
        {tab==='contact' && <>
          <Row label="رقم واتساب">
            <input className="input" placeholder="201xxxxxxxxx" value={form.whatsapp}
              onChange={e=>set('whatsapp',e.target.value)}/>
          </Row>
          <Row label="رابط تليجرام">
            <input className="input" placeholder="https://t.me/..." value={form.telegram}
              onChange={e=>set('telegram',e.target.value)}/>
          </Row>
          <Row label="رابط فيسبوك">
            <input className="input" placeholder="https://facebook.com/..." value={form.facebook}
              onChange={e=>set('facebook',e.target.value)}/>
          </Row>
          <Row label="رابط يوتيوب">
            <input className="input" placeholder="https://youtube.com/..." value={form.youtube}
              onChange={e=>set('youtube',e.target.value)}/>
          </Row>
        </>}
      </div>

      {/* Save button at bottom */}
      <div className="mt-5 flex justify-end">
        <button onClick={handleSave} className="btn-primary" disabled={saving}>
          {saving ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '💾 حفظ التعديلات'}
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
