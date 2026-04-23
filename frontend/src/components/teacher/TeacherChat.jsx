import { useState, useEffect, useRef } from 'react';
import api from '../../utils/api';

export default function TeacherChat() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected]           = useState(null); // { id, name, type:'student'|'assistant' }
  const [messages, setMessages]           = useState([]);
  const [text, setText]                   = useState('');
  const [sending, setSending]             = useState(false);
  const [loadingMsgs, setLoadingMsgs]     = useState(false);
  const [searchQ, setSearchQ]             = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching]         = useState(false);
  const bottomRef  = useRef(null);
  const searchRef  = useRef(null);
  const searchTimer = useRef(null);

  // ── Load existing conversations (students + assistants) ───────────────────
  const loadConvs = async () => {
    try {
      const [s, a] = await Promise.all([
        api.get('/chat/teacher/conversations'),
        api.get('/chat/teacher/staff-conversations'),
      ]);
      const students   = s.data.map(x => ({ id: x.student_id,   name: x.student_name,   type: 'student',   unread: Number(x.unread), last_message: x.last_message }));
      const assistants = a.data.map(x => ({ id: x.assistant_id, name: x.assistant_name, type: 'assistant', unread: Number(x.unread), last_message: x.last_message }));
      setConversations([...students, ...assistants].sort((a, b) => Number(b.unread) - Number(a.unread)));
    } catch {}
  };

  const loadMessages = async (person, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const url = person.type === 'student'
        ? `/chat/teacher/${person.id}`
        : `/chat/staff/${person.id}`;
      const { data } = await api.get(url);
      setMessages(data);
      setConversations(c => c.map(x =>
        x.id === person.id && x.type === person.type ? { ...x, unread: 0 } : x
      ));
    } finally { if (!silent) setLoadingMsgs(false); }
  };

  useEffect(() => {
    loadConvs();
    const t = setInterval(loadConvs, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const t = setInterval(() => loadMessages(selected, true), 5000);
    return () => clearInterval(t);
  }, [selected]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Search with debounce ──────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (!searchQ.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/chat/teacher/search?q=${encodeURIComponent(searchQ)}`);
        setSearchResults(data);
      } finally { setSearching(false); }
    }, 350);
  }, [searchQ]);

  // ── Close search on outside click ────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setSearchResults([]); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selectPerson = (person) => {
    setSelected(person);
    setSearchQ('');
    setSearchResults([]);
    loadMessages(person);
    if (!conversations.find(c => c.id === person.id && c.type === person.type)) {
      setConversations(c => [{ ...person, unread: 0, last_message: '' }, ...c]);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending || !selected) return;
    setSending(true);
    try {
      const url = selected.type === 'student'
        ? `/chat/teacher/${selected.id}/reply`
        : `/chat/staff/${selected.id}/send`;
      const { data } = await api.post(url, { message: text.trim() });
      setMessages(m => [...m, data]);
      setText('');
      setConversations(c => c.map(x =>
        x.id === selected.id && x.type === selected.type
          ? { ...x, last_message: text.trim() }
          : x
      ));
    } finally { setSending(false); }
  };

  const roleBadge = (type) => type === 'assistant'
    ? <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded-full">مساعد</span>
    : <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">طالب</span>;

  const roleIcon = (type) => type === 'assistant' ? '🤝' : '👤';

  return (
    <div dir="rtl">
      <h2 className="text-xl font-extrabold text-slate-800 mb-5">💬 الرسائل</h2>
      <div className="flex gap-4" style={{ height: '72vh', minHeight: 420 }}>

        {/* ── Conversations panel ────────────────────────────────────────── */}
        <div className="w-64 flex-shrink-0 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">

          {/* Search bar */}
          <div className="p-3 border-b border-slate-100 relative" ref={searchRef}>
            <div className="relative">
              <input
                className="input text-sm pr-8 pl-3 w-full"
                placeholder="ابحث عن طالب أو مساعد..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            </div>

            {/* Search results dropdown */}
            {(searchResults.length > 0 || searching) && (
              <div className="absolute right-3 left-3 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden">
                {searching ? (
                  <div className="flex justify-center py-4">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
                  </div>
                ) : searchResults.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-3">لا توجد نتائج</p>
                ) : searchResults.map(r => (
                  <button key={`${r.role}-${r.id}`} onClick={() => selectPerson({ id: r.id, name: r.name, type: r.role })}
                    className="w-full text-right px-3 py-2.5 flex items-center gap-2 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
                    <span className="text-base">{roleIcon(r.role)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                      {r.username && <p className="text-xs text-slate-400 truncate">@{r.username}</p>}
                    </div>
                    {roleBadge(r.role)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Conversations list */}
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 ? (
              <div className="text-center py-10 text-slate-400 px-3">
                <div className="text-3xl mb-2">💬</div>
                <p className="text-xs">ابحث عن شخص لبدء محادثة</p>
              </div>
            ) : conversations.map(c => (
              <button key={`${c.type}-${c.id}`} onClick={() => selectPerson(c)}
                className={`w-full text-right px-3 py-3 border-b border-slate-100 flex items-start gap-2.5 transition-colors
                  ${selected?.id === c.id && selected?.type === c.type
                    ? 'bg-blue-50 border-r-2 border-r-blue-600'
                    : 'hover:bg-slate-50'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0
                  ${c.type === 'assistant' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  {roleIcon(c.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-bold text-slate-800 truncate">{c.name}</p>
                    {c.unread > 0 && (
                      <span className="min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 flex-shrink-0">
                        {c.unread > 9 ? '9+' : c.unread}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {roleBadge(c.type)}
                    <p className="text-xs text-slate-400 truncate flex-1">{c.last_message}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Chat window ────────────────────────────────────────────────── */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <div className="text-center">
                <div className="text-5xl mb-3">💬</div>
                <p className="font-semibold text-sm">ابحث عن شخص أو اختر محادثة</p>
              </div>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-shrink-0">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base
                  ${selected.type === 'assistant' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                  {roleIcon(selected.type)}
                </div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-slate-800 text-sm">{selected.name}</p>
                  {roleBadge(selected.type)}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {loadingMsgs ? (
                  <div className="flex justify-center py-8">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"/>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-sm">لا توجد رسائل — ابدأ المحادثة</p>
                  </div>
                ) : messages.map(m => {
                  const isMine = m.from_role === 'teacher' || m.from_role === 'assistant' && selected.type === 'assistant' && m.to_role === 'assistant';
                  const fromTeacher = m.from_role === 'teacher';
                  return (
                    <div key={m.id} className={`flex ${fromTeacher ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm
                        ${fromTeacher
                          ? 'bg-blue-600 text-white rounded-tl-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-tr-sm'}`}>
                        {!fromTeacher && (
                          <p className="text-xs text-slate-400 font-semibold mb-0.5">{m.from_name}</p>
                        )}
                        <p className="leading-relaxed">{m.message}</p>
                        <p className={`text-xs mt-1 ${fromTeacher ? 'text-blue-200' : 'text-slate-400'}`}>
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
                <input className="flex-1 input text-sm" placeholder={`اكتب رسالة لـ ${selected.name}...`}
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
