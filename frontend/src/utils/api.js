import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api'
});

// Attach JWT to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-logout on 401 — but NOT on the handful of pre-auth endpoints where a
// 401 is an expected, benign response (wrong password, bad reset token...),
// not a sign that a previously-valid session just got invalidated.
// Deliberately narrower than "any /auth/ url": /auth/me needs to stay
// covered by this redirect+flash-message flow too, since it's often the
// very first request to notice a session was killed (e.g. logged in from
// another device) on a fresh page load.
const PRE_AUTH_PATHS = [
  '/auth/student/login', '/auth/teacher/login', '/auth/assistant/login',
  '/auth/teacher/login/2fa', '/auth/register', '/auth/forgot-password', '/auth/reset-password',
];
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const isPreAuthRoute = PRE_AUTH_PATHS.some(p => err.config?.url?.includes(p));
    if (err.response?.status === 401 && !isPreAuthRoute) {
      // Stash the server's reason (e.g. "logged in from another device")
      // so the login page can show it instead of silently dropping the
      // user back with no explanation.
      const message = err.response?.data?.message;
      if (message) sessionStorage.setItem('flashMessage', message);
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
