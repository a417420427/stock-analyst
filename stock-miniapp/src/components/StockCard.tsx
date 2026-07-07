import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Stock } from '../types'

interface Props {
  stock: Stock
  showDetail?: boolean
}

export default function StockCard({ stock, showDetail = true }: Props) {
  const marketLabel = { A: 'A股', HK: '港股', US: '美股' }[stock.market] || stock.market
  const changePct = (stock as any).change_pct ?? null

  const handleClick = () => {
    if (showDetail) {
      Taro.navigateTo({ url: `/pages/stock-detail/index?stockId=${stock.id}` })
    }
  }

  return (
    <View className='stock-card' onClick={handleClick}>
      <View className='stock-card-left'>
        <Text className='stock-name'>{stock.name}</Text>
        <View className='stock-meta'>
          <Text className='stock-symbol'>{stock.symbol}</Text>
          <Text className={`stock-market ${stock.market.toLowerCase()}`}>{marketLabel}</Text>
        </View>
      </View>
      <View className='stock-card-right'>
        <Text className='stock-price'>
          {(stock as any).price ? `¥${(stock as any).price}` : '--'}
        </Text>
        {changePct !== null && (
          <Text className={`stock-change ${changePct >= 0 ? 'up' : 'down'}`}>
            {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
          </Text>
        )}
      </View>
    </View>
  )
}
