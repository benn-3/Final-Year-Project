import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// ── Attach access token to every request ──────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── On 401, try to refresh once then redirect to login ───────────────────────
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    if (err.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = api
          .post('/auth/refresh', { refreshToken: localStorage.getItem('refreshToken') })
          .then((r) => {
            localStorage.setItem('accessToken', r.data.accessToken);
            localStorage.setItem('refreshToken', r.data.refreshToken);
            refreshing = null;
            return r.data.accessToken;
          })
          .catch(() => {
            refreshing = null;
            localStorage.clear();
            window.location.href = '/login';
            return Promise.reject(err);
          });
      }
      const token = await refreshing;
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }
    return Promise.reject(err);
  }
);

export default api;
