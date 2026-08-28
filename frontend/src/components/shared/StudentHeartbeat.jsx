import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

// Pings the server every 60s while a student has the app open, so the
// teacher's students list can show who's online right now (server treats
// "online" as last_seen_at within the last 3 minutes — a bit of slack past
// this interval so a single missed beat doesn't flip someone offline).
// Renders nothing; mounted once at the top level so it survives page
// navigation instead of restarting its interval on every route change.
export default function StudentHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    if (user?.role !== 'student') return;
    const beat = () => api.post('/auth/heartbeat').catch(() => {});
    beat();
    const t = setInterval(beat, 60000);
    return () => clearInterval(t);
  }, [user?.id, user?.role]);

  return null;
}
