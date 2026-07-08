import { View, Text, ScrollView } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import * as api from '../../services/api'
import './index.scss'

interface QuotaItem {
  action: string
  label: string
  used: number
  limit: number
  remaining: number
}

export default function LoginPage() {
  const [user, setUser] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hasPhone, setHasPhone] = useState(false)
  const [quotas, setQuotas] = useState<QuotaItem[]>([])
  const [quotaDate, setQuotaDate] = useState('')

  useLoad(() => {
    checkAuth()
  })

  useDidShow(() => {
    checkAuth()
  })

  const checkAuth = () => {
    try {
      const token = Taro.getStorageSync('stock_token')
      const userInfo = Taro.getStorageSync('stock_user')
      setIsLoggedIn(!!token)
      if (userInfo) {
        setUser(userInfo)
        setHasPhone(!!userInfo.phone)
      }
      if (token) {
        loadQuota()
      }
    } catch {
      setIsLoggedIn(false)
    }
  }

  const loadQuota = async () => {
    try {
      const data = await api.getAIQuota()
      setQuotas(data.quotas || [])
      setQuotaDate(data.date || '')
    } catch {
      // 悄无声息
    }
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '退出登录',
      content: '确定要退出吗？',
      success: (res) => {
        if (res.confirm) {
          api.logout()
          setIsLoggedIn(false)
          setUser(null)
          setHasPhone(false)
          setQuotas([])
        }
      }
    })
  }

  const goToLogs = () => Taro.navigateTo({ url: '/pages/logs/index' })

  // ===== 已登录 → 个人中心 =====
  if (isLoggedIn) {
    return (
      <ScrollView className='login-page' scrollY>
        <View className='user-section'>
          <View className='avatar-placeholder'>👤</View>
          <Text className='user-name'>{user?.username || '微信用户'}</Text>
          <Text className='user-desc'>
            {hasPhone
              ? `已绑定 ${user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')}`
              : '微信用户'
            }
          </Text>
        </View>

        {/* AI 配额卡片 */}
        <View className='quota-card'>
          <View className='quota-header'>
            <Text className='quota-title'>🤖 AI 免费额度</Text>
            {quotaDate && <Text className='quota-date'>{quotaDate.replace(/-/g, '/')}</Text>}
          </View>
          {quotas.length === 0 ? (
            <Text className='quota-loading'>加载中...</Text>
          ) : (
            quotas.map((q) => {
              const pct = q.limit > 0 ? (q.used / q.limit) * 100 : 0
              const barColor = pct >= 80 ? '#ff4d4f' : pct >= 50 ? '#faad14' : '#4F6EF7'
              return (
                <View key={q.action} className='quota-row'>
                  <View className='quota-label-row'>
                    <Text className='quota-label'>{q.label}</Text>
                    <Text className='quota-count'>
                      {q.used}/{q.limit}
                      {q.limit > 0 && (
                        <Text className='quota-remaining'> 剩余 {q.remaining}</Text>
                      )}
                    </Text>
                  </View>
                  {q.limit > 0 && (
                    <View className='quota-bar-bg'>
                      <View
                        className='quota-bar'
                        style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
                      />
                    </View>
                  )}
                  {q.limit === 0 && (
                    <Text className='quota-unlimited'>无限次</Text>
                  )}
                </View>
              )
            })
          )}
        </View>

        <View className='info-card' onClick={goToLogs}>
          <Text className='info-card-label'>📋 操作日志</Text>
          <Text className='info-card-arrow'>›</Text>
        </View>

        <View className='logout-btn' onClick={handleLogout}>退出登录</View>
      </ScrollView>
    )
  }

  // ===== 未登录 → 显示提示 =====
  return (
    <View className='login-page'>
      <View className='user-section'>
        <View className='avatar-placeholder'>📊</View>
        <Text className='user-name'>未登录</Text>
        <Text className='user-desc'>进入首页后会自动登录</Text>
      </View>
      <View className='info-card' onClick={() => Taro.switchTab({ url: '/pages/index/index' })}>
        <Text className='info-card-label'>🏠 去首页</Text>
        <Text className='info-card-arrow'>›</Text>
      </View>
    </View>
  )
}
