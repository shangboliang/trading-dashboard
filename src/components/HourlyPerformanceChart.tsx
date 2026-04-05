"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { analyticsApi, type HourlyStats, type GlobalFilter } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

interface HourlyPerformanceChartProps {
  filters?: GlobalFilter;
}

export function HourlyPerformanceChart({ filters }: HourlyPerformanceChartProps) {
  const [data, setData] = useState<HourlyStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const hourlyData = await analyticsApi.getHourly(filters);
        setData(hourlyData);
      } catch (err) {
        console.error('Failed to load hourly stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [filters]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  const hours = Array.from({ length: 24 }).map((_, i) => `${i}:00`);

  // 转换数据格式
  const pnlData = Array.from({ length: 24 }).map((_, i) => {
    const found = data.find(d => d.rangeStart === i);
    return found ? found.totalRealisedPnL.toFixed(2) : 0;
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: hours,
      axisLine: { lineStyle: { color: '#2B3139' } },
      axisLabel: { color: '#848E9C', interval: 2 }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#2B3139', type: 'dashed' } },
      axisLabel: { color: '#848E9C' }
    },
    series: [
      {
        name: '每小时盈亏',
        type: 'line',
        smooth: true,
        data: pnlData,
        itemStyle: { color: '#3b82f6' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0)' }
            ]
          }
        },
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
}
