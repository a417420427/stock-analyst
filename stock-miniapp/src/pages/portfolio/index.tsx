import { View, Text, ScrollView, Input } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useLoad, usePullDownRefresh } from '@tarojs/taro'
import { useState, useEffect } from 'react'
import * as api from '../../services/api'
import type { SimulatedAccount, AccountDetail, Trade, AIResult, AICreateResult } from '../../types'
import './index.scss'

type ModalType = 'none' | 'create' | 'trade' | 'fund' | 'ai' | 'ai_create'

const MARKET_TAGS: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' }

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<SimulatedAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [activeAccountId, setActiveAccountId] = useState<number | null>(null)
  const [accountDetail, setAccountDetail] = useState<AccountDetail | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [modal, setModal] = useState<ModalType>('none')
  const [fundAction, setFundAction] = useState<'deposit' | 'withdraw'>('deposit')

  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)
  const [hasPhone, setHasPhone] = useState(false)

  // 创建账户
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('')

  // 交易
  const [tradeStockId, setTradeStockId] = useState<number | null>(null)
  const [tradeStockSearch, setTradeStockSearch] = useState('')
  const [tradeStockCandidates, setTradeStockCandidates] = useState<any[]>([])
  const [tradeSide, setTradeSide] = useState<'buy' | 'sell'>('buy')
  const [tradeQty, setTradeQty] = useState('')
  const [tradePrice, setTradePrice] = useState('')
  const [tradeNote, setTradeNote] = useState('')

  // 资金
  const [fundAmount, setFundAmount] = useState('')

  // AI 选股
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<AIResult | null>(null)
  const [aiStep, setAiStep] = useState<'input' | 'preview' | 'done'>('input')
  const [aiCreateResult, setAiCreateResult] = useState<AICreateResult | null>(null)

  // 股票搜索列表
  const [allStocks, setAllStocks] = useState<any[]>([])

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
    loadStocks()
  })

  usePullDownRefresh(async () => {
    const token = Taro.getStorageSync('stock_token')
    if (!token) { Taro.stopPullDownRefresh(); return }
    if (activeAccountId) {
      await Promise.all([loadAccounts(), loadAccountDetail(activeAccountId), loadTrades(activeAccountId)])
    } else {
      await loadAccounts()
    }
    Taro.stopPullDownRefresh()
  })

  const loadAccounts = async (created?: boolean) => {
    setLoading(true)
    try {
      const data = await api.getAccounts()
      setAccounts(data)
      if (data.length === 0 && !created) {
        // 没有账户时自动创建默认组合
        try {
          await api.createAccount('默认组合', 1000000)
          await loadAccounts(true)
          return
        } catch { /* ignore */ }
      }
    } catch {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
    setLoading(false)
  }

  const loadAccountDetail = async (id: number) => {
    try {
      const data = await api.getAccountDetail(id)
      setAccountDetail(data)
    } catch {
      setAccountDetail(null)
    }
  }

  const loadTrades = async (id: number) => {
    try {
      const data = await api.getAccountTrades(id)
      setTrades(data || [])
    } catch {
      setTrades([])
    }
  }

  const loadStocks = async () => {
    try {
      const data = await api.request<{ items: any[]; total: number }>('GET', '/market/stocks/all?page=1&page_size=200')
      setAllStocks(data.items || [])
    } catch { /* ignore */ }
  }

  const handleAccountClick = async (id: number) => {
    setActiveAccountId(id)
    setModal('none')
    await Promise.all([loadAccountDetail(id), loadTrades(id)])
  }

  const handleBackToList = () => {
    setActiveAccountId(null)
    setAccountDetail(null)
    setTrades([])
  }

  // ── 创建账户 ──
  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) {
      Taro.showToast({ title: '请输入账户名称', icon: 'none' })
      return
    }
    try {
      await api.createAccount(newAccountName.trim(), Number(newAccountBalance) || 1000000)
      Taro.showToast({ title: '创建成功', icon: 'success' })
      setModal('none')
      setNewAccountName('')
      setNewAccountBalance('')
      await loadAccounts()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '创建失败', icon: 'none' })
    }
  }

  // 股票搜索
  const searchStock = (q: string) => {
    setTradeStockSearch(q)
    if (!q.trim()) {
      setTradeStockCandidates([])
      return
    }
    const ql = q.toLowerCase()
    const matched = allStocks.filter(s =>
      s.symbol?.toLowerCase().includes(ql) || s.name?.toLowerCase().includes(ql)
    ).slice(0, 10)
    setTradeStockCandidates(matched)
  }

  const selectStock = (s: any) => {
    setTradeStockId(s.id)
    setTradeStockSearch(`${s.name} (${s.symbol}.${s.market})`)
    setTradeStockCandidates([])
  }

  // ── 交易 ──
  const handleTrade = async () => {
    if (!tradeStockId) {
      Taro.showToast({ title: '请选择股票', icon: 'none' })
      return
    }
    if (!tradeQty || parseInt(tradeQty) < 1) {
      Taro.showToast({ title: '请输入数量', icon: 'none' })
      return
    }
    try {
      await api.createTrade(activeAccountId!, {
        stock_id: tradeStockId,
        side: tradeSide,
        quantity: parseInt(tradeQty),
        price: tradePrice ? parseFloat(tradePrice) : undefined,
        note: tradeNote || undefined,
      })
      Taro.showToast({ title: '交易成功', icon: 'success' })
      setModal('none')
      setTradeStockId(null)
      setTradeQty('')
      setTradePrice('')
      setTradeNote('')
      await Promise.all([loadAccounts(), loadAccountDetail(activeAccountId!), loadTrades(activeAccountId!)])
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '交易失败', icon: 'none' })
    }
  }

  // ── 入金/提现 ──
  const handleFund = async () => {
    const amt = parseFloat(fundAmount)
    if (!amt || amt <= 0) {
      Taro.showToast({ title: '请输入有效金额', icon: 'none' })
      return
    }
    try {
      if (fundAction === 'deposit') {
        await api.deposit(activeAccountId!, amt)
      } else {
        await api.withdraw(activeAccountId!, amt)
      }
      Taro.showToast({ title: fundAction === 'deposit' ? '入金成功' : '提现成功', icon: 'success' })
      setModal('none')
      setFundAmount('')
      await Promise.all([loadAccounts(), loadAccountDetail(activeAccountId!)])
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '操作失败', icon: 'none' })
    }
  }

  // ── AI 选股 ──
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) {
      Taro.showToast({ title: '请描述你的投资需求', icon: 'none' })
      return
    }
    setAiLoading(true)
    setAiStep('preview')
    try {
      const res = await api.aiGenerate(aiPrompt.trim(), 1000000)
      setAiResult(res)
    } catch (e: any) {
      Taro.showToast({ title: e?.message || 'AI 分析失败', icon: 'none' })
      setAiStep('input')
    }
    setAiLoading(false)
  }

  const handleAiCreate = async () => {
    if (!aiResult) return
    setAiStep('done')
    try {
      const res = await api.aiCreate(aiResult.prompt, aiResult.initial_balance)
      setAiCreateResult(res)
      await loadAccounts()
    } catch (e: any) {
      Taro.showToast({ title: e?.message || '创建失败', icon: 'none' })
      setAiStep('preview')
    }
  }

  // ── 重置账户 ──
  const handleReset = () => {
    Taro.showModal({
      title: '重置账户',
      content: '将删除所有交易记录，确定重置？',
      success: async (res) => {
        if (res.confirm) {
          try {
            await api.resetAccount(activeAccountId!)
            Taro.showToast({ title: '已重置', icon: 'success' })
            setActiveAccountId(null)
            setAccountDetail(null)
            setTrades([])
            await loadAccounts()
          } catch (e: any) {
            Taro.showToast({ title: e?.message || '重置失败', icon: 'none' })
          }
        }
      }
    })
  }

  // ── 渲染 ──
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

  // ── 账户总览 ──
  if (!activeAccountId) {
    const totalAsset = accounts.reduce((s, a) => s + a.total_asset, 0)
    const totalPnl = accounts.reduce((s, a) => s + a.total_pnl, 0)
    const totalPositions = accounts.reduce((s, a) => s + (a.position_count || 0), 0)

    return (
      <View className='portfolio-wrapper'>
        <ScrollView className='portfolio-page' scrollY>
          {/* 总览统计 */}
          <View className='overview-stats'>
            <View className='stat-grid'>
              <View className='stat-card'>
                <Text className='stat-label'>总资产</Text>
                <Text className='stat-value'>¥{totalAsset.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              <View className='stat-card'>
                <Text className='stat-label'>总盈亏</Text>
                <Text className={`stat-value ${totalPnl >= 0 ? 'up' : 'down'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toFixed(2)}
                </Text>
              </View>
              <View className='stat-card'>
                <Text className='stat-label'>组合数</Text>
                <Text className='stat-value'>{accounts.length}</Text>
              </View>
              <View className='stat-card'>
                <Text className='stat-label'>持仓标的</Text>
                <Text className='stat-value'>{totalPositions}</Text>
              </View>
            </View>
          </View>

          {/* 操作按钮 */}
          <View className='action-row'>
            <View className='action-btn primary' onClick={() => { setAiPrompt(''); setAiResult(null); setAiStep('input'); setModal('ai') }}>
              <Text>🤖 AI 选股</Text>
            </View>
            <View className='action-btn' onClick={() => { setNewAccountName(''); setNewAccountBalance(''); setModal('create') }}>
              <Text>＋ 新建</Text>
            </View>
          </View>

          {/* 账户列表 */}
          {accounts.map(account => (
            <View key={account.id} className='account-card' onClick={() => handleAccountClick(account.id)}>
              <View className='account-header'>
                <View className='account-name-row'>
                  {account.is_ai_generated && <Text className='ai-badge'>AI</Text>}
                  <Text className='account-name'>{account.name}</Text>
                </View>
                <View className='account-pnl-row'>
                  <Text className='account-pnl' style={{ color: account.total_pnl >= 0 ? '#ef4444' : '#22c55e' }}>
                    {account.total_pnl >= 0 ? '+' : ''}{account.total_pnl.toFixed(2)}
                  </Text>
                  <Text className='account-delete' onClick={(e) => { e.stopPropagation();
                    Taro.showModal({
                      title: '删除组合',
                      content: `确定删除组合「${account.name}」？不可恢复。`,
                      success: async (res) => {
                        if (res.confirm) {
                          try {
                            await api.deleteAccount(account.id)
                            Taro.showToast({ title: '已删除', icon: 'success' })
                            await loadAccounts()
                          } catch (e: any) {
                            Taro.showToast({ title: e?.message || '删除失败', icon: 'none' })
                          }
                        }
                      }
                    })
                  }}>删除</Text>
                </View>
              </View>
              <View className='account-stats-row'>
                <View className='account-stat'>
                  <Text className='stat-lbl'>总资产</Text>
                  <Text className='stat-val'>¥{account.total_asset.toLocaleString()}</Text>
                </View>
                <View className='account-stat'>
                  <Text className='stat-lbl'>可用</Text>
                  <Text className='stat-val'>¥{account.available_balance.toLocaleString()}</Text>
                </View>
                <View className='account-stat'>
                  <Text className='stat-lbl'>持仓</Text>
                  <Text className='stat-val'>{account.position_count || 0}</Text>
                </View>
              </View>
            </View>
          ))}

          {/* 间距 */}
          <View style={{ height: 40 }}></View>
        </ScrollView>

        {/* ── 创建账户弹窗 ── */}
        {modal === 'create' && (
          <View className='modal-overlay' onClick={() => setModal('none')}>
            <View className='modal-content' onClick={e => e.stopPropagation()}>
              <Text className='modal-title'>新建策略组合</Text>
              <View className='form-group'>
                <Text className='form-label'>组合名称</Text>
                <Input
                  className='form-input'
                  placeholder='如：白马组合、成长组合'
                  value={newAccountName}
                  onInput={e => setNewAccountName(e.detail.value)}
                />
              </View>
              <View className='form-group'>
                <Text className='form-label'>初始资金 (元)</Text>
                <Input
                  className='form-input'
                  placeholder='1000000'
                  type='number'
                  value={newAccountBalance}
                  onInput={e => setNewAccountBalance(e.detail.value)}
                />
              </View>
              <View className='fee-note'>手续费: A股万1.5 | 港股万2.5 | 美股万1</View>
              <View className='modal-actions'>
                <View className='modal-btn modal-btn-cancel' onClick={() => setModal('none')}>
                  取消
                </View>
                <View className='modal-btn modal-btn-primary' onClick={handleCreateAccount}>
                  确认创建
                </View>
              </View>
            </View>
          </View>
        )}

        {/* ── AI 选股弹窗 ── */}
        {modal === 'ai' && (
          <View className='modal-overlay' onClick={() => { setModal('none'); setAiStep('input'); setAiResult(null) }}>
            <View className='modal-content modal-full' onClick={e => e.stopPropagation()}>
              {/* Step 1: 输入 */}
              {aiStep === 'input' && (
                <>
                  <Text className='modal-title'>🤖 AI 选股</Text>
                  <View className='ai-input-box'>
                    <View className='ai-tip'>
                      <Text>描述你的投资需求，AI 将自动选股并创建模拟组合</Text>
                      <Text className='ai-tip-example'>例如：选5只低PE、高分红的白马股，等权重配置</Text>
                    </View>
                    <Input
                      className='ai-input'
                      placeholder='低估值白马股组合，PE<15，分红率>3%，5只等权重配置'
                      value={aiPrompt}
                      onInput={e => setAiPrompt(e.detail.value)}
                    />
                    <View className='modal-actions' style={{ marginTop: 24 }}>
                      <View className='modal-btn modal-btn-cancel' onClick={() => { setModal('none'); setAiResult(null); setAiStep('input') }}>
                        取消
                      </View>
                      <View className='modal-btn modal-btn-primary' onClick={handleAiGenerate}>
                        🤖 AI 智能选股
                      </View>
                    </View>
                  </View>
                </>
              )}

              {/* Step 2: 预览 */}
              {aiStep === 'preview' && (
                <>
                  <Text className='modal-title'>🎯 选股方案预览</Text>
                  {aiLoading ? (
                    <View className='ai-loading'>
                      <Text className='ai-loading-text'>AI 正在分析全市场股票...</Text>
                    </View>
                  ) : aiResult ? (
                    <View className='ai-preview'>
                      <View className='ai-result-header'>
                        <Text className='ai-result-title'>{aiResult.suggestion.name}</Text>
                        <Text className='ai-result-desc'>{aiResult.suggestion.description}</Text>
                        <View className='ai-tags'>
                          <Text className='ai-tag' data-color={aiResult.suggestion.risk_level === 'low' ? 'green' : aiResult.suggestion.risk_level === 'medium' ? 'orange' : 'red'}>
                            风险: {aiResult.suggestion.risk_level === 'low' ? '低' : aiResult.suggestion.risk_level === 'medium' ? '中' : '高'}
                          </Text>
                          <Text className='ai-tag'>初始资金: ¥{aiResult.initial_balance.toLocaleString()}</Text>
                        </View>
                      </View>

                      <View className='ai-stock-section'>
                        <Text className='section-title'>持仓清单</Text>
                        {(aiResult.suggestion.stocks || []).map((s, i) => {
                          const amount = (aiResult.initial_balance || 0) * (s.weight || 0)
                          return (
                            <View key={s.stock_id || i} className='ai-stock-item'>
                              <View className='ai-stock-left'>
                                <Text className='ai-stock-idx'>{i + 1}</Text>
                                <View>
                                  <Text className='ai-stock-name'>{s.name}</Text>
                                  <Text className='ai-stock-symbol'>{s.symbol}</Text>
                                </View>
                              </View>
                              <View className='ai-stock-right'>
                                <Text className='ai-stock-weight'>{(s.weight * 100).toFixed(0)}%</Text>
                                <Text className='ai-stock-amount'>¥{amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}</Text>
                                <Text className='ai-stock-reason'>{s.reason}</Text>
                              </View>
                            </View>
                          )
                        })}
                      </View>

                      <View className='modal-actions' style={{ marginTop: 16 }}>
                        <View className='modal-btn modal-btn-cancel' onClick={() => { setAiStep('input'); setAiResult(null) }}>
                          重选
                        </View>
                        <View className='modal-btn modal-btn-primary' onClick={handleAiCreate}>
                          ✅ 创建并买入
                        </View>
                      </View>
                      <Text className='ai-advice'>{aiResult.suggestion.advice}</Text>
                    </View>
                  ) : (
                    <Text className='ai-error'>AI 分析失败，请检查 AI 设置</Text>
                  )}
                </>
              )}

              {/* Step 3: 完成 */}
              {aiStep === 'done' && aiCreateResult && (
                <>
                  <Text className='modal-title'>🎉 创建成功</Text>
                  <View className='ai-done'>
                    <View className='ai-done-info'>
                      <Text className='ai-done-name'>"{aiCreateResult.account.name}"</Text>
                      <View className='ai-done-stats'>
                        <Text>初始资金: ¥{aiCreateResult.account.initial_balance?.toLocaleString()}</Text>
                        <Text>剩余资金: ¥{aiCreateResult.account.available_balance?.toLocaleString()}</Text>
                        <Text>实际投入: ¥{(aiCreateResult.total_invested || 0).toLocaleString()}</Text>
                      </View>
                    </View>

                    <Text className='section-title'>买入明细</Text>
                    {(aiCreateResult.trades || []).map((t, i) => (
                      <View key={t.stock_id || i} className='trade-item'>
                        <Text className='trade-item-name'>{t.name} ({t.symbol})</Text>
                        <Text className='trade-item-detail'>
                          买入 {t.quantity}股 × ¥{t.exec_price} = ¥{t.total?.toLocaleString()}
                        </Text>
                        <Text className='trade-item-commission'>手续费: ¥{t.commission?.toFixed(2)}</Text>
                      </View>
                    ))}

                    <View className='modal-actions' style={{ marginTop: 16 }}>
                      <View className='modal-btn modal-btn-cancel' onClick={() => { setModal('none'); setAiStep('input'); setAiResult(null); setAiCreateResult(null) }}>
                        关闭
                      </View>
                      <View className='modal-btn modal-btn-primary' onClick={() => {
                        setModal('none')
                        setAiStep('input')
                        handleAccountClick(aiCreateResult.account.id)
                      }}>
                        查看组合
                      </View>
                    </View>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
      </View>
    )
  }

  // ── 账户详情 ──
  const detail = accountDetail
  return (
    <View className='portfolio-wrapper'>
      <ScrollView className='portfolio-page' scrollY>
        {/* 返回按钮 + 操作 */}
        <View className='detail-top-bar'>
          <View className='detail-back' onClick={handleBackToList}>
            ← 返回
          </View>
          <Text className='detail-title'>{detail?.account?.name || ''}</Text>
          <View className='detail-actions'>
            <View className='detail-action-btn' onClick={() => { setTradeStockId(null); setTradeSide('buy'); setTradeQty(''); setTradePrice(''); setTradeNote(''); setModal('trade') }}>
              交易
            </View>
            <View className='detail-action-btn' onClick={() => { setFundAction('deposit'); setFundAmount(''); setModal('fund') }}>
              入金
            </View>
            <View className='detail-action-btn' onClick={() => { setFundAction('withdraw'); setFundAmount(''); setModal('fund') }}>
              提现
            </View>
            <View className='detail-action-btn danger' onClick={handleReset}>
              重置
            </View>
          </View>
        </View>

        {/* AI 描述 */}
        {detail?.account?.ai_prompt && (
          <View className='ai-prompt-card'>
            <Text>🤖 AI 选股: "{detail.account.ai_prompt}"</Text>
          </View>
        )}

        {/* 账户统计 */}
        {detail && (
          <View className='detail-stats'>
            <View className='detail-stat-grid'>
              <View className='detail-stat-card'>
                <Text className='stat-label'>总资产</Text>
                <Text className='stat-value'>¥{detail.summary.total_asset.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              <View className='detail-stat-card'>
                <Text className='stat-label'>可用资金</Text>
                <Text className='stat-value'>¥{detail.account.available_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              <View className='detail-stat-card'>
                <Text className='stat-label'>持仓市值</Text>
                <Text className='stat-value'>¥{detail.summary.market_value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
              <View className='detail-stat-card'>
                <Text className='stat-label'>累计盈亏</Text>
                <Text className={`stat-value ${detail.summary.total_pnl >= 0 ? 'up' : 'down'}`}>
                  {detail.summary.total_pnl >= 0 ? '+' : ''}{detail.summary.total_pnl.toFixed(2)}
                  <Text className='stat-suffix'> ({detail.summary.pnl_pct >= 0 ? '+' : ''}{detail.summary.pnl_pct.toFixed(2)}%)</Text>
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* 持仓明细 */}
        <Text className='section-title'>持仓明细</Text>
        {detail && detail.positions.length === 0 ? (
          <View className='empty-section'>
            <Text>暂无持仓，点击上方「交易」买入</Text>
          </View>
        ) : (
          detail?.positions?.map(pos => (
            <View key={pos.stock_id} className='position-card'>
              <View className='pos-header'>
                <View className='pos-name-row'>
                  <Text className='pos-tag' style={{ backgroundColor: `var(--${MARKET_TAGS[pos.market] || 'blue'})` }}>{pos.market}</Text>
                  <Text className='pos-name'>{pos.name}</Text>
                  <Text className='pos-symbol'>{pos.symbol}</Text>
                </View>
                <Text className={`pos-pnl ${pos.pnl >= 0 ? 'up' : 'down'}`}>
                  {pos.pnl >= 0 ? '+' : ''}{pos.pnl.toFixed(2)}
                </Text>
              </View>
              <View className='pos-stats'>
                <View className='pos-stat'>
                  <Text className='pos-lbl'>持仓</Text>
                  <Text className='pos-val'>{pos.quantity.toLocaleString()}</Text>
                </View>
                <View className='pos-stat'>
                  <Text className='pos-lbl'>均价</Text>
                  <Text className='pos-val'>{pos.avg_cost.toFixed(2)}</Text>
                </View>
                <View className='pos-stat'>
                  <Text className='pos-lbl'>现价</Text>
                  <Text className='pos-val'>{pos.current_price.toFixed(2)}</Text>
                </View>
                <View className='pos-stat'>
                  <Text className='pos-lbl'>市值</Text>
                  <Text className='pos-val'>¥{pos.market_value.toLocaleString()}</Text>
                </View>
                <View className='pos-stat'>
                  <Text className='pos-lbl'>收益率</Text>
                  <Text className={`pos-val ${pos.pnl_pct >= 0 ? 'up' : 'down'}`}>
                    {pos.pnl_pct >= 0 ? '+' : ''}{pos.pnl_pct.toFixed(2)}%
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}

        {/* 交易流水 */}
        <Text className='section-title'>交易流水</Text>
        {trades.length === 0 ? (
          <View className='empty-section'>
            <Text>暂无交易记录</Text>
          </View>
        ) : (
          trades.map(t => (
            <View key={t.id} className='trade-row'>
              <View className='trade-left'>
                <View className='trade-name-row'>
                  <Text className={`trade-side-tag ${t.side}`}>{t.side === 'buy' ? '买入' : '卖出'}</Text>
                  <Text className='trade-name'>{t.name}</Text>
                  <Text className='trade-symbol'>{t.symbol}</Text>
                </View>
                <Text className='trade-time'>{t.traded_at?.slice(0, 16)?.replace('T', ' ')}</Text>
              </View>
              <View className='trade-right'>
                <Text className='trade-qty'>{t.quantity}股</Text>
                <Text className='trade-price'>¥{t.price.toFixed(2)}</Text>
                <Text className='trade-total'>¥{t.total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 40 }}></View>
      </ScrollView>

      {/* ── 交易弹窗 ── */}
      {modal === 'trade' && (
        <View className='modal-overlay' onClick={() => setModal('none')}>
          <View className='modal-content modal-full' onClick={e => e.stopPropagation()}>
            <Text className='modal-title'>模拟交易</Text>

            <View className='form-group'>
              <Text className='form-label'>股票</Text>
              <Input
                className='form-input'
                placeholder='输入代码或名称搜索（如：600519）'
                value={tradeStockSearch}
                onInput={e => searchStock(e.detail.value)}
              />
              {tradeStockCandidates.length > 0 && (
                <View className='stock-candidates'>
                  {tradeStockCandidates.map(s => (
                    <View key={s.id} className='stock-candidate' onClick={() => selectStock(s)}>
                      <Text className='sc-name'>{s.name}</Text>
                      <Text className='sc-symbol'>{s.symbol}.{s.market}</Text>
                    </View>
                  ))}
                </View>
              )}
              {tradeStockId && (
                <View className='selected-stock'>
                  ✅ 已选: {tradeStockSearch}
                </View>
              )}
            </View>

            <View className='form-group'>
              <Text className='form-label'>方向</Text>
              <View className='picker-row'>
                <View className={`picker-option ${tradeSide === 'buy' ? 'active' : ''}`} onClick={() => setTradeSide('buy')}>
                  买入
                </View>
                <View className={`picker-option ${tradeSide === 'sell' ? 'active' : ''}`} onClick={() => setTradeSide('sell')}>
                  卖出
                </View>
              </View>
            </View>

            <View className='form-row'>
              <View className='form-group' style={{ flex: 1 }}>
                <Text className='form-label'>数量</Text>
                <Input
                  className='form-input'
                  placeholder='100'
                  type='number'
                  value={tradeQty}
                  onInput={e => setTradeQty(e.detail.value)}
                />
              </View>
              <View style={{ width: 16 }} />
              <View className='form-group' style={{ flex: 1 }}>
                <Text className='form-label'>价格（留空自动取最新价）</Text>
                <Input
                  className='form-input'
                  placeholder='自动'
                  type='number'
                  value={tradePrice}
                  onInput={e => setTradePrice(e.detail.value)}
                />
              </View>
            </View>

            <View className='form-group'>
              <Text className='form-label'>备注</Text>
              <Input
                className='form-input'
                placeholder='可选'
                value={tradeNote}
                onInput={e => setTradeNote(e.detail.value)}
              />
            </View>

            <View className='fee-note'>系统自动计算滑点(0.1%)和手续费，A股卖出加收印花税万5</View>

            <View className='modal-actions'>
              <View className='modal-btn modal-btn-cancel' onClick={() => setModal('none')}>
                取消
              </View>
              <View className='modal-btn modal-btn-primary' onClick={handleTrade}>
                确认交易
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ── 入金/提现弹窗 ── */}
      {modal === 'fund' && (
        <View className='modal-overlay' onClick={() => setModal('none')}>
          <View className='modal-content' onClick={e => e.stopPropagation()}>
            <Text className='modal-title'>{fundAction === 'deposit' ? '入金' : '提现'}</Text>
            <View className='form-group'>
              <Text className='form-label'>金额 (元)</Text>
              <Input
                className='form-input'
                placeholder='100000'
                type='number'
                value={fundAmount}
                onInput={e => setFundAmount(e.detail.value)}
              />
            </View>
            <View className='modal-actions'>
              <View className='modal-btn modal-btn-cancel' onClick={() => setModal('none')}>
                取消
              </View>
              <View className='modal-btn modal-btn-primary' onClick={handleFund}>
                确认
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
