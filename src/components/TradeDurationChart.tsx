"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { analyticsApi, type DurationStats } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

export function TradeDurationChart() {
  const [data, setData] = useState<DurationStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const durationData = await analyticsApi.getDuration();
        setData(durationData);
      } catch (err) {
        console.error('Failed to load duration stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['交易笔数'], textStyle: { color: '#848E9C' }, top: 0 },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '15%', containLabel: true },
    xAxis: {
      type: 'category',
      data: data.map(item => item.range),
      axisLine: { lineStyle: { color: '#2B3139' } },
      axisLabel: { color: '#848E9C', interval: 0 }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#2B3139', type: 'dashed' } },
      axisLabel: { color: '#848E9C' }
    },
    series: [
      {
        name: '交易笔数',
        type: 'bar',
        barWidth: '40%',
        data: data.map(item => ({
          value: item.count,
          itemStyle: { color: item.pnl >= 0 ? '#3b82f6' : '#f59e0b' } // 蓝色代表该时间段整体盈利，橙色代表亏损
        })),
        itemStyle: { borderRadius: [4, 4, 0, 0] }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
}
