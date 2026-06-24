import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Space, Spin, Collapse, Button } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined,
  ExpandOutlined, CompressOutlined, InfoCircleOutlined,
} from '@ant-design/icons';
import api from '../services/api';
import StockDetailModal from '../components/market/StockDetailModal';

const { Text } = Typography;

interface StockBrief {
  id: number;
  symbol: string;
  name: string;
  market: string;
  change_pct: number;
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

// ─── Cell renderers ──────────────────────────────

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

function RatioCell({ value }: { value: number | null; suffix?: string }) {
  if (value == null) return <Text type="secondary">-</Text>;
  return <Text strong>{value.toFixed(2)}</Text>;
}

// ─── Main Component ──────────────────────────────

export default function SectorPage() {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [allExpanded, setAllExpanded] = useState(false);
  const [detailStockId, setDetailStockId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    loadSectors();
  }, []);

  const loadSectors = async () => {
    setLoading(true);
    try {
      const res = await api.get('/analysis/sectors');
      setSectors(res.data || []);
    } catch (err) {
      console.error('Load sectors error:', err);
    }
    setLoading(false);
  };

  const toggleAll = () => {
    if (allExpanded) {
      setExpandedRowKeys([]);
    } else {
      setExpandedRowKeys(sectors.map(s => s.sector));
    }
    setAllExpanded(!allExpanded);
  };

  const columns = [
    {
      title: '行业',
      dataIndex: 'sector',
      key: 'sector',
      width: 200,
      render: (name: string) => (
        <Text strong style={{ fontSize: 14 }}>{name}</Text>
      ),
    },
    {
      title: '股票数',
      dataIndex: 'count',
      key: 'count',
      width: 100,
      sorter: (a: SectorData, b: SectorData) => a.count - b.count,
      render: (v: number) => <Tag color="blue">{v}</Tag>,
    },
    {
      title: '平均 PE',
      dataIndex: 'avg_pe',
      key: 'avg_pe',
      width: 120,
      sorter: (a: SectorData, b: SectorData) => (a.avg_pe ?? 0) - (b.avg_pe ?? 0),
      render: (v: number | null) => <RatioCell value={v} />,
    },
    {
      title: '平均 PB',
      dataIndex: 'avg_pb',
      key: 'avg_pb',
      width: 120,
      sorter: (a: SectorData, b: SectorData) => (a.avg_pb ?? 0) - (b.avg_pb ?? 0),
      render: (v: number | null) => <RatioCell value={v} />,
    },
    {
      title: '平均涨跌幅',
      dataIndex: 'avg_change',
      key: 'avg_change',
      width: 140,
      sorter: (a: SectorData, b: SectorData) => a.avg_change - b.avg_change,
      render: (v: number) => <ChangeCell value={v} />,
    },
  ];

  // ─── Expanded row (子表：行业下股票列表) ─────

  const expandedRowRender = (record: SectorData) => {
    const subColumns = [
      {
        title: '市场',
        dataIndex: 'market',
        key: 'market',
        width: 70,
        render: (m: string) => <Tag color={marketTag[m]}>{m}</Tag>,
      },
      { title: '代码', dataIndex: 'symbol', key: 'symbol', width: 100 },
      { title: '名称', dataIndex: 'name', key: 'name' },
      {
        title: '涨跌幅',
        dataIndex: 'change',
        key: 'change',
        width: 120,
        render: (v: number) => <ChangeCell value={v} />,
      },
      {
        title: '操作',
        key: 'action',
        width: 140,
        render: (_: unknown, r: StockBrief) => (
          <Space>
            <Button type="link" size="small" icon={<InfoCircleOutlined />} onClick={() => { setDetailStockId(r.id); setDetailOpen(true); }}>
              详情
            </Button>
            <Button type="link" size="small" href={`/analysis/${r.id}`}>
              分析
            </Button>
          </Space>
        ),
      },
    ];

    return (
      <Table
        dataSource={record.stocks}
        columns={subColumns}
        rowKey="id"
        pagination={false}
        size="small"
        bordered={false}
        style={{ margin: 0 }}
      />
    );
  };

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Space>
            <span>🏢 行业板块分析</span>
          </Space>
        }
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

      {/* 股票详情弹窗 */}
      <StockDetailModal
        stockId={detailStockId}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailStockId(null);
        }}
      />
    </Spin>
  );
}
