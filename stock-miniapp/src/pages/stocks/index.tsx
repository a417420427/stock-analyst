import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useLoad, useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import * as api from '../../services/api'
import type { Stock } from '../../types'
import './index.scss'

export default function StocksPage() {
  const [searchText, setSearchText] = useState('')
  const [marketFilter, setMarketFilter] = useState('')
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)

  const markets = [
    { key: '', label: '全部' },
    { key: 'A', label: 'A股' },
    { key: 'HK', label: '港股' },
    { key: 'US', label: '美股' },
  ]

  const doSearch = useCallback(async (text: string, market: string) => {
    if (!text.trim()) {
      setStocks([])
      setHasSearched(false)
      return
    }
    setLoading(true)
    setHasSearched(true)
    try {
      const data = await api.searchStocks(text.trim(), market || undefined)
      setStocks(data)
    } catch {
      setStocks([])
    }
    setLoading(false)
  }, [])

  const handleSearch = () => {
    doSearch(searchText, marketFilter)
  }

  const handleFilter = (market: string) => {
    setMarketFilter(market)
    if (searchText.trim()) {
      doSearch(searchText, market)
    }
  }

  const handleStockClick = (stock: Stock) => {
    Taro.navigateTo({ url: `/pages/stock-detail/index?stockId=${stock.id}` })
  }

  // 市场标签
  const marketLabel = (m: string) => {
    const map: Record<string, string> = { A: 'A股', HK: '港股', US: '美股' }
    return map[m] || m
  }

  // 模拟涨跌幅（从实时数据获取，这里展示 placeholder）
  const getChange = (stock: Stock) => {
    // 如果有 change_pct 字段则显示
    return (stock as any).change_pct
  }

  return (
    <View className='stocks-page'>
      {/* 搜索栏 */}
      <View className='search-bar'>
        <View className='search-input-wrap'>
          <Text className='search-icon'>🔍</Text>
          <Input
            className='search-input'
            placeholder='输入股票名称或代码'
            value={searchText}
            onInput={(e) => setSearchText(e.detail.value)}
            onConfirm={handleSearch}
            confirmType='search'
          />
        </View>
        <Text className='search-cancel' onClick={handleSearch}>搜索</Text>
      </View>

      {/* 市场筛选 */}
      <View className='market-filters'>
        {markets.map(m => (
          <Text
            key={m.key}
            className={`filter-btn ${marketFilter === m.key ? 'active' : ''}`}
            onClick={() => handleFilter(m.key)}
          >
            {m.label}
          </Text>
        ))}
      </View>

      {/* 股票列表 */}
      <View className='stock-list-wrap'>
        <ScrollView scrollY className='stock-list' refresherEnabled>
          {loading ? (
            <View className='load-more'>搜索中...</View>
          ) : hasSearched && stocks.length === 0 ? (
            <View className='empty-state'>
              <Text className='empty-icon'>🔍</Text>
              <Text className='empty-text'>未找到匹配的股票</Text>
            </View>
          ) : (
            stocks.map(stock => (
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
                    {stock.pe_ttm ? `PE ${stock.pe_ttm.toFixed(1)}` : '--'}
                  </Text>
                  {stock.pb && (
                    <Text className='stock-change flat'>PB {stock.pb.toFixed(2)}</Text>
                  )}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </View>
  )
}
