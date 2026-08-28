import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/api';

// Keeps the installed PWA's home-screen icon badge in sync with unread
// notifications + chat messages, via the Badging API (navigator.setAppBadge).
// Supported on Android Chrome and iOS 16.4+ home-screen installs; silently
// does nothing everywhere else (a regular browser tab, an unsupported
// browser) — feature-detected, never throws.
// Mounted once at the top level so it keeps polling across page navigation.
export default function AppBadgeSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !('setAppBadge' in navigator)) return;

    const endpoints = user.role === 'student'
      ? ['/notifications/unread-count', '/chat/unread-count']
      : user.role === 'teacher'
      ? ['/teacher/my-notifications/unread-count', '/chat/teacher/unread-count']
      : ['/teacher/my-notifications/unread-count', '/chat/assistant/unread-count'];

    const sync = async () => {
      try {
        const results = await Promise.all(
          endpoints.map(url => api.get(url).catch(() => ({ data: { count: 0 } })))
        );
        const total = results.reduce((sum, r) => sum + (Number(r.data.count) || 0), 0);
        if (total > 0) navigator.setAppBadge(total).catch(() => {});
        else navigator.clearAppBadge().catch(() => {});
      } catch {}
    };

    sync();
    const t = setInterval(sync, 15000);
    return () => {
      clearInterval(t);
      navigator.clearAppBadge?.().catch(() => {});
    };
  }, [user?.id, user?.role]);

  return null;
}
