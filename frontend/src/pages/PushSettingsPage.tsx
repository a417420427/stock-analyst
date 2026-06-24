import { useEffect, useState } from 'react';
import {
  Card, Form, Switch, Select, Button, Input, message, Space,
  Descriptions, Tag, Divider, Table, TimePicker,
} from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

interface PushPrefs {
  telegram_enabled: boolean;
  telegram_chat_id: string | null;
  email_enabled: boolean;
  email_address: string | null;
  dingtalk_enabled: boolean;
  dingtalk_webhook: string | null;
  feishu_enabled: boolean;
  feishu_webhook: string | null;
  websocket_enabled: boolean;
  push_level: string;
  quiet_start: string | null;
  quiet_end: string | null;
  daily_digest: boolean;
  weekly_digest: boolean;
}

export default function PushSettingsPage() {
  const [prefs, setPrefs] = useState<PushPrefs | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [testing, setTesting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadPrefs();
    loadHistory();
  }, []);

  const loadPrefs = async () => {
    try {
      const res = await api.get('/push/preferences');
      setPrefs(res.data);
      form.setFieldsValue(res.data);
    } catch {
      message.error('加载推送设置失败');
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get('/push/history', { params: { limit: 10 } });
      setHistory(res.data);
    } catch {
      // 可能第一次还没有数据
    }
  };

  const handleSave = async (values: any) => {
    try {
      await api.patch('/push/preferences', values);
      message.success('推送设置已保存');
      loadPrefs();
    } catch {
      message.error('保存失败');
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await api.post('/push/test');
      const results = res.data?.results || [];
      const allSent = results.every((r: any) => r.status === 'sent');
      if (allSent) {
        message.success('测试推送发送成功！');
      } else {
        message.warning('部分通道推送失败，请检查配置');
      }
      loadHistory();
    } catch {
      message.error('测试推送失败');
    }
    setTesting(false);
  };

  const statusIcon = (enabled: boolean) =>
    enabled ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> :
      <CloseCircleOutlined style={{ color: '#d9d9d9' }} />;

  const pushLevelLabels: Record<string, string> = {
    all: '全部推送',
    normal: '普通及以上',
    urgent_only: '仅紧急',
  };

  return (
    <div>
      {/* 推送概览 */}
      <Card title="🔔 推送设置" style={{ marginBottom: 16 }}>
        <Descriptions column={3} size="small" style={{ marginBottom: 16 }}>
          <Descriptions.Item label="Telegram">{statusIcon(prefs?.telegram_enabled || false)}</Descriptions.Item>
          <Descriptions.Item label="Email">{statusIcon(prefs?.email_enabled || false)}</Descriptions.Item>
          <Descriptions.Item label="钉钉">{statusIcon(prefs?.dingtalk_enabled || false)}</Descriptions.Item>
          <Descriptions.Item label="飞书">{statusIcon(prefs?.feishu_enabled || false)}</Descriptions.Item>
          <Descriptions.Item label="WebSocket">{statusIcon(prefs?.websocket_enabled || false)}</Descriptions.Item>
          <Descriptions.Item label="推送级别">
            <Tag>{pushLevelLabels[prefs?.push_level || 'normal']}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="每日简报">
            {prefs?.daily_digest ? <Tag color="green">已开启</Tag> : <Tag>已关闭</Tag>}
          </Descriptions.Item>
        </Descriptions>

        <Space>
          <Button type="primary" onClick={() => form.submit()}>保存设置</Button>
          <Button onClick={handleTest} loading={testing}>发送测试推送</Button>
        </Space>
      </Card>

      {/* 推送配置表单 */}
      <Card title="⚙️ 通道配置" style={{ marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSave}
          style={{ maxWidth: 600 }}
        >
          <Divider orientation="left" plain>Telegram</Divider>
          <Space>
            <Form.Item name="telegram_enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="telegram_chat_id" label="Chat ID">
              <Input placeholder="用户或群组的 Chat ID" style={{ width: 250 }} />
            </Form.Item>
          </Space>

          <Divider orientation="left" plain>Email</Divider>
          <Space>
            <Form.Item name="email_enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="email_address" label="邮箱地址">
              <Input placeholder="your@email.com" style={{ width: 250 }} />
            </Form.Item>
          </Space>

          <Divider orientation="left" plain>钉钉机器人</Divider>
          <Space>
            <Form.Item name="dingtalk_enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="dingtalk_webhook" label="Webhook URL">
              <Input placeholder="https://oapi.dingtalk.com/robot/send?access_token=..." style={{ width: 350 }} />
            </Form.Item>
          </Space>

          <Divider orientation="left" plain>飞书机器人</Divider>
          <Space>
            <Form.Item name="feishu_enabled" label="启用" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="feishu_webhook" label="Webhook URL">
              <Input placeholder="https://open.feishu.cn/open-apis/bot/v2/hook/..." style={{ width: 350 }} />
            </Form.Item>
          </Space>

          <Divider orientation="left" plain>推送规则</Divider>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Form.Item name="push_level" label="推送级别">
                <Select style={{ width: 180 }}
                  options={[
                    { value: 'all', label: '全部推送' },
                    { value: 'normal', label: '普通及以上' },
                    { value: 'urgent_only', label: '仅紧急' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="daily_digest" label="每日简报" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Space>
          </Space>
        </Form>
      </Card>

      {/* 推送历史 */}
      <Card title="📋 推送历史">
        {history.length === 0 ? (
          <span style={{ color: '#999' }}>暂无推送记录</span>
        ) : (
          <Table
            dataSource={history}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: '时间',
                dataIndex: 'created_at',
                render: (t: string) => dayjs(t).format('MM-DD HH:mm:ss'),
              },
              {
                title: '通道',
                dataIndex: 'channel',
                render: (c: string) => {
                  const icons: Record<string, string> = { telegram: '📱', email: '📧', dingtalk: '🔔' };
                  return `${icons[c] || ''} ${c}`;
                },
              },
              { title: '标题', dataIndex: 'title' },
              {
                title: '级别',
                dataIndex: 'level',
                render: (l: string) => {
                  const colors: Record<string, string> = { urgent: 'red', normal: 'blue', info: 'default' };
                  return <Tag color={colors[l]}>{l}</Tag>;
                },
              },
              {
                title: '状态',
                dataIndex: 'status',
                render: (s: string) => <Tag color={s === 'sent' ? 'green' : 'red'}>{s}</Tag>,
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
