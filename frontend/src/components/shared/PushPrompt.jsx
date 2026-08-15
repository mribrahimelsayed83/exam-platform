import { useState, useEffect } from 'react';
import { isPushSupported, getPushPermissionState, subscribeToPush } from '../../utils/push';

const DISMISS_KEY = 'push-prompt-dismissed';

// A small dismissible banner asking the user to enable push notifications.
// Must stay behind a user click — browsers (and iOS in particular) block
// permission prompts that aren't triggered by a real gesture.
export default function PushPrompt() {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      if (localStorage.getItem(DISMISS_KEY)) return;
      if (!isPushSupported()) return;
      const state = await getPushPermissionState();
      if (state === 'default') setVisible(true);
    })();
  }, []);

  const dismiss = () => { localStorage.setItem(DISMISS_KEY, '1'); setVisible(false); };

  const enable = async () => {
    setLoading(true);
    try {
      const ok = await subscribeToPush();
      if (ok) dismiss(); else setLoading(false);
    } catch { setLoading(false); }
  };

  if (!visible) return null;

  return (
    <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 dark:bg-blue-950/40 dark:border-blue-900 dark:text-blue-200">
      <span className="text-xl">🔔</span>
      <div className="flex-1 text-sm font-semibold">فعّل التنبيهات علشان توصلك رسائل وإشعارات المنصة فورًا على جهازك</div>
      <button onClick={enable} disabled={loading} className="btn-primary btn-sm whitespace-nowrap">
        {loading ? '...' : 'تفعيل'}
      </button>
      <button onClick={dismiss} aria-label="إغلاق" className="text-blue-400 hover:text-blue-600 text-lg leading-none">×</button>
    </div>
  );
}
