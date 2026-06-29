import { useEffect, useState } from 'react';
import {
  Card, Table, Input, Tag, Space, Spin, Typography, Button, Row, Col, Statistic,
} from 'antd';
import {
  SearchOutlined, ArrowUpOutlined, ArrowDownOutlined,
  FundViewOutlined, RobotOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import StockDetailModal from '../components/market/StockDetailModal';

const { Title } = Typography;

const marketTag: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' };

interface StockItem {
  id: number;
  symbol: string;
  name: string;
  market: string;
  sector: string | null;
  industry: string | null;
  pe_ttm: number | null;
  pb: number | null;
  latest_price?: number;
  change_pct?: number;
}

export default function StocksPage() {
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailStockId, setDetailStockId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/market/stocks/all', { params: { limit: 500 } });
      const list: StockItem[] = res.data || [];

      // 补充最新价和涨跌幅
      const enriched = await Promise.all(
        list.map(async (s) => {
          try {
            const detailRes = await api.get(`/analysis/stocks/${s.id}/comprehensive`);
            const d = detailRes.data;
            return { ...s, latest_price: d.latest_price, change_pct: d.change_pct };
          } catch {
            return s;
          }
        })
      );
      setStocks(enriched);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const openDetail = (id: number) => {
    setDetailStockId(id);
    setDetailOpen(true);
  };

  const filtered = search.trim()
    ? stocks.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.symbol.toLowerCase().includes(search.toLowerCase())
      )
    : stocks;

  const columns = [
    {
      title: '代码', dataIndex: 'symbol', width: 100,
      render: (v: string, r: StockItem) => (
        <Space>
          <Tag color={marketTag[r.market]} style={{ fontSize: 11 }}>{r.market}</Tag>
          <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>{v}</span>
        </Space>
      ),
      sorter: (a: StockItem, b: StockItem) => a.symbol.localeCompare(b.symbol),
    },
    {
      title: '名称', dataIndex: 'name', width: 140,
      render: (v: string, r: StockItem) => (
        <a onClick={() => openDetail(r.id)} style={{ fontWeight: 600 }}>{v}</a>
      ),
      sorter: (a: StockItem, b: StockItem) => a.name.localeCompare(b.name),
    },
    {
      title: '现价', dataIndex: 'latest_price', width: 100,
      render: (v: number) => v ? v.toFixed(2) : '-',
      sorter: (a: StockItem, b: StockItem) => (a.latest_price || 0) - (b.latest_price || 0),
    },
    {
      title: '涨跌幅', dataIndex: 'change_pct', width: 100,
      render: (v: number) => v !== undefined ? (
        <span style={{ color: v >= 0 ? '#ef4444' : '#22c55e', fontWeight: 600, fontFamily: 'monospace' }}>
          {v >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
          {' '}{v >= 0 ? '+' : ''}{v.toFixed(2)}%
        </span>
      ) : '-',
      sorter: (a: StockItem, b: StockItem) => (a.change_pct || 0) - (b.change_pct || 0),
    },
    {
      title: 'PE', dataIndex: 'pe_ttm', width: 80,
      render: (v: number | null) => v ? v.toFixed(2) : '-',
      sorter: (a: StockItem, b: StockItem) => (a.pe_ttm || 999) - (b.pe_ttm || 999),
    },
    {
      title: 'PB', dataIndex: 'pb', width: 80,
      render: (v: number | null) => v ? v.toFixed(2) : '-',
      sorter: (a: StockItem, b: StockItem) => (a.pb || 999) - (b.pb || 999),
    },
    {
      title: '行业', dataIndex: 'sector', width: 100,
      render: (v: string | null) => v ? <Tag style={{ fontSize: 11 }}>{v}</Tag> : '-',
      filters: [...new Set(stocks.filter(s => s.sector).map(s => s.sector as string))].map(v => ({ text: v, value: v })),
      onFilter: (val: any, r: StockItem) => r.sector === val,
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: StockItem) => (
        <Space>
          <Button type="link" size="small" icon={<RobotOutlined />}
            onClick={() => openDetail(r.id)}>分析</Button>
          <Button type="link" size="small" icon={<FundViewOutlined />}
            href={`/analysis/${r.id}`}>详情</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
        <span style={{ marginRight: 8 }}>📈</span>全部股票
        <span style={{ fontSize: 12, color: '#999', fontWeight: 400, marginLeft: 12 }}>
          {stocks.length} 只
        </span>
      </Title>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8}>
            <Input
              size="large"
              prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
              placeholder="搜索股票名称或代码..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              allowClear
              style={{ borderRadius: 8 }}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Statistic title="搜索结果" value={filtered.length} suffix={`/ ${stocks.length}`} />
          </Col>
        </Row>
      </Card>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : (
        <Card bodyStyle={{ padding: 0 }}>
          <Table
            dataSource={filtered}
            columns={columns}
            rowKey="id"
            pagination={{ pageSize: 30, showSizeChanger: true, showTotal: (t) => `共 ${t} 只` }}
            size="small"
            scroll={{ x: 800 }}
          />
        </Card>
      )}

      <StockDetailModal
        stockId={detailStockId}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailStockId(null); }}
      />
    </div>
  );
}
