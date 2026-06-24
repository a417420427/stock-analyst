import { useEffect, useState } from 'react';
import { Card, Row, Col, Spin, Statistic, Tag, Typography, Space, Tabs } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../services/api';
import MiniKlineChart from '../components/market/MiniKlineChart';

const { Text, Title } = Typography;

const StarIcon = () => <span role="img" aria-label="star">⭐</span>;
const ThunderIcon = () => <span role="img" aria-label="thunder">⚡</span>;
const SwapIcon = () => <span role="img" aria-label="swap">🔄</span>;
const ChartIcon = () => <span role="img" aria-label="chart">📊</span>;
const BellIcon = () => <span role="img" aria-label="bell">🔔</span>;

interface StockItem {
  id: number;
  symbol: string;
  market: string;
  name: string;
  price: number;
  change: string;
}

interface KlinePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stocks, setStocks] = useState<StockItem[]>([]);
  const [klineData, setKlineData] = useState<Record<number, KlinePoint[]>>({});
  const [stats, setStats] = useState({ stocks: 0, strategies: 0, triggers: 0 });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [watchlistRes, strategiesRes] = await Promise.all([
        api.get('/market/watchlists'),
        api.get('/strategies/'),
      ]);

      const wlData = watchlistRes.data;
      const allStocks: StockItem[] = [];
      if (wlData.length > 0) {
        for (const stock of wlData[0]?.stocks || []) {
          try {
            const realtime = await api.get(`/market/stocks/${stock.id}/realtime`);
            allStocks.push({ id: stock.id, ...realtime.data });
          } catch {
            // 跳过获取不到的行
          }
        }
      }

      setStocks(allStocks);
      setStats({
        stocks: allStocks.length,
        strategies: strategiesRes.data.length,
        triggers: 0,
      });

      // 异步加载所有自选股的 K 线数据
      loadAllKline(allStocks);
    } catch (err) {
      console.error('Load dashboard error:', err);
    }
    setLoading(false);
  };

  const loadAllKline = async (stockList: StockItem[]) => {
    const result: Record<number, KlinePoint[]> = {};
    const promises = stockList.map(async (s) => {
      try {
        const res = await api.get(`/market/stocks/${s.id}/prices`, {
          params: { days: 60 },
        });
        if (res.data && res.data.length > 0) {
          result[s.id] = res.data
            .map((p: any) => ({
              date: p.date,
              open: parseFloat(p.open),
              high: parseFloat(p.high),
              low: parseFloat(p.low),
              close: parseFloat(p.close),
              volume: parseInt(p.volume),
            }))
            .reverse(); // 后端是 desc，改为 asc
        }
      } catch {
        // 跳过
      }
    });
    await Promise.all(promises);
    setKlineData(result);
  };

  const getPriceColor = (change: string) => {
    if (change.startsWith('+')) return 'price-up';
    if (change.startsWith('-')) return 'price-down';
    return '';
  };

  const marketTag: Record<string, string> = {
    A: 'blue',
    HK: 'purple',
    US: 'green',
  };

  return (
    <Spin spinning={loading}>
      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="自选股数量" value={stats.stocks} prefix={<StarIcon />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="活跃策略" value={stats.strategies} prefix={<ThunderIcon />} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic title="今日触发" value={stats.triggers} prefix={<SwapIcon />} />
          </Card>
        </Col>
      </Row>

      {/* 自选股 K 线矩阵 */}
      <Card
        title="📊 自选股 K 线总览"
        style={{ marginBottom: 24 }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        {stocks.length === 0 ? (
          <Text type="secondary">还没有添加自选股，去搜索添加吧</Text>
        ) : (
          <Row gutter={[12, 12]}>
            {stocks.map((s) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={s.id}>
                <Card
                  size="small"
                  title={
                    <Space size={4} style={{ cursor: 'pointer' }}>
                      <Tag color={marketTag[s.market]} style={{ marginRight: 4 }}>
                        {s.market}
                      </Tag>
                      <Text strong style={{ fontSize: 13 }}>
                        {s.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        {s.symbol}
                      </Text>
                    </Space>
                  }
                  extra={
                    <Text
                      className={getPriceColor(s.change)}
                      style={{ fontSize: 12, fontWeight: 600 }}
                    >
                      {s.price} {s.change}
                    </Text>
                  }
                  hoverable
                  onClick={() => (window.location.href = `/analysis/${s.id}`)}
                  bodyStyle={{ padding: 0 }}
                >
                  {klineData[s.id] && klineData[s.id].length > 0 ? (
                    <MiniKlineChart
                      stockId={s.id}
                      name={s.name}
                      data={klineData[s.id]}
                      height={220}
                    />
                  ) : (
                    <div
                      style={{
                        height: 220,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#bbb',
                        fontSize: 12,
                      }}
                    >
                      加载中...
                    </div>
                  )}
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>

      {/* 实时行情列表 */}
      <Card title="📈 实时行情" style={{ marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0f0f0' }}>
              <th style={thStyle}>市场</th>
              <th style={thStyle}>代码</th>
              <th style={thStyle}>名称</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>价格</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>涨跌幅</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {stocks.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f5f5f5' }}>
                <td style={tdStyle}>
                  <Tag color={marketTag[s.market]}>{s.market}</Tag>
                </td>
                <td style={tdStyle}>{s.symbol}</td>
                <td style={tdStyle}>
                  <Text strong>{s.name}</Text>
                </td>
                <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>
                  {s.price}
                </td>
                <td
                  style={{
                    ...tdStyle,
                    textAlign: 'right',
                    color: getPriceColor(s.change) || '#333',
                  }}
                >
                  {s.change}
                </td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>
                  <a href={`/analysis/${s.id}`}>分析</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* 功能入口 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => (window.location.href = '/watchlist')}
            style={{ textAlign: 'center' }}
          >
            <Title level={3}>
              <StarIcon />
            </Title>
            <Text>自选股管理</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => (window.location.href = '/strategies')}
            style={{ textAlign: 'center' }}
          >
            <Title level={3}>
              <ThunderIcon />
            </Title>
            <Text>策略引擎</Text>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            hoverable
            onClick={() => (window.location.href = '/push')}
            style={{ textAlign: 'center' }}
          >
            <Title level={3}>
              <BellIcon />
            </Title>
            <Text>推送设置</Text>
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}

const thStyle: React.CSSProperties = {
  padding: '8px 12px',
  textAlign: 'left',
  fontSize: 12,
  color: '#999',
  fontWeight: 500,
};

const tdStyle: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 13,
};
