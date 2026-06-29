import { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Space, Tooltip, Select } from 'antd';
import { RobotOutlined, SwapOutlined, ClockCircleOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface LogItem {
  id: number;
  action: string;
  level: string;
  title: string;
  detail: any;
  created_at: string;
}

const actionConfig: Record<string, { icon: any; color: string; label: string }> = {
  ai_pick: { icon: <RobotOutlined />, color: 'purple', label: 'AI 选股' },
  trade: { icon: <SwapOutlined />, color: 'blue', label: '交易' },
};

export default function ActivityLogPage() {
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('');

  useEffect(() => { loadLogs(); }, [actionFilter]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params: any = { limit: 100 };
      if (actionFilter) params.action = actionFilter;
      const res = await api.get('/logs', { params });
      setLogs(res.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const columns = [
    {
      title: '时间', dataIndex: 'created_at', width: 160,
      render: (t: string) => (
        <Space>
          <ClockCircleOutlined style={{ color: '#999', fontSize: 11 }} />
          <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{dayjs(t).format('MM-DD HH:mm:ss')}</span>
        </Space>
      ),
    },
    {
      title: '操作', dataIndex: 'action', width: 100,
      render: (a: string) => {
        const cfg = actionConfig[a];
        return cfg ? <Tag icon={cfg.icon} color={cfg.color}>{cfg.label}</Tag> : <Tag>{a}</Tag>;
      },
    },
    {
      title: '标题', dataIndex: 'title', width: 300,
      render: (t: string, r: LogItem) => (
        <Text strong>{t}</Text>
      ),
    },
    {
      title: '详情', key: 'detail',
      render: (_: any, r: LogItem) => {
        if (!r.detail) return '-';
        if (r.action === 'trade') {
          return (
            <Space size={4} wrap>
              <Tag color={r.detail.side === 'buy' ? 'red' : 'green'}>
                {r.detail.side === 'buy' ? '买入' : '卖出'}
              </Tag>
              <span style={{ fontSize: 12 }}>{r.detail.quantity}股</span>
              <span style={{ fontSize: 12, fontFamily: 'monospace' }}>@{r.detail.price}</span>
              {r.detail.commission > 0 && (
                <span style={{ fontSize: 11, color: '#999' }}>手续: {r.detail.commission}</span>
              )}
            </Space>
          );
        }
        if (r.action === 'ai_pick') {
          const trades = r.detail?.trades || [];
          return (
            <Tooltip title={
              <div>
                {trades.map((t: any, i: number) => (
                  <div key={i}>{t.name} ({t.symbol}): {t.weight * 100}% = ¥{t.total?.toLocaleString()}</div>
                ))}
              </div>
            }>
              <span style={{ fontSize: 12, color: '#666', cursor: 'pointer' }}>
                {trades.length}只股票 | 投入 ¥{trades.reduce((s: number, t: any) => s + (t.total || 0), 0).toLocaleString()}
              </span>
            </Tooltip>
          );
        }
        return <span style={{ fontSize: 12, color: '#666' }}>{JSON.stringify(r.detail).slice(0, 100)}</span>;
      },
    },
  ];

  return (
    <div>
      <Title level={4} style={{ marginTop: 0, marginBottom: 16 }}>
        <span style={{ marginRight: 8 }}>📋</span>操作日志
      </Title>

      <Card
        bodyStyle={{ padding: '12px 20px', marginBottom: 16 }}
      >
        <Space>
          <span style={{ fontWeight: 600 }}>筛选：</span>
          <Select
            value={actionFilter || 'all'}
            onChange={v => setActionFilter(v === 'all' ? '' : v)}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部操作' },
              { value: 'ai_pick', label: 'AI 选股' },
              { value: 'trade', label: '交易' },
            ]}
          />
          <span style={{ color: '#999', fontSize: 12 }}>共 {logs.length} 条记录</span>
        </Space>
      </Card>

      <Card bodyStyle={{ padding: 0 }}>
        <Table
          dataSource={logs}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}
