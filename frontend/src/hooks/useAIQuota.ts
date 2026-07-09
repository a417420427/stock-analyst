import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

export interface QuotaItem {
  action: string;
  label: string;
  used: number;
  limit: number;
  remaining: number;
}

export interface AIQuotaData {
  date: string;
  quotas: QuotaItem[];
}

export function useAIQuota() {
  const [quotaData, setQuotaData] = useState<AIQuotaData | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/ai/quota');
      setQuotaData(res.data);
    } catch {
      // Not logged in or network error — silently ignore
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  /** Get quota info for a specific action */
  const getQuota = useCallback(
    (action: string): QuotaItem | undefined =>
      quotaData?.quotas.find((q) => q.action === action),
    [quotaData]
  );

  /** Check if a specific action is exhausted */
  const isExhausted = useCallback(
    (action: string): boolean => {
      const q = getQuota(action);
      return q ? q.remaining <= 0 : false;
    },
    [getQuota]
  );

  /** Get remaining count for UI display */
  const remainingText = useCallback(
    (action: string): string => {
      const q = getQuota(action);
      if (!q) return '';
      return q.limit > 0 ? `剩余 ${q.remaining}/${q.limit} 次` : '不限次';
    },
    [getQuota]
  );

  return { quotaData, loading, refresh, getQuota, isExhausted, remainingText };
}
