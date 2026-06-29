import axios from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  timeout: 120000,
});

// 请求拦截器 — 自动带 token
api.interceptors.request.use(
  (config) => {
    const stored = localStorage.getItem('stock-analyst-auth');
    if (stored) {
      try {
        const { state } = JSON.parse(stored);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      } catch { /* ignore */ }
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// 响应拦截器 — 401 跳登录
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // 清除 token
      localStorage.removeItem('stock-analyst-auth');
      // 跳转到登录页
      window.location.href = '/auth';
    }
    console.error('API Error:', err.response?.data || err.message);
    return Promise.reject(err);
  }
);

export default api;
