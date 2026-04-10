import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

const GRADES = {4:'رابع ابتدائي',5:'خامس ابتدائي',6:'سادس ابتدائي',7:'أول إعدادي',8:'ثاني إعدادي',9:'ثالث إعدادي',10:'أول ثانوي',11:'ثاني ثانوي',12:'ثالث ثانوي'};

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

function getYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url?.match(regex);
  return match ? match[1] : null;
}
function getThumbnail(url) {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

const ITEM_ICONS = { video:'🎬', exam:'📝', file:'📄' };
const ITEM_LABELS = { video:'فيديو', exam:'امتحان', file:'ملف' };
const ITEM_COLORS = {
  video:'bg-blue-100 text-blue-700',
  exam:'bg-purple-100 text-purple-700',
  file:'bg-green-100 text-green-700',
};

// ── Main component ─────────────────────────────────────────────────────────
export default function VideosList() {
  const [playlists, setPlaylists]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [gradeFilter, setGradeFilter]   = useState('all');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [openPlaylist, setOpenPlaylist] = useState(null);

  const load = () => {
    setLoading(true);
    api.get('/videos/manage/playlists')
      .then(r => setPlaylists(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deletePlaylist = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه القائمة وكل محتوياتها؟')) return;
    await api.delete(`/videos/manage/playlists/${id}`);
    load();
  };

  const movePlaylist = async (playlist, dir) => {
    const sameGrade = playlists
      .filter(p => p.grade === playlist.grade)
      .sort((a,b) => a.position - b.position);
    const idx = sameGrade.findIndex(p => p.id === playlist.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sameGrade.length) return;
    const reordered = [...sameGrade];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    await api.put('/videos/manage/playlists/reorder', { ids: reordered.map(p => p.id) });
    load();
  };

  const filtered = gradeFilter === 'all'
    ? playlists
    : playlists.filter(p => String(p.grade) === gradeFilter);

  if (openPlaylist) {
    return (
      <PlaylistManager
        playlist={openPlaylist}
        onBack={() => { setOpenPlaylist(null); load(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <h2 className="text-xl font-extrabold text-slate-800">الفيديوهات التعليمية</h2>
        <button onClick={() => setShowNewPlaylist(true)} className="btn-primary btn-sm">
          + قائمة جديدة
        </button>
      </div>

      {/* Grade filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setGradeFilter('all')}
          className={`btn-sm text-xs ${gradeFilter==='all'?'bg-slate-700 text-white':'btn-secondary'}`}>
          كل الصفوف
        </button>
        {Object.entries(GRADES).map(([k,v]) => (
          <button key={k} onClick={() => setGradeFilter(k)}
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
          <div className="text-5xl mb-3">🎬</div>
          <h3 className="text-lg font-bold text-slate-600 mb-2">لا توجد قوائم تشغيل</h3>
          <button onClick={() => setShowNewPlaylist(true)} className="btn-primary btn-sm">إنشاء قائمة</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(pl => (
            <div key={pl.id} className="card p-0 overflow-hidden group">
              {/* Thumbnail */}
              <div className="relative bg-slate-200 aspect-video overflow-hidden">
                {pl.thumbnail ? (
                  <img src={pl.thumbnail} alt={pl.title} className="w-full h-full object-cover"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                    <span className="text-5xl">🎬</span>
                  </div>
                )}
                <div className="absolute top-2 right-2">
                  <span className="badge badge-blue text-xs bg-white/90">{GRADES[pl.grade]}</span>
                </div>
                <div className="absolute bottom-2 left-2">
                  {pl.sub_count > 0 ? (
                    <span className="bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                      {pl.sub_count} درس
                    </span>
                  ) : (
                    <span className="bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                      {pl.video_count} فيديو
                    </span>
                  )}
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-bold text-slate-800 mb-1">{pl.title}</h3>
                {pl.description && <p className="text-xs text-slate-500 mb-3">{pl.description}</p>}
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setOpenPlaylist(pl)} className="btn-primary btn-sm flex-1">
                    📂 إدارة
                  </button>
                  <button onClick={() => setEditingPlaylist(pl)} className="btn-secondary btn-sm">✏️</button>
                  <button onClick={() => movePlaylist(pl, -1)} className="btn-secondary btn-sm">↑</button>
                  <button onClick={() => movePlaylist(pl, 1)}  className="btn-secondary btn-sm">↓</button>
                  <button onClick={() => deletePlaylist(pl.id)} className="btn-danger btn-sm">🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewPlaylist && (
        <PlaylistModal
          onClose={() => setShowNewPlaylist(false)}
          onSave={() => { setShowNewPlaylist(false); load(); }}
        />
      )}
      {editingPlaylist && (
        <PlaylistModal
          playlist={editingPlaylist}
          onClose={() => setEditingPlaylist(null)}
          onSave={() => { setEditingPlaylist(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Playlist Create/Edit Modal ─────────────────────────────────────────────
function PlaylistModal({ playlist, onClose, onSave }) {
  const [form, setForm] = useState({
    title:       playlist?.title || '',
    description: playlist?.description || '',
    thumbnail:   playlist?.thumbnail || '',
    grade:       playlist?.grade || 4,
  });
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleImageFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const base64 = await resizeImage(file);
    set('thumbnail', base64);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title) return setError('العنوان مطلوب');
    setLoading(true);
    try {
      if (playlist) {
        await api.put(`/videos/manage/playlists/${playlist.id}`, form);
      } else {
        await api.post('/videos/manage/playlists', form);
      }
      onSave();
    } catch(err) {
      setError(err.response?.data?.message || 'خطأ');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-slate-800">
            {playlist ? 'تعديل القائمة' : 'قائمة جديدة'}
          </h3>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>
        {error && <div className="alert alert-danger mb-4">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">عنوان القائمة *</label>
            <input className="input" placeholder="مثال: الوحدة الأولى" value={form.title}
              onChange={e=>set('title',e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">الصف *</label>
            <select className="input" value={form.grade} onChange={e=>set('grade',Number(e.target.value))}>
              {Object.entries(GRADES).map(([k,v])=>(
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">وصف (اختياري)</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e=>set('description',e.target.value)}/>
          </div>
          <ImageUploadField
            value={form.thumbnail}
            onChange={v => set('thumbnail', v)}
            fileRef={fileRef}
            uploading={uploading}
            onFileChange={handleImageFile}
          />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} className="btn-primary flex-1" disabled={loading || uploading}>
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '💾 حفظ'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

// ── Playlist Manager — يدير الدروس (سب-بلايليستات) داخل القائمة ───────────
function PlaylistManager({ playlist, onBack }) {
  const [subs, setSubs]           = useState([]);
  const [videos, setVideos]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showNewSub, setShowNewSub] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [openSub, setOpenSub]     = useState(null);
  // legacy direct-video management
  const [showAddVideo, setShowAddVideo] = useState(false);
  const [editingVideo, setEditingVideo] = useState(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get(`/videos/manage/playlists/${playlist.id}/subs`),
      api.get(`/videos/manage/playlists/${playlist.id}`),
    ]).then(([subsRes, plRes]) => {
      setSubs(subsRes.data);
      setVideos(plRes.data.videos || []);
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deleteSub = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الدرس وكل محتوياته؟')) return;
    await api.delete(`/videos/manage/playlists/${id}`);
    load();
  };

  const moveSub = async (sub, dir) => {
    const sorted = [...subs].sort((a,b) => a.position - b.position);
    const idx = sorted.findIndex(s => s.id === sub.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    await api.put('/videos/manage/playlists/subs/reorder', { ids: reordered.map(s => s.id) });
    load();
  };

  const deleteVideo = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا الفيديو؟')) return;
    await api.delete(`/videos/manage/videos/${id}`);
    load();
  };

  const moveVideo = async (video, dir) => {
    const sorted = [...videos].sort((a,b) => a.position - b.position);
    const idx = sorted.findIndex(v => v.id === video.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    await api.put('/videos/manage/videos/reorder', { ids: reordered.map(v => v.id) });
    load();
  };

  if (openSub) {
    return (
      <SubPlaylistManager
        subPlaylist={openSub}
        parentTitle={playlist.title}
        onBack={() => { setOpenSub(null); load(); }}
      />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="btn-ghost btn-sm">← رجوع</button>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">{playlist.title}</h2>
          <p className="text-xs text-slate-400">{GRADES[playlist.grade]}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : (
        <>
          {/* ── Sub-playlists (Lessons) section ── */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <span className="text-lg">📚</span> الدروس الداخلية
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{subs.length}</span>
              </h3>
              <button onClick={() => setShowNewSub(true)} className="btn-primary btn-sm">
                + درس جديد
              </button>
            </div>

            {subs.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <div className="text-3xl mb-2">📂</div>
                <p className="text-sm text-slate-500 mb-2">لا توجد دروس داخلية بعد</p>
                <button onClick={() => setShowNewSub(true)} className="btn-primary btn-sm">
                  أضف درساً الآن
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {[...subs].sort((a,b)=>a.position-b.position).map((sub) => (
                  <div key={sub.id} className="card p-3 flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">📖</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">{sub.title}</p>
                      {sub.description && <p className="text-xs text-slate-400 truncate">{sub.description}</p>}
                      <p className="text-xs text-blue-500 mt-0.5">{sub.item_count} عنصر</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => setOpenSub(sub)} className="btn-primary btn-sm py-1 px-2 text-xs">📂</button>
                      <button onClick={() => setEditingSub(sub)} className="btn-secondary btn-sm py-1 px-2">✏️</button>
                      <button onClick={() => moveSub(sub,-1)} className="btn-secondary btn-sm py-1 px-2">↑</button>
                      <button onClick={() => moveSub(sub,1)}  className="btn-secondary btn-sm py-1 px-2">↓</button>
                      <button onClick={() => deleteSub(sub.id)} className="btn-danger btn-sm py-1 px-2">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Direct videos section (legacy / optional) ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <span className="text-lg">🎬</span> فيديوهات مباشرة
                <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{videos.length}</span>
                <span className="text-xs text-slate-400">(بدون دروس داخلية)</span>
              </h3>
              <button onClick={() => setShowAddVideo(true)} className="btn-secondary btn-sm">
                + فيديو مباشر
              </button>
            </div>

            {videos.length === 0 ? (
              <div className="text-center py-6 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-400">لا توجد فيديوهات مباشرة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {[...videos].sort((a,b)=>a.position-b.position).map(v => {
                  const thumb = getThumbnail(v.youtube_url);
                  return (
                    <div key={v.id} className="card p-0 overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        <div className="w-20 h-14 flex-shrink-0 bg-slate-200 rounded-lg overflow-hidden">
                          {thumb
                            ? <img src={thumb} alt={v.title} className="w-full h-full object-cover"/>
                            : <div className="w-full h-full flex items-center justify-center text-xl">🎥</div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{v.title}</p>
                          {v.description && <p className="text-xs text-slate-400 truncate">{v.description}</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => setEditingVideo(v)} className="btn-secondary btn-sm py-1 px-2">✏️</button>
                          <button onClick={() => moveVideo(v,-1)} className="btn-secondary btn-sm py-1 px-2">↑</button>
                          <button onClick={() => moveVideo(v,1)}  className="btn-secondary btn-sm py-1 px-2">↓</button>
                          <button onClick={() => deleteVideo(v.id)} className="btn-danger btn-sm py-1 px-2">🗑️</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {showNewSub && (
        <SubPlaylistModal
          parentId={playlist.id}
          onClose={() => setShowNewSub(false)}
          onSave={() => { setShowNewSub(false); load(); }}
        />
      )}
      {editingSub && (
        <SubPlaylistModal
          subPlaylist={editingSub}
          parentId={playlist.id}
          onClose={() => setEditingSub(null)}
          onSave={() => { setEditingSub(null); load(); }}
        />
      )}
      {showAddVideo && (
        <VideoModal
          playlistId={playlist.id}
          onClose={() => setShowAddVideo(false)}
          onSave={() => { setShowAddVideo(false); load(); }}
        />
      )}
      {editingVideo && (
        <VideoModal
          video={editingVideo}
          playlistId={playlist.id}
          onClose={() => setEditingVideo(null)}
          onSave={() => { setEditingVideo(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Sub-playlist Create/Edit Modal ────────────────────────────────────────
function SubPlaylistModal({ subPlaylist, parentId, onClose, onSave }) {
  const [form, setForm] = useState({
    title:       subPlaylist?.title || '',
    description: subPlaylist?.description || '',
    thumbnail:   subPlaylist?.thumbnail || '',
  });
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const handleImageFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const base64 = await resizeImage(file);
    set('thumbnail', base64);
    setUploading(false);
  };

  const handleSave = async () => {
    if (!form.title) return setError('العنوان مطلوب');
    setLoading(true);
    try {
      if (subPlaylist) {
        await api.put(`/videos/manage/playlists/${subPlaylist.id}`, { ...form, grade: subPlaylist.grade });
      } else {
        await api.post(`/videos/manage/playlists/${parentId}/subs`, form);
      }
      onSave();
    } catch(err) {
      setError(err.response?.data?.message || 'خطأ');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-slate-800">
            {subPlaylist ? 'تعديل الدرس' : 'درس جديد'}
          </h3>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>
        {error && <div className="alert alert-danger mb-4">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">عنوان الدرس *</label>
            <input className="input" placeholder="مثال: الدرس الأول - المقدمة" value={form.title}
              onChange={e=>set('title',e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">وصف (اختياري)</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e=>set('description',e.target.value)}/>
          </div>
          <ImageUploadField
            value={form.thumbnail}
            onChange={v => set('thumbnail', v)}
            fileRef={fileRef}
            uploading={uploading}
            onFileChange={handleImageFile}
          />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} className="btn-primary flex-1" disabled={loading || uploading}>
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '💾 حفظ'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

// ── Sub-playlist Manager — يدير المحتوى المتنوع داخل درس ──────────────────
function SubPlaylistManager({ subPlaylist, parentTitle, onBack }) {
  const [items, setItems]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`/videos/manage/playlists/${subPlaylist.id}/items`)
      .then(r => setItems(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deleteItem = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;
    await api.delete(`/videos/manage/items/${id}`);
    load();
  };

  const moveItem = async (item, dir) => {
    const sorted = [...items].sort((a,b) => a.position - b.position);
    const idx = sorted.findIndex(i => i.id === item.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[newIdx]] = [reordered[newIdx], reordered[idx]];
    await api.put('/videos/manage/items/reorder', { ids: reordered.map(i => i.id) });
    load();
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <button onClick={onBack} className="btn-ghost btn-sm">← رجوع</button>
        <div>
          <p className="text-xs text-slate-400">{parentTitle}</p>
          <h2 className="text-xl font-extrabold text-slate-800">{subPlaylist.title}</h2>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 mt-4">
        <span className="text-sm text-slate-500">{items.length} عنصر</span>
        <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">+ إضافة محتوى</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
          <div className="text-4xl mb-2">📭</div>
          <p className="text-slate-500 mb-3">لا يوجد محتوى بعد</p>
          <p className="text-xs text-slate-400 mb-4">يمكنك إضافة فيديوهات، امتحانات، واجبات، وملفات</p>
          <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">+ إضافة محتوى</button>
        </div>
      ) : (
        <div className="space-y-3">
          {[...items].sort((a,b)=>a.position-b.position).map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onEdit={() => setEditingItem(item)}
              onDelete={() => deleteItem(item.id)}
              onMoveUp={() => moveItem(item, -1)}
              onMoveDown={() => moveItem(item, 1)}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <ItemModal
          playlistId={subPlaylist.id}
          onClose={() => setShowAdd(false)}
          onSave={() => { setShowAdd(false); load(); }}
        />
      )}
      {editingItem && (
        <ItemModal
          item={editingItem}
          playlistId={subPlaylist.id}
          onClose={() => setEditingItem(null)}
          onSave={() => { setEditingItem(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Item Row ──────────────────────────────────────────────────────────────
function ItemRow({ item, onEdit, onDelete, onMoveUp, onMoveDown }) {
  const thumb = item.type === 'video' ? getThumbnail(item.youtube_url) : null;

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex items-center gap-3 p-3">
        {/* Thumb or Icon */}
        <div className="w-20 h-14 flex-shrink-0 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
          {thumb ? (
            <img src={thumb} alt={item.title} className="w-full h-full object-cover"/>
          ) : (
            <span className="text-2xl">{ITEM_ICONS[item.type]}</span>
          )}
        </div>
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ITEM_COLORS[item.type]}`}>
              {ITEM_ICONS[item.type]} {ITEM_LABELS[item.type]}
            </span>
          </div>
          <p className="font-semibold text-slate-800 text-sm truncate">{item.title}</p>
          {item.description && <p className="text-xs text-slate-400 truncate">{item.description}</p>}
          {item.type === 'exam' && item.exam_title && (
            <p className="text-xs text-purple-500 truncate">الامتحان: {item.exam_title}</p>
          )}
          {item.type === 'file' && (item.file_name || item.file_url) && (
            <p className="text-xs text-green-600 truncate">
              📎 {item.file_name || item.file_url}
            </p>
          )}
          {item.type === 'video' && item.youtube_url && (
            <p className="text-xs text-blue-500 truncate mt-0.5">{item.youtube_url}</p>
          )}
        </div>
        {/* Actions */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          <div className="flex gap-1">
            <button onClick={onMoveUp}   className="btn-secondary btn-sm py-0.5 px-2">↑</button>
            <button onClick={onMoveDown} className="btn-secondary btn-sm py-0.5 px-2">↓</button>
          </div>
          <div className="flex gap-1">
            <button onClick={onEdit}   className="btn-secondary btn-sm py-0.5 px-2">✏️</button>
            <button onClick={onDelete} className="btn-danger btn-sm py-0.5 px-2">🗑️</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Item Add/Edit Modal ───────────────────────────────────────────────────
function ItemModal({ item, playlistId, onClose, onSave }) {
  const [type, setType]         = useState(item?.type || 'video');
  const [form, setForm]         = useState({
    title:       item?.title || '',
    description: item?.description || '',
    youtube_url: item?.youtube_url || '',
    exam_id:     item?.exam_id || '',
    file_url:    item?.file_url || '',
    file_name:   item?.file_name || '',
    file_data:   '',
  });
  const [exams, setExams]       = useState([]);
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]       = useState('');
  const fileRef = useRef();
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  useEffect(() => {
    api.get('/videos/manage/exams-list').then(r => setExams(r.data)).catch(()=>{});
  }, []);

  const previewThumb = type === 'video' ? getThumbnail(form.youtube_url) : null;

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('حجم الملف أكبر من 10MB');
      return;
    }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm(f => ({ ...f, file_data: ev.target.result, file_name: file.name, file_url: '' }));
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!form.title) return setError('العنوان مطلوب');
    if (type === 'video' && !form.youtube_url) return setError('رابط YouTube مطلوب');
    if (type === 'exam' && !form.exam_id) return setError('اختر امتحاناً');
    setLoading(true);
    try {
      if (item) {
        await api.put(`/videos/manage/items/${item.id}`, { ...form, type });
      } else {
        await api.post(`/videos/manage/playlists/${playlistId}/items`, { ...form, type });
      }
      onSave();
    } catch(err) {
      setError(err.response?.data?.message || 'خطأ');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-slate-800">
            {item ? 'تعديل العنصر' : 'إضافة محتوى'}
          </h3>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>

        {error && <div className="alert alert-danger mb-4">{error}</div>}

        {/* Type selector */}
        {!item && (
          <div className="mb-5">
            <label className="block text-xs font-bold text-slate-500 mb-2">نوع المحتوى *</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(ITEM_LABELS).map(([k, v]) => (
                <button key={k} onClick={() => setType(k)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    type === k ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                  }`}>
                  <div className="text-2xl mb-1">{ITEM_ICONS[k]}</div>
                  <div className="text-xs font-bold text-slate-700">{v}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">العنوان *</label>
            <input className="input" placeholder={
              type === 'video' ? 'مثال: شرح درس الكسور' :
              type === 'exam'  ? 'مثال: امتحان الفصل الأول' :
              'مثال: ملخص الوحدة الأولى'
            } value={form.title} onChange={e=>set('title',e.target.value)}/>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">وصف (اختياري)</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e=>set('description',e.target.value)}/>
          </div>

          {/* Video fields */}
          {type === 'video' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">رابط YouTube *</label>
              <input className="input" placeholder="https://youtube.com/watch?v=..."
                value={form.youtube_url} onChange={e=>set('youtube_url',e.target.value)}/>
              {previewThumb && (
                <div className="mt-2 relative bg-slate-100 rounded-lg overflow-hidden aspect-video max-h-40">
                  <img src={previewThumb} alt="preview" className="w-full h-full object-cover"/>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                      <span className="text-white text-base">▶</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Exam field */}
          {type === 'exam' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">اختر الامتحان *</label>
              <select className="input" value={form.exam_id} onChange={e=>set('exam_id',e.target.value)}>
                <option value="">-- اختر امتحاناً --</option>
                {exams.map(ex => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({GRADES[ex.grade]})
                  </option>
                ))}
              </select>
              {exams.length === 0 && (
                <p className="text-xs text-slate-400 mt-1">لا توجد امتحانات فعّالة حالياً</p>
              )}
            </div>
          )}

          {/* File upload field */}
          {type === 'file' && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">الملف</label>
              <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload}/>
              <button type="button" onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="btn-secondary btn-sm w-full flex items-center justify-center gap-2 mb-3">
                {uploading
                  ? <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/> جاري الرفع...</>
                  : <>📁 ارفع ملف من الجهاز (PDF, Word, ...)</>}
              </button>
              {form.file_name && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-2 mb-2">
                  <span className="text-lg">📎</span>
                  <span className="text-sm text-green-700 font-semibold flex-1 truncate">{form.file_name}</span>
                  <button onClick={() => setForm(f=>({...f,file_name:'',file_data:'',file_url:''}))}
                    className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              )}
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"/></div>
                <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-slate-400">أو</span></div>
              </div>
              <div className="mt-2">
                <label className="block text-xs text-slate-500 mb-1">الصق رابط خارجي (Google Drive, ...)</label>
                <input className="input text-xs" placeholder="https://drive.google.com/..."
                  value={form.file_url} onChange={e=>{set('file_url',e.target.value); set('file_name',''); set('file_data','');}}/>
              </div>
              <p className="text-xs text-slate-400 mt-1">الحد الأقصى للملف المرفوع: 10MB</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} className="btn-primary flex-1" disabled={loading || uploading}>
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '💾 حفظ'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  );
}

// ── Reusable Image Upload Field ───────────────────────────────────────────
function ImageUploadField({ value, onChange, fileRef, uploading, onFileChange }) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-500 mb-1">صورة الغلاف (اختياري)</label>

      {/* Upload from device */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFileChange}
      />
      <div className="flex gap-2 mb-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="btn-secondary btn-sm flex items-center gap-1.5 flex-1"
        >
          {uploading
            ? <><span className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/> جاري الرفع...</>
            : <>📁 ارفع من الجهاز</>}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="btn-danger btn-sm px-2"
            title="حذف الصورة"
          >✕</button>
        )}
      </div>

      {/* Or paste URL */}
      <input
        className="input text-xs"
        placeholder="أو الصق رابط صورة https://..."
        value={value?.startsWith('data:') ? '' : (value || '')}
        onChange={e => onChange(e.target.value)}
      />

      {/* Preview */}
      {value && (
        <img
          src={value}
          alt="preview"
          className="mt-2 w-full h-32 object-cover rounded-lg border border-slate-200"
        />
      )}
    </div>
  );
}

// ── Video Add/Edit Modal (legacy direct videos) ───────────────────────────
function VideoModal({ video, playlistId, onClose, onSave }) {
  const [form, setForm] = useState({
    title:       video?.title || '',
    youtube_url: video?.youtube_url || '',
    description: video?.description || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const previewThumb = getThumbnail(form.youtube_url);

  const handleSave = async () => {
    if (!form.title || !form.youtube_url) return setError('العنوان والرابط مطلوبان');
    setLoading(true);
    try {
      if (video) {
        await api.put(`/videos/manage/videos/${video.id}`, form);
      } else {
        await api.post(`/videos/manage/playlists/${playlistId}/videos`, form);
      }
      onSave();
    } catch(err) {
      setError(err.response?.data?.message || 'خطأ');
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-extrabold text-slate-800">
            {video ? 'تعديل الفيديو' : 'إضافة فيديو مباشر'}
          </h3>
          <button onClick={onClose} className="btn-ghost btn-sm">✕</button>
        </div>
        {error && <div className="alert alert-danger mb-4">{error}</div>}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">عنوان الفيديو *</label>
            <input className="input" placeholder="مثال: شرح درس الكسور" value={form.title}
              onChange={e=>set('title',e.target.value)}/>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">رابط YouTube *</label>
            <input className="input" placeholder="https://youtube.com/watch?v=..." value={form.youtube_url}
              onChange={e=>set('youtube_url',e.target.value)}/>
            {previewThumb && (
              <div className="mt-2 relative bg-slate-100 rounded-lg overflow-hidden aspect-video max-h-40">
                <img src={previewThumb} alt="preview" className="w-full h-full object-cover"/>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xl">▶</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">وصف (اختياري)</label>
            <textarea className="input resize-none" rows={2} value={form.description}
              onChange={e=>set('description',e.target.value)}/>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={handleSave} className="btn-primary flex-1" disabled={loading}>
            {loading ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : '💾 حفظ'}
          </button>
          <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
        </div>
      </div>
    </div>
  );
}
