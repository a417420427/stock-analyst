import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Spin, Statistic, Tag, Typography, Space, Table, Button,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, WalletOutlined,
  RiseOutlined, FallOutlined, SwapOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title } = Typography;

interface IndexData {
  name: string;
  symbol: string;
  price: number;
  change_pct: number;
  change: number;
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
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    loadData();
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 大盘指数 — 获取主要指数的价格
      const indexSymbols: { name: string; symbol: string }[] = [
        { name: '沪深300', symbol: '000300' },
        { name: '上证指数', symbol: '000001' },
        { name: '深证成指', symbol: '399001' },
        { name: '创业板指', symbol: '399006' },
      ];

      const indexResults = await Promise.allSettled(
        indexSymbols.map(async (idx) => {
          try {
            const res = await api.get('/market/search', { params: { q: idx.name } });
            return null; // 后端没有指数API，用模拟或ETF代替
          } catch { return null; }
        })
      );

      // 用模拟数据填充指数
      setIndices([
        { name: '沪深300', symbol: '000300', price: 4215.67, change_pct: 1.23, change: 51.23 },
        { name: '上证指数', symbol: '000001', price: 3128.45, change_pct: 0.76, change: 23.56 },
        { name: '深证成指', symbol: '399001', price: 10432.18, change_pct: -0.34, change: -35.67 },
        { name: '创业板指', symbol: '399006', price: 2156.89, change_pct: 1.89, change: 40.12 },
      ]);

      // 模拟持仓统计
      const accRes = await api.get('/portfolio/accounts');
      setAccounts(accRes.data || []);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const marketTag = (m: string) => m === 'A' ? 'blue' : m === 'HK' ? 'purple' : 'green';

  const totalAsset = accounts.reduce((s, a) => s + a.total_asset, 0);
  const totalPnl = accounts.reduce((s, a) => s + a.total_pnl, 0);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      {/* 大盘指数 */}
      <Title level={4} style={{ marginBottom: 12, marginTop: 0 }}>
        <span style={{ marginRight: 8 }}>📊</span>大盘行情
        <span style={{ fontSize: 12, color: '#999', fontWeight: 400, marginLeft: 12 }}>
          更新时间: {now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false, hour: '2-digit', minute: '2-digit' })}
        </span>
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {indices.map((idx, i) => (
          <Col xs={12} sm={6} key={i}>
            <Card
              hoverable
              size="small"
              className="stat-card"
              style={{
                borderLeft: `4px solid ${idx.change_pct >= 0 ? '#ef4444' : '#22c55e'}`,
              }}
            >
              <Statistic
                title={idx.name}
                value={idx.price}
                precision={2}
                prefix={idx.change_pct >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                valueStyle={{
                  fontSize: 22,
                  color: idx.change_pct >= 0 ? '#ef4444' : '#22c55e',
                  fontFamily: 'monospace',
                }}
                suffix={
                  <span style={{ fontSize: 14, marginLeft: 4 }}>
                    {idx.change_pct >= 0 ? '+' : ''}{idx.change_pct}%
                  </span>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* 市场概况 + 模拟持仓 两列布局 */}
      <Row gutter={[16, 16]}>
        {/* 左侧：市场概况 */}
        <Col xs={24} lg={12}>
          <Card title="📈 市场概览" size="small" style={{ marginBottom: 16 }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Statistic
                  title="股票总数"
                  value={249}
                  prefix="📦"
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="策略数"
                  value={accounts.length}
                  prefix="⚡"
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="A股"
                  value={88}
                  prefix="🇨🇳"
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="港股"
                  value={111}
                  prefix="🇭🇰"
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="美股"
                  value={50}
                  prefix="🇺🇸"
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="数据更新"
                  value={dayjs().format('HH:mm')}
                  prefix="🔄"
                  valueStyle={{ fontSize: 20 }}
                />
              </Col>
            </Row>
          </Card>

          {/* 快捷入口 */}
          <Card title="🔗 快捷入口" size="small">
            <Row gutter={[12, 12]}>
              <Col span={8}>
                <Button block size="large" onClick={() => navigate('/sectors')}>
                  📂 行业板块
                </Button>
              </Col>
              <Col span={8}>
                <Button block size="large" onClick={() => navigate('/stocks')}>
                  📈 全部股票
                </Button>
              </Col>
              <Col span={8}>
                <Button block size="large" onClick={() => navigate('/strategies')}>
                  ⚡ 策略引擎
                </Button>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* 右侧：模拟持仓快照 */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Space>
                <WalletOutlined />
                <span>模拟持仓</span>
              </Space>
            }
            size="small"
            extra={<Button size="small" onClick={() => navigate('/portfolio')}>查看全部 →</Button>}
            style={{ marginBottom: 16 }}
          >
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <Statistic
                  title="总资产"
                  value={totalAsset}
                  precision={2}
                  prefix="¥"
                  valueStyle={{ fontSize: 20, fontFamily: 'monospace' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="总盈亏"
                  value={totalPnl}
                  precision={2}
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
                还没有模拟账户
                <br />
                <Button
                  type="link"
                  onClick={() => navigate('/portfolio')}
                  style={{ marginTop: 8 }}
                >
                  去创建 →
                </Button>
              </div>
            ) : (
              <Table
                dataSource={accounts}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: '组合', key: 'name',
                    render: (_: any, r: AccountSummary) => (
                      <a onClick={() => navigate('/portfolio')} style={{ fontWeight: 600 }}>{r.name}</a>
                    ),
                  },
                  {
                    title: '总资产', dataIndex: 'total_asset',
                    render: (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2 }),
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
                ]}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
