import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { useState } from 'react'
import * as api from '../../services/api'
import type { SimulatedAccount } from '../../types'
import './index.scss'

type ModalType = 'none' | 'create' | 'ai' | 'deposit' | 'withdraw'

interface AccountDetail {
  account: SimulatedAccount
  positions: any[]
  orders: any[]
}

interface TradeItem {
  id: number
  stock?: { name: string; symbol: string }
  type: string
  volume: number
  price: number
  status: string
  created_at: string
}

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [tabView, setTabView] = useState<string>('accounts')
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null)
  const [accountDetail, setAccountDetail] = useState<AccountDetail | null>(null)
  const [trades, setTrades] = useState<TradeItem[]>([])
  const [modal, setModal] = useState<ModalType>('none')

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [hasPhone, setHasPhone] = useState(false)

  useLoad(async () => {
    const token = Taro.getStorageSync('stock_token')
    setIsLoggedIn(!!token)
    if (!token) {
      setLoading(false)
      return
    }
    const userInfo = Taro.getStorageSync('stock_user')
    setHasPhone(!!(userInfo?.phone))
    await loadAccounts()
  })

  usePullDownRefresh(async () => {
    const token = Taro.getStorageSync('stock_token')
    if (!token) { Taro.stopPullDownRefresh(); return }
    await loadAccounts()
    Taro.stopPullDownRefresh()
  })

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const data = await api.request<SimulatedAccount[]>('GET', '/portfolio/accounts')
      setAccounts(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
    setLoading(false)
  }

  if (isLoggedIn === false) {
    return (
      <ScrollView className='portfolio-page' scrollY>
        <View className='empty-portfolio' style={{ paddingTop: '200rpx' }}>
          <Text className='empty-icon'>🔐</Text>
          <Text className='empty-text'>请先登录</Text>
          <View className='empty-action' onClick={() => Taro.switchTab({ url: '/pages/login/index' })}>
            去登录
          </View>
        </View>
      </ScrollView>
    )
  }

  if (loading) {
    return (
      <View className='load-more' style={{ paddingTop: '200rpx' }}>
        <Text>加载中...</Text>
      </View>
    )
  }

  return (
    <ScrollView className='portfolio-page' scrollY>
      {accounts.length === 0 ? (
        <View className='empty-portfolio' style={{ paddingTop: '160rpx' }}>
          <Text className='empty-icon'>💼</Text>
          <Text className='empty-text'>暂无模拟账户</Text>
          <View className='empty-action' onClick={() => setModal('create')}>
            + 创建账户
          </View>
        </View>
      ) : (
        accounts.map(account => (
          <View key={account.id} className='account-card'>
            <View className='account-name-row'>
              <Text className='account-name'>{account.name}</Text>
            </View>
            <View className='account-detail-row'>
              <Text className='detail-label'>总资产</Text>
              <Text className='detail-value'>¥{account.total_asset.toLocaleString()}</Text>
            </View>
            <View className='account-detail-row'>
              <Text className='detail-label'>可用余额</Text>
              <Text className='detail-value'>¥{account.available_balance.toLocaleString()}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  )
}
