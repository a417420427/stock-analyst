// 操作日志
import { View, Text, ScrollView } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import * as api from '../../services/api'
import type { ActivityLog } from '../../types'
import './index.scss'

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useLoad(async () => {
    const token = Taro.getStorageSync('stock_token')
    const loggedIn = !!token
    setIsLoggedIn(loggedIn)

    if (!loggedIn) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const data = await api.getActivityLogs()
      setLogs(data)
    } catch {
      setLogs([])
    }
    setLoading(false)
  })

  const actionLabel: Record<string, string> = {
    ai_pick: 'AI 选股',
    ai_analysis: 'AI 分析',
    ai_prediction: 'AI 预测',
    trade: '交易操作',
    account_create: '创建账户',
    account_deposit: '充值',
    account_withdraw: '提现',
  }

  return (
    <ScrollView className='logs-page' scrollY>
      {isLoggedIn === false ? (
        <View className='empty-logs'>
          <Text className='empty-logs-icon'>🔐</Text>
          <Text className='empty-logs-text'>请先登录</Text>
          <View className='empty-logs-btn' onClick={() => Taro.switchTab({ url: '/pages/login/index' })}>
            去登录
          </View>
        </View>
      ) : loading ? (
        <View className='empty-logs'>
          <Text className='empty-logs-icon'>📋</Text>
          <Text>加载中...</Text>
        </View>
      ) : logs.length === 0 ? (
        <View className='empty-logs'>
          <Text className='empty-logs-icon'>📋</Text>
          <Text>暂无操作日志</Text>
        </View>
      ) : (
        logs.map((log) => (
          <View key={log.id} className='log-card'>
            <View className='log-header'>
              <Text className='log-action'>{actionLabel[log.action] || log.action}</Text>
              <Text className='log-time'>
                {new Date(log.created_at).toLocaleString('zh-CN', { hour12: false })}
              </Text>
            </View>
            <Text className='log-detail'>{typeof log.detail === 'object' ? JSON.stringify(log.detail) : log.detail}</Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}
