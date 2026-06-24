import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Row, Col, Spin, Descriptions, Tag, Statistic, Space, Tabs,
  Button, Typography, Input, message, Alert, Divider,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, RobotOutlined,
  SendOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react';
import dayjs from 'dayjs';
import api from '../services/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface StockInfo {
  id: number;
  symbol: string;
  name: string;
  market: string;
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

export default function AnalysisPage() {
  const { stockId } = useParams<{ stockId: string }>();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [aiSummary, setAiSummary] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [queryLoading, setQueryLoading] = useState(false);

  useEffect(() => {
    if (stockId) {
      loadAnalysis(parseInt(stockId));
      loadAiSummary(parseInt(stockId));
    }
  }, [stockId]);

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

  // K线图配置
  const dates = (analysis.indicators?.ma?.ma5 || []).map((_: any, i: number) => `Day ${i + 1}`);

  const klineOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['MA5', 'MA20'] },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: dates },
    yAxis: { type: 'value' },
    series: [
      {
        name: 'MA5',
        type: 'line',
        data: analysis.indicators?.ma?.ma5 || [],
        smooth: true,
        lineStyle: { width: 2, color: '#f59e0b' },
      },
      {
        name: 'MA20',
        type: 'line',
        data: analysis.indicators?.ma?.ma20 || [],
        smooth: true,
        lineStyle: { width: 2, color: '#8b5cf6', type: 'dashed' },
      },
    ],
  };

  const rsiData = analysis.indicators?.rsi?.rsi14 || [];
  const rsiOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: dates.slice(0, rsiData.length) },
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
      {/* 股票概览 */}
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

      {/* 技术图表 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card title="MA 均线">
            <ReactEChartsCore option={klineOption} style={{ height: 350 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title="RSI (14)">
            <ReactEChartsCore option={rsiOption} style={{ height: 350 }} />
          </Card>
        </Col>
      </Row>

      {/* 详细指标 + AI 对话 */}
      <Card title="📊 详细分析" style={{ marginTop: 16 }}>
        <Tabs
          items={[
            {
              key: 'macd',
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
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    💡 提示：可以在策略引擎中用 AI 条件来判断股票（如"当前适合买入吗？"），也可以在 AI 设置中配置不同的模型
                  </Text>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
