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
    account_delete: '删除组合',
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
        logs.map((log) => {
          const levelColor: Record<string, string> = {
            success: '#52c41a',
            info: '#1677ff',
            warning: '#faad14',
            error: '#ff4d4f',
          }
          return (
          <View key={log.id} className='log-card'>
            <View className='log-header'>
              <View className='log-header-left'>
                <Text className={`log-level-dot`} style={{ backgroundColor: levelColor[log.level] || '#999' }} />
                <Text className='log-action'>{actionLabel[log.action] || log.action}</Text>
                {log.level === 'success' && <Text className='log-level-tag success'>成功</Text>}
                {log.level === 'warning' && <Text className='log-level-tag warning'>警告</Text>}
                {log.level === 'error' && <Text className='log-level-tag error'>错误</Text>}
              </View>
              <Text className='log-time'>
                {log.created_at?.slice(0, 16)?.replace('T', ' ')}
              </Text>
            </View>

            {log.title && (
              <Text className='log-title'>{log.title}</Text>
            )}

            {log.detail && (
              <View className='log-detail-box'>
                {typeof log.detail === 'object'
                  ? Object.entries(log.detail)
                      .filter(([k]) => !['account_id', 'stock_id', 'strategy_id', 'user_id', 'id'].includes(k))
                      .map(([k, v]) => {
                        const labelMap: Record<string, string> = {
                          side: '方向',
                          quantity: '数量',
                          price: '价格',
                          total: '金额',
                          commission: '手续费',
                          stamp_duty: '印花税',
                          name: '组合名称',
                          prompt: '描述',
                          balance: '余额',
                          amount: '金额',
                          position_count: '持仓数',
                          initial_balance: '初始资金',
                          available_balance: '可用资金',
                          trades: '交易数',
                          stock_name: '股票',
                          stock_symbol: '代码',
                          market: '市场',
                        }
                        const label = labelMap[k] || k
                        let displayV = String(v)
                        if (k === 'side') displayV = v === 'buy' ? '买入' : '卖出'
                        if (k === 'commission' || k === 'stamp_duty' || k === 'total' || k === 'price') {
                          displayV = `¥${Number(v).toFixed(2)}`
                        }
                        if (k === 'quantity') displayV = `${v}股`
                        if (k === 'balance' || k === 'amount' || k === 'initial_balance' || k === 'available_balance') {
                          displayV = `¥${Number(v).toLocaleString()}`
                        }
                        // trades 是个数组，显示数量就行
                        if (k === 'trades' && Array.isArray(v)) displayV = `${v.length}笔`
                        return (
                          <View key={k} className='log-detail-row'>
                            <Text className='log-detail-key'>{label}</Text>
                            <Text className='log-detail-value'>{displayV}</Text>
                          </View>
                        )
                      })
                  : <Text className='log-detail-text'>{log.detail}</Text>
                }
              </View>
            )}
          </View>
          )
        })
      )}
    </ScrollView>
  )
}
