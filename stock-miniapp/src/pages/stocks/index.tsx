import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useLoad } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '../../services/api'
import type { Stock } from '../../types'
import './index.scss'

interface StockItem extends Stock {
  latest_price?: number
  change_pct?: number
}

export default function StocksPage() {
  const [searchText, setSearchText] = useState('')
  const [marketFilter, setMarketFilter] = useState('A')
  const [stocks, setStocks] = useState<StockItem[]>([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const loadStocks = useCallback(async (p: number, append: boolean = false) => {
    setLoading(true)
    try {
      const res = await api.request<any>('GET', `/market/stocks/all?market=${marketFilter}&page=${p}&page_size=20`)
      const items = (res.items || []) as StockItem[]
      if (append) {
        setStocks(prev => [...prev, ...items])
      } else {
        setStocks(items)
      }
      setTotal(res.total || 0)
      setHasMore(items.length === 20)
    } catch {
      setStocks([])
    }
    setLoading(false)
  }, [marketFilter])

  useLoad(async () => {
    setPage(1)
    await loadStocks(1)
  })

  const handleSearch = async () => {
    if (!searchText.trim()) {
      setPage(1)
      await loadStocks(1)
      return
    }
    setLoading(true)
    try {
      const data = await api.searchStocks(searchText.trim(), marketFilter || undefined)
      setStocks(data as any)
      setTotal(data.length)
      setHasMore(false)
    } catch {
      setStocks([])
    }
    setLoading(false)
  }

  const handleScrollToLower = async () => {
    if (!hasMore || loading) return
    const nextPage = page + 1
    setPage(nextPage)
    await loadStocks(nextPage, true)
  }

  const handleStockClick = (stock: StockItem) => {
    Taro.navigateTo({ url: `/pages/stock-detail/index?stockId=${stock.id}` })
  }

  // 市场标签
  const marketLabel = (m: string) => {
    const map: Record<string, string> = { A: 'A股', HK: '港股', US: '美股' }
    return map[m] || m
  }

  return (
    <View className='stocks-page'>
      {/* 搜索栏 */}
      <View className='search-bar'>
        <View className='search-input-wrap'>
          <Text className='search-icon'>🔍</Text>
          <Input
            className='search-input'
            placeholder='搜索股票名称或代码'
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
            onConfirm={handleSearch}
            confirmType='search'
          />
        </View>
        <Text className='search-cancel' onClick={handleSearch}>搜索</Text>
      </View>

      {/* 股票列表 */}
      <View className='stock-list-wrap'>
        <ScrollView
          scrollY
          className='stock-list'
          refresherEnabled
          onScrollToLower={handleScrollToLower}
          style={{ height: '100%' }}
        >
          {loading && stocks.length === 0 ? (
            <View className='load-more'>加载中...</View>
          ) : stocks.length === 0 ? (
            <View className='empty-state'>
              <Text className='empty-icon'>📭</Text>
              <Text className='empty-text'>暂无数据</Text>
              <Text className='empty-sub'>下拉刷新重试</Text>
            </View>
          ) : (
            <>
              {stocks.map(stock => (
                <View
                  key={stock.id}
                  className='stock-card'
                  onClick={() => handleStockClick(stock)}
                >
                  <View className='stock-card-left'>
                    <View className='stock-name-row'>
                      <Text className='stock-name'>{stock.name}</Text>
                      <Text className='stock-symbol'>{stock.symbol}</Text>
                    </View>
                    <View className='stock-meta'>
                      <Text className={`market-tag ${stock.market.toLowerCase()}`}>
                        {marketLabel(stock.market)}
                      </Text>
                      {stock.sector && (
                        <Text className='stock-sector'>{stock.sector}</Text>
                      )}
                    </View>
                  </View>
                  <View className='stock-card-right'>
                    <Text className='stock-price'>
                      {stock.latest_price ? stock.latest_price.toFixed(2) : '--'}
                    </Text>
                    <Text className={`stock-change ${(stock.change_pct ?? 0) >= 0 ? 'up' : 'down'}`}>
                      {(stock.change_pct ?? 0) >= 0 ? '+' : ''}{(stock.change_pct ?? 0).toFixed(2)}%
                    </Text>
                  </View>
                </View>
              ))}
              {loading && stocks.length > 0 && (
                <View className='load-more'>加载更多...</View>
              )}
              {!hasMore && stocks.length > 0 && (
                <View className='load-more'>共 {total} 只股票</View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </View>
  )
}
