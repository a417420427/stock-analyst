import { View, Text, ScrollView } from '@tarojs/components'
import { useLoad } from '@tarojs/taro'
import { useState } from 'react'
import * as api from '../../services/api'
import type { ActivityLog } from '../../types'
import './index.scss'

export default function LogsPage() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)

  useLoad(async () => {
    setLoading(true)
    try {
      const data = await api.getActivityLogs()
      setLogs(data)
    } catch {
      setLogs([])
    }
    setLoading(false)
  })

  const levelLabel = {
    info: '信息',
    success: '成功',
    warning: '警告',
    error: '错误',
  }

  const actionLabel: Record<string, string> = {
    ai_pick: 'AI 选股',
    trade: '交易',
    system: '系统',
  }

  return (
    <ScrollView className='logs-page' scrollY>
      {loading ? (
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
        logs.map(log => (
          <View key={log.id} className='log-card'>
            <View className='log-header'>
              <Text className='log-title'>{log.title || '操作'}</Text>
              <View style={{ display: 'flex', alignItems: 'center' }}>
                <Text className={`log-level ${log.level}`}>
                  {levelLabel[log.level as keyof typeof levelLabel] || log.level}
                </Text>
                <Text className='log-action-tag'>
                  {actionLabel[log.action as keyof typeof actionLabel] || log.action}
                </Text>
              </View>
            </View>
            <Text className='log-time'>{log.created_at}</Text>
          </View>
        ))
      )}
    </ScrollView>
  )
}
