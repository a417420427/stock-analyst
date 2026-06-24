import { useEffect, useState, useRef } from 'react';
import { Space, Tag, Tooltip } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  MinusCircleOutlined,
} from '@ant-design/icons';
import api from '../../services/api';

interface MarketStatus {
  status: 'trading' | 'pre' | 'post' | 'closed';
  next_open: string;
  next_close: string;
}

interface TradingData {
  a: MarketStatus;
  hk: MarketStatus;
  us: MarketStatus;
  server_time: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  trading: {
    color: '#22c55e',
    label: '交易中',
    icon: <CheckCircleOutlined style={{ color: '#22c55e' }} />,
  },
  pre: {
    color: '#fa8c16',
    label: '盘前',
    icon: <ClockCircleOutlined style={{ color: '#fa8c16' }} />,
  },
  post: {
    color: '#fa8c16',
    label: '盘后',
    icon: <ClockCircleOutlined style={{ color: '#fa8c16' }} />,
  },
  closed: {
    color: '#bfbfbf',
    label: '休市',
    icon: <MinusCircleOutlined style={{ color: '#bfbfbf' }} />,
  },
};

const MARKET_LABELS: Record<string, string> = {
  a: 'A 股',
  hk: '港股',
  us: '美股',
};

export default function TradingCalendar() {
  const [data, setData] = useState<TradingData | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    loadStatus();
    // Auto-refresh every 60 seconds
    timerRef.current = setInterval(loadStatus, 60000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const loadStatus = async () => {
    try {
      const res = await api.get('/market/trading-status');
      setData(res.data);
    } catch {
      // Silently fail
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const statusDot = (market: string, status: MarketStatus) => {
    const cfg = STATUS_CONFIG[status.status] || STATUS_CONFIG.closed;
    return (
      <Tooltip
        key={market}
        title={
          <div>
            <div>{MARKET_LABELS[market]}: {cfg.label}</div>
            {status.status === 'trading' && <div>收盘: {formatTime(status.next_close)}</div>}
            {status.status !== 'trading' && <div>开盘: {formatTime(status.next_open)}</div>}
          </div>
        }
      >
        <Tag
          style={{
            cursor: 'pointer',
            fontSize: 11,
            padding: '0 6px',
            lineHeight: '22px',
            border: `1px solid ${cfg.color}`,
            color: cfg.color,
            background: `${cfg.color}10`,
            borderRadius: 12,
            marginRight: 4,
          }}
        >
          {cfg.icon}
          <span style={{ marginLeft: 3 }}>{MARKET_LABELS[market]}</span>
        </Tag>
      </Tooltip>
    );
  };

  return (
    <Space size={4}>
      {data ? (
        <>
          {statusDot('a', data.a)}
          {statusDot('hk', data.hk)}
          {statusDot('us', data.us)}
        </>
      ) : (
        <Tag style={{ fontSize: 11, color: '#999', border: '1px dashed #d9d9d9' }}>加载中...</Tag>
      )}
    </Space>
  );
}
