// API 封装层
import Taro from '@tarojs/taro'
import type {
  Stock, StockRealtime, PriceData, IndexData,
  ComprehensiveAnalysis, AIAnalysisResponse, AIPredictionResponse,
  SimulatedAccount, AccountDetail, Trade, SectorData, ActivityLog, User,
  AIResult, AICreateResult
} from '../types'

// 服务端 API 地址
// 项目根目录下创建 .env 文件配置: API_BASE_URL=http://39.106.172.134:8000/api/v1
// 或通过 Taro 的 defineConstants 注入
const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:8000/api/v1'

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

// ===== AI 配额 =====
export async function getAIQuota(): Promise<{ date: string; quotas: { action: string; label: string; used: number; limit: number; remaining: number }[] }> {
  return request('GET', '/ai/quota')
}

// ===== 行业板块 =====
export async function getSectors(): Promise<SectorData[]> {
  return request<SectorData[]>('GET', '/analysis/sectors')
}

// ===== 模拟交易 =====
export async function getAccounts(): Promise<SimulatedAccount[]> {
  return request<SimulatedAccount[]>('GET', '/portfolio/accounts')
}

export async function createAccount(name: string, initialBalance: number = 1000000): Promise<SimulatedAccount> {
  return request<SimulatedAccount>('POST', '/portfolio/accounts', { name, initial_balance: initialBalance })
}

export async function getAccountDetail(accountId: number): Promise<AccountDetail> {
  return request<AccountDetail>('GET', `/portfolio/accounts/${accountId}`)
}

export async function getAccountTrades(accountId: number): Promise<Trade[]> {
  return request<Trade[]>('GET', `/portfolio/accounts/${accountId}/trades`)
}

export async function createTrade(
  accountId: number,
  params: { stock_id: number; side: string; quantity: number; price?: number; order_type?: string; note?: string }
): Promise<any> {
  const query = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&')
  return request('POST', `/portfolio/accounts/${accountId}/trades?${query}`)
}

export async function deposit(accountId: number, amount: number): Promise<any> {
  return request('POST', `/portfolio/accounts/${accountId}/deposit?amount=${amount}`)
}

export async function withdraw(accountId: number, amount: number): Promise<any> {
  return request('POST', `/portfolio/accounts/${accountId}/withdraw?amount=${amount}`)
}

export async function resetAccount(accountId: number): Promise<any> {
  return request('DELETE', `/portfolio/accounts/${accountId}`)
}

export async function deleteAccount(accountId: number): Promise<any> {
  return request('DELETE', `/portfolio/accounts/${accountId}/delete`)
}

export async function aiGenerate(prompt: string, initialBalance: number = 1000000): Promise<AIResult> {
  return request<AIResult>('POST', `/portfolio/ai-generate?prompt=${encodeURIComponent(prompt)}&initial_balance=${initialBalance}`, undefined, { timeout: 120000 })
}

export async function aiCreate(prompt: string, initialBalance: number = 1000000): Promise<AICreateResult> {
  return request<AICreateResult>('POST', `/portfolio/ai-create?prompt=${encodeURIComponent(prompt)}&initial_balance=${initialBalance}`, undefined, { timeout: 120000 })
}

// ===== 活动日志 =====
export async function getActivityLogs(page: number = 1, pageSize: number = 20): Promise<ActivityLog[]> {
  return request<ActivityLog[]>('GET', `/logs?page=${page}&page_size=${pageSize}`)
}
