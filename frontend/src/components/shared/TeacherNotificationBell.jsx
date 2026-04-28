import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../utils/api';

const typeIcons = {
  register:   '📝',
  login:      '🔑',
  submission: '📋',
  comment:    '💬',
  like:       '❤️',
};


export default function TeacherNotificationBell() {
  const [count, setCount]   = useState(0);
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchCount = async () => {
    try {
      const { data } = await api.get('/teacher/my-notifications/unread-count');
      setCount(data.count);
    } catch {}
  };

  const openPanel = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const { data } = await api.get('/teacher/my-notifications');
      setNotifs(data);
    } finally { setLoading(false); }
  };

  const markAllRead = async () => {
    await api.post('/teacher/my-notifications/read-all');
    setCount(0);
    setNotifs(n => n.map(x => ({ ...x, is_read: true })));
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      try {
        await api.post(`/teacher/my-notifications/${notif.id}/read`);
        setNotifs(n => n.map(x => x.id === notif.id ? { ...x, is_read: true } : x));
        setCount(c => Math.max(0, c - 1));
      } catch {}
    }
    setOpen(false);
    const id = notif.link_id;
    if (notif.link_type === 'chat' && id) {
      navigate(`/teacher/chat?student=${id}`);
    } else if (notif.link_type === 'student' && id) {
      navigate(`/teacher/students?open=${id}`);
    } else if (notif.link_type === 'student') {
      navigate('/teacher/students');
    } else if (notif.link_type === 'submission' && id) {
      navigate(`/teacher/submissions?open=${id}`);
    } else if (notif.link_type === 'video') {
      navigate('/teacher/videos');
    }
  };

  const deleteNotif = async (id, e) => {
    e.stopPropagation();
    await api.delete(`/teacher/my-notifications/${id}`);
    const deleted = notifs.find(x => x.id === id);
    if (deleted && !deleted.is_read) setCount(c => Math.max(0, c - 1));
    setNotifs(n => n.filter(x => x.id !== id));
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={openPanel}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors">
        <span className="text-xl">🔔</span>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-800 text-sm">إشعاراتك</h3>
            <div className="flex items-center gap-3">
              {count > 0 && (
                <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline font-semibold">
                  تعليم الكل
                </button>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-6">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
              </div>
            ) : notifs.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">لا توجد إشعارات</p>
              </div>
            ) : (
              notifs.map(n => (
                <div key={n.id}
                  onClick={() => handleNotifClick(n)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-slate-50 transition-colors cursor-pointer
                    ${!n.is_read ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'}`}>
                  <span className="text-xl flex-shrink-0 mt-0.5">{typeIcons[n.type] || '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-slate-800 truncate">{n.title}</p>
                      {!n.is_read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"/>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {new Date(n.created_at).toLocaleDateString('ar-EG',{
                        month:'short', day:'numeric',
                        hour:'2-digit', minute:'2-digit'
                      })}
                    </p>
                  </div>
                  <button onClick={(e) => deleteNotif(n.id, e)}
                    className="text-slate-300 hover:text-red-500 transition-colors flex-shrink-0 mt-0.5">
                    ✕
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
