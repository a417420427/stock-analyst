import { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Spin, Tag, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import * as echarts from 'echarts';
import api from '../services/api';

const { Text } = Typography;

interface IndexData {
  symbol: string;
  name: string;
  market: string;
  price: number;
  change: number;
  prices: { date: string; close: number }[];
}

const marketColors: Record<string, string> = { A: 'red', HK: 'purple', US: 'green' };

export default function IndicesPage() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);
  const chartRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    loadIndices();
  }, []);

  useEffect(() => {
    if (indices.length > 0) {
      indices.forEach(idx => renderChart(idx));
    }
  }, [indices]);

  const loadIndices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/market/indices');
      setIndices(res.data || []);
    } catch {
      console.error('加载指数失败');
    }
    setLoading(false);
  };

  const renderChart = (idx: IndexData) => {
    const el = chartRefs.current[idx.symbol];
    if (!el || idx.prices.length === 0) return;

    const chart = echarts.init(el);
    const dates = idx.prices.map(p => p.date.slice(5));
    const values = idx.prices.map(p => p.close);
    const isUp = idx.change >= 0;
    const color = isUp ? '#ef4444' : '#22c55e';

    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { left: 0, right: 0, top: 5, bottom: 0 },
      xAxis: { type: 'category', data: dates, show: false },
      yAxis: { type: 'value', show: false, scale: true },
      series: [{
        type: 'line',
        data: values,
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + '40' },
              { offset: 1, color: color + '05' },
            ],
          },
        },
      }],
    });
  };

  return (
    <div>
      <h3 style={{ marginBottom: 16, fontWeight: 600 }}>📈 大盘指数</h3>
      <Spin spinning={loading}>
        <Row gutter={[16, 16]}>
          {indices.map(idx => (
            <Col xs={24} sm={12} lg={8} key={idx.symbol}>
              <Card
                hoverable
                style={{ borderRadius: 12 }}
                bodyStyle={{ padding: '16px 20px' }}
              >
                <Row justify="space-between" align="middle">
                  <Col>
                    <Space>
                      <Tag color={marketColors[idx.market]}>{idx.market}</Tag>
                      <Text strong style={{ fontSize: 15 }}>{idx.name}</Text>
                    </Space>
                  </Col>
                  <Col style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>
                      {idx.price ? idx.price.toLocaleString() : '-'}
                    </div>
                    <div style={{ color: idx.change >= 0 ? '#ef4444' : '#22c55e', fontSize: 13, fontWeight: 600 }}>
                      {idx.change !== 0 ? (
                        <>{idx.change >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {Math.abs(idx.change).toFixed(2)}%</>
                      ) : <span style={{ color: '#999' }}>-</span>}
                    </div>
                  </Col>
                </Row>
                <div
                  ref={el => { chartRefs.current[idx.symbol] = el; }}
                  style={{ height: 100, marginTop: 8 }}
                />
              </Card>
            </Col>
          ))}
        </Row>
      </Spin>
    </div>
  );
}

function Space({ children, size }: any) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: size || 8 }}>{children}</div>;
}
