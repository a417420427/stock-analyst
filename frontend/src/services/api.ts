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

// 全局 429 处理：触发可自定义的事件
const QUOTA_EXHAUSTED_EVENT = 'stock-analyst:quota-exhausted';

// 响应拦截器 — 401 跳登录 / 429 触发配额事件
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // 清除 token
      localStorage.removeItem('stock-analyst-auth');
      // 跳转到登录页
      window.location.href = '/auth';
    }
    if (err.response?.status === 429) {
      // 触发全局配额超限事件
      const detail = err.response?.data?.detail || '调用已达上限';
      window.dispatchEvent(new CustomEvent(QUOTA_EXHAUSTED_EVENT, { detail: { detail } }));
    }
    console.error('API Error:', err.response?.data || err.message);
    return Promise.reject(err);
  }
);

export { QUOTA_EXHAUSTED_EVENT };

export default api;
