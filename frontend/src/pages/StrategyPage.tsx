import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, Modal, Form, Input, Select,
  Switch, message, Popconfirm, List, Divider, Tooltip,
} from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, PauseCircleOutlined,
  DeleteOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { TextArea } = Input;

// 条件类型定义
const CONDITION_TYPES = [
  { value: 'price_above', label: '📈 价格突破', desc: '价格高于指定值' },
  { value: 'price_below', label: '📉 价格跌破', desc: '价格低于指定值' },
  { value: 'price_change_pct', label: '📊 涨跌幅阈值', desc: '单日涨跌幅超过 X%' },
  { value: 'volume_surge', label: '📶 成交量放大', desc: '成交量超过均值的 N 倍' },
  { value: 'ma_cross', label: '🔀 均线金叉/死叉', desc: '短期均线上穿/下穿长期均线' },
  { value: 'macd_cross', label: '🔀 MACD 金叉/死叉', desc: 'DIF 上穿/下穿 DEA' },
  { value: 'rsi_threshold', label: '📊 RSI 超买超卖', desc: 'RSI 低于阈值回升或高于阈值回落' },
  { value: 'bollinger_break', label: '📊 布林带突破', desc: '价格突破布林带上轨/下轨' },
  { value: 'trend_score', label: '📈 趋势评分', desc: '多维度趋势一致性评分超过阈值' },
  { value: 'ai_judge', label: '🤖 AI 判断', desc: '用 AI 分析判断条件（需配置 AI Key）' },
  { value: 'always', label: '⏰ 定时推送', desc: '始终触发（用于定时简报）' },
];

const DIRECTION_OPTIONS: Record<string, { value: string; label: string }[]> = {
  price_change_pct: [
    { value: 'above', label: '上涨' },
    { value: 'below', label: '下跌' },
  ],
  ma_cross: [
    { value: 'golden', label: '金叉（上穿）' },
    { value: 'dead', label: '死叉（下穿）' },
  ],
  macd_cross: [
    { value: 'golden', label: '金叉（上穿）' },
    { value: 'dead', label: '死叉（下穿）' },
  ],
  rsi_threshold: [
    { value: 'oversold', label: '超卖反弹' },
    { value: 'overbought', label: '超买回落' },
  ],
  bollinger_break: [
    { value: 'upper', label: '突破上轨' },
    { value: 'lower', label: '跌破下轨' },
  ],
  trend_score: [
    { value: 'above', label: '看涨（正向高分）' },
    { value: 'below', label: '看跌（负向高分）' },
  ],
};

interface Strategy {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  definition: any;
  scan_schedule: string;
  scan_interval: number;
  last_triggered_at: string | null;
  created_at: string;
}

interface Trigger {
  id: number;
  strategy_id: number;
  stock_id: number;
  trigger_data: any;
  pushed: boolean;
  triggered_at: string;
}

interface Stock {
  id: number;
  symbol: string;
  name: string;
  market: string;
}

const scheduleLabels: Record<string, string> = {
  pre_market: '盘前',
  intraday: '盘中(每5分钟)',
  post_market: '盘后',
  daily: '每日一次',
};

const condLabel = (type: string) => CONDITION_TYPES.find(c => c.value === type)?.label || type;

export default function StrategyPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [triggers, setTriggers] = useState<Trigger[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<number | null>(null);
  const [allStocks, setAllStocks] = useState<Stock[]>([]);
  const [form] = Form.useForm();

  // 条件动态表单
  const [condType, setCondType] = useState('price_change_pct');
  const [multiCond, setMultiCond] = useState<{ type: string; params: any }[]>([
    { type: 'price_change_pct', params: { direction: 'above', threshold: 3, days: 1 } },
  ]);

  useEffect(() => {
    loadStrategies();
    loadStocks();
  }, []);

  const loadStrategies = async () => {
    try {
      const res = await api.get('/strategies/');
      setStrategies(res.data);
    } catch { message.error('加载策略失败'); }
  };

  const loadStocks = async () => {
    try {
      const res = await api.get('/market/stocks/all', { params: { limit: 500 } });
      setAllStocks(res.data || []);
    } catch { /* ignore */ }
  };

  const loadTriggers = async (strategyId: number) => {
    try {
      const res = await api.get(`/strategies/${strategyId}/triggers`);
      setTriggers(res.data);
      setSelectedStrategy(strategyId);
    } catch { message.error('加载触发记录失败'); }
  };

  const handleCreate = async (values: any) => {
    // 从多条件构建
    const definition = {
      conditions: multiCond.map(c => ({ type: c.type, params: c.params })),
      logic: values.logic || 'AND',
      actions: [{ type: 'notify', channel: values.channel || 'feishu' }],
      cooldown_minutes: values.cooldown || 15,
      stock_ids: values.stock_ids || [],
    };

    try {
      await api.post('/strategies/', {
        name: values.name,
        description: values.description,
        definition,
        scan_schedule: values.schedule || 'intraday',
        scan_interval: values.interval || 300,
      });
      message.success('策略创建成功');
      setCreateModalOpen(false);
      setMultiCond([{ type: 'price_change_pct', params: { direction: 'above', threshold: 3, days: 1 } }]);
      form.resetFields();
      loadStrategies();
    } catch { message.error('创建失败'); }
  };

  const toggleActive = async (s: Strategy) => {
    try {
      await api.patch(`/strategies/${s.id}`, { is_active: !s.is_active });
      loadStrategies();
    } catch { message.error('操作失败'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/strategies/${id}`);
      message.success('删除成功');
      loadStrategies();
    } catch { message.error('删除失败'); }
  };

  // 更新单个条件的参数
  const updateCond = (index: number, field: string, value: any) => {
    const newConds = [...multiCond];
    if (field === 'type') {
      newConds[index] = { type: value, params: {} };
    } else {
      newConds[index] = { ...newConds[index], params: { ...newConds[index].params, [field]: value } };
    }
    setMultiCond(newConds);
  };

  const addCondition = () => {
    setMultiCond([...multiCond, { type: 'price_change_pct', params: { direction: 'above', threshold: 3 } }]);
  };

  const removeCondition = (index: number) => {
    if (multiCond.length <= 1) return;
    setMultiCond(multiCond.filter((_, i) => i !== index));
  };

  const strategyColumns = [
    {
      title: '状态',
      dataIndex: 'is_active',
      width: 70,
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'default'}>{active ? '运行' : '暂停'}</Tag>
      ),
    },
    { title: '策略名称', dataIndex: 'name', key: 'name' },
    {
      title: '条件',
      key: 'conditions',
      width: 200,
      render: (_: any, record: Strategy) => {
        const conds = record.definition?.conditions || [];
        return (
          <Space size={4} wrap>
            {conds.map((c: any, i: number) => (
              <Tooltip key={i} title={JSON.stringify(c.params)}>
                <Tag color="blue" style={{ fontSize: 11 }}>{condLabel(c.type)}</Tag>
              </Tooltip>
            ))}
            {conds.length > 1 && (
              <Tag color="orange" style={{ fontSize: 11 }}>
                {record.definition?.logic || 'AND'}
              </Tag>
            )}
          </Space>
        );
      },
    },
    {
      title: '时段',
      dataIndex: 'scan_schedule',
      width: 100,
      render: (s: string) => <Tag style={{ fontSize: 11 }}>{scheduleLabels[s] || s}</Tag>,
    },
    {
      title: '冷却',
      dataIndex: 'definition',
      width: 60,
      render: (d: any) => `${d?.cooldown_minutes || '-'}分`,
    },
    {
      title: '最后触发',
      dataIndex: 'last_triggered_at',
      width: 130,
      render: (t: string | null) => t ? dayjs(t).format('MM-DD HH:mm') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_: any, record: Strategy) => (
        <Space>
          <Button type="link" size="small"
            icon={record.is_active ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
            onClick={() => toggleActive(record)}>
            {record.is_active ? '暂停' : '启用'}
          </Button>
          <Button type="link" size="small" onClick={() => loadTriggers(record.id)}>记录</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <span>⚡ 策略引擎</span>
            <Tag color="purple" style={{ fontSize: 11 }}>{strategies.length} 个策略</Tag>
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
            新建策略
          </Button>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          dataSource={strategies}
          columns={strategyColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
        {strategies.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
            还没有策略，点击右上角新建一个
          </div>
        )}
      </Card>

      {/* 触发记录 */}
      {selectedStrategy && (
        <Card
          title="📋 触发记录"
          extra={<Button size="small" onClick={() => setSelectedStrategy(null)}>关闭</Button>}
          style={{ marginBottom: 16 }}
        >
          {triggers.length === 0 ? (
            <span style={{ color: '#999' }}>暂无触发记录</span>
          ) : (
            <Table
              dataSource={triggers}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: '时间', dataIndex: 'triggered_at', width: 150,
                  render: (t: string) => dayjs(t).format('MM-DD HH:mm:ss'),
                },
                {
                  title: '推送', dataIndex: 'pushed', width: 70,
                  render: (p: boolean) => <Tag color={p ? 'green' : 'orange'}>{p ? '已推送' : '待推送'}</Tag>,
                },
                {
                  title: '摘要', key: 'summary',
                  render: (_: any, r: Trigger) => {
                    const d = r.trigger_data;
                    if (!d) return '-';
                    const parts: string[] = [];
                    if (d.price) parts.push(`价格: ${d.price}`);
                    if (d.change_pct) parts.push(`涨跌: ${d.change_pct}%`);
                    if (d.volume_ratio) parts.push(`量比: ${d.volume_ratio}`);
                    if (d.rsi) parts.push(`RSI: ${d.rsi}`);
                    if (d.trend) parts.push(`趋势: ${d.trend.composite}`);
                    return parts.join(' | ') || JSON.stringify(d.conditions_summary);
                  },
                },
              ]}
            />
          )}
        </Card>
      )}

      {/* 新建策略弹窗 */}
      <Modal
        title="新建策略"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
        width={680}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="策略名称" rules={[{ required: true }]}>
            <Input placeholder="如：茅台 MACD 金叉监控" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="可选：描述这个策略的用途" />
          </Form.Item>

          <Divider orientation="left" plain>触发条件（支持多条件组合）</Divider>

          {multiCond.map((cond, i) => (
            <Card
              key={i}
              size="small"
              style={{ marginBottom: 8, background: '#fafafa' }}
              title={`条件 ${i + 1}`}
              extra={multiCond.length > 1 && (
                <Button type="link" size="small" danger onClick={() => removeCondition(i)}>
                  删除
                </Button>
              )}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Select
                  value={cond.type}
                  onChange={(v) => updateCond(i, 'type', v)}
                  style={{ width: '100%' }}
                  options={CONDITION_TYPES.map(c => ({
                    value: c.value,
                    label: `${c.label} — ${c.desc}`,
                  }))}
                />

                {/* 根据条件类型显示不同参数 */}
                <Space wrap>
                  {/* 涨跌幅参数 */}
                  {(cond.type === 'price_change_pct') && (
                    <>
                      <Select
                        value={cond.params.direction || 'above'}
                        onChange={(v) => updateCond(i, 'direction', v)}
                        style={{ width: 100 }}
                        options={DIRECTION_OPTIONS.price_change_pct}
                      />
                      <span>超过</span>
                      <Input
                        type="number"
                        value={cond.params.threshold || 3}
                        onChange={(e) => updateCond(i, 'threshold', parseFloat(e.target.value))}
                        style={{ width: 80 }}
                        suffix="%"
                      />
                      <Select
                        value={cond.params.days || 1}
                        onChange={(v) => updateCond(i, 'days', v)}
                        style={{ width: 100 }}
                        options={[
                          { value: 1, label: '较昨日' },
                          { value: 5, label: '较5日前' },
                          { value: 20, label: '较20日前' },
                        ]}
                      />
                    </>
                  )}

                  {/* 成交量参数 */}
                  {cond.type === 'volume_surge' && (
                    <>
                      <span>超过均值的</span>
                      <Input
                        type="number"
                        value={cond.params.ratio || 2}
                        onChange={(e) => updateCond(i, 'ratio', parseFloat(e.target.value))}
                        style={{ width: 80 }}
                        suffix="倍"
                      />
                      <span>参考</span>
                      <Select
                        value={cond.params.lookback || 20}
                        onChange={(v) => updateCond(i, 'lookback', v)}
                        style={{ width: 100 }}
                        options={[
                          { value: 10, label: '近10日' },
                          { value: 20, label: '近20日' },
                          { value: 60, label: '近60日' },
                        ]}
                      />
                    </>
                  )}

                  {/* 均线交叉参数 */}
                  {cond.type === 'ma_cross' && (
                    <>
                      <Select
                        value={cond.params.direction || 'golden'}
                        onChange={(v) => updateCond(i, 'direction', v)}
                        style={{ width: 120 }}
                        options={DIRECTION_OPTIONS.ma_cross}
                      />
                      <span>快线</span>
                      <Input
                        type="number"
                        value={cond.params.fast_period || 5}
                        onChange={(e) => updateCond(i, 'fast_period', parseInt(e.target.value))}
                        style={{ width: 70 }}
                      />
                      <span>日 / 慢线</span>
                      <Input
                        type="number"
                        value={cond.params.slow_period || 20}
                        onChange={(e) => updateCond(i, 'slow_period', parseInt(e.target.value))}
                        style={{ width: 70 }}
                      />
                      <span>日</span>
                    </>
                  )}

                  {/* MACD 交叉 */}
                  {cond.type === 'macd_cross' && (
                    <Select
                      value={cond.params.direction || 'golden'}
                      onChange={(v) => updateCond(i, 'direction', v)}
                      style={{ width: 150 }}
                      options={DIRECTION_OPTIONS.macd_cross}
                    />
                  )}

                  {/* RSI */}
                  {cond.type === 'rsi_threshold' && (
                    <>
                      <Select
                        value={cond.params.direction || 'oversold'}
                        onChange={(v) => updateCond(i, 'direction', v)}
                        style={{ width: 130 }}
                        options={DIRECTION_OPTIONS.rsi_threshold}
                      />
                      <span>阈值</span>
                      <Input
                        type="number"
                        value={cond.params.threshold || 30}
                        onChange={(e) => updateCond(i, 'threshold', parseInt(e.target.value))}
                        style={{ width: 70 }}
                      />
                    </>
                  )}

                  {/* 布林带 */}
                  {cond.type === 'bollinger_break' && (
                    <Select
                      value={cond.params.direction || 'upper'}
                      onChange={(v) => updateCond(i, 'direction', v)}
                      style={{ width: 150 }}
                      options={DIRECTION_OPTIONS.bollinger_break}
                    />
                  )}

                  {/* AI 判断 */}
                  {cond.type === 'ai_judge' && (
                    <div style={{ width: '100%' }}>
                      <Input.TextArea
                        value={cond.params.prompt || ''}
                        onChange={(e) => updateCond(i, 'prompt', e.target.value)}
                        placeholder="输入判断条件，例如：该股近期是否有利好趋势？成交量是否异常？"
                        rows={3}
                        style={{ width: '100%' }}
                      />
                      <div style={{ color: '#999', fontSize: 12, marginTop: 4 }}>
                        AI 将根据股票数据和你的描述进行判断（需在 AI 设置中配置 API Key）
                      </div>
                    </div>
                  )}

                  {/* 趋势评分 */}
                  {cond.type === 'trend_score' && (
                    <>
                      <Select
                        value={cond.params.direction || 'above'}
                        onChange={(v) => updateCond(i, 'direction', v)}
                        style={{ width: 150 }}
                        options={DIRECTION_OPTIONS.trend_score}
                      />
                      <span>阈值</span>
                      <Input
                        type="number"
                        value={cond.params.threshold || 60}
                        onChange={(e) => updateCond(i, 'threshold', parseInt(e.target.value))}
                        style={{ width: 70 }}
                      />
                    </>
                  )}

                  {/* 价格突破参数 */}
                  {(cond.type === 'price_above' || cond.type === 'price_below') && (
                    <>
                      <span>价格</span>
                      <Input
                        type="number"
                        value={cond.params.threshold || 0}
                        onChange={(e) => updateCond(i, 'threshold', parseFloat(e.target.value))}
                        style={{ width: 120 }}
                      />
                    </>
                  )}
                </Space>
              </Space>
            </Card>
          ))}

          <Button type="dashed" onClick={addCondition} block style={{ marginBottom: 12 }}>
            + 添加条件
          </Button>

          <Form.Item name="logic" label="条件组合逻辑" initialValue="AND">
            <Select
              options={[
                { value: 'AND', label: '所有条件同时满足(AND)' },
                { value: 'OR', label: '任一条件满足(OR)' },
              ]}
            />
          </Form.Item>

          <Divider orientation="left" plain>策略设置</Divider>

          <Space wrap>
            <Form.Item name="schedule" label="运行时段" initialValue="intraday">
              <Select style={{ width: 160 }}
                options={[
                  { value: 'intraday', label: '盘中 (每5分钟)' },
                  { value: 'pre_market', label: '盘前' },
                  { value: 'post_market', label: '盘后' },
                  { value: 'daily', label: '每日一次' },
                ]}
              />
            </Form.Item>
            <Form.Item name="channel" label="推送通道" initialValue="feishu">
              <Select style={{ width: 130 }}
                options={[
                  { value: 'feishu', label: '飞书' },
                  { value: 'telegram', label: 'Telegram' },
                  { value: 'email', label: '邮件' },
                  { value: 'dingtalk', label: '钉钉' },
                ]}
              />
            </Form.Item>
            <Form.Item name="cooldown" label="冷却(分钟)" initialValue={15}>
              <Input type="number" style={{ width: 80 }} />
            </Form.Item>
          </Space>

          <Form.Item name="stock_ids" label="监控标的（留空则监控全部自选股）">
            <Select
              mode="multiple"
              placeholder="选择要监控的股票（可选）"
              style={{ width: '100%' }}
              allowClear
              showSearch
              filterOption={(input, option) =>
                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
              }
              options={allStocks.map(s => ({
                value: s.id,
                label: `${s.name} (${s.symbol}.${s.market})`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
