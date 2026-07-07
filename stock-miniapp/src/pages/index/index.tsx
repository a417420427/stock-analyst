import { View, Text, ScrollView } from '@tarojs/components'
import { useLoad, usePullDownRefresh } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import * as api from '../../services/api'
import type { SectorData } from '../../types'
import './index.scss'

// 静默微信登录
async function silentLogin() {
  try {
    const token = Taro.getStorageSync('stock_token')
    if (token) return
    // @ts-ignore
    const loginRes = await Taro.login()
    if (!loginRes.code) return
    const data = await api.wxLogin(loginRes.code)
    if (data.user) {
      Taro.setStorageSync('stock_user', data.user)
    }
  } catch {
    // 静默失败不影响使用
  }
}

export default function Dashboard() {
  const [sectors, setSectors] = useState<SectorData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')

  useLoad(async () => {
    await silentLogin()
    await loadData()
  })

  usePullDownRefresh(async () => {
    await loadData()
    Taro.stopPullDownRefresh()
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await api.getSectors()
      setSectors(data)
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
    } catch (err: any) {
      Taro.showToast({ title: '获取板块数据失败', icon: 'none' })
    }
    setLoading(false)
  }

  const handleStockList = () => {
    Taro.switchTab({ url: '/pages/stocks/index' })
  }

  const handleSectors = () => {
    Taro.switchTab({ url: '/pages/sectors/index' })
  }

  const handlePortfolio = () => {
    Taro.switchTab({ url: '/pages/portfolio/index' })
  }

  // 板块统计
  const topGainers = [...sectors].sort((a, b) => b.avg_change - a.avg_change).slice(0, 3)
  const topLosers = [...sectors].sort((a, b) => a.avg_change - b.avg_change).slice(0, 3)
  const upCount = sectors.filter(s => s.avg_change > 0).length
  const downCount = sectors.filter(s => s.avg_change < 0).length
  const totalSectors = sectors.length

  return (
    <ScrollView className='dashboard' scrollY>
      {/* 顶部更新时间 */}
      {lastUpdate && (
        <Text className='update-time'>最近更新: {lastUpdate}</Text>
      )}

      {/* 板块概览 — 涨幅前3 + 跌幅前3 */}
      <View className='section'>
        <Text className='section-title'>涨幅前三</Text>
        <View className='sector-list'>
          {topGainers.map((s) => (
            <View key={s.sector} className='sector-card bg-up'>
              <View className='sector-left'>
                <Text className='sector-name'>{s.sector}</Text>
                <Text className='sector-count'>{s.count} 只</Text>
              </View>
              <View className='sector-right'>
                <Text className='sector-change up'>+{s.avg_change.toFixed(2)}%</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className='section'>
        <Text className='section-title'>跌幅前三</Text>
        <View className='sector-list'>
          {topLosers.map((s) => (
            <View key={s.sector} className='sector-card bg-down'>
              <View className='sector-left'>
                <Text className='sector-name'>{s.sector}</Text>
                <Text className='sector-count'>{s.count} 只</Text>
              </View>
              <View className='sector-right'>
                <Text className='sector-change down'>{s.avg_change.toFixed(2)}%</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 板块统计 */}
      <View className='section'>
        <Text className='section-title'>板块统计</Text>
        <View className='market-overview'>
          <View className='market-chip' onClick={handleSectors}>
            <Text className='chip-label'>板块总数</Text>
            <Text className='chip-count'>{totalSectors}</Text>
          </View>
          <View className='market-chip' onClick={handleSectors}>
            <Text className='chip-label' style={{ color: '#ef4444' }}>上涨</Text>
            <Text className='chip-count' style={{ color: '#ef4444' }}>{upCount}</Text>
          </View>
          <View className='market-chip' onClick={handleSectors}>
            <Text className='chip-label' style={{ color: '#22c55e' }}>下跌</Text>
            <Text className='chip-count' style={{ color: '#22c55e' }}>{downCount}</Text>
          </View>
        </View>
      </View>

      {/* 快捷入口 */}
      <View className='section'>
        <Text className='section-title'>快捷入口</Text>
        <View className='quick-actions'>
          <View className='quick-action' onClick={handleStockList}>
            <Text className='qa-icon'>📈</Text>
            <Text className='qa-label'>全部股票</Text>
          </View>
          <View className='quick-action' onClick={handleSectors}>
            <Text className='qa-icon'>🏢</Text>
            <Text className='qa-label'>行业板块</Text>
          </View>
          <View className='quick-action' onClick={handlePortfolio}>
            <Text className='qa-icon'>💼</Text>
            <Text className='qa-label'>模拟交易</Text>
          </View>
        </View>
      </View>

      {loading && (
        <View className='loading-overlay'>
          <Text>加载中...</Text>
        </View>
      )}
    </ScrollView>
  )
}
