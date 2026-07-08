import { View, Text, ScrollView } from '@tarojs/components'
import { useRouter, useLoad, usePullDownRefresh } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '../../services/api'
import type { ComprehensiveAnalysis, AIAnalysisContent, AIAnalysisResponse, AIPredictionResponse, TrendScore } from '../../types'
import './index.scss'

// ─── helpers ───────────────────────────────────────────────

/** 安全取数值，为空时返回后备值 */
const num = (v: unknown, fallback: '--' | 0 = '--'): number | '--' | 0 => {
  if (v == null) return fallback
  const n = Number(v)
  return !isNaN(n) ? n : fallback
}

/** 格式化：xx.xx */
const fmt2 = (v: unknown): string | '--' => {
  const n = num(v)
  return typeof n === 'number' ? n.toFixed(2) : n
}

/** 格式化：xx.x%  (输入为小数，如 0.25 → '25.0%') */
const fmtPct = (v: unknown, decimals = 1): string | '--' => {
  const n = num(v)
  return typeof n === 'number' ? (n * 100).toFixed(decimals) + '%' : n
}

/** 格式化：亿市值 (输入为元) */
const fmtCap = (v: unknown): string | '--' => {
  const n = num(v)
  return typeof n === 'number' && n > 0 ? (n / 1e8).toFixed(1) + '亿' : (n+'')
}

/** 价格颜色 */
const priceColor = (pct: number | undefined | null): string | undefined => {
  if (pct == null) return undefined
  return pct >= 0 ? '#FF6B6B' : '#00C48C'
}

/** 趋势颜色 */
const trendColor = (score: number): string =>
  score > 60 ? '#FF6B6B' : score > 40 ? '#FFB946' : '#00C48C'

/** 看涨/跌/震荡颜色 */
const directionColor = (d: string): string =>
  d === '看涨' ? '#FF6B6B' : d === '看跌' ? '#00C48C' : '#FFB946'

/** 变化的符号前缀 */
const signPrefix = (v: number | undefined | null): string =>
  v != null && v >= 0 ? '+' : ''

/** 变化的 CSS 类名 */
const changeDirClass = (v: number | undefined | null): string => {
  if (v == null) return ''
  return v >= 0 ? 'up' : 'down'
}

/** 带符号的格式化变化百分比 */
const formatChangePct = (v: number | undefined | null): string => {
  if (v == null) return '--'
  return `${signPrefix(v)}${v.toFixed(2)}%`
}

/** 置信度中文标签 */
const confidenceLabel = (c: string): string => {
  if (c === '高') return '高'
  if (c === '中') return '中'
  return '低'
}

// ─── 市场标签 ──────────────────────────────────────────────

const MarketBadge = ({ market }: { market?: string }) => {
  if (!market) return null
  const label =
    market === 'A' ? 'A股' : market === 'HK' ? '港股' : market === 'US' ? '美股' : market
  return <Text className={`stock-detail-market ${market.toLowerCase()}`}>{label}</Text>
}

// ─── 组件 ──────────────────────────────────────────────────

export default function StockDetail() {
  const router = useRouter()
  const stockId = Number(router.params.stockId)

  const [analysis, setAnalysis] = useState<ComprehensiveAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(!!Taro.getStorageSync('stock_token'))
  const [aiSummary, setAiSummary] = useState<AIAnalysisResponse | null>(null)
  const [aiPrediction, setAIPrediction] = useState<AIPredictionResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPredLoading, setAiPredLoading] = useState(false)

  useLoad(async () => {
    if (!stockId || isNaN(stockId)) {
      setLoadError('参数错误')
      setLoading(false)
      return
    }
    setIsLoggedIn(!!Taro.getStorageSync('stock_token'))
    await loadData()
  })

  usePullDownRefresh(async () => {
    await loadData()
    Taro.stopPullDownRefresh()
  })

  const loadData = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const comp = await api.getComprehensiveAnalysis(stockId).catch(() => null)
      if (!comp) {
        setLoadError('加载失败，请下拉刷新重试')
      }
      setAnalysis(comp)
    } catch {
      setLoadError('加载失败，请检查网络后重试')
    }
    setLoading(false)
  }

  const handleAISummary = useCallback(async () => {
    if (aiSummary || aiLoading) return
    setAiLoading(true)
    try {
      const res = await api.getAISummary(stockId)
      setAiSummary(res)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || 'AI 分析失败', icon: 'none' })
    } finally {
      setAiLoading(false)
    }
  }, [aiSummary, aiLoading, stockId])

  const handleAIPrediction = useCallback(async () => {
    if (aiPrediction || aiPredLoading) return
    setAiPredLoading(true)
    try {
      const res = await api.getAIPrediction(stockId)
      setAIPrediction(res)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || 'AI 预测失败', icon: 'none' })
    } finally {
      setAiPredLoading(false)
    }
  }, [aiPrediction, aiPredLoading, stockId])

  // ── 错误态 / 加载态 ──

  if (loadError) {
    return (
      <View className='detail-error'>
        <Text className='detail-error-icon'>⚠️</Text>
        <Text className='detail-error-text'>{loadError}</Text>
        <View className='detail-error-btn' onClick={loadData}>重新加载</View>
      </View>
    )
  }

  if (loading) {
    return <View className='detail-loading'>加载中...</View>
  }

  // ── 解构（此时 stock 已保证非 null 才渲染） ──

  const stock = analysis?.stock ?? null
  const trend: TrendScore | null = analysis?.trend_score ?? null
  const latestPrice: number | undefined = analysis?.latest_price
  const changePct: number | undefined = analysis?.change_pct
  const volumeNum = analysis?.volume

  const pred = aiPrediction?.prediction ?? null

  // ── 渲染 ──

  return (
    <ScrollView className='detail-page' scrollY>
      {/* 基本信息 */}
      {stock && (
        <View className='stock-header'>
          <View className='stock-title-row'>
            <Text className='stock-detail-name'>{stock.name}</Text>
            <Text className='stock-detail-symbol'>{stock.symbol}</Text>
            <MarketBadge market={stock.market} />
          </View>

          {/* 价格区域 */}
          <StockPriceArea
            latestPrice={latestPrice}
            changePct={changePct}
          />

          {/* 成交量 */}
          <VolumeRow volume={volumeNum} />
        </View>
      )}

      {/* 基本面 */}
      {stock && (
        <FundamentalsSection stock={stock} />
      )}

      {/* 趋势评分 */}
      {trend && (
        <TrendSection trend={trend} />
      )}

      {/* AI 分析 */}
      <View className='ai-section'>
        <View className='ai-header'>
          <Text className='section-title'>🤖 AI 分析</Text>
          <Text className='ai-badge'>Powered by API</Text>
        </View>

        {!isLoggedIn && <AILoginPrompt />}

        {isLoggedIn && !aiSummary && (
          <View className='ai-btn' onClick={handleAISummary}>
            {aiLoading ? 'AI 正在分析，请稍候...' : '生成 AI 分析'}
          </View>
        )}

        {isLoggedIn && aiSummary && (
          <AIAnalysisCard content={aiSummary.analysis} />
        )}

        {isLoggedIn && aiSummary && !pred && (
          <View className='ai-btn' onClick={handleAIPrediction}>
            {aiPredLoading ? '正在生成预测...' : '生成涨跌预测'}
          </View>
        )}

        {isLoggedIn && pred && <PredictionCard pred={pred} />}
      </View>
    </ScrollView>
  )
}

// ─── 子组件 ────────────────────────────────────────────────

/** 价格 + 涨跌幅 */
const StockPriceArea = ({
  latestPrice,
  changePct,
}: {
  latestPrice: number | undefined
  changePct: number | undefined
}) => {
  const dirClass = changeDirClass(changePct)
  const color = priceColor(changePct)
  const pctText = formatChangePct(changePct)

  return (
    <View className='price-row'>
      <Text className='current-price'>¥{fmt2(latestPrice)}</Text>
      <Text
        className={`price-change${dirClass ? ' ' + dirClass : ''}`}
        style={{ color }}
      >
        {pctText}
      </Text>
    </View>
  )
}

/** 成交量 */
const VolumeRow = ({ volume }: { volume: number | undefined }) => {
  const v = num(volume, 0)
  const text = typeof v === 'number' ? v.toLocaleString() : '0'
  return <Text className='volume-row'>成交量: {text}</Text>
}

/** 基本面表格 */
const FundamentalsSection = ({ stock }: { stock: NonNullable<ComprehensiveAnalysis['stock']> }) => (
  <View className='fundamentals'>
    <Text className='section-title'>基本面</Text>
    <View className='fund-grid'>
      <FundItem label='PE (TTM)' value={fmt2(stock.pe_ttm)} />
      <FundItem label='PB' value={fmt2(stock.pb)} />
      <FundItem label='市值' value={fmtCap(stock.market_cap)} />
      <FundItem label='股息率' value={fmtPct(stock.dividend_yield)} />
      <FundItem label='营收增长' value={fmtPct(stock.revenue_growth)} />
      <FundItem label='利润率' value={fmtPct(stock.profit_margin)} />
    </View>
  </View>
)

/** 趋势评分 */
const TrendSection = ({ trend }: { trend: TrendScore }) => {
  const items = [
    { label: '短期', key: 'short' as const, score: trend.short },
    { label: '中期', key: 'medium' as const, score: trend.medium },
    { label: '长期', key: 'long' as const, score: trend.long },
    { label: '综合', key: 'composite' as const, score: trend.composite },
  ]

  return (
    <View className='trend-section'>
      <Text className='section-title'>趋势评分</Text>
      <View className='trend-bars'>
        {items.map(item => (
          <TrendBar key={item.key} label={item.label} score={item.score} />
        ))}
      </View>
    </View>
  )
}

/** 单条趋势进度条 */
const TrendBar = ({ label, score }: { label: string; score: number }) => {
  const clampedWidth = `${Math.max(0, Math.min(100, score))}%`
  const color = trendColor(score)

  return (
    <View className='trend-row'>
      <Text className='trend-label'>{label}</Text>
      <View className='trend-bar-bg'>
        <View
          className='trend-bar-fill'
          style={{ width: clampedWidth, background: color }}
        />
      </View>
      <Text className='trend-score' style={{ color }}>
        {score}
      </Text>
    </View>
  )
}

/** 基本面单项 */
const FundItem = ({ label, value }: { label: string; value: string | number }) => (
  <View className='fund-item'>
    <Text className='fund-label'>{label}</Text>
    <Text className='fund-value'>{value}</Text>
  </View>
)

/** AI 分析卡片 — 渲染 summary 接口返回的结构化分析 */
const AIAnalysisCard = ({ content }: { content: AIAnalysisContent }) => {
  const scoreColor = content.score > 60 ? '#FF6B6B' : content.score > 40 ? '#FFB946' : '#00C48C'
  const trendLabel = content.trend === '看涨' ? '📈' : content.trend === '看跌' ? '📉' : '➡️'

  return (
    <View className='ai-content'>
      <View className='analysis-header'>
        <Text className='analysis-trend' style={{ color: scoreColor }}>
          {trendLabel} {content.trend}
        </Text>
        <Text className='analysis-score' style={{ color: scoreColor }}>
          评分 {content.score}
        </Text>
      </View>

      <View className='analysis-summary'>
        <Text>{content.summary}</Text>
      </View>

      <View className='analysis-levels'>
        <Text className='analysis-label'>支撑位</Text>
        <Text className='analysis-value'>{content.support}</Text>
        <Text className='analysis-label'>阻力位</Text>
        <Text className='analysis-value'>{content.resistance}</Text>
      </View>

      <View className='analysis-warning'>
        <Text className='analysis-warning-text'>⚠️ {content.risk_warning}</Text>
      </View>
    </View>
  )
}

/** AI 登录提示 */
const AILoginPrompt = () => (
  <View className='ai-phone-lock'>
    <Text className='ai-lock-icon'>🔐</Text>
    <Text className='ai-lock-text'>请先登录使用 AI 功能</Text>
    <View className='ai-lock-btn' onClick={() => Taro.switchTab({ url: '/pages/login/index' })}>
      去登录
    </View>
  </View>
)

/** 预测卡片 */
const PredictionCard = ({
  pred,
}: {
  pred: NonNullable<AIPredictionResponse['prediction']>
}) => {
  const cLabel = confidenceLabel(pred.confidence)
  const dir = pred.direction
  const color = directionColor(dir)

  return (
    <View className='prediction-card'>
      <Text className='prediction-direction' style={{ color }}>
        {dir} · {cLabel} 置信度
      </Text>
      <Text className='prediction-detail'>
        预估涨幅: {pred.predicted_change}% · 时间: {pred.timeframe}
        {'\n'}支撑位: {pred.support} · 阻力位: {pred.resistance}
      </Text>
      {pred.risks.length > 0 && (
        <View className='prediction-risk'>
          ⚠️ 风险提示: {pred.risks.join('; ')}
        </View>
      )}
    </View>
  )
}
