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
  strategy_id?: number
  strategy_name?: string
  initial_balance: number
  available_balance: number
  frozen_balance: number
  market_value: number
  total_asset: number
  total_pnl: number
  pnl_pct: number
  is_ai_generated?: boolean
  ai_prompt?: string
  created_at?: string
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
