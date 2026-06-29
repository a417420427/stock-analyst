import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, message, Modal, Form, Input, Select,
  InputNumber, Statistic, Row, Col, Tabs, Popconfirm, Descriptions, Divider, Tooltip,
  Steps, Alert, Spin, Progress,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  WalletOutlined, SwapOutlined, BankOutlined, RobotOutlined,
  ThunderboltOutlined, CheckCircleOutlined, LoadingOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { TabPane } = Tabs;
const { TextArea } = Input;

interface Account {
  id: number;
  name: string;
  strategy_id: number | null;
  strategy_name: string | null;
  initial_balance: number;
  available_balance: number;
  frozen_balance: number;
  market_value: number;
  total_asset: number;
  total_pnl: number;
  pnl_pct: number;
  position_count: number;
  commission_rate: number;
}

interface Position {
  stock_id: number;
  symbol: string;
  name: string;
  market: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  market_value: number;
  cost_total: number;
  pnl: number;
  pnl_pct: number;
  buy_count: number;
  sell_count: number;
}

interface Trade {
  id: number;
  stock_id: number;
  symbol: string;
  name: string;
  market: string;
  side: string;
  quantity: number;
  price: number;
  total: number;
  commission: number;
  order_type: string;
  traded_at: string;
  note: string | null;
}

interface AccountDetail {
  account: Account;
  summary: { market_value: number; total_asset: number; total_pnl: number; pnl_pct: number; position_count: number };
  positions: Position[];
}

const marketTag: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' };

const commissionLabels: Record<string, string> = {
  'A': '万1.5',
  'HK': '万2.5',
  'US': '万1',
};

export default function PortfolioPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [selectedAccount, setSelectedAccount] = useState<AccountDetail | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [allStocks, setAllStocks] = useState<any[]>([]);

  // Modals
  const [createModal, setCreateModal] = useState(false);
  const [tradeModal, setTradeModal] = useState(false);
  const [fundModal, setFundModal] = useState(false);
  const [fundAction, setFundAction] = useState<'deposit' | 'withdraw'>('deposit');

  // AI 选股
  const [aiModal, setAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [aiStep, setAiStep] = useState<'input' | 'preview' | 'creating' | 'done'>('input');
  const [createdAccount, setCreatedAccount] = useState<any>(null);

  const [form] = Form.useForm();
  const [tradeForm] = Form.useForm();
  const [fundForm] = Form.useForm();

  useEffect(() => {
    loadAccounts();
    loadStocks();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/portfolio/accounts');
      setAccounts(res.data || []);
    } catch { message.error('加载账户失败'); }
    setLoading(false);
  };

  const loadAccountDetail = async (id: number) => {
    try {
      const [detailRes, tradesRes] = await Promise.all([
        api.get(`/portfolio/accounts/${id}`),
        api.get(`/portfolio/accounts/${id}/trades`),
      ]);
      setSelectedAccount(detailRes.data);
      setTrades(tradesRes.data || []);
    } catch { message.error('加载持仓详情失败'); }
  };

  const loadStocks = async () => {
    try {
      const res = await api.get('/market/stocks/all', { params: { page: 1, page_size: 500 } });
      setAllStocks(res.data?.items || []);
    } catch { /* ignore */ }
  };

  const handleCreateAccount = async (values: any) => {
    try {
      await api.post('/portfolio/accounts', null, {
        params: {
          name: values.name,
          initial_balance: values.initial_balance || 1000000,
        },
      });
      message.success('账户创建成功');
      setCreateModal(false);
      form.resetFields();
      loadAccounts();
    } catch { message.error('创建失败'); }
  };

  const handleTrade = async (values: any) => {
    const accId = parseInt(activeTab);
    try {
      await api.post(`/portfolio/accounts/${accId}/trades`, null, {
        params: {
          stock_id: values.stock_id,
          side: values.side,
          quantity: values.quantity,
          price: values.price || undefined,
          order_type: values.order_type || 'market',
          note: values.note || undefined,
        },
      });
      message.success('交易成功');
      setTradeModal(false);
      tradeForm.resetFields();
      loadAccountDetail(accId);
      loadAccounts();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '交易失败');
    }
  };

  const handleFund = async (values: any) => {
    const accId = parseInt(activeTab);
    try {
      await api.post(`/portfolio/accounts/${accId}/${fundAction}`, null, {
        params: { amount: values.amount },
      });
      message.success(fundAction === 'deposit' ? '入金成功' : '提现成功');
      setFundModal(false);
      fundForm.resetFields();
      loadAccountDetail(accId);
      loadAccounts();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '操作失败');
    }
  };

  const handleReset = async (accId: number) => {
    try {
      await api.delete(`/portfolio/accounts/${accId}`);
      message.success('账户已重置');
      setSelectedAccount(null);
      loadAccounts();
    } catch { message.error('重置失败'); }
  };

  // ── AI 选股 ──
  const handleAiGenerate = async (values: any) => {
    setAiLoading(true);
    setAiResult(null);
    setAiStep('preview');
    try {
      const res = await api.post('/portfolio/ai-generate', null, {
        params: {
          prompt: values.prompt,
          initial_balance: values.initial_balance || 1000000,
        },
        timeout: 120000,
      });
      setAiResult(res.data);
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'AI 分析失败，请检查 AI 设置');
      setAiStep('input');
    }
    setAiLoading(false);
  };

  const handleAiCreate = async () => {
    if (!aiResult) return;
    setAiStep('creating');
    try {
      const res = await api.post('/portfolio/ai-create', null, {
        params: {
          prompt: aiResult.prompt,
          initial_balance: aiResult.initial_balance,
        },
        timeout: 120000,
      });
      setCreatedAccount(res.data);
      setAiStep('done');
      loadAccounts();
    } catch (e: any) {
      message.error(e.response?.data?.detail || '创建失败');
      setAiStep('preview');
    }
  };

  // ── Tab切换 ──
  const onTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'overview') {
      setSelectedAccount(null);
      setTrades([]);
    } else {
      loadAccountDetail(parseInt(key));
    }
  };

  // ── 持仓列 ──
  const positionColumns = [
    {
      title: '标的', key: 'stock', width: 200,
      render: (_: any, r: Position) => (
        <Space>
          <Tag color={marketTag[r.market]}>{r.market}</Tag>
          <a href={`/analysis/${r.stock_id}`}><span style={{ fontWeight: 600 }}>{r.name}</span></a>
          <span style={{ color: '#999', fontSize: 12 }}>{r.symbol}</span>
        </Space>
      ),
    },
    { title: '持仓', dataIndex: 'quantity', width: 80, render: (v: number) => v.toLocaleString() },
    {
      title: '均价', dataIndex: 'avg_cost', width: 100,
      render: (v: number) => <span style={{ fontFamily: 'monospace' }}>{v.toFixed(2)}</span>,
    },
    {
      title: '现价', dataIndex: 'current_price', width: 100,
      render: (v: number) => <span style={{ fontFamily: 'monospace' }}>{v.toFixed(2)}</span>,
    },
    {
      title: '成本', dataIndex: 'cost_total', width: 120,
      render: (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
    {
      title: '市值', dataIndex: 'market_value', width: 120,
      render: (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
    {
      title: '盈亏', dataIndex: 'pnl', width: 120,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#ef4444' : '#22c55e', fontWeight: 600, fontFamily: 'monospace' }}>
          {v >= 0 ? '+' : ''}{v.toFixed(2)}
        </span>
      ),
    },
    {
      title: '收益率', dataIndex: 'pnl_pct', width: 100,
      render: (v: number) => (
        <Tag color={v >= 0 ? 'red' : 'green'} style={{ fontFamily: 'monospace' }}>
          {v >= 0 ? '+' : ''}{v.toFixed(2)}%
        </Tag>
      ),
    },
  ];

  // ── 交易记录列 ──
  const tradeColumns = [
    {
      title: '时间', dataIndex: 'traded_at', width: 150,
      render: (t: string) => dayjs(t).format('MM-DD HH:mm:ss'),
    },
    {
      title: '方向', dataIndex: 'side', width: 70,
      render: (s: string) => (
        <Tag color={s === 'buy' ? 'red' : 'green'}>{s === 'buy' ? '买入' : '卖出'}</Tag>
      ),
    },
    {
      title: '标的', key: 'stock', width: 200,
      render: (_: any, r: Trade) => (
        <Space>
          <Tag color={marketTag[r.market]}>{r.market}</Tag>
          <span>{r.name}</span>
          <span style={{ color: '#999', fontSize: 12 }}>{r.symbol}</span>
        </Space>
      ),
    },
    { title: '数量', dataIndex: 'quantity', width: 80 },
    {
      title: '执行价', dataIndex: 'price', width: 100,
      render: (p: number) => p.toFixed(2),
    },
    {
      title: '金额', dataIndex: 'total', width: 120,
      render: (t: number) => t.toLocaleString(undefined, { minimumFractionDigits: 2 }),
    },
    {
      title: '手续费', dataIndex: 'commission', width: 100,
      render: (c: number) => c.toFixed(2),
    },
    { title: '类型', dataIndex: 'order_type', width: 70, render: (t: string) => t === 'market' ? '市价' : '限价' },
  ];

  const totalPnl = accounts.reduce((s, a) => s + a.total_pnl, 0);
  const totalAsset = accounts.reduce((s, a) => s + a.total_asset, 0);

  return (
    <div>
      {/* 总览统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card className="stat-card" size="small">
            <Statistic title="总资产" value={totalAsset} precision={2} prefix="¥"
              valueStyle={{ color: '#1d2129', fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card className="stat-card" size="small">
            <Statistic title="总盈亏" value={totalPnl} precision={2}
              prefix={totalPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: totalPnl >= 0 ? '#ef4444' : '#22c55e', fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card className="stat-card" size="small">
            <Statistic title="策略数" value={accounts.length} prefix={<>📊</>}
              valueStyle={{ fontSize: 24 }} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card className="stat-card" size="small">
            <Statistic title="持仓标的" value={accounts.reduce((s, a) => s + a.position_count, 0)}
              prefix={<>📦</>} valueStyle={{ fontSize: 24 }} />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <WalletOutlined />
            <span>模拟交易</span>
          </Space>
        }
        extra={
          <Space>
            <Button icon={<RobotOutlined />} onClick={() => { setAiModal(true); setAiResult(null); setAiStep('input'); setCreatedAccount(null); }}>
              AI 选股
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)}>
              新建组合
            </Button>
          </Space>
        }
      >
        {accounts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            <BankOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
            <div>还没有模拟账户，点击右上角新建一个策略组合</div>
          </div>
        ) : (
          <Tabs
            activeKey={activeTab}
            onChange={onTabChange}
            tabBarExtraContent={
              activeTab !== 'overview' && (
                <Space>
                  <Button size="small" icon={<SwapOutlined />} onClick={() => setTradeModal(true)}>
                    交易
                  </Button>
                  <Button size="small" onClick={() => { setFundAction('deposit'); setFundModal(true); }}>
                    入金
                  </Button>
                  <Button size="small" onClick={() => { setFundAction('withdraw'); setFundModal(true); }}>
                    提现
                  </Button>
                  <Popconfirm title="确定重置？将删除所有交易记录" onConfirm={() => handleReset(parseInt(activeTab))}>
                    <Button size="small" danger>重置</Button>
                  </Popconfirm>
                </Space>
              )
            }
          >
            <TabPane tab="📊 总览" key="overview">
              <Table
                dataSource={accounts}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '组合名称', key: 'name',
                    render: (_: any, r: Account) => (
                      <Space>
                        <WalletOutlined />
                        <a onClick={() => onTabChange(String(r.id))} style={{ fontWeight: 600 }}>{r.name}</a>
                        {r.strategy_name && <Tag style={{ fontSize: 11 }}>{r.strategy_name}</Tag>}
                      </Space>
                    ),
                  },
                  { title: '初始资金', dataIndex: 'initial_balance', render: (v: number) => v.toLocaleString() },
                  { title: '可用资金', dataIndex: 'available_balance', render: (v: number) => v.toLocaleString() },
                  {
                    title: '市值', dataIndex: 'market_value',
                    render: (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2 }),
                  },
                  {
                    title: '总资产', dataIndex: 'total_asset',
                    render: (v: number) => <strong>{v.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>,
                  },
                  {
                    title: '盈亏', dataIndex: 'total_pnl',
                    render: (v: number) => (
                      <span style={{ color: v >= 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                        {v >= 0 ? '+' : ''}{v.toFixed(2)}
                      </span>
                    ),
                  },
                  {
                    title: '收益率', dataIndex: 'pnl_pct',
                    render: (v: number) => (
                      <Tag color={v >= 0 ? 'red' : 'green'}>{v >= 0 ? '+' : ''}{v}%</Tag>
                    ),
                  },
                  { title: '持仓数', dataIndex: 'position_count' },
                  {
                    title: '手续费', dataIndex: 'commission_rate',
                    render: (v: number) => `万${(v * 10000).toFixed(1)}`,
                  },
                ]}
              />
            </TabPane>

            {/* 单个账户详情 */}
            {selectedAccount && (
              <TabPane tab={selectedAccount.account.name} key={String(selectedAccount.account.id)}>
                {/* 账户统计 */}
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  <Col xs={12} sm={6}>
                    <Card size="small" className="stat-card">
                      <Statistic title="总资产" value={selectedAccount.summary.total_asset} precision={2}
                        prefix="¥" valueStyle={{ fontSize: 20 }} />
                    </Card>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Card size="small" className="stat-card">
                      <Statistic title="可用资金" value={selectedAccount.account.available_balance} precision={2}
                        prefix="¥" valueStyle={{ fontSize: 20 }} />
                    </Card>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Card size="small" className="stat-card">
                      <Statistic title="持仓市值" value={selectedAccount.summary.market_value} precision={2}
                        prefix="¥" valueStyle={{ fontSize: 20 }} />
                    </Card>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Card size="small" className="stat-card">
                      <Statistic
                        title="累计盈亏"
                        value={selectedAccount.summary.total_pnl}
                        precision={2}
                        prefix={selectedAccount.summary.total_pnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                        valueStyle={{
                          color: selectedAccount.summary.total_pnl >= 0 ? '#ef4444' : '#22c55e',
                          fontSize: 20,
                        }}
                        suffix={
                          <span style={{ fontSize: 13 }}>
                            ({selectedAccount.summary.pnl_pct >= 0 ? '+' : ''}{selectedAccount.summary.pnl_pct}%)
                          </span>
                        }
                      />
                    </Card>
                  </Col>
                </Row>

                <Divider orientation="left" plain>持仓明细</Divider>
                {selectedAccount.positions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>
                    该组合还没有持仓，点击右上角「交易」买入
                  </div>
                ) : (
                  <Table
                    dataSource={selectedAccount.positions}
                    columns={positionColumns}
                    rowKey="stock_id"
                    pagination={false}
                    size="small"
                    style={{ marginBottom: 16 }}
                  />
                )}

                <Divider orientation="left" plain>交易流水</Divider>
                <Table
                  dataSource={trades}
                  columns={tradeColumns}
                  rowKey="id"
                  pagination={false}
                  size="small"
                />
              </TabPane>
            )}
          </Tabs>
        )}
      </Card>

      {/* 创建账户弹窗 */}
      <Modal
        title="新建策略组合"
        open={createModal}
        onCancel={() => setCreateModal(false)}
        onOk={() => form.submit()}
        okText="创建"
        width={460}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreateAccount}>
          <Form.Item name="name" label="组合名称" rules={[{ required: true }]}>
            <Input placeholder="如：白马组合、成长组合、AI选股组合" />
          </Form.Item>
          <Form.Item name="initial_balance" label="初始资金(¥)" initialValue={1000000}>
            <InputNumber min={10000} step={100000} style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => v?.replace(/,/g, '') as any} />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>
            手续费: A股万1.5 | 港股万2.5 | 美股万1 (卖出加印花税万5)
          </div>
        </Form>
      </Modal>

      {/* 交易弹窗 */}
      <Modal
        title="模拟交易"
        open={tradeModal}
        onCancel={() => setTradeModal(false)}
        onOk={() => tradeForm.submit()}
        okText="确认交易"
        width={520}
        destroyOnClose
      >
        <Form form={tradeForm} layout="vertical" onFinish={handleTrade}>
          <Form.Item name="stock_id" label="股票" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择股票"
              filterOption={(input, option) =>
                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
              }
              options={allStocks.map(s => ({
                value: s.id,
                label: `${s.name} (${s.symbol}.${s.market})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="side" label="方向" rules={[{ required: true }]}>
            <Select options={[
              { value: 'buy', label: '买入' },
              { value: 'sell', label: '卖出' },
            ]} />
          </Form.Item>
          <Space style={{ width: '100%' }}>
            <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="price" label="价格(留空自动取最新价)">
              <InputNumber min={0.01} step={0.01} style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Form.Item name="order_type" label="订单类型" initialValue="market">
            <Select options={[
              { value: 'market', label: '市价单（自动加滑点）' },
              { value: 'limit', label: '限价单（指定价格）' },
            ]} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input placeholder="可选备注" />
          </Form.Item>
          <div style={{ color: '#999', fontSize: 12 }}>
            系统自动计算滑点(0.1%)和手续费(万1.5/万2.5/万1)，A股卖出加收印花税万5
          </div>
        </Form>
      </Modal>

      {/* 资金操作弹窗 */}
      <Modal
        title={fundAction === 'deposit' ? '入金' : '提现'}
        open={fundModal}
        onCancel={() => setFundModal(false)}
        onOk={() => fundForm.submit()}
        okText="确认"
        width={400}
        destroyOnClose
      >
        <Form form={fundForm} layout="vertical" onFinish={handleFund}>
          <Form.Item name="amount" label={`金额(¥)`} rules={[{ required: true }]}>
            <InputNumber min={1} step={10000} style={{ width: '100%' }}
              formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(v) => v?.replace(/,/g, '') as any} />
          </Form.Item>
        </Form>
      </Modal>

      {/* AI 选股弹窗 */}
      <Modal
        title={
          <Space>
            <RobotOutlined style={{ color: '#722ed1' }} />
            <span>AI 选股</span>
            {aiStep === 'preview' && <Tag color="blue">预览</Tag>}
            {aiStep === 'creating' && <Tag color="processing">创建中</Tag>}
            {aiStep === 'done' && <Tag color="green">完成</Tag>}
          </Space>
        }
        open={aiModal}
        onCancel={() => { setAiModal(false); setAiResult(null); setAiStep('input'); setCreatedAccount(null); }}
        footer={null}
        width={700}
        destroyOnClose
      >
        {/* Step 1: 输入需求 */}
        {aiStep === 'input' && (
          <Form layout="vertical" onFinish={handleAiGenerate}>
            <div style={{ marginBottom: 16 }}>
              <Alert
                type="info"
                showIcon
                message="描述你的投资需求，AI 将自动选股并创建模拟组合"
                description="例如：选5只低PE、高分红的白马股，等权重配置"
              />
            </div>
            <Form.Item name="prompt" label="投资需求描述" rules={[{ required: true, message: '请描述你的投资需求' }]}>
              <TextArea
                rows={4}
                placeholder="例如：低估值白马股组合，PE<15，分红率>3%，5只等权重配置"
              />
            </Form.Item>
            <Form.Item name="initial_balance" label="初始资金(¥)" initialValue={1000000}>
              <InputNumber min={10000} step={100000} style={{ width: '100%' }}
                formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={(v) => v?.replace(/,/g, '') as any} />
            </Form.Item>
            <Button type="primary" htmlType="submit" icon={<ThunderboltOutlined />} block size="large">
              🤖 AI 智能选股
            </Button>
          </Form>
        )}

        {/* Step 2: 预览结果 */}
        {aiStep === 'preview' && (
          <div>
            {aiLoading ? (
              <div style={{ textAlign: 'center', padding: 60 }}>
                <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
                <div style={{ marginTop: 16, color: '#999' }}>AI 正在分析全市场股票...</div>
              </div>
            ) : aiResult ? (
              <div>
                <Alert
                  type="success"
                  showIcon
                  message={aiResult.suggestion.name}
                  description={
                    <Space direction="vertical">
                      <div>{aiResult.suggestion.description}</div>
                      <Space>
                        <Tag color="blue">风险: {aiResult.suggestion.risk_level === 'low' ? '低' : aiResult.suggestion.risk_level === 'medium' ? '中' : '高'}</Tag>
                        <Tag color="orange">预估收益: {aiResult.suggestion.estimated_return || '-'}</Tag>
                        <Tag color="purple">初始资金: ¥{aiResult.initial_balance?.toLocaleString()}</Tag>
                      </Space>
                    </Space>
                  }
                  style={{ marginBottom: 16 }}
                />

                <div style={{ fontWeight: 600, marginBottom: 8 }}>📋 选股清单</div>
                <Table
                  dataSource={aiResult.suggestion.stocks}
                  rowKey="stock_id"
                  pagination={false}
                  size="small"
                  columns={[
                    { title: '#', key: 'idx', width: 40, render: (_: any, __: any, i: number) => i + 1 },
                    { title: '代码', dataIndex: 'symbol', width: 100 },
                    { title: '名称', dataIndex: 'name', width: 120 },
                    {
                      title: '权重', dataIndex: 'weight', width: 80,
                      render: (v: number) => <Tag color="blue">{(v * 100).toFixed(0)}%</Tag>,
                    },
                    { title: '选股理由', dataIndex: 'reason', render: (v: string) => <div style={{ fontSize: 12, maxWidth: 280 }}>{v}</div> },
                  ]}
                  style={{ marginBottom: 16 }}
                />

                <Divider />

                <Space direction="horizontal" style={{ width: '100%', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ color: '#999', fontSize: 12 }}>投资建议</div>
                    <div style={{ fontSize: 13 }}>{aiResult.suggestion.advice || '无'}</div>
                  </div>
                  <Button type="primary" size="large" onClick={handleAiCreate} icon={<CheckCircleOutlined />}>
                    ✅ 创建并买入
                  </Button>
                </Space>
              </div>
            ) : (
              <Alert type="error" message="分析失败" description="请检查 AI 设置中是否配置了 API Key" />
            )}
          </div>
        )}

        {/* Step 3: 创建中 */}
        {aiStep === 'creating' && (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <div style={{ marginTop: 16, color: '#999' }}>正在创建模拟账户并自动买入...</div>
          </div>
        )}

        {/* Step 4: 完成 */}
        {aiStep === 'done' && createdAccount && (
          <div>
            <Alert
              type="success"
              showIcon
              message={`🎉 组合 "${createdAccount.account.name}" 创建成功`}
              description={
                <Space direction="vertical">
                  <div>初始资金: ¥{createdAccount.account.initial_balance?.toLocaleString()}</div>
                  <div>剩余资金: ¥{createdAccount.account.available_balance?.toLocaleString()}</div>
                  <div>实际投入: ¥{createdAccount.total_invested?.toLocaleString()}</div>
                </Space>
              }
              style={{ marginBottom: 16 }}
            />

            <div style={{ fontWeight: 600, marginBottom: 8 }}>📋 买入明细</div>
            <Table
              dataSource={createdAccount.trades}
              rowKey="stock_id"
              pagination={false}
              size="small"
              columns={[
                { title: '股票', dataIndex: 'name', width: 100 },
                { title: '数量', dataIndex: 'quantity', width: 80 },
                { title: '价格', dataIndex: 'exec_price', width: 100, render: (v: number) => v.toFixed(2) },
                { title: '金额', dataIndex: 'total', width: 120, render: (v: number) => v.toLocaleString() },
                { title: '手续费', dataIndex: 'commission', width: 100, render: (v: number) => v.toFixed(2) },
                { title: '占比', dataIndex: 'weight', width: 80, render: (v: number) => `${(v * 100).toFixed(0)}%` },
              ]}
              style={{ marginBottom: 16 }}
            />

            <Divider />
            <div style={{ color: '#999', fontSize: 12, marginBottom: 12 }}>
              {createdAccount.suggestion.advice}
            </div>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => { setAiModal(false); setAiStep('input'); setAiResult(null); setCreatedAccount(null); }}>
                关闭
              </Button>
              <Button type="primary" onClick={() => { setAiModal(false); onTabChange(String(createdAccount.account.id)); }}>
                查看组合
              </Button>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}
