import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import dayjs from 'dayjs';

interface KlineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Props {
  /** 股票ID */
  stockId: number;
  /** 股票名称 */
  name: string;
  /** K线数据 */
  data: KlineData[];
  /** 宽度（像素），自动适配 */
  height?: number;
}

export default function MiniKlineChart({ stockId, name, data, height = 260 }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current || data.length === 0) return;

    if (!instanceRef.current) {
      instanceRef.current = echarts.init(chartRef.current);
    }
    const chart = instanceRef.current;

    // 准备 K 线数据
    const dates = data.map((d) => dayjs(d.date).format('MM-DD'));
    const klineData = data.map((d) => [d.open, d.close, d.low, d.high]);
    const volumes = data.map((d) => d.volume);

    // 计算 MA 线
    const closes = data.map((d) => d.close);
    const ma5 = calcMA(closes, 5);
    const ma20 = calcMA(closes, 20);

    // K线涨跌颜色
    const upColor = '#ef4444';
    const downColor = '#22c55e';

    const option: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      grid: [
        { left: '5%', right: '5%', top: '8%', height: '62%' },
        { left: '5%', right: '5%', top: '78%', height: '16%' },
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
          lineStyle: { width: 1.5, color: '#f59e0b' },
          xAxisIndex: 0,
          yAxisIndex: 0,
        },
        {
          name: 'MA20',
          type: 'line',
          data: ma20,
          smooth: true,
          symbol: 'none',
          lineStyle: { width: 1.5, color: '#8b5cf6', type: 'dashed' },
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
              const item = data[params.dataIndex];
              return item ? (item.close >= item.open ? upColor : downColor) : '#999';
            },
          },
        },
      ],
      dataZoom: [
        { type: 'inside', xAxisIndex: [0, 1], start: Math.max(0, 100 - 40), end: 100 },
      ],
    };

    chart.setOption(option, true);
    chart.resize();

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [data]);

  return (
    <div
      ref={chartRef}
      style={{ width: '100%', height }}
      onClick={() => window.open(`/analysis/${stockId}`, '_self')}
      title="点击查看详细分析"
    />
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
