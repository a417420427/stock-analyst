import { View, Text, Button } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import * as api from '../../services/api'
import './index.scss'

export default function LoginPage() {
  const [user, setUser] = useState<any>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [hasPhone, setHasPhone] = useState(false)

  useLoad(() => {
    silentLogin()
  })

  useDidShow(() => {
    // 每次显示时刷新登录状态
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

  const silentLogin = async () => {
    // 如果已经有 token 且未过期，跳过
    const token = Taro.getStorageSync('stock_token')
    if (token) {
      checkAuth()
      return
    }

    try {
      // @ts-ignore
      const loginRes = await Taro.login()
      if (!loginRes.code) return

      const data = await api.wxLogin(loginRes.code)
      setUser(data.user)
      setHasPhone(!!data.user?.phone)
      setIsLoggedIn(true)
    } catch {
      // 静默失败不影响使用
    }
  }

  const handleBindPhone = async (e: any) => {
    try {
      const detail = e.detail

      console.log('detail', detail)
      if (detail.errMsg !== 'getPhoneNumber:ok') {
        Taro.showToast({ title: '授权失败', icon: 'none' })
        return
      }

      const data = await api.bindPhone(detail.code)
      setHasPhone(true)
      setUser(prev => ({ ...prev, phone: data.phone }))
      Taro.setStorageSync('stock_user', { ...user, phone: data.phone })
      Taro.showToast({ title: '绑定成功', icon: 'success' })
    } catch (err: any) {
      Taro.showToast({ title: err.message || '绑定失败', icon: 'none' })
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
          // 静默重新登录
          silentLogin()
        }
      }
    })
  }

  const goToLogs = () => {
    Taro.navigateTo({ url: '/pages/logs/index' })
  }

  const goToAISettings = () => {
    Taro.showToast({ title: 'AI 设置请在 Web 端操作', icon: 'none' })
  }

  return (
    <View className='login-page'>
      {/* 用户信息 */}
      <View className='user-section'>
        <View className='avatar-placeholder'>
          {isLoggedIn ? '👤' : '📊'}
        </View>
        <Text className='user-name'>
          {isLoggedIn ? (user?.username || '微信用户') : '股票智能分析'}
        </Text>
        <Text className='user-desc'>
          {isLoggedIn
            ? (hasPhone ? `已绑定手机` : '完善手机号，享受完整服务')
            : '正在自动登录...'
          }
        </Text>
      </View>

      {/* 绑定手机号提示 */}
      {isLoggedIn && !hasPhone && (
        <Button className='phone-bind-btn' openType='getPhoneNumber' onGetPhoneNumber={handleBindPhone}>
          <View className='phone-bind-card'>
            <View className='phone-bind-left'>
              <Text className='phone-bind-icon'>📱</Text>
              <View>
                <Text className='phone-bind-title'>绑定手机号</Text>
                <Text className='phone-bind-desc'>用于账号安全和找回密码</Text>
              </View>
            </View>
            <Text className='phone-bind-arrow'>›</Text>
          </View>
        </Button>
      )}

      {/* 功能入口 */}
      <View className='info-card' onClick={goToLogs}>
        <Text className='info-card-label'>📋 操作日志</Text>
        <Text className='info-card-arrow'>›</Text>
      </View>

      <View className='info-card' onClick={goToAISettings}>
        <Text className='info-card-label'>🤖 AI 设置</Text>
        <Text className='info-card-arrow'>›</Text>
      </View>

      {/* 退出登录 */}
      {isLoggedIn && (
        <View className='logout-btn' onClick={handleLogout}>
          退出当前账号
        </View>
      )}
    </View>
  )
}
