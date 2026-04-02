"use client";

import { useState, useEffect } from "react";
import ReactECharts from "echarts-for-react";
import { analyticsApi, type PnLPoint } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

export function CumulativePnLChart() {
  const [data, setData] = useState<PnLPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPnL() {
      try {
        const result = await analyticsApi.getPnLCurve(30);
        setData(result || []);
      } catch (err) {
        console.error('Failed to load PnL curve:', err);
      } finally {
        setLoading(false);
      }
    }
    loadPnL();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-textMuted text-sm">
        暂无盈亏曲线数据，请同步真实交易
      </div>
    );
  }

  const dates = data.map(p => {
    const d = new Date(p.date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  });
  const values = data.map(p => p.cumulativePnL);

  const option = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1e222d',
      borderColor: '#2B3139',
      textStyle: { color: '#EAECEF' },
      formatter: (params: any) => {
        const point = data[params[0].dataIndex];
        return `${params[0].name}<br/>累计盈亏: <b style="color:${params[0].value >= 0 ? '#22ab94' : '#f23645'}">$${params[0].value}</b><br/>今日平仓: ${point.closedLegs || 0} 笔`;
      }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLine: { lineStyle: { color: '#2B3139' } },
      axisLabel: { color: '#848E9C' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#2B3139', type: 'dashed' } },
      axisLabel: { color: '#848E9C' },
    },
    series: [
      {
        name: '累计 PNL',
        type: 'line',
        smooth: true,
        symbol: 'none',
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.4)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
            ]
          }
        },
        data: values
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
}
