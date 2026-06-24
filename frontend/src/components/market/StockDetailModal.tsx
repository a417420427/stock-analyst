import { useEffect, useState, useRef } from 'react';
import { Modal, Descriptions, Tag, Spin, Button, Space, Statistic, Typography } from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined,
  FundViewOutlined,
} from '@ant-design/icons';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import api from '../../services/api';

const { Text } = Typography;

interface DetailData {
  stock: {
    id: number;
    symbol: string;
    name: string;
    market: string;
    pe_ttm?: number | null;
    pb?: number | null;
  };
  latest_price: number;
  change_pct: number;
  volume: number;
  indicators: {
    ma?: { ma5?: number[]; ma20?: number[] };
    rsi?: { rsi14?: number[] };
  };
  trend_score: Record<string, number>;
  patterns: any[];
}

interface Props {
  stockId: number | null;
  open: boolean;
  onClose: () => void;
}

const marketTag: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' };

export default function StockDetailModal({ stockId, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DetailData | null>(null);
  const [prices, setPrices] = useState<any[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (open && stockId) {
      loadDetail(stockId);
    }
  }, [open, stockId]);

  useEffect(() => {
    if (!open) {
      // Cleanup chart on close
      if (chartInstance.current) {
        chartInstance.current.dispose();
        chartInstance.current = null;
      }
    }
  }, [open]);

  useEffect(() => {
    if (data && prices.length > 0 && chartRef.current) {
      renderChart();
    }
  }, [data, prices]);

  const loadDetail = async (id: number) => {
    setLoading(true);
    try {
      const [analysisRes, pricesRes] = await Promise.all([
        api.get(`/analysis/stocks/${id}/comprehensive`),
        api.get(`/market/stocks/${id}/prices`, { params: { days: 60 } }),
      ]);
      setData(analysisRes.data);
      const raw = pricesRes.data || [];
      setPrices(raw.reverse());
    } catch (err) {
      console.error('Load stock detail error:', err);
    }
    setLoading(false);
  };

  const renderChart = () => {
    if (!chartRef.current) return;
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }
    const chart = chartInstance.current;

    const dates = prices.map((p: any) => dayjs(p.date).format('MM-DD'));
    const closes = prices.map((p: any) => parseFloat(p.close));
    const kData = prices.map((p: any) => [
      parseFloat(p.open), parseFloat(p.close),
      parseFloat(p.low), parseFloat(p.high),
    ]);

    const ma5 = calcMA(closes, 5);
    const ma20 = calcMA(closes, 20);

    const upColor = '#ef4444';
    const downColor = '#22c55e';

    chart.setOption({
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      grid: { left: '3%', right: '3%', top: '8%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { fontSize: 9, rotate: 30 },
        axisLine: { lineStyle: { color: '#999' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        scale: true,
        splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
        axisLabel: { fontSize: 9 },
      },
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: kData,
          itemStyle: {
            color: upColor,
            color0: downColor,
            borderColor: upColor,
            borderColor0: downColor,
          },
        },
        {
          name: 'MA5',
          type: 'line',
          data: ma5,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#f59e0b' },
        },
        {
          name: 'MA20',
          type: 'line',
          data: ma20,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#8b5cf6', type: 'dashed' },
        },
      ],
      dataZoom: [{ type: 'inside', start: 60, end: 100 }],
    }, true);

    chart.resize();
  };

  const getLatest = (arr: number[] | undefined): number | null => {
    if (arr && arr.length > 0) return Number(arr[arr.length - 1].toFixed(2));
    return null;
  };

  return (
    <Modal
      title={data ? (
        <Space>
          <Tag color={marketTag[data.stock.market] || 'default'}>{data.stock.market}</Tag>
          <span>{data.stock.name}</span>
          <Text type="secondary" style={{ fontSize: 13 }}>{data.stock.symbol}</Text>
        </Space>
      ) : '股票详情'}
      open={open}
      onCancel={onClose}
      footer={
        data ? (
          <Button type="primary" href={`/analysis/${data.stock.id}`} icon={<FundViewOutlined />}>
            查看完整分析
          </Button>
        ) : null
      }
      width={560}
      destroyOnClose
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : data ? (
        <div>
          {/* 价格 & 涨跌幅 */}
          <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
            <Statistic
              title="最新价格"
              value={data.latest_price}
              precision={2}
            />
            <Statistic
              title="涨跌幅"
              value={Math.abs(data.change_pct)}
              precision={2}
              suffix="%"
              prefix={data.change_pct > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
              valueStyle={{ color: data.change_pct > 0 ? '#ef4444' : '#22c55e' }}
            />
            <Statistic
              title="趋势评分"
              value={data.trend_score?.composite || 0}
              valueStyle={{ color: (data.trend_score?.composite || 0) > 0 ? '#ef4444' : '#22c55e' }}
            />
          </div>

          {/* 技术指标 */}
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
            <Descriptions.Item label="MA5">
              {getLatest(data.indicators?.ma?.ma5) ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="MA20">
              {getLatest(data.indicators?.ma?.ma20) ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="RSI14">
              {getLatest(data.indicators?.rsi?.rsi14) ?? '-'}
            </Descriptions.Item>
            <Descriptions.Item label="成交量">
              {data.volume.toLocaleString()}
            </Descriptions.Item>
            <Descriptions.Item label="PE (TTM)">
              {data.stock.pe_ttm ? Number(data.stock.pe_ttm).toFixed(2) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="PB">
              {data.stock.pb ? Number(data.stock.pb).toFixed(2) : '-'}
            </Descriptions.Item>
          </Descriptions>

          {/* 迷你 K 线 */}
          <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>📈 K 线走势（60日）</div>
          <div ref={chartRef} style={{ width: '100%', height: 240, borderRadius: 8, border: '1px solid #f0f0f0' }} />
        </div>
      ) : (
        <Text type="secondary">加载失败</Text>
      )}
    </Modal>
  );
}

// ─── Helper ─────────────────────────────────────────

function calcMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    return Math.round((sum / period) * 100) / 100;
  });
}
