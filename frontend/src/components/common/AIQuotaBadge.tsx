import { useEffect, useState } from 'react';
import { Tag, Tooltip, Popover, Space, Progress, Spin, Button, message } from 'antd';
import { RobotOutlined, ThunderboltOutlined, FundViewOutlined, RiseOutlined, DownOutlined } from '@ant-design/icons';
import { useAIQuota, QuotaItem } from '../../hooks/useAIQuota';
import { QUOTA_EXHAUSTED_EVENT } from '../../services/api';

const actionIcons: Record<string, React.ReactNode> = {
  ai_pick: <ThunderboltOutlined />,
  summary: <FundViewOutlined />,
  prediction: <RiseOutlined />,
  plan: <RobotOutlined />,
};

const actionColors: Record<string, string> = {
  ai_pick: 'purple',
  summary: 'blue',
  prediction: 'orange',
  plan: 'cyan',
};

interface AIQuotaBadgeProps {
  /** Show as a compact tag instead of full popover trigger */
  compact?: boolean;
  /** Only show specific action quota */
  action?: string;
  /** Additional CSS class */
  className?: string;
}

export default function AIQuotaBadge({ compact, action, className }: AIQuotaBadgeProps) {
  const { quotaData, loading, refresh } = useAIQuota();
  const [visible, setVisible] = useState(false);
  const [toastShown, setToastShown] = useState(false);

  // Listen for 429 events globally
  useEffect(() => {
    const handler = (e: Event) => {
      const { detail } = e as CustomEvent;
      message.warning(`⚠️ ${detail || 'AI 调用已达每日上限，请明天再试'}`);
      refresh(); // Refresh quota display
    };
    window.addEventListener(QUOTA_EXHAUSTED_EVENT, handler);
    return () => window.removeEventListener(QUOTA_EXHAUSTED_EVENT, handler);
  }, [refresh]);

  // Compact mode: just a colored tag
  if (compact && action && quotaData) {
    const q = quotaData.quotas.find((x) => x.action === action);
    if (!q) return null;
    const remaining = q.limit > 0 ? q.remaining : 99;
    const exhausted = q.limit > 0 && q.remaining <= 0;
    return (
      <Tooltip title={`${q.label}: ${q.remaining}/${q.limit} 次`}>
        <Tag
          color={exhausted ? 'red' : actionColors[action] || 'default'}
          style={{ fontSize: 11, cursor: 'pointer' }}
          className={className}
        >
          {actionIcons[action]} {q.label}
          {q.limit > 0 && ` ${q.remaining}/${q.limit}`}
          {exhausted ? '⚠️' : ''}
        </Tag>
      </Tooltip>
    );
  }

  // Full popover
  const content = loading ? (
    <Spin size="small" style={{ display: 'block', textAlign: 'center', padding: 16 }} />
  ) : !quotaData ? (
    <div style={{ fontSize: 12, color: '#999', padding: 8 }}>登录后可查看</div>
  ) : (
    <div style={{ minWidth: 240 }}>
      <div style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
        今日配额 ({quotaData.date})
      </div>
      {quotaData.quotas.map((q: QuotaItem) => {
        const exhausted = q.limit > 0 && q.remaining <= 0;
        const pct = q.limit > 0 ? (q.used / q.limit) * 100 : 0;
        return (
          <div key={q.action} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
              <Space size={4}>
                {actionIcons[q.action]}
                <span>{q.label}</span>
              </Space>
              <span style={{ color: exhausted ? '#ef4444' : '#666', fontWeight: exhausted ? 700 : 400 }}>
                {q.limit > 0 ? `${q.used}/${q.limit}` : '不限次'}
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
      <Button size="small" type="link" onClick={refresh} style={{ padding: 0, fontSize: 11 }}>
        刷新
      </Button>
    </div>
  );

  return (
    <Popover
      content={content}
      title="🤖 AI 配额"
      trigger="click"
      open={visible}
      onOpenChange={setVisible}
    >
      <Tag
        color="purple"
        style={{ cursor: 'pointer', fontSize: 11 }}
        className={className}
      >
        <RobotOutlined /> AI 配额
        {quotaData && (
          <span style={{ marginLeft: 4 }}>
            {quotaData.quotas.some((q) => q.limit > 0 && q.remaining <= 0) ? '⚠️' : ''}
          </span>
        )}
      </Tag>
    </Popover>
  );
}
