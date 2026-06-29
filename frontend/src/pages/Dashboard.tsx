import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Spin, Statistic, Tag, Typography, Space, Table, Button,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, WalletOutlined,
  RiseOutlined, FallOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import * as echarts from 'echarts';
import { useRef } from 'react';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

interface IndexItem {
  symbol: string;
  name: string;
  market: string;
  price: number;
  change_pct: number;
  prices: { date: string; close: number }[];
}

interface AccountSummary {
  id: number;
  name: string;
  total_asset: number;
  initial_balance: number;
  total_pnl: number;
  pnl_pct: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [indices, setIndices] = useState<IndexItem[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [now, setNow] = useState(new Date());
  const chartRefs = useRef<Record<string, HTMLDivElement>>({});

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [idxRes, accRes] = await Promise.all([
        api.get('/market/indices'),
        api.get('/portfolio/accounts'),
      ]);
      setIndices(idxRes.data || []);
      setAccounts(accRes.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => {
    if (!loading && indices.length > 0) {
      indices.forEach((idx, i) => {
        const el = document.getElementById(`spark-${i}`);
        if (el && idx.prices?.length > 0) {
          const chart = echarts.init(el);
          chart.setOption({
            grid: { left: 0, right: 0, top: 2, bottom: 2 },
            xAxis: { show: false },
            yAxis: { show: false },
            series: [{
              type: 'line',
              data: idx.prices.map(p => p.close),
              smooth: true,
              symbol: 'none',
              lineStyle: { width: 2, color: idx.change_pct >= 0 ? '#ef4444' : '#22c55e' },
              areaStyle: { color: idx.change_pct >= 0 ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)' },
            }],
          });
        }
      });
    }
  }, [loading, indices]);

  const marketTag: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' };
  const totalAsset = accounts.reduce((s, a) => s + a.total_asset, 0);
  const totalPnl = accounts.reduce((s, a) => s + a.total_pnl, 0);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <Title level={4} style={{ marginBottom: 12, marginTop: 0 }}>
        <span style={{ marginRight: 8 }}>📊</span>大盘行情
        <span style={{ fontSize: 12, color: '#999', fontWeight: 400, marginLeft: 12 }}>
          {now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, hour: '2-digit', minute: '2-digit' })}
        </span>
      </Title>

      {/* 指数卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {indices.slice(0, 7).map((idx, i) => (
          <Col xs={12} sm={8} md={6} lg={4} key={idx.symbol}>
            <Card
              hoverable
              size="small"
              className="stat-card"
              style={{
                borderLeft: `4px solid ${idx.change_pct >= 0 ? '#ef4444' : '#22c55e'}`,
                height: 100,
                position: 'relative',
                overflow: 'hidden',
              }}
              bodyStyle={{ padding: '12px 14px' }}
            >
              <div style={{ fontSize: 11, color: '#666', marginBottom: 2 }}>
                <Tag color={marketTag[idx.market]} style={{ fontSize: 10, marginRight: 4 }}>{idx.market}</Tag>
                {idx.name}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace', color: '#1d2129' }}>
                {idx.price > 0 ? idx.price.toLocaleString() : '-'}
              </div>
              <div style={{ fontSize: 12, color: idx.change_pct >= 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>
                {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct}%
              </div>
              <div id={`spark-${i}`} style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 24 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 左: 市场概况 + 快捷入口 | 右: 模拟持仓 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="📈 市场概览" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic title="跟踪指数" value={indices.length} prefix="📊" valueStyle={{ fontSize: 20 }} />
              </Col>
              <Col span={12}>
                <Statistic title="模拟策略" value={accounts.length} prefix="💼" valueStyle={{ fontSize: 20 }} />
              </Col>
              <Col span={8}>
                <Statistic title="A股" value={88} prefix="🇨🇳" valueStyle={{ fontSize: 20 }} />
              </Col>
              <Col span={8}>
                <Statistic title="港股" value={111} prefix="🇭🇰" valueStyle={{ fontSize: 20 }} />
              </Col>
              <Col span={8}>
                <Statistic title="美股" value={50} prefix="🇺🇸" valueStyle={{ fontSize: 20 }} />
              </Col>
            </Row>
          </Card>
          <Card title="🔗 快捷入口" size="small">
            <Row gutter={[12, 12]}>
              <Col span={8}>
                <Button block size="large" onClick={() => navigate('/sectors')}>📂 行业板块</Button>
              </Col>
              <Col span={8}>
                <Button block size="large" onClick={() => navigate('/stocks')}>📈 全部股票</Button>
              </Col>
              <Col span={8}>
                <Button block size="large" onClick={() => navigate('/portfolio')}>💼 模拟交易</Button>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            title={<Space><WalletOutlined /><span>模拟持仓</span></Space>}
            size="small"
            extra={<Button size="small" onClick={() => navigate('/portfolio')}>查看全部 →</Button>}
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Statistic title="总资产" value={totalAsset} precision={2} prefix="¥"
                  valueStyle={{ fontSize: 20, fontFamily: 'monospace' }} />
              </Col>
              <Col span={12}>
                <Statistic title="总盈亏" value={totalPnl} precision={2}
                  prefix={totalPnl >= 0 ? <RiseOutlined /> : <FallOutlined />}
                  valueStyle={{ color: totalPnl >= 0 ? '#ef4444' : '#22c55e', fontSize: 20, fontFamily: 'monospace' }}
                  suffix={
                    <span style={{ fontSize: 12, marginLeft: 4 }}>
                      ({totalAsset > 0 ? ((totalPnl / (totalAsset - totalPnl)) * 100).toFixed(2) : '0'}%)
                    </span>
                  }
                />
              </Col>
            </Row>
            {accounts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                还没有模拟账户<br />
                <Button type="link" onClick={() => navigate('/portfolio')} style={{ marginTop: 8 }}>去创建 →</Button>
              </div>
            ) : (
              <Table dataSource={accounts} rowKey="id" pagination={false} size="small"
                columns={[
                  { title: '组合', key: 'name', render: (_: any, r: AccountSummary) => (
                    <a onClick={() => navigate('/portfolio')} style={{ fontWeight: 600 }}>{r.name}</a>
                  )},
                  { title: '总资产', dataIndex: 'total_asset', render: (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2 }) },
                  { title: '盈亏', dataIndex: 'total_pnl', render: (v: number) => (
                    <span style={{ color: v >= 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{v >= 0 ? '+' : ''}{v.toFixed(2)}</span>
                  )},
                  { title: '收益率', dataIndex: 'pnl_pct', render: (v: number) => (
                    <Tag color={v >= 0 ? 'red' : 'green'}>{v >= 0 ? '+' : ''}{v}%</Tag>
                  )},
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
