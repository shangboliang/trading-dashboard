"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { analyticsApi, type WeekdayStats } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

export function WeekdayPerformanceChart() {
  const [data, setData] = useState<WeekdayStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const weekdayData = await analyticsApi.getWeekday();
        setData(weekdayData);
      } catch (err) {
        console.error('Failed to load weekday stats:', err);
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

  const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  // 转换数据格式
  const pnlData = weekdays.map((_, i) => {
    const found = data.find(d => d.rangeStart === i + 1);
    return found ? found.totalRealisedPnL.toFixed(2) : 0;
  });

  const option = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', top: '10%', containLabel: true },
    xAxis: {
      type: 'category',
      data: weekdays,
      axisLine: { lineStyle: { color: '#2B3139' } },
      axisLabel: { color: '#848E9C' }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#2B3139', type: 'dashed' } },
      axisLabel: { color: '#848E9C' }
    },
    series: [
      {
        name: '总盈亏',
        type: 'bar',
        barWidth: '60%',
        data: pnlData,
        itemStyle: {
          color: (params: any) => params.value >= 0 ? '#22ab94' : '#f23645',
          borderRadius: [4, 4, 0, 0]
        }
      }
    ]
  };

  return <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />;
}
