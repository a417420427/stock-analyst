import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback, useEffect } from 'react'
import * as api from '../../services/api'
import type { SimulatedAccount } from '../../types'
import './index.scss'

// ===== 持仓 & 交易类型 =====
interface Position {
  stock_id: number
  symbol: string
  name: string
  market: string
  quantity: number
  avg_cost: number
  current_price: number
  market_value: number
  cost_total: number
  pnl: number
  pnl_pct: number
  buy_count: number
  sell_count: number
}

interface TradeItem {
  id: number
  stock_id: number
  symbol: string
  name: string
  market: string
  side: string
  quantity: number
  price: number
  total: number
  commission: number
  order_type: string
  traded_at: string
  note: string | null
}

interface AccountDetail {
  account: {
    id: number
    name: string
    initial_balance: number
    available_balance: number
    frozen_balance: number
    commission_rate: number
    slippage: number
  }
  summary: { market_value: number; total_asset: number; total_pnl: number; pnl_pct: number; position_count: number }
  positions: Position[]
}

// ===== AI 选股 =====
interface AIStockItem {
  stock_id: number
  name: string
  symbol: string
  market: string
  weight: number
  reason: string
}

interface AISuggestion {
  name: string
  description: string
  stocks: AIStockItem[]
  estimated_return: string
  risk_level: string
  advice: string
}

interface AIResult {
  prompt: string
  suggestion: AISuggestion
  initial_balance: number
}

type TabView = 'accounts' | 'detail' | 'trades'
type ModalType = 'none' | 'create' | 'trade' | 'fund' | 'ai' | 'ai-result' | 'ai-done'

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [tabView, setTabView] = useState<TabView>('accounts')
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null)
  const [accountDetail, setAccountDetail] = useState<AccountDetail | null>(null)
  const [trades, setTrades] = useState<TradeItem[]>([])
  const [modal, setModal] = useState<ModalType>('none')

  // 创建账户
  const [newName, setNewName] = useState('')
  const [newBalance, setNewBalance] = useState('100000')

  // 交易
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [tradeStockId, setTradeStockId] = useState('')
  const [tradeQty, setTradeQty] = useState('')
  const [tradePrice, setTradePrice] = useState('')

  // 资金
  const [fundAmount, setFundAmount] = useState('')
  const [fundAction, setFundAction] = useState<'deposit' | 'withdraw'>('deposit')

  // AI 选股
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiBalance, setAiBalance] = useState('100000')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [aiCreating, setAiCreating] = useState(false)

  useLoad(async () => {
    await loadAccounts()
  })

  usePullDownRefresh(async () => {
    await loadAccounts()
    Taro.stopPullDownRefresh()
  })

  const loadAccounts = async () => {
    setLoading(true)
    try {
      const data = await api.getAccounts()
      setAccounts(data)
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
    setLoading(false)
  }

  const loadAccountDetail = async (id: number) => {
    try {
      const [detailRes, tradesRes] = await Promise.all([
        api.request('GET', `/portfolio/accounts/${id}`),
        api.request('GET', `/portfolio/accounts/${id}/trades`),
      ])
      setAccountDetail(detailRes as any)
      setTrades(tradesRes as any)
      setActiveAccountId(id)
      setTabView('detail')
    } catch {
      Taro.showToast({ title: '加载持仓失败', icon: 'none' })
    }
  }

  const handleCreateAccount = async () => {
    if (!newName.trim()) {
      Taro.showToast({ title: '请输入账户名称', icon: 'none' })
      return
    }
    try {
      const balance = parseFloat(newBalance) || 100000
      await api.request('POST', `/portfolio/accounts?name=${encodeURIComponent(newName.trim())}&initial_balance=${balance}`)
      Taro.showToast({ title: '创建成功', icon: 'success' })
      setModal('none')
      setNewName('')
      setNewBalance('100000')
      await loadAccounts()
    } catch {
      Taro.showToast({ title: '创建失败', icon: 'none' })
    }
  }

  const handleTrade = async () => {
    if (!activeAccountId || !tradeStockId || !tradeQty) {
      Taro.showToast({ title: '请填写完整信息', icon: 'none' })
      return
    }
    const stockId = parseInt(tradeStockId)
    const qty = parseInt(tradeQty)
    if (!stockId || !qty) {
      Taro.showToast({ title: '请输入有效数字', icon: 'none' })
      return
    }
    try {
      let path = `/portfolio/accounts/${activeAccountId}/trades?stock_id=${stockId}&side=${tradeSide}&quantity=${qty}`
      if (tradePrice) path += `&price=${tradePrice}`
      await api.request('POST', path)
      Taro.showToast({ title: '交易成功', icon: 'success' })
      setModal('none')
      setTradeStockId('')
      setTradeQty('')
      setTradePrice('')
      await loadAccountDetail(activeAccountId)
      await loadAccounts()
    } catch (e: any) {
      Taro.showToast({ title: e.message || '交易失败', icon: 'none' })
    }
  }

  const handleFund = async () => {
    if (!activeAccountId || !fundAmount) return
    const amount = parseFloat(fundAmount)
    if (!amount || amount <= 0) {
      Taro.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    try {
      await api.request('POST', `/portfolio/accounts/${activeAccountId}/${fundAction}?amount=${amount}`)
      Taro.showToast({ title: fundAction === 'deposit' ? '入金成功' : '提现成功', icon: 'success' })
      setModal('none')
      setFundAmount('')
      await loadAccountDetail(activeAccountId)
      await loadAccounts()
    } catch (e: any) {
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }

  const handleReset = async (id: number) => {
    Taro.showModal({
      title: '重置账户',
      content: '确定重置此账户吗？所有交易记录将被清空。',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.request('DELETE', `/portfolio/accounts/${id}`)
            Taro.showToast({ title: '已重置', icon: 'success' })
            setAccountDetail(null)
            setTabView('accounts')
            await loadAccounts()
          } catch {
            Taro.showToast({ title: '重置失败', icon: 'none' })
          }
        }
      }
    })
  }

  // AI 选股
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      Taro.showToast({ title: '请输入选股需求', icon: 'none' })
      return
    }
    setAiLoading(true)
    try {
      const res: any = await api.request(
        'POST',
        `/portfolio/ai-generate?prompt=${encodeURIComponent(aiPrompt.trim())}&initial_balance=${parseFloat(aiBalance) || 100000}`,
        undefined,
        { timeout: 120 }
      )
      setAiResult(res)
      setModal('ai-result')
    } catch (e: any) {
      Taro.showToast({ title: e.message || 'AI 分析失败', icon: 'none' })
    }
    setAiLoading(false)
  }

  const handleAiCreate = async () => {
    if (!aiResult) return
    setAiCreating(true)
    try {
      const res: any = await api.request(
        'POST',
        `/portfolio/ai-create?prompt=${encodeURIComponent(aiResult.prompt)}&initial_balance=${aiResult.initial_balance}`,
        undefined,
        { timeout: 120 }
      )
      setModal('ai-done')
      await loadAccounts()
    } catch (e: any) {
      Taro.showToast({ title: e.message || '创建失败', icon: 'none' })
    }
    setAiCreating(false)
  }

  // 计算总资产
  const totalAsset = accounts.reduce((sum, a) => sum + a.total_asset, 0)
  const totalPL = accounts.reduce((sum, a) => sum + (a.total_pnl || 0), 0)

  const marketLabel = (m: string) => ({ A: 'A股', HK: '港股', US: '美股' }[m] || m)

  // ===== 账户列表视图 =====
  const renderAccounts = () => (
    <>
      {/* 总资产头部 */}
      <View className='portfolio-header'>
        <View className='header-row'>
          <View>
            <Text className='header-label'>总资产</Text>
            <Text className='header-balance'>¥{totalAsset.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
            <Text className={`header-pl ${totalPL >= 0 ? 'up' : 'down'}`}>
              总盈亏: {totalPL >= 0 ? '+' : ''}¥{totalPL.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      {/* AI 选股入口 */}
      <View className='ai-section' onClick={() => setModal('ai')}>
        <Text className='ai-title'>🤖 AI 智能选股</Text>
        <Text className='ai-desc'>输入选股需求，AI 自动分析全市场并推荐投资组合</Text>
        <View className='ai-btn'>
          🚀 开始选股
        </View>
      </View>

      {/* 账户列表 */}
      <View className='section-header'>
        <Text className='section-title'>交易账户</Text>
        <Text className='section-action' onClick={() => setModal('create')}>+ 新建</Text>
      </View>

      {accounts.length === 0 ? (
        <View className='empty-portfolio'>
          <Text className='empty-icon'>💼</Text>
          <Text className='empty-text'>
            {loading ? '加载中...' : '暂无模拟账户\n点击下方按钮创建一个'}
          </Text>
          {!loading && (
            <View className='empty-action' onClick={() => setModal('create')}>
              + 创建账户
            </View>
          )}
        </View>
      ) : (
        accounts.map(account => (
          <View key={account.id} className='account-card' onClick={() => loadAccountDetail(account.id)}>
            <View className='account-name-row'>
              <Text className='account-name'>{account.name}</Text>
              {account.is_ai_generated && (
                <Text className='account-ai-tag'>AI</Text>
              )}
            </View>
            <View className='account-detail-row'>
              <Text className='detail-label'>总资产</Text>
              <Text className='detail-value'>¥{account.total_asset.toLocaleString()}</Text>
            </View>
            <View className='account-detail-row'>
              <Text className='detail-label'>可用余额</Text>
              <Text className='detail-value'>¥{account.available_balance.toLocaleString()}</Text>
            </View>
            <View className='account-detail-row'>
              <Text className='detail-label'>总盈亏</Text>
              <Text className={`detail-value ${account.total_pnl >= 0 ? 'up' : 'down'}`}>
                {account.total_pnl >= 0 ? '+' : ''}¥{account.total_pnl.toFixed(2)} ({account.pnl_pct}%)
              </Text>
            </View>
          </View>
        ))
      )}
    </>
  )

  // ===== 持仓详情视图 =====
  const renderDetail = () => {
    if (!accountDetail) return null
    const { account, summary, positions } = accountDetail

    return (
      <>
        {/* 返回 */}
        <View className='detail-back' onClick={() => { setTabView('accounts'); setAccountDetail(null) }}>
          ‹ 返回账户列表
        </View>

        {/* 账户名称 */}
        <View className='section-header'>
          <Text className='section-title'>{account.name}</Text>
        </View>

        {/* 概要 */}
        <View className='account-summary'>
          <View className='summary-card'>
            <Text className='summary-label'>总资产</Text>
            <Text className='summary-value'>¥{summary.total_asset.toFixed(2)}</Text>
          </View>
          <View className='summary-card'>
            <Text className='summary-label'>可用余额</Text>
            <Text className='summary-value'>¥{account.available_balance.toFixed(2)}</Text>
          </View>
          <View className='summary-card'>
            <Text className='summary-label'>持仓数</Text>
            <Text className='summary-value'>{summary.position_count}</Text>
          </View>
        </View>

        {/* 操作按钮 */}
        <View className='quick-actions' style={{ marginBottom: '20rpx' }}>
          <View className='quick-action' onClick={() => { setTradeSide('buy'); setModal('trade') }}>
            <Text style={{ fontSize: '32rpx' }}>📗</Text>
            <Text style={{ fontSize: '22rpx', color: 'var(--text-secondary)' }}>买入</Text>
          </View>
          <View className='quick-action' onClick={() => { setTradeSide('sell'); setModal('trade') }}>
            <Text style={{ fontSize: '32rpx' }}>📕</Text>
            <Text style={{ fontSize: '22rpx', color: 'var(--text-secondary)' }}>卖出</Text>
          </View>
          <View className='quick-action' onClick={() => { setFundAction('deposit'); setModal('fund') }}>
            <Text style={{ fontSize: '32rpx' }}>💰</Text>
            <Text style={{ fontSize: '22rpx', color: 'var(--text-secondary)' }}>入金</Text>
          </View>
          <View className='quick-action' onClick={() => { setFundAction('withdraw'); setModal('fund') }}>
            <Text style={{ fontSize: '32rpx' }}>🏧</Text>
            <Text style={{ fontSize: '22rpx', color: 'var(--text-secondary)' }}>提现</Text>
          </View>
        </View>

        {/* Tabs: 持仓 / 交易记录 */}
        <View className='tab-bar'>
          <View className={`tab-btn ${tabView === 'detail' ? 'active' : ''}`}
            onClick={() => setTabView('detail')}>
            持仓 {positions.length}
          </View>
          <View className={`tab-btn ${tabView === 'trades' ? 'active' : ''}`}
            onClick={() => setTabView('trades')}>
            交易记录
          </View>
        </View>

        {tabView === 'detail' && (
          positions.length === 0 ? (
            <View className='empty-portfolio'>
              <Text className='empty-icon'>📭</Text>
              <Text className='empty-text'>暂无持仓</Text>
            </View>
          ) : (
            positions.map(pos => (
              <View key={pos.stock_id} className='position-card'
                onClick={() => Taro.navigateTo({ url: `/pages/stock-detail/index?stockId=${pos.stock_id}` })}>
                <View className='position-header'>
                  <View style={{ display: 'flex', alignItems: 'center' }}>
                    <Text className='position-name'>{pos.name}</Text>
                    <Text className='position-symbol'>{pos.symbol}</Text>
                    <Text className={`position-market ${pos.market.toLowerCase()}`}>
                      {marketLabel(pos.market)}
                    </Text>
                  </View>
                  <Text className={`detail-value ${pos.pnl >= 0 ? 'up' : 'down'}`}>
                    {pos.pnl >= 0 ? '+' : ''}{pos.pnl_pct.toFixed(2)}%
                  </Text>
                </View>
                <View className='position-grid'>
                  <View className='position-item'>
                    <Text className='position-item-label'>持仓</Text>
                    <Text className='position-item-value'>{pos.quantity.toLocaleString()}</Text>
                  </View>
                  <View className='position-item'>
                    <Text className='position-item-label'>均价</Text>
                    <Text className='position-item-value'>{pos.avg_cost.toFixed(2)}</Text>
                  </View>
                  <View className='position-item'>
                    <Text className='position-item-label'>现价</Text>
                    <Text className='position-item-value'>{pos.current_price.toFixed(2)}</Text>
                  </View>
                  <View className='position-item'>
                    <Text className='position-item-label'>市值</Text>
                    <Text className='position-item-value'>{pos.market_value.toFixed(2)}</Text>
                  </View>
                  <View className='position-item'>
                    <Text className='position-item-label'>盈亏</Text>
                    <Text className={`position-item-value ${pos.pnl >= 0 ? 'up' : 'down'}`}>
                      {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                    </Text>
                  </View>
                  <View className='position-item'>
                    <Text className='position-item-label'>成本</Text>
                    <Text className='position-item-value'>{pos.cost_total.toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            ))
          )
        )}

        {tabView === 'trades' && (
          trades.length === 0 ? (
            <View className='empty-portfolio'>
              <Text className='empty-text'>暂无交易记录</Text>
            </View>
          ) : (
            trades.map(trade => (
              <View key={trade.id} className='trade-item'>
                <View className='trade-left'>
                  <View className='trade-header'>
                    <Text className='trade-stock-name'>{trade.name}</Text>
                    <Text className={`trade-side ${trade.side}`}>
                      {trade.side === 'buy' ? '买入' : '卖出'}
                    </Text>
                  </View>
                  <Text className='trade-detail'>
                    {trade.quantity}股 × ¥{trade.price.toFixed(2)}
                  </Text>
                  <Text className='trade-time'>{trade.traded_at?.slice(0, 16)?.replace('T', ' ')}</Text>
                </View>
                <Text className='trade-total'>
                  ¥{trade.total.toFixed(2)}
                </Text>
              </View>
            ))
          )
        )}

        {/* 底部操作 */}
        <View style={{ marginTop: '20rpx' }}>
          <View className='ai-btn' style={{ background: 'var(--danger)' }}
            onClick={() => handleReset(account.id)}>
            🗑️ 重置账户
          </View>
        </View>
      </>
    )
  }

  // ===== 模态框: 创建账户 =====
  const renderCreateModal = () => (
    <View className='modal-overlay' onClick={() => setModal('none')}>
      <View className='modal-content' onClick={(e) => e.stopPropagation()}>
        <Text className='modal-title'>创建模拟账户</Text>
        <View className='form-group'>
          <Text className='form-label'>账户名称</Text>
          <Input className='form-input' placeholder='如：白马组合' value={newName}
            onInput={(e) => setNewName(e.detail.value)} />
        </View>
        <View className='form-group'>
          <Text className='form-label'>初始资金</Text>
          <Input className='form-input' placeholder='100000' value={newBalance}
            onInput={(e) => setNewBalance(e.detail.value)} type='number' />
        </View>
        <View className='form-btn primary' onClick={handleCreateAccount}>创建账户</View>
        <View className='form-btn cancel' onClick={() => setModal('none')}>取消</View>
      </View>
    </View>
  )

  // ===== 模态框: 交易 =====
  const renderTradeModal = () => (
    <View className='modal-overlay' onClick={() => setModal('none')}>
      <View className='modal-content' onClick={(e) => e.stopPropagation()}>
        <Text className='modal-title'>{tradeSide === 'buy' ? '📗 买入' : '📕 卖出'}</Text>

        <View className='picker-row'>
          <View className={`picker-option ${tradeSide === 'buy' ? 'active' : ''}`}
            onClick={() => setTradeSide('buy')}>买入</View>
          <View className={`picker-option ${tradeSide === 'sell' ? 'active' : ''}`}
            onClick={() => setTradeSide('sell')}>卖出</View>
        </View>

        <View className='form-group'>
          <Text className='form-label'>股票 ID（输入后自动获取）</Text>
          <Input className='form-input' placeholder='输入股票 ID' value={tradeStockId}
            onInput={(e) => setTradeStockId(e.detail.value)} type='number' />
        </View>
        <View className='form-group'>
          <Text className='form-label'>数量（股）</Text>
          <Input className='form-input' placeholder='输入数量' value={tradeQty}
            onInput={(e) => setTradeQty(e.detail.value)} type='number' />
        </View>
        <View className='form-group'>
          <Text className='form-label'>价格（留空取最新价）</Text>
          <Input className='form-input' placeholder='留空自动取最新价' value={tradePrice}
            onInput={(e) => setTradePrice(e.detail.value)} type='digit' />
        </View>

        <View className='form-btn primary' onClick={handleTrade}>
          {tradeSide === 'buy' ? '确认买入' : '确认卖出'}
        </View>
        <View className='form-btn cancel' onClick={() => setModal('none')}>取消</View>
      </View>
    </View>
  )

  // ===== 模态框: 资金 =====
  const renderFundModal = () => (
    <View className='modal-overlay' onClick={() => setModal('none')}>
      <View className='modal-content' onClick={(e) => e.stopPropagation()}>
        <Text className='modal-title'>{fundAction === 'deposit' ? '💰 入金' : '🏧 提现'}</Text>
        <View className='form-group'>
          <Text className='form-label'>金额（元）</Text>
          <Input className='form-input' placeholder='输入金额' value={fundAmount}
            onInput={(e) => setFundAmount(e.detail.value)} type='digit' />
        </View>
        <View className='form-btn primary' onClick={handleFund}>
          {fundAction === 'deposit' ? '确认入金' : '确认提现'}
        </View>
        <View className='form-btn cancel' onClick={() => setModal('none')}>取消</View>
      </View>
    </View>
  )

  // ===== 模态框: AI 选股 =====
  const renderAIModal = () => (
    <View className='modal-overlay' onClick={() => setModal('none')}>
      <View className='modal-content' onClick={(e) => e.stopPropagation()}>
        <Text className='modal-title'>🤖 AI 智能选股</Text>
        <View className='form-group'>
          <Text className='form-label'>选股需求</Text>
          <Input className='ai-textarea' placeholder='如：选5只低PE高分红白马股，等权重配置' value={aiPrompt}
            onInput={(e) => setAiPrompt(e.detail.value)} />
        </View>
        <View className='form-group'>
          <Text className='form-label'>资金金额</Text>
          <Input className='form-input' placeholder='默认 100000' value={aiBalance}
            onInput={(e) => setAiBalance(e.detail.value)} type='number' />
        </View>
        <View className={`ai-btn ${aiLoading ? 'loading' : ''}`} onClick={handleAiGenerate}>
          {aiLoading ? 'AI 分析中...' : '🚀 生成选股方案'}
        </View>
        <View className='form-btn cancel' onClick={() => setModal('none')}>取消</View>
      </View>
    </View>
  )

  // ===== 模态框: AI 结果 =====
  const renderAIResultModal = () => {
    if (!aiResult) return null
    const s = aiResult.suggestion
    return (
      <View className='modal-overlay' onClick={() => setModal('none')}>
        <View className='modal-content' onClick={(e) => e.stopPropagation()}>
          <Text className='modal-title'>📋 选股结果</Text>

          <View className='ai-result-card'>
            <Text className='ai-result-name'>{s.name}</Text>
            <Text className='ai-result-desc'>{s.description}</Text>
            {s.estimated_return && (
              <Text className='ai-result-desc'>预计收益: {s.estimated_return}</Text>
            )}
          </View>

          <View style={{ margin: '16rpx 0' }}>
            <Text style={{ fontSize: '24rpx', fontWeight: 600, color: 'var(--text)', marginBottom: '8rpx', display: 'block' }}>
              推荐股票（{s.stocks.length} 只）
            </Text>
            {s.stocks.map((stock, i) => (
              <View key={stock.stock_id} className='ai-stock-row'>
                <Text className='ai-stock-name'>{stock.name} ({stock.symbol})</Text>
                <Text className='ai-stock-weight'>{(stock.weight * 100).toFixed(0)}%</Text>
                <Text className='ai-stock-reason'>{stock.reason}</Text>
              </View>
            ))}
          </View>

          {aiCreating ? (
            <View className='ai-btn loading'>正在创建账户并买入...</View>
          ) : (
            <>
              <View className='ai-create-btn create' onClick={handleAiCreate}>
                ✅ 创建组合并买入
              </View>
              <View className='ai-create-btn retry' onClick={() => setModal('ai')}>
                🔄 重新生成
              </View>
            </>
          )}
          <View className='form-btn cancel' onClick={() => setModal('none')}>关闭</View>
        </View>
      </View>
    )
  }

  // ===== 模态框: AI 创建完成 =====
  const renderAIDoneModal = () => (
    <View className='modal-overlay'>
      <View className='modal-content'>
        <View style={{ textAlign: 'center', padding: '40rpx 0' }}>
          <Text style={{ fontSize: '80rpx', display: 'block' }}>🎉</Text>
          <Text style={{ fontSize: '36rpx', fontWeight: 700, color: 'var(--text)', marginTop: '16rpx', display: 'block' }}>
            AI 组合已创建
          </Text>
          <Text style={{ fontSize: '26rpx', color: 'var(--text-secondary)', marginTop: '8rpx', display: 'block' }}>
            已自动买入推荐股票，请到账户列表中查看
          </Text>
        </View>
        <View className='form-btn primary' onClick={() => { setModal('none'); setAiResult(null) }}>
          知道了
        </View>
      </View>
    </View>
  )

  return (
    <ScrollView className='portfolio-page' scrollY>
      {tabView === 'accounts' && renderAccounts()}
      {tabView === 'detail' && renderDetail()}

      {/* Modals */}
      {modal === 'create' && renderCreateModal()}
      {modal === 'trade' && renderTradeModal()}
      {modal === 'fund' && renderFundModal()}
      {modal === 'ai' && renderAIModal()}
      {modal === 'ai-result' && renderAIResultModal()}
      {modal === 'ai-done' && renderAIDoneModal()}
    </ScrollView>
  )
}
