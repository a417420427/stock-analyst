import { useEffect, useState } from 'react';
import {
  Card, Form, Input, Select, Button, message, Space, Tag, Progress, Spin,
  Descriptions, Divider, Tooltip,
} from 'antd';
import AIQuotaBadge from '../components/common/AIQuotaBadge';
import { useAIQuota, QuotaItem } from '../hooks/useAIQuota';
import { CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import api from '../services/api';

interface AIConfig {
  id: number;
  provider: string;
  model: string;
  api_key: string;
  api_base: string | null;
  is_active: boolean;
  created_at: string;
}

const PROVIDER_OPTIONS = [
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  {
    value: 'deepseek',
    label: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    base: 'https://api.deepseek.com/v1',
  },
  {
    value: 'together',
    label: 'Together AI',
    models: ['meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', 'mistralai/Mixtral-8x22B-Instruct-v0.1'],
    base: 'https://api.together.xyz/v1',
  },
  {
    value: 'custom',
    label: '自定义 API',
    models: ['gpt-4o', 'gpt-4o-mini', 'claude-3-opus', '自定义'],
  },
];

export default function AISettingsPage() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('openai');
  const [form] = Form.useForm();
  const { quotaData, loading: quotaLoading, refresh: refreshQuota } = useAIQuota();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const res = await api.get('/ai/settings');
      setConfig(res.data);
      if (res.data) {
        form.setFieldsValue(res.data);
        setSelectedProvider(res.data.provider);
      }
    } catch {
      // 还没有配置
    }
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const res = await api.post('/ai/settings', values);
      setConfig(res.data);
      message.success('AI 配置已保存');
    } catch {
      message.error('保存失败');
    }
    setSaving(false);
  };

  const providerInfo = PROVIDER_OPTIONS.find(p => p.value === selectedProvider);

  return (
    <div>
      <Card title="🤖 AI 模型配置" style={{ marginBottom: 16 }}>
        <Descriptions column={2} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="状态">
            {config ? (
              <Tag color="green" icon={<CheckCircleOutlined />}>已配置</Tag>
            ) : (
              <Tag icon={<CloseCircleOutlined />}>未配置</Tag>
            )}
          </Descriptions.Item>
          {config && (
            <>
              <Descriptions.Item label="当前模型">
                <Tag color="blue">{config.provider} / {config.model}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="API Key">
                <Text code>{config.api_key}</Text>
              </Descriptions.Item>
              {config.api_base && (
                <Descriptions.Item label="API 地址">{config.api_base}</Descriptions.Item>
              )}
              <Descriptions.Item label="配置时间">
                {new Date(config.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      {/* AI 配额展示 */}
      <Card title="📊 AI 配额" style={{ marginBottom: 16 }}>
        {quotaLoading ? (
          <Spin size="small" />
        ) : !quotaData ? (
          <span style={{ color: '#999', fontSize: 13 }}>登录后可查看配额</span>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: '#999', marginBottom: 12 }}>
              今日配额（{quotaData.date}）- 每个动作每天独立计数
            </div>
            <Space direction="vertical" style={{ width: '100%' }}>
              {quotaData.quotas.map((q: QuotaItem) => {
                const exhausted = q.limit > 0 && q.remaining <= 0;
                const pct = q.limit > 0 ? (q.used / q.limit) * 100 : 0;
                return (
                  <div key={q.action} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
                      <Space size={4}>
                        <span>{q.label}</span>
                      </Space>
                      <span style={{ color: exhausted ? '#ef4444' : '#666', fontWeight: exhausted ? 700 : 400 }}>
                        {q.limit > 0 ? `${q.used} / ${q.limit} 次` : '不限次'}
                      </span>
                    </div>
                    {q.limit > 0 && (
                      <Progress
                        percent={Math.min(pct, 100)}
                        size="small"
                        showInfo={false}
                        strokeColor={exhausted ? '#ef4444' : pct > 80 ? '#faad14' : '#52c41a'}
                        trailColor="#f0f0f0"
                      />
                    )}
                  </div>
                );
              })}
            </Space>
            <Button size="small" type="link" onClick={refreshQuota} style={{ padding: 0, marginTop: 8, fontSize: 12 }}>
              刷新
            </Button>
          </div>
        )}
      </Card>

      <Card title="⚙️ 配置 AI">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          initialValues={{
            provider: 'openai',
            model: 'gpt-4o',
            api_key: '',
            api_base: '',
          }}
          style={{ maxWidth: 600 }}
        >
          <Form.Item name="provider" label="AI 服务商">
            <Select
              onChange={(v) => setSelectedProvider(v)}
              options={PROVIDER_OPTIONS.map(p => ({
                value: p.value,
                label: p.label,
              }))}
            />
          </Form.Item>

          <Form.Item
            name="model"
            label={
              <Space>
                <span>模型</span>
                <Tooltip title="不同服务商支持的模型不同">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true }]}
          >
            <Select
              mode={selectedProvider === 'custom' ? 'tags' : undefined}
              options={providerInfo?.models.map(m => ({ value: m, label: m }))}
              placeholder={selectedProvider === 'custom' ? '输入模型名称' : '选择模型'}
            />
          </Form.Item>

          <Form.Item
            name="api_key"
            label={
              <Space>
                <span>API Key</span>
                <Tooltip title="Key 将加密存储在服务端">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password
              placeholder="sk-..."
              style={{ fontFamily: 'monospace' }}
            />
          </Form.Item>

          {selectedProvider === 'custom' && (
            <Form.Item name="api_base" label="API 地址">
              <Input placeholder="https://your-api.com/v1" />
            </Form.Item>
          )}

          <Divider />

          <div style={{ color: '#666', fontSize: 13, marginBottom: 16 }}>
            <p>💡 AI 能力说明：</p>
            <ul>
              <li><strong>智能摘要</strong> — 个股页面点击 AI 摘要，LLM 分析趋势和风险</li>
              <li><strong>AI 条件判断</strong> — 策略引擎中可使用 AI 作为判断条件（如"该股近期有利好趋势吗？"）</li>
              <li><strong>智能简报</strong> — 每日收盘复盘由 AI 生成叙述性总结</li>
              <li><strong>自然语言查询</strong> — 在分析页用中文提问（预留）</li>
            </ul>
          </div>

          <Button type="primary" htmlType="submit" loading={saving}>
            保存配置
          </Button>
        </Form>
      </Card>
    </div>
  );
}

function Text({ code, children }: { code?: boolean; children: React.ReactNode }) {
  const mask = typeof children === 'string' && !code && children.length > 8
    ? children.slice(0, 4) + '****' + children.slice(-4)
    : children;
  return <span style={{ fontFamily: code ? 'monospace' : undefined, fontSize: 13 }}>{mask}</span>;
}
