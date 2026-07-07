// ===== 股票基础 =====
export interface Stock {
  id: number
  symbol: string
  market: 'A' | 'HK' | 'US'
  name: string
  name_en?: string
  sector?: string
  industry?: string
  pe_ttm?: number
  pb?: number
  market_cap?: number
  dividend_yield?: number
  revenue_growth?: number
  profit_margin?: number
}

// ===== 价格 =====
export interface PriceData {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount?: number
}

export interface StockRealtime {
  symbol: string
  market: string
  name: string
  price: number
  change: string
  volume: number
  date: string
}

// ===== 大盘指数 =====
export interface IndexData {
  symbol: string
  name: string
  market: string
  price: number
  change_pct: number
  prices: { date: string; close: number }[]
  error?: string
}

// ===== 技术指标 =====
export interface Indicators {
  ma: { ma5: number[]; ma20: number[] }
  macd: { macd: number[]; signal: number[]; hist: number[] }
  rsi: { rsi14: number }
  bollinger: { upper: number[]; middle: number[]; lower: number[] }
  kdj: { k: number[]; d: number[]; j: number[] }
}

export interface TrendScore {
  short: number
  medium: number
  long: number
  composite: number
}

export interface Pattern {
  type: string
  name: string
  direction: 'bullish' | 'bearish' | 'neutral'
  reliability: number
}

export interface ComprehensiveAnalysis {
  stock: Stock
  latest_price: number
  change_pct: number
  volume: number
  indicators: Indicators
  patterns: Pattern[]
  trend_score: TrendScore
}

// ===== AI 分析 =====
export interface AIPrediction {
  direction: '看涨' | '看跌' | '震荡'
  predicted_change: number
  timeframe: string
  confidence: '高' | '中' | '低'
  support: number
  resistance: number
  summary: string
  technical_analysis: string
  fundamental_analysis: string
  risks: string[]
}

export interface AIAnalysisResponse {
  stock: { id: number; symbol: string; name: string }
  analysis: string
}

export interface AIPredictionResponse {
  stock: { id: number; symbol: string; name: string; market: string }
  prediction: AIPrediction
}

// ===== 模拟交易 =====
export interface SimulatedAccount {
  id: number
  name: string
  strategy_id?: number | null
  strategy_name?: string | null
  initial_balance: number
  available_balance: number
  frozen_balance: number
  market_value: number
  total_asset: number
  total_pnl: number
  pnl_pct: number
  position_count?: number
  is_ai_generated?: boolean | null
  ai_prompt?: string | null
  commission_rate?: number
  created_at?: string
}

export interface AccountSummary {
  market_value: number
  total_asset: number
  total_pnl: number
  pnl_pct: number
  position_count: number
}

export interface AccountDetail {
  account: SimulatedAccount
  summary: AccountSummary
  positions: Position[]
}

export interface Position {
  stock_id: number
  symbol: string
  name: string
  market: string
  quantity: number
  avg_cost: number
  current_price: number
  market_value: number
  cost_total: number
  pnl: number
  pnl_pct: number
  buy_count: number
  sell_count: number
}

export interface Trade {
  id: number
  stock_id: number
  symbol: string
  name: string
  market: string
  side: 'buy' | 'sell'
  quantity: number
  price: number
  total: number
  commission: number
  order_type: string
  traded_at: string
  note: string | null
}

export interface AISuggestion {
  name: string
  description: string
  risk_level: string
  estimated_return: string | null
  stocks: { stock_id: number; symbol: string; name: string; weight: number; reason: string }[]
  advice: string
}

export interface AIResult {
  prompt: string
  initial_balance: number
  suggestion: AISuggestion
}

export interface AICreateResult {
  account: SimulatedAccount
  suggestion: AISuggestion
  trades: { stock_id: number; symbol: string; name: string; quantity: number; exec_price: number; total: number; commission: number; weight: number }[]
  total_invested: number
}

// ===== 行业板块 =====
export interface SectorData {
  sector: string
  count: number
  avg_pe: number
  avg_pb: number
  avg_change: number
  stocks: {
    id: number
    symbol: string
    name: string
    market: string
    change: number
  }[]
}

// ===== 日志 =====
export interface ActivityLog {
  id: number
  action: string
  level: string
  title: string
  detail: any
  created_at: string
}

// ===== 用户 =====
export interface User {
  id: number
  username: string
  email?: string
  token?: string
}
