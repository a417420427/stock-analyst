import { View, Text } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import * as api from '../../services/api'
import './index.scss'

export default function LoginPage() {
  const [user, setUser] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hasPhone, setHasPhone] = useState(false)

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
    } catch {
      setIsLoggedIn(false)
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
        }
      }
    })
  }

  const goToLogs = () => Taro.navigateTo({ url: '/pages/logs/index' })

  // ===== 已登录 → 个人中心（openid 区分用户） =====
  if (isLoggedIn) {
    return (
      <View className='login-page'>
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
        <View className='info-card' onClick={goToLogs}>
          <Text className='info-card-label'>📋 操作日志</Text>
          <Text className='info-card-arrow'>›</Text>
        </View>
        <View className='logout-btn' onClick={handleLogout}>退出登录</View>
      </View>
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
