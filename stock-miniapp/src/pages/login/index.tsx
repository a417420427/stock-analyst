import { View, Text, Input } from '@tarojs/components'
import { useLoad, useDidShow } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import * as api from '../../services/api'
import './index.scss'

export default function LoginPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isRegister, setIsRegister] = useState(false)
  const [error, setError] = useState('')

  useLoad(() => {
    checkAuth()
  })

  useDidShow(() => {
    checkAuth()
  })

  const checkAuth = () => {
    try {
      const token = Taro.getStorageSync('stock_token')
      setIsLoggedIn(!!token)
    } catch {
      setIsLoggedIn(false)
    }
  }

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      setError('请输入用户名和密码')
      return
    }
    setError('')
    try {
      if (isRegister) {
        await api.register(username.trim(), password)
      }
      await api.login(username.trim(), password)
      setIsLoggedIn(true)
      Taro.showToast({ title: isRegister ? '注册成功' : '登录成功', icon: 'success' })
    } catch (err: any) {
      setError(err.message || '登录失败')
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
          setUsername('')
          setPassword('')
        }
      }
    })
  }

  // API 设置页面
  const goToAISettings = () => {
    Taro.showToast({ title: 'AI 设置请在 Web 端操作', icon: 'none' })
  }

  const goToLogs = () => {
    Taro.navigateTo({ url: '/pages/logs/index' })
  }

  if (isLoggedIn) {
    return (
      <View className='login-page'>
        <View className='user-section'>
          <View className='avatar-placeholder'>👤</View>
          <Text className='user-name'>已登录</Text>
          <Text className='user-desc'>欢迎使用股票智能分析系统</Text>
        </View>

        <View className='info-card' onClick={goToLogs}>
          <Text className='info-card-label'>📋 操作日志</Text>
          <Text className='info-card-arrow'>›</Text>
        </View>

        <View className='info-card' onClick={goToAISettings}>
          <Text className='info-card-label'>🤖 AI 设置</Text>
          <Text className='info-card-arrow'>›</Text>
        </View>

        <View className='logout-btn' onClick={handleLogout}>
          退出登录
        </View>
      </View>
    )
  }

  return (
    <View className='login-page'>
      <View className='user-section'>
        <View className='avatar-placeholder'>📊</View>
        <Text className='user-name'>股票智能分析</Text>
        <Text className='user-desc'>登录以使用全部功能</Text>
      </View>

      <View className='login-form'>
        <Text className='form-title'>{isRegister ? '注册' : '登录'}</Text>

        {error && <View className='login-error'>{error}</View>}

        <View className='input-group'>
          <Text className='input-label'>用户名</Text>
          <Input
            className='form-input'
            placeholder='请输入用户名'
            value={username}
            onInput={(e) => setUsername(e.detail.value)}
          />
        </View>

        <View className='input-group'>
          <Text className='input-label'>密码</Text>
          <Input
            className='form-input'
            placeholder='请输入密码'
            password
            value={password}
            onInput={(e) => setPassword(e.detail.value)}
          />
        </View>

        <View className='login-btn' onClick={handleLogin}>
          {isRegister ? '注册并登录' : '登录'}
        </View>

        <Text className='switch-auth' onClick={() => setIsRegister(!isRegister)}>
          {isRegister ? '已有账号？去登录' : '没有账号？去注册'}
        </Text>
      </View>

      <View className='info-card'>
        <Text className='info-card-label'>默认账号</Text>
        <Text className='info-card-arrow'>admin / admin123</Text>
      </View>
    </View>
  )
}
