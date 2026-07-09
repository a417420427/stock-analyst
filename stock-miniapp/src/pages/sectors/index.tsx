import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { useState } from 'react'
import * as api from '../../services/api'
import type { SectorData } from '../../types'
import './index.scss'

export default function SectorsPage() {
  const [sectors, setSectors] = useState<SectorData[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showAll, setShowAll] = useState<Set<string>>(new Set()) // 完全展开
  const [loading, setLoading] = useState(true)

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
      const data = await api.getSectors()
      setSectors(data)
    } catch {
      Taro.showToast({ title: '加载板块失败', icon: 'none' })
    }
    setLoading(false)
  }

  const toggleExpand = (name: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleShowAll = (name: string) => {
    setShowAll(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const goToStock = (stockId: number) => {
    Taro.navigateTo({ url: `/pages/stock-detail/index?stockId=${stockId}` })
  }

  return (
    <ScrollView className='sectors-page' scrollY>
      {loading ? (
        <View className='empty-sector'>
          <Text className='empty-sector-icon'>🏢</Text>
          <Text>加载中...</Text>
        </View>
      ) : sectors.length === 0 ? (
        <View className='empty-sector'>
          <Text className='empty-sector-icon'>🏢</Text>
          <Text className='empty-sector-text'>暂无板块数据</Text>
        </View>
      ) : (
        sectors.map(sector => (
          <View key={sector.sector} className='sector-card'>
            <View className='sector-header' onClick={() => toggleExpand(sector.sector)}>
              <Text className='sector-name'>{sector.sector}</Text>
              <Text className={`sector-change ${sector.avg_change >= 0 ? 'up' : 'down'}`}>
                {sector.avg_change >= 0 ? '+' : ''}{sector.avg_change.toFixed(2)}%
              </Text>
            </View>

            <View className='sector-stats'>
              <Text className='sector-stat'>
                成分股: <Text className='sector-stat-value'>{sector.count}</Text>
              </Text>
              <Text className='sector-stat'>
                PE: <Text className='sector-stat-value'>{sector.avg_pe.toFixed(1)}</Text>
              </Text>
              <Text className='sector-stat'>
                PB: <Text className='sector-stat-value'>{sector.avg_pb.toFixed(2)}</Text>
              </Text>
            </View>

            {expanded.has(sector.sector) && sector.stocks.length > 0 && (
              <View className='sector-stocks'>
                {sector.stocks
                  .slice(0, showAll.has(sector.sector) ? undefined : 10)
                  .map(s => (
                    <View
                      key={s.id}
                      className='sector-stock-row'
                      onClick={() => goToStock(s.id)}
                    >
                      <Text className='sector-stock-name'>{s.name}</Text>
                      <Text className='sector-stock-market'>{s.market}</Text>
                      <Text className='sector-stock-change'>
                        <Text className={s.change >= 0 ? 'up' : 'down'}>
                          {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%
                        </Text>
                      </Text>
                    </View>
                  ))}
                {!showAll.has(sector.sector) && sector.stocks.length > 10 && (
                  <Text className='load-more' onClick={() => toggleShowAll(sector.sector)}>
                    还有 {sector.stocks.length - 10} 只，点击展开全部 ›
                  </Text>
                )}
                {showAll.has(sector.sector) && sector.stocks.length > 10 && (
                  <Text className='load-more' onClick={() => toggleShowAll(sector.sector)}>
                    收起 ›
                  </Text>
                )}
              </View>
            )}
          </View>
        ))
      )}
    </ScrollView>
  )
}
