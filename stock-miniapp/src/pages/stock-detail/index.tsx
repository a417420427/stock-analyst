import { View, Text, ScrollView } from '@tarojs/components'
import { useRouter, useLoad, usePullDownRefresh } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '../../services/api'
import KLineChart from '../../components/KLineChart'
import type { PriceData, ComprehensiveAnalysis, AIAnalysisResponse, AIPredictionResponse } from '../../types'
import './index.scss'

export default function StockDetail() {
  const router = useRouter()
  const stockId = Number(router.params.stockId)

  const [analysis, setAnalysis] = useState<ComprehensiveAnalysis | null>(null)
  const [prices, setPrices] = useState<PriceData[]>([])
  const [days, setDays] = useState(60)
  const [loading, setLoading] = useState(true)

  // AI 状态
  const [aiSummary, setAiSummary] = useState<AIAnalysisResponse | null>(null)
  const [aiPrediction, setAiPrediction] = useState<AIPredictionResponse | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiPredLoading, setAiPredLoading] = useState(false)

  const timeframes = [
    { label: '1月', days: 30 },
    { label: '3月', days: 90 },
    { label: '6月', days: 180 },
    { label: '1年', days: 365 },
  ]

  useLoad(async () => {
    if (!stockId) return
    await loadData(days)
  })

  usePullDownRefresh(async () => {
    await loadData(days)
    Taro.stopPullDownRefresh()
  })

  const loadData = async (d: number) => {
    setLoading(true)
    try {
      const [comp, priceData] = await Promise.all([
        api.getComprehensiveAnalysis(stockId).catch(() => null),
        api.getStockPrices(stockId, d).catch(() => []),
      ])
      setAnalysis(comp)
      setPrices(priceData)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
    setLoading(false)
  }

  const changeTimeframe = (d: number) => {
    setDays(d)
    api.getStockPrices(stockId, d).then(setPrices).catch(() => {})
  }

  const handleAISummary = async () => {
    if (aiSummary) return // 已有结果
    setAiLoading(true)
    try {
      const res = await api.getAISummary(stockId)
      setAiSummary(res)
    } catch {
      Taro.showToast({ title: 'AI 分析失败', icon: 'none' })
    }
    setAiLoading(false)
  }

  const handleAIPrediction = async () => {
    if (aiPrediction) return
    setAiPredLoading(true)
    try {
      const res = await api.getAIPrediction(stockId)
      setAiPrediction(res)
    } catch {
      Taro.showToast({ title: 'AI 预测失败', icon: 'none' })
    }
    setAiPredLoading(false)
  }

  const stockInfo = analysis?.stock
  if (loading) {
    return <View className='detail-loading'>加载中...</View>
  }

  const trendScore = analysis?.trend_score
  const getTrendColor = (score: number) => {
    if (score > 60) return '#FF6B6B'
    if (score > 40) return '#FFB946'
    return '#00C48C'
  }

  const prediction = aiPrediction?.prediction

  return (
    <ScrollView className='detail-page' scrollY>
      {/* 股票基本信息 */}
      {stockInfo && (
        <View className='stock-header'>
          <View className='stock-title-row'>
            <Text className='stock-detail-name'>{stockInfo.name}</Text>
            <Text className='stock-detail-symbol'>{stockInfo.symbol}</Text>
            <Text className={`stock-detail-market ${stockInfo.market?.toLowerCase()}`}>
              {stockInfo.market === 'A' ? 'A股' : stockInfo.market === 'HK' ? '港股' : '美股'}
            </Text>
          </View>
          <View className='price-row'>
            <Text className='current-price'>
              ¥{analysis?.latest_price?.toFixed(2) || '--'}
            </Text>
            {analysis?.change_pct !== undefined && (
              <Text className={`price-change ${analysis.change_pct >= 0 ? 'up' : 'down'}`}>
                {analysis.change_pct >= 0 ? '+' : ''}{analysis.change_pct.toFixed(2)}%
              </Text>
            )}
          </View>
          <Text className='volume-row'>
            成交量: {(analysis?.volume || 0).toLocaleString()}
          </Text>
        </View>
      )}

      {/* K 线图 */}
      <View className='chart-section'>
        <Text className='chart-title'>走势图</Text>
        <View className='timeframes'>
          {timeframes.map(tf => (
            <Text
              key={tf.days}
              className={`timeframe-btn ${days === tf.days ? 'active' : ''}`}
              onClick={() => changeTimeframe(tf.days)}
            >
              {tf.label}
            </Text>
          ))}
        </View>
        <KLineChart prices={prices} showMA />
      </View>

      {/* 基本面 */}
      {stockInfo && (
        <View className='fundamentals'>
          <Text className='section-title'>基本面</Text>
          <View className='fund-grid'>
            <View className='fund-item'>
              <Text className='fund-label'>PE (TTM)</Text>
              <Text className='fund-value'>{stockInfo.pe_ttm?.toFixed(2) || '--'}</Text>
            </View>
            <View className='fund-item'>
              <Text className='fund-label'>PB</Text>
              <Text className='fund-value'>{stockInfo.pb?.toFixed(2) || '--'}</Text>
            </View>
            <View className='fund-item'>
              <Text className='fund-label'>市值</Text>
              <Text className='fund-value'>
                {stockInfo.market_cap
                  ? (stockInfo.market_cap / 1e8).toFixed(1) + '亿'
                  : '--'}
              </Text>
            </View>
            <View className='fund-item'>
              <Text className='fund-label'>股息率</Text>
              <Text className='fund-value'>
                {stockInfo.dividend_yield
                  ? (stockInfo.dividend_yield * 100).toFixed(2) + '%'
                  : '--'}
              </Text>
            </View>
            <View className='fund-item'>
              <Text className='fund-label'>营收增长</Text>
              <Text className='fund-value'>
                {stockInfo.revenue_growth
                  ? (stockInfo.revenue_growth * 100).toFixed(1) + '%'
                  : '--'}
              </Text>
            </View>
            <View className='fund-item'>
              <Text className='fund-label'>利润率</Text>
              <Text className='fund-value'>
                {stockInfo.profit_margin
                  ? (stockInfo.profit_margin * 100).toFixed(1) + '%'
                  : '--'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* 趋势评分 */}
      {trendScore && (
        <View className='trend-section'>
          <Text className='section-title'>趋势评分</Text>
          <View className='trend-bars'>
            {[
              { label: '短期', key: 'short', score: trendScore.short },
              { label: '中期', key: 'medium', score: trendScore.medium },
              { label: '长期', key: 'long', score: trendScore.long },
              { label: '综合', key: 'composite', score: trendScore.composite },
            ].map(item => (
              <View key={item.key} className='trend-row'>
                <Text className='trend-label'>{item.label}</Text>
                <View className='trend-bar-bg'>
                  <View
                    className='trend-bar-fill'
                    style={{
                      width: `${item.score}%`,
                      background: getTrendColor(item.score),
                    }}
                  />
                </View>
                <Text className='trend-score' style={{ color: getTrendColor(item.score) }}>
                  {item.score}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* AI 分析 */}
      <View className='ai-section'>
        <View className='ai-header'>
          <Text className='section-title'>🤖 AI 分析</Text>
          <Text className='ai-badge'>Powered by API</Text>
        </View>

        {!aiSummary && !aiLoading && (
          <View className='ai-btn' onClick={handleAISummary}>
            生成 AI 分析
          </View>
        )}

        {aiLoading && (
          <View className='ai-loading'>AI 正在分析，请稍候...</View>
        )}

        {aiSummary && (
          <>
            <View className='ai-content'>
              <Text>{aiSummary.analysis}</Text>
            </View>

            {/* AI 预测 */}
            {!prediction && !aiPredLoading && (
              <View className='ai-btn' onClick={handleAIPrediction}>
                生成涨跌预测
              </View>
            )}

            {aiPredLoading && (
              <View className='ai-loading'>正在生成预测...</View>
            )}

            {prediction && (
              <View className='prediction-card'>
                <Text
                  className='prediction-direction'
                  style={{
                    color: prediction.direction === '看涨' ? '#FF6B6B'
                      : prediction.direction === '看跌' ? '#00C48C' : '#FFB946'
                  }}
                >
                  {prediction.direction} · {prediction.confidence}置信度
                </Text>
                <Text className='prediction-detail'>
                  预估涨幅: {prediction.predicted_change}% · 时间: {prediction.timeframe}
                  {'\n'}支撑位: {prediction.support} · 阻力位: {prediction.resistance}
                </Text>
                {prediction.risks?.length > 0 && (
                  <View className='prediction-risk'>
                    ⚠️ 风险提示: {prediction.risks.join('; ')}
                  </View>
                )}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  )
}
