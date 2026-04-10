import { useState, useEffect } from 'react';
import api from '../../utils/api';

const GRADES = {4:'رابع ابتدائي',5:'خامس ابتدائي',6:'سادس ابتدائي',7:'أول إعدادي',8:'ثاني إعدادي',9:'ثالث إعدادي',10:'أول ثانوي',11:'ثاني ثانوي',12:'ثالث ثانوي'};

function getYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url?.match(regex);
  return match ? match[1] : null;
}

function getThumbnail(url) {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

export default function VideosList() {
  const [playlists, setPlaylists]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [gradeFilter, setGradeFilter]   = useState('all');
  const [showNewPlaylist, setShowNewPlaylist] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [openPlaylist, setOpenPlaylist] = useState(null); // playlist being managed

  const load = () => {
    setLoading(true);
    api.get('/videos/manage/playlists')
      .then(r => setPlaylists(r.data))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const deletePlaylist = async (id) => {
    if (!confirm('هل أنت متأكد من حذف هذه القائمة وكل فيديوهاتها؟')) return;
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
          {filtered.map(pl => {
            const thumb = pl.thumbnail || getThumbnail(null);
            return (
              <div key={pl.id} className="card p-0 overflow-hidden group">
                {/* Thumbnail */}
                <div className="relative bg-slate-200 aspect-video overflow-hidden">
                  {pl.thumbnail ? (
                    <img src={pl.thumbnail} alt={pl.title}
                      className="w-full h-full object-cover"/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                      <span className="text-5xl">🎬</span>
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span className="badge badge-blue text-xs bg-white/90">{GRADES[pl.grade]}</span>
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <span className="bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                      {pl.video_count} فيديو
                    </span>
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
            );
          })}
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

// ── Playlist Create/Edit Modal ────────────────────────────────────────────
function PlaylistModal({ playlist, onClose, onSave }) {
  const [form, setForm] = useState({
    title:       playlist?.title || '',
    description: playlist?.description || '',
    thumbnail:   playlist?.thumbnail || '',
    grade:       playlist?.grade || 4,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

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
            <input className="input" placeholder="مثال: شرح الفصل الأول" value={form.title}
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
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              رابط صورة الغلاف (اختياري)
            </label>
            <input className="input" placeholder="https://..." value={form.thumbnail}
              onChange={e=>set('thumbnail',e.target.value)}/>
            {form.thumbnail && (
              <img src={form.thumbnail} alt="preview"
                className="mt-2 w-full h-32 object-cover rounded-lg border border-slate-200"/>
            )}
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

// ── Playlist Manager — إدارة فيديوهات قائمة ──────────────────────────────
function PlaylistManager({ playlist, onBack }) {
  const [videos, setVideos]       = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAdd, setShowAdd]     = useState(false);
  const [editing, setEditing]     = useState(null);

  const load = () => {
    setLoading(true);
    api.get(`/videos/manage/playlists/${playlist.id}`)
      .then(r => setVideos(r.data.videos))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

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

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <button onClick={onBack} className="btn-ghost btn-sm">← رجوع</button>
        <div>
          <h2 className="text-xl font-extrabold text-slate-800">{playlist.title}</h2>
          <p className="text-xs text-slate-400">{GRADES[playlist.grade]}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-500">{videos.length} فيديو</span>
        <button onClick={() => setShowAdd(true)} className="btn-primary btn-sm">+ إضافة فيديو</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
        </div>
      ) : videos.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <div className="text-4xl mb-2">🎥</div>
          <p>لا توجد فيديوهات بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {[...videos].sort((a,b)=>a.position-b.position).map((v, idx) => {
            const thumb = getThumbnail(v.youtube_url);
            return (
              <div key={v.id} className="card p-0 overflow-hidden">
                <div className="flex items-center gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="w-24 h-16 flex-shrink-0 bg-slate-200 rounded-lg overflow-hidden">
                    {thumb
                      ? <img src={thumb} alt={v.title} className="w-full h-full object-cover"/>
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🎥</div>
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 text-sm truncate">{v.title}</div>
                    {v.description && <p className="text-xs text-slate-400 truncate">{v.description}</p>}
                    <p className="text-xs text-blue-500 truncate mt-0.5">{v.youtube_url}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <div className="flex gap-1">
                      <button onClick={() => moveVideo(v,-1)} className="btn-secondary btn-sm py-0.5 px-2">↑</button>
                      <button onClick={() => moveVideo(v,1)}  className="btn-secondary btn-sm py-0.5 px-2">↓</button>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setEditing(v)} className="btn-secondary btn-sm py-0.5 px-2">✏️</button>
                      <button onClick={() => deleteVideo(v.id)} className="btn-danger btn-sm py-0.5 px-2">🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAdd && (
        <VideoModal
          playlistId={playlist.id}
          onClose={() => setShowAdd(false)}
          onSave={() => { setShowAdd(false); load(); }}
        />
      )}
      {editing && (
        <VideoModal
          video={editing}
          playlistId={playlist.id}
          onClose={() => setEditing(null)}
          onSave={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

// ── Video Add/Edit Modal ──────────────────────────────────────────────────
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
            {video ? 'تعديل الفيديو' : 'إضافة فيديو'}
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
