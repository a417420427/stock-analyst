import { View, Text, ScrollView } from '@tarojs/components'
import { useLoad, usePullDownRefresh, useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '../../services/api'
import MiniChart from '../../components/MiniChart'
import type { IndexData } from '../../types'
import './index.scss'

export default function Dashboard() {
  const [indices, setIndices] = useState<IndexData[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')

  useLoad(async () => {
    await loadData()
  })

  usePullDownRefresh(async () => {
    await loadData()
    Taro.stopPullDownRefresh()
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await api.getIndices()
      setIndices(data)
      setLastUpdate(new Date().toLocaleTimeString('zh-CN', { hour12: false }))
    } catch (err: any) {
      Taro.showToast({ title: '获取行情失败', icon: 'none' })
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

  // 市场统计
  const aCount = indices.filter(i => i.market === 'A').length
  const hkCount = indices.filter(i => i.market === 'HK').length
  const usCount = indices.filter(i => i.market === 'US').length

  return (
    <ScrollView className='dashboard' scrollY>
      {/* 顶部更新时间 */}
      {lastUpdate && (
        <Text className='update-time'>最近更新: {lastUpdate}</Text>
      )}

      {/* 指数列表 */}
      <View className='index-list'>
        {indices.map((idx) => (
          <View key={idx.symbol} className={`index-card ${idx.change_pct >= 0 ? 'bg-up' : 'bg-down'}`}>
            <View className='index-left'>
              <Text className='index-name'>{idx.name}</Text>
              <Text className='index-symbol'>{idx.symbol}</Text>
            </View>
            <View className='index-chart'>
              {idx.prices?.length > 1 && (
                <MiniChart
                  prices={idx.prices}
                  width={160}
                  height={60}
                />
              )}
            </View>
            <View className='index-right'>
              <Text className='index-price'>{idx.price.toFixed(2)}</Text>
              <Text className={`index-change ${idx.change_pct >= 0 ? 'up' : 'down'}`}>
                {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct.toFixed(2)}%
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* 市场概览 */}
      <View className='section'>
        <Text className='section-title'>市场概览</Text>
        <View className='market-overview'>
          <View className='market-chip' onClick={handleStockList}>
            <Text className='chip-label'>A 股</Text>
            <Text className='chip-count'>{aCount} 指数</Text>
          </View>
          <View className='market-chip' onClick={handleStockList}>
            <Text className='chip-label'>港股</Text>
            <Text className='chip-count'>{hkCount} 指数</Text>
          </View>
          <View className='market-chip' onClick={handleStockList}>
            <Text className='chip-label'>美股</Text>
            <Text className='chip-count'>{usCount} 指数</Text>
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
