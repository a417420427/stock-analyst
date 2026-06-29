import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Typography, Space, Spin, Button, Row, Col, Statistic,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined,
  ExpandOutlined, CompressOutlined, InfoCircleOutlined, FundViewOutlined,
  RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import StockDetailModal from '../components/market/StockDetailModal';

const { Text } = Typography;

interface StockBrief {
  id: number;
  symbol: string;
  name: string;
  market: string;
  change: number;
}

interface SectorData {
  sector: string;
  count: number;
  avg_pe: number | null;
  avg_pb: number | null;
  avg_change: number;
  stocks: StockBrief[];
}

const marketTag: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' };

function ChangeCell({ value }: { value: number | null | undefined }) {
  const v = Number(value) || 0;
  if (v === 0) return <span style={{ color: '#999' }}>0.00%</span>;
  const isUp = v > 0;
  return (
    <span style={{ color: isUp ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
      {isUp ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(v).toFixed(2)}%
    </span>
  );
}

export default function SectorPage() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [allExpanded, setAllExpanded] = useState(false);
  const [detailStockId, setDetailStockId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => { loadSectors(); }, []);

  const loadSectors = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analysis/sectors');
      setSectors(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const toggleAll = () => {
    if (allExpanded) { setExpandedRowKeys([]); }
    else { setExpandedRowKeys(sectors.map(s => s.sector)); }
    setAllExpanded(!allExpanded);
  };

  // ── 行业涨跌统计 ──
  const topSectors = [...sectors].sort((a, b) => b.avg_change - a.avg_change);
  const upCount = sectors.filter(s => s.avg_change > 0).length;
  const downCount = sectors.filter(s => s.avg_change < 0).length;
  const totalStocks = sectors.reduce((s, sec) => s + sec.count, 0);

  const columns = [
    {
      title: '行业', dataIndex: 'sector', key: 'sector', width: 200,
      render: (name: string) => <Text strong style={{ fontSize: 14 }}>{name}</Text>,
    },
    {
      title: '股票数', dataIndex: 'count', key: 'count', width: 80,
      sorter: (a: SectorData, b: SectorData) => a.count - b.count,
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '平均 PE', dataIndex: 'avg_pe', key: 'avg_pe', width: 100,
      sorter: (a: SectorData, b: SectorData) => (a.avg_pe ?? 0) - (b.avg_pe ?? 0),
      render: (v: number | null) => v != null ? <Text strong>{v.toFixed(2)}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '平均 PB', dataIndex: 'avg_pb', key: 'avg_pb', width: 100,
      sorter: (a: SectorData, b: SectorData) => (a.avg_pb ?? 0) - (b.avg_pb ?? 0),
      render: (v: number | null) => v != null ? <Text strong>{v.toFixed(2)}</Text> : <Text type="secondary">-</Text>,
    },
    {
      title: '涨跌幅', dataIndex: 'avg_change', key: 'avg_change', width: 120,
      sorter: (a: SectorData, b: SectorData) => a.avg_change - b.avg_change,
      render: (v: number) => <ChangeCell value={v} />,
    },
  ];

  const expandedRowRender = (record: SectorData) => {
    const subColumns = [
      { title: '市场', dataIndex: 'market', key: 'market', width: 60, render: (m: string) => <Tag color={marketTag[m]}>{m}</Tag> },
      { title: '代码', dataIndex: 'symbol', key: 'symbol', width: 80 },
      { title: '名称', dataIndex: 'name', key: 'name', render: (v: string) => <Text strong>{v}</Text> },
      { title: '涨跌幅', dataIndex: 'change', key: 'change', width: 100, render: (v: number) => <ChangeCell value={v} /> },
      {
        title: '操作', key: 'action', width: 120,
        render: (_: unknown, r: StockBrief) => (
          <Space>
            <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => { setDetailStockId(r.id); setDetailOpen(true); }}>详情</Button>
            <Button type="link" size="small" icon={<FundViewOutlined />} href={`/analysis/${r.id}`}>分析</Button>
          </Space>
        ),
      },
    ];
    return (
      <Table dataSource={record.stocks} columns={subColumns} rowKey="id" pagination={false} size="small" bordered={false} />
    );
  };

  return (
    <Spin spinning={loading}>
      {/* 行业涨跌统计 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small" className="stat-card">
            <Statistic title="行业总数" value={sectors.length} prefix="🏢" valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="stat-card">
            <Statistic title="上涨 / 下跌" value={`${upCount} / ${downCount}`}
              prefix={upCount >= downCount ? <RiseOutlined style={{ color: '#ef4444' }} /> : <FallOutlined style={{ color: '#22c55e' }} />}
              valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="stat-card">
            <Statistic title="总标的数" value={totalStocks} prefix="📦" valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" className="stat-card">
            <Statistic title="最强行业" value={topSectors[0]?.sector || '-'} prefix="🥇"
              valueStyle={{ fontSize: 16, fontWeight: 600 }} />
          </Card>
        </Col>
      </Row>

      {/* 涨跌前三 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card size="small" title="🔥 涨幅前3" style={{ borderTop: '3px solid #ef4444' }}>
            {topSectors.slice(0, 3).map((s, i) => (
              <div key={s.sector} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>{i + 1}. {s.sector}</span>
                <span style={{ color: '#ef4444', fontWeight: 600 }}>+{Math.abs(s.avg_change).toFixed(2)}%</span>
              </div>
            ))}
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" title="🧊 跌幅前3" style={{ borderTop: '3px solid #22c55e' }}>
            {topSectors.slice(-3).reverse().map((s, i) => (
              <div key={s.sector} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                <span>{i + 1}. {s.sector}</span>
                <span style={{ color: '#22c55e', fontWeight: 600 }}>-{Math.abs(s.avg_change).toFixed(2)}%</span>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {/* 行业详细列表 */}
      <Card
        title={<Space><span>🏢 行业明细</span></Space>}
        extra={
          <Space>
            <Button size="small" onClick={toggleAll} icon={allExpanded ? <CompressOutlined /> : <ExpandOutlined />}>
              {allExpanded ? '全部折叠' : '全部展开'}
            </Button>
          </Space>
        }
      >
        <Table
          dataSource={sectors}
          columns={columns}
          rowKey="sector"
          pagination={false}
          size="middle"
          expandable={{
            expandedRowRender,
            expandedRowKeys,
            onExpandedRowsChange: (keys: readonly React.Key[]) => {
              setExpandedRowKeys(keys as string[]);
              setAllExpanded(keys.length === sectors.length);
            },
          }}
        />
      </Card>

      <StockDetailModal
        stockId={detailStockId}
        open={detailOpen}
        onClose={() => { setDetailOpen(false); setDetailStockId(null); }}
      />
    </Spin>
  );
}
