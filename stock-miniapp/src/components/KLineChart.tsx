import { View, Text, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo, useEffect, useRef, useState } from 'react'
import type { PriceData } from '../types'

interface Props {
  prices: PriceData[]
  height?: number
  showMA?: boolean
  compact?: boolean
}

// 简易 K 线绘制组件（使用 Canvas 2D API）
export default function KLineChart({ prices, height = 400, showMA = true, compact = false }: Props) {
  const canvasRef = useRef<any>(null)
  const [ready, setReady] = useState(false)
  const chartHeight = compact ? height : height

  const [canvasWidth, setCanvasWidth] = useState(600)

  useEffect(() => {
    if (!prices.length || !canvasRef.current) return
    
    // 获取实际渲染宽度
    const query = Taro.createSelectorQuery()
    const canvasId = `kline-${prices.length}`
    query.select(`#${canvasId}`).boundingClientRect((rect) => {
      if (rect && rect.width > 0) {
        setCanvasWidth(rect.width)
      }
    }).exec()
    
    const timer = setTimeout(() => {
      drawChart()
      setReady(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [prices, compact])

  const drawChart = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = 2
    const w = canvasWidth || canvas.width / dpr
    const h = canvas.height / dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)

    if (prices.length < 2) {
      ctx.fillStyle = '#8C94A8'
      ctx.font = '24rpx sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText('数据不足', w / 2, h / 2)
      return
    }

    const pad = { top: 20, right: 20, bottom: 30, left: 40 }
    const chartW = w - pad.left - pad.right
    const chartH = h - pad.top - pad.bottom

    const highs = prices.map(p => p.high)
    const lows = prices.map(p => p.low)
    const maxPrice = Math.max(...highs)
    const minPrice = Math.min(...lows)
    const range = maxPrice - minPrice || 1
    const padding = range * 0.05
    const yMax = maxPrice + padding
    const yMin = minPrice - padding
    const yRange = yMax - yMin

    const candleW = Math.min(12, chartW / prices.length * 0.6)
    const spacing = chartW / (prices.length - 1 || 1)

    // 画网格
    ctx.strokeStyle = '#EAEDF4'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (chartH / 4) * i
      ctx.beginPath()
      ctx.moveTo(pad.left, y)
      ctx.lineTo(w - pad.right, y)
      ctx.stroke()

      const price = yMax - (yRange / 4) * i
      ctx.fillStyle = '#B0B8C8'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(price.toFixed(2), pad.left - 5, y + 3)
    }

    // 计算 MA
    const ma5 = showMA ? calcMA(5) : null
    const ma20 = showMA ? calcMA(20) : null

    function calcMA(n: number): (number | null)[] {
      return prices.map((_, i) => {
        if (i < n - 1) return null
        let sum = 0
        for (let j = i - n + 1; j <= i; j++) sum += prices[j].close
        return sum / n
      })
    }

    function priceToY(price: number): number {
      return pad.top + ((yMax - price) / yRange) * chartH
    }

    // 画均线
    if (ma5) {
      drawLine('#4F6EF7', ma5)
    }
    if (ma20) {
      drawLine('#FFB946', ma20)
    }

    function drawLine(color: string, values: (number | null)[]) {
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.beginPath()
      let started = false
      values.forEach((v, i) => {
        if (v === null) { started = false; return }
        const x = pad.left + i * spacing
        const y = priceToY(v)
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      })
      ctx.stroke()
    }

    // 画 K 线
    prices.forEach((p, i) => {
      const x = pad.left + i * spacing
      const openY = priceToY(p.open)
      const closeY = priceToY(p.close)
      const highY = priceToY(p.high)
      const lowY = priceToY(p.low)
      const isUp = p.close >= p.open
      const color = isUp ? '#FF6B6B' : '#00C48C'

      // 影线
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      // 实体
      const bodyTop = Math.min(openY, closeY)
      const bodyBottom = Math.max(openY, closeY)
      const bodyH = Math.max(bodyBottom - bodyTop, 2)
      ctx.fillStyle = color
      ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH)
    })
  }

  // 简要指标
  const latest = prices[prices.length - 1]
  const prev = prices.length > 1 ? prices[prices.length - 2] : null
  const changePct = prev ? ((latest.close - prev.close) / prev.close * 100).toFixed(2) : '0.00'

  return (
    <View className='kline-chart'>
      {!compact && (
        <View className='kline-header'>
          <View className='kline-price-row'>
            <Text className='kline-price'>¥{latest?.close.toFixed(2) || '--'}</Text>
            <Text className={`kline-change ${Number(changePct) >= 0 ? 'up' : 'down'}`}>
              {Number(changePct) >= 0 ? '+' : ''}{changePct}%
            </Text>
          </View>
        </View>
      )}
      <Canvas
        ref={canvasRef}
        className='kline-canvas'
        style={{ width: '100%', height: `${chartHeight}rpx` }}
        canvasId={`kline-${prices.length}`}
        type='2d'
      />
      {!ready && prices.length > 0 && (
        <View className='kline-loading'>绘制中...</View>
      )}
    </View>
  )
}
