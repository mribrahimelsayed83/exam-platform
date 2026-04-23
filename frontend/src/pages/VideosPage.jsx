import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/shared/Navbar';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';

function getYouTubeId(url) {
  const regex = /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
  const match = url?.match(regex);
  return match ? match[1] : null;
}

const ITEM_ICONS  = { video:'🎬', exam:'📝', file:'📄' };
const ITEM_LABELS = { video:'فيديو', exam:'امتحان', file:'ملف' };

// ── Main Page ──────────────────────────────────────────────────────────────
export default function VideosPage() {
  // view states: 'playlists' | 'subs' | 'items' | 'player'
  const [view, setView]           = useState('playlists');
  const [playlists, setPlaylists] = useState([]);
  const [parentPlaylist, setParentPlaylist] = useState(null);
  const [subs, setSubs]           = useState([]);
  const [subPlaylist, setSubPlaylist] = useState(null);
  const [items, setItems]         = useState([]);
  const [currentVideo, setCurrentVideo] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [viewedIds, setViewedIds] = useState(new Set());
  const { user } = useAuth();
  const navigate = useNavigate();

  // Load top-level playlists + viewed IDs on mount
  useEffect(() => {
    Promise.all([
      api.get('/videos/playlists'),
      api.get('/videos/viewed').catch(() => ({ data: [] })),
    ]).then(([pl, vw]) => {
      setPlaylists(pl.data);
      setViewedIds(new Set(vw.data));
    }).finally(() => setLoading(false));
  }, []);

  // ── Open a top-level playlist ──
  const openPlaylist = async (pl) => {
    setLoading(true);
    try {
      if (pl.sub_count > 0) {
        // Has sub-playlists → show sub-playlists view
        const { data } = await api.get(`/videos/playlists/${pl.id}/subs`);
        setParentPlaylist(data.parent);
        setSubs(data.subs);
        setView('subs');
      } else {
        // Legacy direct-videos playlist
        const { data } = await api.get(`/videos/playlists/${pl.id}`);
        const sorted = (data.videos || []).sort((a,b) => a.position - b.position);
        setParentPlaylist(data.playlist);
        setItems(sorted.map(v => ({ ...v, type: 'video' })));
        setCurrentVideo(sorted[0] || null);
        setView(sorted.length > 0 ? 'player' : 'items');
      }
    } finally { setLoading(false); }
  };

  // ── Open a sub-playlist ──
  const openSub = async (sub) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/videos/playlists/${sub.id}/items`);
      setSubPlaylist(data.playlist);
      setItems(data.items || []);
      // If first item is a video, go directly to player
      const firstVideo = (data.items || []).find(i => i.type === 'video');
      setCurrentVideo(firstVideo || null);
      setView('items');
    } finally { setLoading(false); }
  };

  // ── Track video view ──
  const trackView = (item) => {
    api.post('/videos/view', { item_id: item.id, title: item.title }).catch(() => {});
    setViewedIds(prev => new Set([...prev, item.id]));
  };

  // ── Back handlers ──
  const goToPlaylists = () => {
    setView('playlists');
    setParentPlaylist(null);
    setSubs([]);
    setSubPlaylist(null);
    setItems([]);
    setCurrentVideo(null);
  };

  const goToSubs = () => {
    setView('subs');
    setSubPlaylist(null);
    setItems([]);
    setCurrentVideo(null);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-100"><Navbar/>
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    </div>
  );

  // ── Video Player view (legacy + items with active video) ──────────────
  if (view === 'player' || (view === 'items' && currentVideo && currentVideo.type === 'video' && items.some(i=>i.type==='video'))) {
    const videoId    = getYouTubeId(currentVideo?.youtube_url);
    const videoItems = items.filter(i => i.type === 'video');
    const currentIdx = videoItems.findIndex(v => v.id === currentVideo?.id);

    return (
      <div className="min-h-screen bg-slate-900">
        <Navbar/>
        <div className="max-w-6xl mx-auto px-4 py-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-4 flex-wrap">
            <button onClick={goToPlaylists} className="text-slate-400 hover:text-white transition-colors">
              ← الفيديوهات
            </button>
            {parentPlaylist && (
              <>
                <span className="text-slate-600">/</span>
                <button onClick={view === 'items' ? goToSubs : goToPlaylists}
                  className="text-slate-400 hover:text-white transition-colors">
                  {parentPlaylist.title}
                </button>
              </>
            )}
            {subPlaylist && (
              <>
                <span className="text-slate-600">/</span>
                <button onClick={() => setCurrentVideo(null)}
                  className="text-slate-400 hover:text-white transition-colors">
                  {subPlaylist.title}
                </button>
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Player + Comments */}
            <div className="lg:col-span-2 space-y-4">
              {videoId ? (
                <div className="relative bg-black rounded-2xl overflow-hidden" style={{paddingTop:'56.25%'}}>
                  <iframe
                    className="absolute inset-0 w-full h-full"
                    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
                    title={currentVideo.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen/>
                </div>
              ) : (
                <div className="bg-slate-800 rounded-2xl aspect-video flex items-center justify-center">
                  <p className="text-slate-400">رابط الفيديو غير صحيح</p>
                </div>
              )}

              <VideoInfo video={currentVideo}/>

              {/* Prev/Next among videos */}
              <div className="flex gap-3">
                <button disabled={currentIdx<=0}
                  onClick={() => { const v=videoItems[currentIdx-1]; setCurrentVideo(v); trackView(v); }}
                  className="btn-secondary flex-1 disabled:opacity-40">← السابق</button>
                <button disabled={currentIdx>=videoItems.length-1}
                  onClick={() => { const v=videoItems[currentIdx+1]; setCurrentVideo(v); trackView(v); }}
                  className="btn-primary flex-1 disabled:opacity-40">التالي →</button>
              </div>

              {/* Back to lesson items */}
              {view === 'items' && (
                <button onClick={() => setCurrentVideo(null)}
                  className="w-full btn-secondary">
                  ← رجوع لمحتوى الدرس
                </button>
              )}

              {currentVideo && <VideoComments videoId={currentVideo.id} user={user}/>}
            </div>

            {/* Sidebar: all items in the sub-playlist */}
            <div className="lg:col-span-1">
              <div className="bg-slate-800 rounded-2xl overflow-hidden sticky top-20">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="font-bold text-white text-sm">
                    {subPlaylist?.title || parentPlaylist?.title}
                  </h3>
                  <p className="text-slate-400 text-xs mt-0.5">{items.length} عنصر</p>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {items.map((item, idx) => {
                    const isActiveVideo = item.type === 'video' && currentVideo?.id === item.id;
                    const tid = item.type === 'video' ? getYouTubeId(item.youtube_url) : null;
                    const thumb = tid ? `https://img.youtube.com/vi/${tid}/mqdefault.jpg` : null;
                    return (
                      <SidebarItem
                        key={item.id}
                        item={item}
                        idx={idx}
                        isActive={isActiveVideo}
                        isViewed={viewedIds.has(item.id)}
                        thumb={thumb}
                        onClick={() => {
                          if (item.type === 'video') { setCurrentVideo(item); trackView(item); }
                        }}
                        navigate={navigate}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Items view (lesson content, no active video) ──────────────────────
  if (view === 'items') {
    return (
      <div className="min-h-screen bg-slate-100">
        <Navbar/>
        <div className="max-w-3xl mx-auto px-4 py-8">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm mb-6 flex-wrap">
            <button onClick={goToPlaylists} className="text-slate-500 hover:text-slate-800 transition-colors">
              الفيديوهات
            </button>
            {parentPlaylist && (
              <>
                <span className="text-slate-400">/</span>
                <button onClick={goToSubs} className="text-slate-500 hover:text-slate-800 transition-colors">
                  {parentPlaylist.title}
                </button>
              </>
            )}
            {subPlaylist && (
              <>
                <span className="text-slate-400">/</span>
                <span className="text-slate-800 font-semibold">{subPlaylist.title}</span>
              </>
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-slate-800 mb-1">{subPlaylist?.title}</h1>
          {subPlaylist?.description && (
            <p className="text-slate-500 text-sm mb-6">{subPlaylist.description}</p>
          )}

          {items.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📭</div>
              <p>لا يوجد محتوى في هذا الدرس بعد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <LessonItemCard
                  key={item.id}
                  item={item}
                  isViewed={viewedIds.has(item.id)}
                  onPlayVideo={() => { setCurrentVideo(item); trackView(item); }}
                  navigate={navigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Sub-playlists view (lessons list) ────────────────────────────────
  if (view === 'subs') {
    return (
      <div className="min-h-screen bg-slate-100">
        <Navbar/>
        <div className="max-w-3xl mx-auto px-4 py-8">
          <button onClick={goToPlaylists}
            className="text-slate-500 hover:text-slate-800 text-sm flex items-center gap-1 mb-4 transition-colors">
            ← رجوع للقوائم
          </button>
          {parentPlaylist?.thumbnail && (
            <div className="relative rounded-2xl overflow-hidden aspect-video mb-6 max-h-48">
              <img src={parentPlaylist.thumbnail} alt={parentPlaylist.title}
                className="w-full h-full object-cover"/>
              <div className="absolute inset-0 bg-black/40 flex items-end p-5">
                <h1 className="text-2xl font-extrabold text-white">{parentPlaylist.title}</h1>
              </div>
            </div>
          )}
          {!parentPlaylist?.thumbnail && (
            <h1 className="text-2xl font-extrabold text-slate-800 mb-6">{parentPlaylist?.title}</h1>
          )}

          {parentPlaylist?.description && (
            <p className="text-slate-500 text-sm mb-5">{parentPlaylist.description}</p>
          )}

          <p className="text-sm text-slate-500 mb-4">{subs.length} درس</p>

          {subs.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <div className="text-5xl mb-3">📂</div>
              <p>لا توجد دروس بعد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {[...subs].sort((a,b)=>a.position-b.position).map((sub, idx) => (
                <div key={sub.id}
                  onClick={() => openSub(sub)}
                  className="card p-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group">
                  <div className="flex items-center gap-4 p-4">
                    {sub.thumbnail ? (
                      <div className="w-20 h-14 flex-shrink-0 rounded-xl overflow-hidden">
                        <img src={sub.thumbnail} alt={sub.title} className="w-full h-full object-cover"/>
                      </div>
                    ) : (
                      <div className="w-14 h-14 flex-shrink-0 bg-blue-100 rounded-xl flex items-center justify-center">
                        <span className="text-2xl font-extrabold text-blue-600">{idx + 1}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                        {sub.title}
                      </h3>
                      {sub.description && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{sub.description}</p>
                      )}
                      <p className="text-xs text-slate-400 mt-1">{sub.item_count} عنصر</p>
                    </div>
                    <span className="text-slate-400 group-hover:text-blue-500 transition-colors text-xl">←</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Playlists Grid (default view) ────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100">
      <Navbar/>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-800">الفيديوهات التعليمية</h1>
          <p className="text-slate-500 text-sm mt-1">قوائم الفيديوهات لصفك الدراسي</p>
        </div>
        {playlists.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <div className="text-5xl mb-3">🎬</div>
            <h3 className="text-lg font-bold text-slate-600">لا توجد فيديوهات بعد</h3>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {playlists.map(pl => (
              <div key={pl.id} onClick={() => openPlaylist(pl)}
                className="card p-0 overflow-hidden cursor-pointer hover:shadow-md transition-shadow group">
                <div className="relative bg-slate-200 aspect-video overflow-hidden">
                  {pl.thumbnail
                    ? <img src={pl.thumbnail} alt={pl.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                    : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                        <span className="text-5xl">🎬</span>
                      </div>}
                  <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <div className="w-14 h-14 bg-white/90 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-2xl">{pl.sub_count > 0 ? '📂' : '▶'}</span>
                    </div>
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
                <div className="p-4">
                  <h3 className="font-bold text-slate-800 mb-1">{pl.title}</h3>
                  {pl.description && <p className="text-xs text-slate-500">{pl.description}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Lesson Item Card (in items view) ─────────────────────────────────────
function LessonItemCard({ item, isViewed, onPlayVideo, navigate }) {
  const thumb = item.type === 'video' ? getThumbnail(item.youtube_url) : null;
  const [downloading, setDownloading] = useState(false);

  const downloadFile = async () => {
    setDownloading(true);
    try {
      const { data } = await api.get(`/videos/items/${item.id}/download`);
      if (data.file_data) {
        const a = document.createElement('a');
        a.href = data.file_data;
        a.download = data.file_name || 'ملف';
        a.click();
      } else if (item.file_url) {
        window.open(item.file_url, '_blank', 'noreferrer');
      }
    } finally { setDownloading(false); }
  };

  const handleClick = () => {
    if (item.type === 'video') onPlayVideo();
    else if (item.type === 'exam' && item.exam_id) navigate(`/student/exam/${item.exam_id}`);
    else if (item.type === 'file') downloadFile();
  };

  const hasFile = item.type === 'file' && (item.file_name || item.file_url);
  const isClickable = item.type === 'video' ||
    (item.type === 'exam' && item.exam_id) ||
    hasFile;

  const badgeColor =
    item.type === 'video' ? 'bg-blue-100 text-blue-700' :
    item.type === 'exam'  ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700';

  return (
    <div
      onClick={isClickable && !downloading ? handleClick : undefined}
      className={`card p-0 overflow-hidden transition-shadow ${isClickable ? 'cursor-pointer hover:shadow-md' : ''}`}>
      <div className="flex items-center gap-4 p-4">
        {/* Thumb or icon */}
        <div className="w-20 h-14 flex-shrink-0 bg-slate-100 rounded-xl overflow-hidden flex items-center justify-center relative">
          {thumb ? (
            <div className="relative w-full h-full">
              <img src={thumb} alt={item.title} className="w-full h-full object-cover"/>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-red-600/90 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">▶</span>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-3xl">{ITEM_ICONS[item.type] || '📄'}</span>
          )}
          {isViewed && (
            <span className="absolute top-1 right-1 w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow">✓</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor} inline-block mb-1`}>
            {ITEM_ICONS[item.type]} {ITEM_LABELS[item.type]}
          </span>
          <h3 className="font-bold text-slate-800 truncate">{item.title}</h3>
          {item.description && <p className="text-xs text-slate-500 truncate mt-0.5">{item.description}</p>}
          {item.type === 'exam' && item.exam_title && (
            <p className="text-xs text-purple-600 mt-0.5">📝 {item.exam_title}</p>
          )}
          {item.type === 'file' && item.file_name && (
            <p className="text-xs text-green-600 mt-0.5">📎 {item.file_name}</p>
          )}
        </div>

        {/* Action indicator */}
        {item.type === 'file' && hasFile && (
          <div className="flex-shrink-0">
            {downloading
              ? <span className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin block"/>
              : <span className="text-green-600 text-lg">⬇️</span>}
          </div>
        )}
        {item.type !== 'file' && isClickable && (
          <span className="text-slate-400 text-xl flex-shrink-0">←</span>
        )}
      </div>
    </div>
  );
}

// ── Sidebar Item (inside video player view) ────────────────────────────
function SidebarItem({ item, idx, isActive, isViewed, thumb, onClick, navigate }) {
  const handleClick = async () => {
    if (item.type === 'video') {
      onClick();
    } else if (item.type === 'exam' && item.exam_id) {
      navigate(`/student/exam/${item.exam_id}`);
    } else if (item.type === 'file') {
      const { data } = await api.get(`/videos/items/${item.id}/download`).catch(()=>({data:null}));
      if (data?.file_data) {
        const a = document.createElement('a');
        a.href = data.file_data; a.download = data.file_name || 'ملف'; a.click();
      } else if (item.file_url) {
        window.open(item.file_url, '_blank', 'noreferrer');
      }
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`flex items-center gap-3 p-3 cursor-pointer transition-colors
        ${isActive ? 'bg-blue-600' : 'hover:bg-slate-700'}`}>
      <div className={`flex-shrink-0 text-xs font-bold w-5 text-center ${isActive ? 'text-white' : isViewed ? 'text-emerald-400' : 'text-slate-500'}`}>
        {isActive ? '▶' : isViewed ? '✓' : idx + 1}
      </div>
      <div className="w-16 h-10 flex-shrink-0 bg-slate-700 rounded overflow-hidden flex items-center justify-center">
        {thumb
          ? <img src={thumb} alt={item.title} className="w-full h-full object-cover"/>
          : <span className="text-lg">{ITEM_ICONS[item.type]}</span>}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
          {item.title}
        </p>
        {!isActive && (
          <span className={`text-xs px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${
            item.type === 'video'      ? 'bg-blue-500/20 text-blue-300' :
            item.type === 'exam'       ? 'bg-purple-500/20 text-purple-300' :
            item.type === 'assignment' ? 'bg-orange-500/20 text-orange-300' :
                                         'bg-green-500/20 text-green-300'
          }`}>
            {ITEM_LABELS[item.type]}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Video Info + Like ─────────────────────────────────────────────────────
function VideoInfo({ video }) {
  const [likes, setLikes] = useState({ count:0, liked:false });

  useEffect(() => {
    if (!video) return;
    api.get(`/videos/${video.id}/likes`).then(r => setLikes(r.data)).catch(()=>{});
  }, [video?.id]);

  const toggleLike = async () => {
    const { data } = await api.post(`/videos/${video.id}/like`);
    setLikes(l => ({ count: l.count + (data.liked?1:-1), liked: data.liked }));
  };

  if (!video) return null;
  return (
    <div className="bg-slate-800 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h2 className="text-white font-extrabold text-lg mb-1">{video.title}</h2>
          {video.description && <p className="text-slate-400 text-sm">{video.description}</p>}
        </div>
        <button onClick={toggleLike}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all flex-shrink-0
            ${likes.liked?'bg-red-500 text-white':'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
          <span className="text-lg">{likes.liked?'❤️':'🤍'}</span>
          <span className="font-bold text-sm">{likes.count}</span>
        </button>
      </div>
    </div>
  );
}

// ── Video Comments ────────────────────────────────────────────────────────
function VideoComments({ videoId, user }) {
  const [comments, setComments] = useState([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    api.get(`/videos/${videoId}/comments`)
      .then(r => setComments(r.data))
      .finally(() => setLoading(false));
  }, [videoId]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post(`/videos/${videoId}/comments`, { body: text.trim() });
      setComments(c => [...c, data]);
      setText('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior:'smooth' }), 100);
    } finally { setSending(false); }
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-4">
      <h3 className="font-bold text-white mb-4 text-sm">
        التعليقات {comments.length > 0 && <span className="text-slate-400 font-normal">({comments.length})</span>}
      </h3>
      <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-4">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
          </div>
        ) : comments.length === 0 ? (
          <p className="text-slate-500 text-xs text-center py-3">لا توجد تعليقات بعد — كن الأول!</p>
        ) : (
          comments.map(c => (
            <div key={c.id} className="flex gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
                {c.student_name?.charAt(0)}
              </div>
              <div className="flex-1 bg-slate-700 rounded-xl px-3 py-2">
                <p className="text-xs font-bold text-blue-300 mb-0.5">{c.student_name}</p>
                <p className="text-sm text-slate-200 leading-relaxed">{c.body}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {new Date(c.created_at).toLocaleDateString('ar-EG',{hour:'2-digit',minute:'2-digit'})}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef}/>
      </div>
      <form onSubmit={send} className="flex gap-2">
        <div className="w-7 h-7 bg-blue-600 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold">
          {user?.name?.charAt(0)}
        </div>
        <input
          className="flex-1 bg-slate-700 text-slate-200 text-sm px-3 py-2 rounded-xl border border-slate-600 outline-none focus:border-blue-500 placeholder:text-slate-500"
          placeholder="اكتب تعليقك..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button type="submit" disabled={sending || !text.trim()}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-sm font-bold disabled:opacity-40 transition-colors flex-shrink-0">
          {sending ? '...' : 'إرسال'}
        </button>
      </form>
    </div>
  );
}
