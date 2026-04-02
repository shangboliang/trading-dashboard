"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { analyticsApi, type WeekdayStats } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DailyPerformanceChart() {
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

  // 转换数据
  const chartData = DAYS.map((day, index) => {
    // rangeStart 1=Monday, 2=Tuesday...
    const match = data.find(w => w.rangeStart === index + 1);
    return match ? match.totalRealisedPnL : 0;
  });

  const options = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      backgroundColor: "#1e222d",
      borderColor: "#2b313f",
      textStyle: { color: "#d1d4dc" },
      formatter: (params: any) => {
        const val = params[0].value;
        return `${params[0].name}<br/>PNL: <span style="color:${val >= 0 ? '#22ab94' : '#f23645'}">${val >= 0 ? '+' : ''}$${val.toFixed(2)}</span>`;
      }
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: DAYS,
      axisLabel: { color: "#787b86" },
      axisLine: { lineStyle: { color: "#2b313f" } },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#2b313f", type: 'dashed' } },
      axisLabel: { color: "#787b86", formatter: '${value}' },
    },
    series: [
      {
        data: chartData,
        type: "bar",
        itemStyle: {
          color: (params: any) => params.value >= 0 ? "#22ab94" : "#f23645"
        },
      },
    ],
  };

  return <ReactECharts option={options} style={{ height: "100%", width: "100%" }} />;
}
