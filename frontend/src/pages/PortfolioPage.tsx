import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Space, message, Modal, Form, Input, Select,
  InputNumber, Statistic, Row, Col, Descriptions, Popconfirm,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

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
  traded_at: string;
  note: string | null;
}

interface Position {
  stock_id: number;
  symbol: string;
  name: string;
  market: string;
  quantity: number;
  cost: number;
  current_price: number;
  market_value: number;
  pnl: number;
  pnl_pct: number;
}

interface PortfolioData {
  trades: Trade[];
  positions: Position[];
}

const marketTag: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' };

export default function PortfolioPage() {
  const [data, setData] = useState<PortfolioData>({ trades: [], positions: [] });
  const [loading, setLoading] = useState(true);
  const [allStocks, setAllStocks] = useState<any[]>([]);
  const [addModal, setAddModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
    loadStocks();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/portfolio/trades');
      setData(res.data);
    } catch { message.error('加载持仓失败'); }
    setLoading(false);
  };

  const loadStocks = async () => {
    try {
      const res = await api.get('/market/stocks/all', { params: { limit: 500 } });
      setAllStocks(res.data || []);
    } catch { /* ignore */ }
  };

  const handleAdd = async (values: any) => {
    try {
      await api.post('/portfolio/trades', {
        stock_id: values.stock_id,
        side: values.side,
        quantity: values.quantity,
        price: values.price || undefined,
        note: values.note || undefined,
      });
      message.success('交易已记录');
      setAddModal(false);
      form.resetFields();
      loadData();
    } catch { message.error('记录失败'); }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.delete(`/portfolio/trades/${id}`);
      message.success('已删除');
      loadData();
    } catch { message.error('删除失败'); }
  };

  const totalPnl = data.positions.reduce((s, p) => s + p.pnl, 0);
  const totalValue = data.positions.reduce((s, p) => s + p.market_value, 0);

  const tradeColumns = [
    { title: '时间', dataIndex: 'traded_at', width: 150, render: (t: string) => dayjs(t).format('MM-DD HH:mm') },
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
      title: '价格', dataIndex: 'price', width: 100,
      render: (p: number) => `¥${p.toFixed(2)}`,
    },
    {
      title: '金额', dataIndex: 'total', width: 120,
      render: (t: number) => `¥${t.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      title: '操作', key: 'action', width: 60,
      render: (_: any, r: Trade) => (
        <Popconfirm title="删除这条记录？" onConfirm={() => handleDelete(r.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  const positionColumns = [
    {
      title: '标的', key: 'stock', width: 200,
      render: (_: any, r: Position) => (
        <Space>
          <Tag color={marketTag[r.market]}>{r.market}</Tag>
          <a href={`/analysis/${r.stock_id}`}><span>{r.name}</span></a>
          <span style={{ color: '#999', fontSize: 12 }}>{r.symbol}</span>
        </Space>
      ),
    },
    { title: '持仓', dataIndex: 'quantity', width: 80 },
    { title: '均价', dataIndex: 'cost', width: 100, render: (v: number) => v.toFixed(2) },
    { title: '现价', dataIndex: 'current_price', width: 100, render: (v: number) => v.toFixed(2) },
    { title: '市值', dataIndex: 'market_value', width: 120, render: (v: number) => v.toLocaleString() },
    {
      title: '盈亏', dataIndex: 'pnl', width: 120,
      render: (v: number) => (
        <span style={{ color: v >= 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
          {v >= 0 ? '+' : ''}{v.toFixed(2)}
        </span>
      ),
    },
    {
      title: '收益率', dataIndex: 'pnl_pct', width: 100,
      render: (v: number) => (
        <Tag color={v >= 0 ? 'red' : 'green'}>{v >= 0 ? '+' : ''}{v.toFixed(2)}%</Tag>
      ),
    },
  ];

  return (
    <div>
      {/* 汇总卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic title="持仓市值" value={totalValue} precision={2}
              prefix="¥" valueStyle={{ color: '#1d2129' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic title="总盈亏" value={totalPnl} precision={2}
              prefix={totalPnl >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: totalPnl >= 0 ? '#ef4444' : '#22c55e' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card className="stat-card">
            <Statistic title="持仓数" value={data.positions.length}
              prefix="📦" valueStyle={{ color: '#1d2129' }} />
          </Card>
        </Col>
      </Row>

      {/* 持仓列表 */}
      <Card title="📦 当前持仓" style={{ marginBottom: 16 }}>
        {data.positions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 30, color: '#999' }}>
            还没有持仓，点击右上角记录一笔买入
          </div>
        ) : (
          <Table
            dataSource={data.positions}
            columns={positionColumns}
            rowKey="symbol"
            pagination={false}
            size="small"
          />
        )}
      </Card>

      {/* 交易记录 */}
      <Card
        title="📋 交易记录"
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddModal(true)}>
            记录交易
          </Button>
        }
      >
        <Table
          dataSource={data.trades}
          columns={tradeColumns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>

      {/* 新增交易弹窗 */}
      <Modal
        title="记录模拟交易"
        open={addModal}
        onCancel={() => setAddModal(false)}
        onOk={() => form.submit()}
        okText="记录"
        cancelText="取消"
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleAdd}>
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
          <Space>
            <Form.Item name="quantity" label="数量" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: 140 }} />
            </Form.Item>
            <Form.Item name="price" label="价格（留空自动取最新价）">
              <InputNumber min={0.01} step={0.01} style={{ width: 160 }} />
            </Form.Item>
          </Space>
          <Form.Item name="note" label="备注">
            <Input placeholder="可选备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
