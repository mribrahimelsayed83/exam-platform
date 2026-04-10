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

export default function VideosPage() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    api.get('/videos/playlists')
      .then(r => setPlaylists(r.data))
      .finally(() => setLoading(false));
  }, []);

  const openPlaylist = async (pl) => {
    const { data } = await api.get(`/videos/playlists/${pl.id}`);
    const videos = data.videos.sort((a,b) => a.position - b.position);
    setSelected({ playlist: data.playlist, videos, currentVideo: videos[0] || null });
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-100"><Navbar/>
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/>
      </div>
    </div>
  );

  // ── Video Player ──────────────────────────────────────────────────────
  if (selected) {
    const { playlist, videos, currentVideo } = selected;
    const videoId    = getYouTubeId(currentVideo?.youtube_url);
    const currentIdx = videos.findIndex(v => v.id === currentVideo?.id);

    return (
      <div className="min-h-screen bg-slate-900">
        <Navbar/>
        <div className="max-w-6xl mx-auto px-4 py-6">
          <button onClick={() => setSelected(null)}
            className="text-slate-400 hover:text-white text-sm flex items-center gap-1 mb-4 transition-colors">
            ← رجوع للقوائم
          </button>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* Player + Comments */}
            <div className="lg:col-span-2 space-y-4">
              {/* YouTube embed */}
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

              {/* Video info + like */}
              <VideoInfo video={currentVideo} />

              {/* Prev/Next */}
              <div className="flex gap-3">
                <button disabled={currentIdx===0}
                  onClick={() => setSelected(s=>({...s,currentVideo:videos[currentIdx-1]}))}
                  className="btn-secondary flex-1 disabled:opacity-40">← السابق</button>
                <button disabled={currentIdx===videos.length-1}
                  onClick={() => setSelected(s=>({...s,currentVideo:videos[currentIdx+1]}))}
                  className="btn-primary flex-1 disabled:opacity-40">التالي →</button>
              </div>

              {/* Comments */}
              {currentVideo && <VideoComments videoId={currentVideo.id} user={user}/>}
            </div>

            {/* Playlist sidebar */}
            <div className="lg:col-span-1">
              <div className="bg-slate-800 rounded-2xl overflow-hidden sticky top-20">
                <div className="p-4 border-b border-slate-700">
                  <h3 className="font-bold text-white text-sm">{playlist.title}</h3>
                  <p className="text-slate-400 text-xs mt-0.5">{videos.length} فيديو</p>
                </div>
                <div className="max-h-[500px] overflow-y-auto">
                  {videos.map((v,idx) => {
                    const tid = getYouTubeId(v.youtube_url);
                    const thumb = tid ? `https://img.youtube.com/vi/${tid}/mqdefault.jpg` : null;
                    const isActive = currentVideo?.id === v.id;
                    return (
                      <div key={v.id}
                        onClick={() => setSelected(s=>({...s,currentVideo:v}))}
                        className={`flex items-center gap-3 p-3 cursor-pointer transition-colors
                          ${isActive?'bg-blue-600':'hover:bg-slate-700'}`}>
                        <div className={`flex-shrink-0 text-xs font-bold w-5 text-center ${isActive?'text-white':'text-slate-500'}`}>
                          {isActive?'▶':idx+1}
                        </div>
                        <div className="w-16 h-10 flex-shrink-0 bg-slate-700 rounded overflow-hidden">
                          {thumb
                            ? <img src={thumb} alt={v.title} className="w-full h-full object-cover"/>
                            : <div className="w-full h-full flex items-center justify-center text-slate-500">🎥</div>}
                        </div>
                        <p className={`text-xs font-semibold truncate flex-1 ${isActive?'text-white':'text-slate-300'}`}>
                          {v.title}
                        </p>
                      </div>
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

  // ── Playlists Grid ─────────────────────────────────────────────────────
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
                      <span className="text-blue-600 text-2xl">▶</span>
                    </div>
                  </div>
                  <div className="absolute bottom-2 left-2">
                    <span className="bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                      {pl.video_count} فيديو
                    </span>
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

      {/* Comments list */}
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

      {/* Comment input */}
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
