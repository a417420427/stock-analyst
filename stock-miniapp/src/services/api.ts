// API 封装层
import Taro from '@tarojs/taro'
import type {
  Stock, StockRealtime, PriceData, IndexData,
  ComprehensiveAnalysis, AIAnalysisResponse, AIPredictionResponse,
  SimulatedAccount, SectorData, ActivityLog, User
} from '../types'

// 服务端 API 地址
const BASE_URL = 'http://39.106.172.134:8000/api/v1'

// Token 管理
function getToken(): string | null {
  try {
    return Taro.getStorageSync('stock_token') || null
  } catch {
    return null
  }
}

function setToken(token: string) {
  Taro.setStorageSync('stock_token', token)
}

function clearToken() {
  Taro.removeStorageSync('stock_token')
}

export async function request<T>(
  method: string,
  path: string,
  data?: any,
  opts?: { timeout?: number; noAuth?: boolean }
): Promise<T> {
  const token = getToken()
  const header: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token && !opts?.noAuth) {
    header['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await Taro.request({
      url: `${BASE_URL}${path}`,
      method: method as any,
      data,
      header,
      timeout: opts?.timeout || 15000
    })

    // 401 自动跳登录
    if (res.statusCode === 401) {
      clearToken()
      Taro.navigateTo({ url: '/pages/login/index' })
      throw new Error('登录已过期')
    }

    if (res.statusCode >= 400) {
      const detail = (res.data as any)?.detail || '请求失败'
      throw new Error(detail)
    }

    return res.data as T
  } catch (err: any) {
    if (err.errMsg?.includes('timeout') || err.errMsg?.includes('fail')) {
      Taro.showToast({ title: '网络连接失败', icon: 'none' })
    }
    throw err
  }
}

// ===== 认证 =====
export async function login(username: string, password: string): Promise<{ access_token: string; token_type: string; user?: User }> {
  const data = await request<{ access_token: string; token_type: string }>(
    'POST', '/auth/login', { username, password }, { noAuth: true }
  )
  if (data.access_token) {
    setToken(data.access_token)
  }
  return data
}

// ===== 微信登录 =====
export async function wxLogin(code: string): Promise<{ access_token: string; user: any; is_new: boolean; has_phone: boolean }> {
  const data = await request<{ access_token: string; user: any; is_new: boolean; has_phone: boolean }>(
    'POST', `/auth/wx-login?code=${encodeURIComponent(code)}`, undefined, { noAuth: true }
  )
  if (data.access_token) {
    setToken(data.access_token)
    Taro.setStorageSync('stock_user', data.user)
  }
  return data
}

export async function register(username: string, password: string, email?: string) {
  return request<any>('POST', '/auth/register', { username, password, email }, { noAuth: true })
}

export function logout() {
  clearToken()
}

// ===== 微信手机号绑定 =====
export async function bindPhone(phone: string, code: string): Promise<{ message: string; phone: string }> {
  const data = await request<{ message: string; phone: string }>(
    'POST', `/auth/bind-phone?phone=${encodeURIComponent(phone)}&code=${encodeURIComponent(code)}`
  )
  return data
}

// ===== 大盘指数 =====
export async function getIndices(): Promise<IndexData[]> {
  return request<IndexData[]>('GET', '/market/indices')
}

// ===== 股票列表 =====
export async function searchStocks(q: string, market?: string): Promise<Stock[]> {
  let path = `/market/stocks/search?q=${encodeURIComponent(q)}`
  if (market) path += `&market=${market}`
  return request<Stock[]>('GET', path)
}

export async function getStocks(params?: {
  page?: number; page_size?: number; market?: string; search?: string;
  sort_by?: string; sort_order?: string
}): Promise<{ stocks: Stock[]; total: number }> {
  let path = `/market/stocks?`
  if (params) {
    const qs = Object.entries(params)
      .filter(([_, v]) => v !== undefined && v !== '')
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&')
    path += qs
  }
  return request<{ stocks: Stock[]; total: number }>('GET', path)
}

// ===== 个股实时 =====
export async function getStockRealtime(stockId: number): Promise<StockRealtime> {
  return request<StockRealtime>('GET', `/market/stocks/${stockId}/realtime`)
}

// ===== 个股价格 =====
export async function getStockPrices(stockId: number, days: number = 60): Promise<PriceData[]> {
  return request<PriceData[]>('GET', `/market/stocks/${stockId}/prices?days=${days}`)
}

// ===== 综合分析 =====
export async function getComprehensiveAnalysis(stockId: number): Promise<ComprehensiveAnalysis> {
  return request<ComprehensiveAnalysis>('GET', `/analysis/stocks/${stockId}/comprehensive`)
}

// ===== 技术指标 =====
export async function getIndicators(stockId: number, lookback: number = 50): Promise<any> {
  return request('GET', `/analysis/stocks/${stockId}/indicators?lookback=${lookback}`)
}

// ===== AI 分析 =====
export async function getAISummary(stockId: number): Promise<AIAnalysisResponse> {
  return request<AIAnalysisResponse>('GET', `/ai/summary/${stockId}`, undefined, { timeout: 60000 })
}

export async function getAIPrediction(stockId: number): Promise<AIPredictionResponse> {
  return request<AIPredictionResponse>('POST', `/ai/predict/${stockId}`, undefined, { timeout: 60000 })
}

export async function aiNLQuery(query: string): Promise<{ query: string; answer: string }> {
  return request('POST', `/ai/query?query=${encodeURIComponent(query)}`, undefined, { timeout: 60000 })
}

// ===== 行业板块 =====
export async function getSectors(): Promise<SectorData[]> {
  return request<SectorData[]>('GET', '/analysis/sectors')
}

// ===== 模拟交易 =====
export async function getAccounts(): Promise<SimulatedAccount[]> {
  return request<SimulatedAccount[]>('GET', '/portfolio/accounts')
}

// ===== 活动日志 =====
export async function getActivityLogs(page: number = 1, pageSize: number = 20): Promise<ActivityLog[]> {
  return request<ActivityLog[]>('GET', `/logs?page=${page}&page_size=${pageSize}`)
}
