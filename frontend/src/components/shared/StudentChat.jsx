import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

export default function StudentChat({ onClose, onRead }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText]         = useState('');
  const [sending, setSending]   = useState(false);
  const [loading, setLoading]   = useState(true);
  const bottomRef = useRef(null);

  const load = async (silent = false) => {
    try {
      const { data } = await api.get('/chat/messages');
      setMessages(data);
      if (!silent) setLoading(false);
      onRead?.();
    } catch { if (!silent) setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const { data } = await api.post('/chat/send', { message: text.trim() });
      setMessages(m => [...m, data]);
      setText('');
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end justify-end p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden"
        style={{ height: '70vh', maxHeight: 560 }}
        onClick={e => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-blue-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-lg">👨‍🏫</div>
            <div>
              <p className="text-white font-bold text-sm">اسأل المعلم</p>
              <p className="text-white/70 text-xs">سيرد عليك في أقرب وقت</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl transition-colors">✕</button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-slate-400 text-sm">ابدأ محادثتك مع المعلم</p>
            </div>
          ) : (
            messages.map(m => {
              const isMe = m.from_role === 'student';
              return (
                <div key={m.id} className={`flex ${isMe ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm
                    ${isMe
                      ? 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'
                      : 'bg-blue-600 text-white rounded-tl-sm'
                    }`}>
                    {!isMe && (
                      <p className="text-xs text-blue-200 font-bold mb-0.5">{m.from_name}</p>
                    )}
                    <p className="leading-relaxed">{m.message}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-slate-400' : 'text-blue-200'}`}>
                      {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Input */}
        <form onSubmit={send} className="flex gap-2 p-3 border-t border-slate-100 bg-white flex-shrink-0">
          <input
            className="flex-1 input text-sm"
            placeholder="اكتب رسالتك..."
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={sending}
          />
          <button type="submit" disabled={sending || !text.trim()}
            className="btn-primary px-4 text-sm flex-shrink-0 disabled:opacity-50">
            {sending
              ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
              : '↑'
            }
          </button>
        </form>
      </div>
    </div>
  );
}
