import { useEffect, useState, useRef } from 'react';
import {
  Modal, Descriptions, Tag, Spin, Button, Space, Statistic, Typography,
  Card, Divider, Rate, Alert, Collapse,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined,
  FundViewOutlined, RobotOutlined,
  RiseOutlined, FallOutlined, WarningOutlined,
} from '@ant-design/icons';
import AIQuotaBadge from '../common/AIQuotaBadge';
import * as echarts from 'echarts';
import dayjs from 'dayjs';
import api from '../../services/api';

const { Text, Paragraph } = Typography;

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

interface Prediction {
  direction: string;
  expected_change_pct: number;
  timeframe: string;
  confidence: string;
  support_level: number;
  resistance_level: number;
  reasons: string[];
  risks: string[];
  technical_analysis: string;
  fundamental_analysis: string;
  summary: string;
}

interface Props {
  stockId: number | null;
  open: boolean;
  onClose: () => void;
}

const marketTag: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' };
const confColor: Record<string, string> = { high: 'red', medium: 'orange', low: '#999' };
const confLabel: Record<string, string> = { high: '高', medium: '中', low: '低' };

export default function StockDetailModal({ stockId, open, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<DetailData | null>(null);
  const [prices, setPrices] = useState<any[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // AI 预测
  const [predictModal, setPredictModal] = useState(false);
  const [predictLoading, setPredictLoading] = useState(false);
  const [prediction, setPrediction] = useState<Prediction | null>(null);

  useEffect(() => {
    if (open && stockId) {
      loadDetail(stockId);
    }
  }, [open, stockId]);

  useEffect(() => {
    if (!open) {
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

  const loadPrediction = async () => {
    if (!stockId) return;
    setPredictLoading(true);
    setPrediction(null);
    try {
      const res = await api.post(`/ai/predict/${stockId}`);
      const p = res.data.prediction;
      if (p && !p.error) {
        setPrediction(p);
      } else {
        setPrediction({
          direction: 'neutral',
          expected_change_pct: 0,
          timeframe: 'N/A',
          confidence: 'low',
          support_level: 0,
          resistance_level: 0,
          reasons: [],
          risks: [],
          technical_analysis: p?.error || 'AI 分析失败',
          fundamental_analysis: '',
          summary: p?.error || 'AI 分析失败',
        });
      }
      setPredictModal(true);
    } catch {
      setPrediction({
        direction: 'neutral',
        expected_change_pct: 0,
        timeframe: 'N/A',
        confidence: 'low',
        support_level: 0,
        resistance_level: 0,
        reasons: [],
        risks: [],
        technical_analysis: 'AI 预测请求失败，请检查 AI 设置',
        fundamental_analysis: '',
        summary: 'AI 预测请求失败',
      });
      setPredictModal(true);
    }
    setPredictLoading(false);
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
    <>
      {/* 详情弹窗 */}
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
            <Space>
              <Button icon={<RobotOutlined />} onClick={loadPrediction} loading={predictLoading}>
                AI 预测
              </Button>
              <AIQuotaBadge compact action="prediction" />
              <Button type="primary" href={`/analysis/${data.stock.id}`} icon={<FundViewOutlined />}>
                查看完整分析
              </Button>
            </Space>
          ) : null
        }
        width={560}
        destroyOnClose
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : data ? (
          <div>
            <div style={{ display: 'flex', gap: 32, marginBottom: 16 }}>
              <Statistic title="最新价格" value={data.latest_price} precision={2} />
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

            <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
              <Descriptions.Item label="MA5">{getLatest(data.indicators?.ma?.ma5) ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="MA20">{getLatest(data.indicators?.ma?.ma20) ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="RSI14">{getLatest(data.indicators?.rsi?.rsi14) ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="成交量">{data.volume.toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="PE (TTM)">{data.stock.pe_ttm ? Number(data.stock.pe_ttm).toFixed(2) : '-'}</Descriptions.Item>
              <Descriptions.Item label="PB">{data.stock.pb ? Number(data.stock.pb).toFixed(2) : '-'}</Descriptions.Item>
            </Descriptions>

            <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>📈 K 线走势（60日）</div>
            <div ref={chartRef} style={{ width: '100%', height: 240, borderRadius: 8, border: '1px solid #f0f0f0' }} />
          </div>
        ) : (
          <Text type="secondary">加载失败</Text>
        )}
      </Modal>

      {/* AI 预测弹窗 */}
      <Modal
        title={
          prediction ? (
            <Space>
              <RobotOutlined style={{ color: '#722ed1' }} />
              <span>AI 预测分析</span>
              {prediction.direction === 'up' && <Tag color="red">看涨</Tag>}
              {prediction.direction === 'down' && <Tag color="green">看跌</Tag>}
              {prediction.direction === 'neutral' && <Tag color="default">震荡</Tag>}
              <Tag color={confColor[prediction.confidence] || 'default'}>
                置信度: {confLabel[prediction.confidence] || prediction.confidence}
              </Tag>
            </Space>
          ) : 'AI 预测分析'
        }
        open={predictModal}
        onCancel={() => setPredictModal(false)}
        footer={null}
        width={600}
        destroyOnClose
      >
        {predictLoading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#999' }}>AI 正在分析...</div>
          </div>
        ) : prediction ? (
          <div>
            {/* 涨跌预估 */}
            <Card size="small" style={{ marginBottom: 12, background: '#fafafa' }}>
              <Space align="center" style={{ width: '100%', justifyContent: 'center' }}>
                {prediction.direction === 'up' ? (
                  <RiseOutlined style={{ fontSize: 32, color: '#ef4444' }} />
                ) : prediction.direction === 'down' ? (
                  <FallOutlined style={{ fontSize: 32, color: '#22c55e' }} />
                ) : (
                  <WarningOutlined style={{ fontSize: 32, color: '#faad14' }} />
                )}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 700, color: prediction.direction === 'up' ? '#ef4444' : '#22c55e' }}>
                    {prediction.expected_change_pct > 0 ? '+' : ''}{prediction.expected_change_pct}%
                  </div>
                  <div style={{ color: '#999', fontSize: 12 }}>
                    预计 {prediction.timeframe || '未来'} 涨跌幅
                  </div>
                </div>
                <div style={{ borderLeft: '1px solid #f0f0f0', paddingLeft: 24 }}>
                  <div style={{ fontSize: 12, color: '#999' }}>支撑位</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{prediction.support_level || '-'}</div>
                  <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>阻力位</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>{prediction.resistance_level || '-'}</div>
                </div>
              </Space>
            </Card>

            {/* 理由 */}
            {prediction.reasons && prediction.reasons.length > 0 && (
              <Card size="small" title="📈 看涨理由" style={{ marginBottom: 12 }}>
                {prediction.reasons.map((r: string, i: number) => (
                  <div key={i} style={{ padding: '4px 0', color: '#ef4444' }}>• {r}</div>
                ))}
              </Card>
            )}

            {/* 风险 */}
            {prediction.risks && prediction.risks.length > 0 && (
              <Card size="small" title="⚠️ 风险提示" style={{ marginBottom: 12 }}>
                {prediction.risks.map((r: string, i: number) => (
                  <div key={i} style={{ padding: '4px 0', color: '#faad14' }}>• {r}</div>
                ))}
              </Card>
            )}

            {/* 详细分析 */}
            <Collapse
              size="small"
              items={[
                {
                  key: 'tech',
                  label: '📊 技术面分析',
                  children: <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8 }}>{prediction.technical_analysis || '暂无'}</div>,
                },
                {
                  key: 'fund',
                  label: '📋 基本面分析',
                  children: <div style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8 }}>{prediction.fundamental_analysis || '暂无'}</div>,
                },
              ]}
              style={{ marginBottom: 12 }}
            />

            {/* 总结 */}
            <Alert
              type="info"
              showIcon
              message="AI 总结"
              description={<div style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{prediction.summary}</div>}
            />
          </div>
        ) : null}
      </Modal>
    </>
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
