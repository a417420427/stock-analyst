import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Row, Col, Spin, Tag, Statistic, Space, Tabs,
  Button, Typography, Input, message, Alert, Divider, Segmented,
  Descriptions,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, RobotOutlined,
  SendOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react';
import dayjs from 'dayjs';
import api from '../services/api';
import AIQuotaBadge from '../components/common/AIQuotaBadge';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface StockInfo {
  id: number;
  symbol: string;
  name: string;
  market: string;
  pe_ttm?: number | string | null;
  pb?: number | string | null;
  market_cap?: number | string | null;
  dividend_yield?: number | string | null;
  revenue_growth?: number | string | null;
  profit_margin?: number | string | null;
}

interface AnalysisResult {
  stock: StockInfo;
  latest_price: number;
  change_pct: number;
  volume: number;
  indicators: any;
  patterns: any[];
  trend_score: Record<string, number>;
}

interface PricePoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Period options ────────────────────────────────

const PERIOD_OPTIONS = [
  { label: '1个月', value: 30 },
  { label: '3个月', value: 90 },
  { label: '6个月', value: 180 },
  { label: '1年', value: 365 },
];

// ─── Main Component ────────────────────────────────

export default function AnalysisPage() {
  const { stockId } = useParams<{ stockId: string }>();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [prices, setPrices] = useState<PricePoint[]>([]);
  const [days, setDays] = useState(90);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);
  // 副图开关
  const [showMacd, setShowMacd] = useState(true);
  const [showRsi, setShowRsi] = useState(true);

  useEffect(() => {
    if (stockId) {
      const id = parseInt(stockId);
      loadAnalysis(id);
      loadPrices(id, days);
      loadAiSummary(id);
    }
  }, [stockId]);

  useEffect(() => {
    if (stockId) {
      loadPrices(parseInt(stockId), days);
    }
  }, [days]);

  const loadAnalysis = async (id: number) => {
    setLoading(true);
    try {
      const res = await api.get(`/analysis/stocks/${id}/comprehensive`);
      setAnalysis(res.data);
    } catch (err) {
      console.error('Load analysis error:', err);
    }
    setLoading(false);
  };

  const loadPrices = async (id: number, d: number) => {
    try {
      const res = await api.get(`/market/stocks/${id}/prices`, { params: { days: d } });
      const raw = res.data || [];
      // Reverse from desc to asc
      const sorted: PricePoint[] = raw
        .map((p: any) => ({
          date: p.date,
          open: parseFloat(p.open),
          high: parseFloat(p.high),
          low: parseFloat(p.low),
          close: parseFloat(p.close),
          volume: parseInt(p.volume),
        }))
        .reverse();
      setPrices(sorted);
    } catch (err) {
      console.error('Load prices error:', err);
    }
  };

  const loadAiSummary = async (id: number) => {
    try {
      const res = await api.get(`/ai/summary/${id}`);
      setAiSummary(res.data);
    } catch {
      // AI 可能未配置
    }
  };

  const handleAsk = async () => {
    if (!aiQuery.trim()) return;
    setQueryLoading(true);
    try {
      const res = await api.post(`/ai/query`, null, {
        params: { query: aiQuery },
      });
      setAiAnswer(res.data?.answer || '暂无回复');
    } catch {
      message.error('AI 查询失败');
    }
    setQueryLoading(false);
  };

  if (loading) {
    return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  }

  if (!analysis) {
    return <Card>暂无数据</Card>;
  }

  const { stock } = analysis;

  const marketTag: Record<string, string> = { A: 'blue', HK: 'purple', US: 'green' };

  // ─── Build K-line + MA + Volume option ──────────────

  const dates = prices.map(p => dayjs(p.date).format('MM-DD'));
  const closes = prices.map(p => p.close);
  const klineData = prices.map(p => [p.open, p.close, p.low, p.high]);
  const volumes = prices.map(p => p.volume);

  const ma5 = calcMA(closes, 5);
  const ma20 = calcMA(closes, 20);

  const upColor = '#ef4444';
  const downColor = '#22c55e';

  const klineOption = {
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross' },
    },
    legend: {
      data: ['K线', 'MA5', 'MA20', '成交量'],
      top: 0,
    },
    grid: [
      { left: '3%', right: '4%', top: '12%', height: '50%' },
      { left: '3%', right: '4%', top: '70%', height: '22%' },
    ],
    xAxis: [
      {
        type: 'category',
        data: dates,
        axisLine: { lineStyle: { color: '#999' } },
        axisLabel: { fontSize: 10, rotate: 30 },
        splitLine: { show: false },
        gridIndex: 0,
      },
      {
        type: 'category',
        data: dates,
        axisLabel: { show: false },
        splitLine: { show: false },
        gridIndex: 1,
      },
    ],
    yAxis: [
      {
        type: 'value',
        scale: true,
        splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
        axisLabel: { fontSize: 10 },
        gridIndex: 0,
      },
      {
        type: 'value',
        scale: true,
        splitLine: { show: false },
        axisLabel: { fontSize: 9 },
        gridIndex: 1,
      },
    ],
    dataZoom: [
      { type: 'inside', xAxisIndex: [0, 1], start: Math.max(0, 100 - 40), end: 100 },
    ],
    series: [
      {
        name: 'K线',
        type: 'candlestick',
        data: klineData,
        xAxisIndex: 0,
        yAxisIndex: 0,
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
        lineStyle: { width: 2, color: '#f59e0b' },
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      {
        name: 'MA20',
        type: 'line',
        data: ma20,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, color: '#8b5cf6', type: 'dashed' },
        xAxisIndex: 0,
        yAxisIndex: 0,
      },
      {
        name: '成交量',
        type: 'bar',
        data: volumes,
        xAxisIndex: 1,
        yAxisIndex: 1,
        itemStyle: {
          color: (params: any) => {
            const item = prices[params.dataIndex];
            return item ? (item.close >= item.open ? upColor : downColor) : '#999';
          },
        },
      },
    ],
  };

  // ─── MACD sub-chart ──────────────────────────────────

  const macd = analysis.indicators?.macd;
  let macdOption: any = {};

  if (macd) {
    const dif = Array.isArray(macd.dif) ? macd.dif : [];
    const dea = Array.isArray(macd.dea) ? macd.dea : [];
    const macdBar = Array.isArray(macd.macd) ? macd.macd : [];

    macdOption = {
      tooltip: { trigger: 'axis' },
      legend: { data: ['DIF', 'DEA', 'MACD'], top: 0 },
      grid: { left: '3%', right: '4%', top: '12%', bottom: '3%', containLabel: true },
      xAxis: {
        type: 'category',
        data: dates.slice(dates.length - dif.length),
        axisLabel: { fontSize: 10, rotate: 30 },
      },
      yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { type: 'dashed', color: '#eee' } } },
      series: [
        {
          name: 'DIF',
          type: 'line',
          data: dif,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#1677ff' },
        },
        {
          name: 'DEA',
          type: 'line',
          data: dea,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 2, color: '#fa8c16' },
        },
        {
          name: 'MACD',
          type: 'bar',
          data: macdBar.map((v: number) => ({
            value: v,
            itemStyle: { color: v >= 0 ? upColor : downColor },
          })),
          barWidth: '60%',
        },
      ],
    };
  }

  // ─── RSI chart ───────────────────────────────────────

  const rsiData = analysis.indicators?.rsi?.rsi14 || [];
  const rsiOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['RSI14'], top: 0 },
    grid: { left: '3%', right: '4%', top: '12%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: dates.slice(0, rsiData.length), axisLabel: { fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value', min: 0, max: 100 },
    series: [
      {
        name: 'RSI14',
        type: 'line',
        data: rsiData,
        smooth: true,
        lineStyle: { width: 2 },
        markLine: {
          data: [
            { yAxis: 70, label: { formatter: '超买 70' } },
            { yAxis: 30, label: { formatter: '超卖 30' } },
          ],
        },
      },
    ],
  };

  return (
    <div>
      {/* 股票概览 + 基本面 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24} align="middle">
          <Col>
            <Tag color={marketTag[stock.market] || 'default'} style={{ fontSize: 14, padding: '4px 12px' }}>
              {stock.market}
            </Tag>
          </Col>
          <Col>
            <h2 style={{ margin: 0 }}>{stock.name}<span style={{ fontSize: 16, color: '#999' }}> {stock.symbol}</span></h2>
          </Col>
          <Col flex="auto">
            <Space size="large" style={{ float: 'right' }}>
              <Statistic title="价格" value={analysis.latest_price} precision={2} />
              <Statistic title="涨跌幅"
                value={Math.abs(analysis.change_pct)}
                precision={2} suffix="%"
                prefix={analysis.change_pct > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                valueStyle={{ color: analysis.change_pct > 0 ? '#ef4444' : '#22c55e' }}
              />
              <Statistic title="趋势评分" value={analysis.trend_score?.composite || 0}
                valueStyle={{ color: (analysis.trend_score?.composite || 0) > 0 ? '#ef4444' : '#22c55e' }}
              />
            </Space>
          </Col>
        </Row>

        {/* 基本面数据 */}
        <div style={{ marginTop: 12, padding: '8px 0', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <FundItem label="PE (TTM)" value={analysis.stock.pe_ttm} suffix="" />
          <FundItem label="PB" value={analysis.stock.pb} suffix="" />
          <FundItem label="市值" value={analysis.stock.market_cap} suffix="" formatter />
          <FundItem label="股息率" value={analysis.stock.dividend_yield} suffix="%" />
          <FundItem label="营收增长" value={analysis.stock.revenue_growth} suffix="%" />
          <FundItem label="利润率" value={analysis.stock.profit_margin} suffix="%" />
        </div>
      </Card>

      {/* AI 分析摘要 */}
      {aiSummary && (
        <Card
          title={
            <Space>
              <RobotOutlined style={{ color: '#1677ff' }} />
              <span>AI 智能分析</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          bodyStyle={{ padding: '16px 24px' }}
        >
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Descriptions column={2} size="small">
                <Descriptions.Item label="趋势判断">
                  <Tag color={aiSummary.analysis?.trend === '看涨' ? 'red' : aiSummary.analysis?.trend === '看跌' ? 'green' : 'default'}>
                    {aiSummary.analysis?.trend || 'N/A'}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="综合评分">
                  <Text strong style={{ fontSize: 18, color: (aiSummary.analysis?.score || 50) >= 60 ? '#ef4444' : '#22c55e' }}>
                    {aiSummary.analysis?.score || '-'}
                  </Text>
                  <Text type="secondary">/100</Text>
                </Descriptions.Item>
                <Descriptions.Item label="支撑位">{aiSummary.analysis?.support || '-'}</Descriptions.Item>
                <Descriptions.Item label="阻力位">{aiSummary.analysis?.resistance || '-'}</Descriptions.Item>
              </Descriptions>
              {aiSummary.analysis?.risk_warning && (
                <Alert
                  message={aiSummary.analysis.risk_warning}
                  type={aiSummary.analysis.risk_warning.includes('AI') ? 'warning' : 'info'}
                  showIcon
                  style={{ marginTop: 8, fontSize: 12 }}
                />
              )}
            </Col>
            <Col xs={24} md={12}>
              <div style={{
                background: '#f6ffed',
                border: '1px solid #b7eb8f',
                borderRadius: 8,
                padding: '12px 16px',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 15, lineHeight: 1.8, color: '#135200' }}>
                  💡 {aiSummary.analysis?.summary || '暂无摘要'}
                </Text>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      {/* 时间周期选择 */}
      <Card style={{ marginBottom: 16 }} bodyStyle={{ padding: '12px 20px' }}>
        <Space>
          <Text strong style={{ fontSize: 13 }}>时间周期：</Text>
          <Segmented
            options={PERIOD_OPTIONS}
            value={days}
            onChange={(val) => setDays(val as number)}
          />
        </Space>
      </Card>

      {/* 技术图表 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title={<>K 线图 + 均线 + 成交量 <Tag style={{ fontSize: 11 }}>{days}日</Tag></>}>
            <ReactEChartsCore option={klineOption} style={{ height: 420 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <div style={{ marginBottom: 8, display: 'flex', gap: 8 }}>
            <Button size="small" type={showMacd ? 'primary' : 'default'} onClick={() => setShowMacd(!showMacd)}>MACD</Button>
            <Button size="small" type={showRsi ? 'primary' : 'default'} onClick={() => setShowRsi(!showRsi)}>RSI</Button>
          </div>
          {showMacd && (
            <Card title="MACD" style={{ marginBottom: showRsi ? 16 : 0 }}>
              {macd ? (
                <ReactEChartsCore option={macdOption} style={{ height: 240 }} />
              ) : (
                <span>暂无数据</span>
              )}
            </Card>
          )}
          {showRsi && (
            <Card title="RSI (14)">
              <ReactEChartsCore option={rsiOption} style={{ height: 240 }} />
            </Card>
          )}
        </Col>
      </Row>

      {/* 详细指标 + AI 对话 */}
      <Card title="📊 详细分析" style={{ marginTop: 16 }}>
        <Tabs
          items={[
            {
              key: 'macd_values',
              label: 'MACD',
              children: analysis.indicators?.macd ? (
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="DIF">{analysis.indicators.macd.dif?.slice(-1)[0]?.toFixed(4) || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="DEA">{analysis.indicators.macd.dea?.slice(-1)[0]?.toFixed(4) || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="MACD柱">{analysis.indicators.macd.macd?.slice(-1)[0]?.toFixed(4) || 'N/A'}</Descriptions.Item>
                </Descriptions>
              ) : <span>暂无数据</span>,
            },
            {
              key: 'kdj',
              label: 'KDJ',
              children: analysis.indicators?.kdj ? (
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="K值">{analysis.indicators.kdj.k?.slice(-1)[0]?.toFixed(2) || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="D值">{analysis.indicators.kdj.d?.slice(-1)[0]?.toFixed(2) || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="J值">{analysis.indicators.kdj.j?.slice(-1)[0]?.toFixed(2) || 'N/A'}</Descriptions.Item>
                </Descriptions>
              ) : <span>暂无数据</span>,
            },
            {
              key: 'boll',
              label: '布林带',
              children: analysis.indicators?.bollinger ? (
                <Descriptions column={3} size="small">
                  <Descriptions.Item label="上轨">{analysis.indicators.bollinger.boll_upper?.slice(-1)[0]?.toFixed(2) || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="中轨">{analysis.indicators.bollinger.boll_mid?.slice(-1)[0]?.toFixed(2) || 'N/A'}</Descriptions.Item>
                  <Descriptions.Item label="下轨">{analysis.indicators.bollinger.boll_lower?.slice(-1)[0]?.toFixed(2) || 'N/A'}</Descriptions.Item>
                </Descriptions>
              ) : <span>暂无数据</span>,
            },
            {
              key: 'patterns',
              label: '形态识别',
              children: analysis.patterns.length === 0 ? (
                <span>未检测到明显形态</span>
              ) : (
                <div>
                  {analysis.patterns.map((p: any, i: number) => (
                    <Tag key={i} color="blue" style={{ marginBottom: 4 }}>
                      {p.type} (置信度: {p.confidence})
                    </Tag>
                  ))}
                </div>
              ),
            },
            {
              key: 'ai_chat',
              label: (
                <Space size={4}>
                  <RobotOutlined />
                  <span>AI 对话</span>
                  <AIQuotaBadge compact action="summary" />
                </Space>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>🤖 问 AI 关于 {stock.name} 的问题</Text>
                    <Paragraph type="secondary" style={{ marginTop: 4, fontSize: 12 }}>
                      可以问任何关于这只股票的问题，AI 会结合技术指标和基本面数据回答
                    </Paragraph>
                  </div>

                  <Space.Compact style={{ width: '100%', marginBottom: 12 }}>
                    <TextArea
                      placeholder={`例如：${stock.name} 近期趋势如何？支撑位和阻力位在哪？`}
                      value={aiQuery}
                      onChange={(e) => setAiQuery(e.target.value)}
                      rows={2}
                      onPressEnter={handleAsk}
                    />
                    <Button
                      type="primary"
                      icon={<SendOutlined />}
                      loading={queryLoading}
                      onClick={handleAsk}
                      style={{ height: 52 }}
                    >
                      发送
                    </Button>
                  </Space.Compact>

                  {aiAnswer && (
                    <Card
                      size="small"
                      style={{
                        background: '#f6f8fa',
                        border: '1px solid #e8e8e8',
                      }}
                    >
                      <Space align="start" style={{ marginBottom: 8 }}>
                        <RobotOutlined style={{ color: '#1677ff', fontSize: 16 }} />
                        <Text strong>AI 回答</Text>
                      </Space>
                      <Paragraph style={{ whiteSpace: 'pre-wrap', margin: 0, lineHeight: 1.8 }}>
                        {aiAnswer}
                      </Paragraph>
                    </Card>
                  )}

                  <Divider />
                  <div style={{ fontSize: 12, color: '#999', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>💡 可以在策略引擎中用 AI 条件来判断股票，或在 AI 设置中配置不同模型</span>
                    <AIQuotaBadge compact action="summary" />
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────

/** 基本面数值项 */
function FundItem({ label, value, suffix = '', formatter = false }: {
  label: string;
  value: any;
  suffix?: string;
  formatter?: boolean;
}) {
  const numVal = value != null ? Number(value) : 0;
  const displayVal = numVal !== 0
    ? formatter
      ? numVal >= 1e12
        ? `${(numVal / 1e12).toFixed(2)}万亿`
        : `${(numVal / 1e8).toFixed(2)}亿`
      : `${numVal.toFixed(2)}${suffix}`
    : '-';
  return (
    <div style={{ textAlign: 'center', minWidth: 80 }}>
      <div style={{ fontSize: 11, color: '#86909c', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: displayVal === '-' ? '#ddd' : '#1d2129' }}>
        {displayVal}
      </div>
    </div>
  );
}

/** 简单移动平均 */
function calcMA(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    return Math.round((sum / period) * 100) / 100;
  });
}
