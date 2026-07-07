import { View, Canvas } from '@tarojs/components'
import { useEffect, useRef } from 'react'

interface Props {
  prices: { close: number }[]
  width?: number
  height?: number
  color?: string
  upColor?: string
  downColor?: string
  className?: string
}

/** 迷你走势图 */
export default function MiniChart({
  prices, width = 120, height = 50,
  color, upColor = '#FF6B6B', downColor = '#00C48C',
  className
}: Props) {
  const canvasRef = useRef<any>(null)

  useEffect(() => {
    if (!prices.length || !canvasRef.current) return
    const timer = setTimeout(draw, 100)
    return () => clearTimeout(timer)
  }, [prices])

  const draw = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = 2
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, width, height)

    if (prices.length < 2) return

    const closes = prices.map(p => p.close)
    const max = Math.max(...closes)
    const min = Math.min(...closes)
    const range = max - min || 1
    const pad = 2

    const chartW = width - pad * 2
    const chartH = height - pad * 2

    // 判断涨跌
    const isUp = closes[closes.length - 1] >= closes[0]
    const lineColor = color || (isUp ? upColor : downColor)

    // 渐变填充
    const grad = ctx.createLinearGradient(0, 0, 0, height)
    grad.addColorStop(0, isUp ? 'rgba(255,107,107,0.15)' : 'rgba(0,196,140,0.15)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')

    // 画填充区域
    ctx.beginPath()
    closes.forEach((v, i) => {
      const x = pad + (i / (closes.length - 1)) * chartW
      const y = pad + ((max - v) / range) * chartH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.lineTo(width - pad, height)
    ctx.lineTo(pad, height)
    ctx.closePath()
    ctx.fillStyle = grad
    ctx.fill()

    // 画线
    ctx.beginPath()
    closes.forEach((v, i) => {
      const x = pad + (i / (closes.length - 1)) * chartW
      const y = pad + ((max - v) / range) * chartH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  return (
    <Canvas
      ref={canvasRef}
      style={{ width: `${width}rpx`, height: `${height}rpx`, display: 'block' }}
      canvasId={`mini-${prices.length}-${Math.random().toString(36).slice(2, 6)}`}
      type='2d'
    />
  )
}
