import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

export default function TeacherChat() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [text, setText]                   = useState('');
  const [sending, setSending]             = useState(false);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const bottomRef = useRef(null);

  const loadConvs = async () => {
    try {
      const { data } = await api.get('/chat/teacher/conversations');
      setConversations(data);
    } catch {}
  };

  const loadMessages = async (studentId, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const { data } = await api.get(`/chat/teacher/${studentId}`);
      setMessages(data);
      setConversations(c => c.map(x => x.student_id === studentId ? { ...x, unread: '0' } : x));
    } finally { if (!silent) setLoadingMsgs(false); }
  };

  useEffect(() => {
    loadConvs();
    const t = setInterval(loadConvs, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => loadMessages(selected.student_id, true), 5000);
    return () => clearInterval(t);
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectStudent = (conv) => {
    setSelected(conv);
    loadMessages(conv.student_id);
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending || !selected) return;
    setSending(true);
    try {
      const { data } = await api.post(`/chat/teacher/${selected.student_id}/reply`, { message: text.trim() });
      setMessages(m => [...m, data]);
      setText('');
    } finally { setSending(false); }
  };

  return (
    <div dir="rtl">
      <h2 className="text-xl font-extrabold text-slate-800 mb-5">💬 رسائل الطلاب</h2>
      <div className="flex gap-4" style={{ height: '70vh', minHeight: 400 }}>

        {/* Conversations list */}
        <div className="w-64 flex-shrink-0 bg-white rounded-2xl border border-slate-200 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <div className="text-4xl mb-2">💬</div>
              <p className="text-sm">لا توجد رسائل بعد</p>
            </div>
          ) : conversations.map(c => (
            <button key={c.student_id} onClick={() => selectStudent(c)}
              className={`w-full text-right px-4 py-3 border-b border-slate-100 flex items-start gap-3 transition-colors
                ${selected?.student_id === c.student_id ? 'bg-blue-50 border-r-2 border-r-blue-600' : 'hover:bg-slate-50'}`}>
              <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-base flex-shrink-0">
                👤
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-slate-800 truncate">{c.student_name}</p>
                  {Number(c.unread) > 0 && (
                    <span className="w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {c.unread}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate mt-0.5">{c.last_message}</p>
              </div>
            </button>
          ))}
        </div>

        {/* Chat window */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="text-5xl mb-3">💬</div>
                <p className="font-semibold">اختر طالباً للرد عليه</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-base">👤</div>
                <div>
                  <p className="font-bold text-slate-800 text-sm">{selected.student_name}</p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {loadingMsgs ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
                  </div>
                ) : messages.map(m => {
                  const isStudent = m.from_role === 'student';
                  return (
                    <div key={m.id} className={`flex ${isStudent ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm
                        ${isStudent
                          ? 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'
                          : 'bg-blue-600 text-white rounded-tl-sm'
                        }`}>
                        <p className="leading-relaxed">{m.message}</p>
                        <p className={`text-xs mt-1 ${isStudent ? 'text-slate-400' : 'text-blue-200'}`}>
                          {new Date(m.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef}/>
              </div>

              {/* Input */}
              <form onSubmit={send} className="flex gap-2 p-3 border-t border-slate-100 flex-shrink-0">
                <input className="flex-1 input text-sm" placeholder="اكتب ردك..."
                  value={text} onChange={e => setText(e.target.value)} disabled={sending}/>
                <button type="submit" disabled={sending || !text.trim()}
                  className="btn-primary px-4 text-sm disabled:opacity-50">
                  {sending
                    ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                    : 'إرسال'
                  }
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
