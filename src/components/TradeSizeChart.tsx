"use client";

import { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { analyticsApi, type SizeStats, type GlobalFilter } from "@/lib/api-client";
import { Loader2 } from "lucide-react";

interface TradeSizeChartProps {
  filters?: GlobalFilter;
}

export function TradeSizeChart({ filters }: TradeSizeChartProps) {
  const [data, setData] = useState<SizeStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const sizeData = await analyticsApi.getSize(filters);
        setData(sizeData);
      } catch (err) {
        console.error('Failed to load size stats:', err);
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

  const options = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      backgroundColor: "#1e222d",
      borderColor: "#2b313f",
      textStyle: { color: "#d1d4dc" },
    },
    legend: {
      textStyle: { color: "#787b86" },
      top: 0,
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#2b313f" } },
      axisLabel: { color: "#787b86" },
    },
    yAxis: {
      type: "category",
      data: data.map((item) => `> ${Math.round(item.rangeStart)}`),
      axisLabel: { color: "#787b86" },
      axisLine: { lineStyle: { color: "#2b313f" } },
    },
    series: [
      {
        name: "胜利",
        type: "bar",
        stack: "total",
        data: data.map((item) => item.wins.countLegs),
        itemStyle: { color: "#22ab94" },
      },
      {
        name: "损失",
        type: "bar",
        stack: "total",
        data: data.map((item) => item.loss.countLegs),
        itemStyle: { color: "#f23645" },
      },
    ],
  };

  return <ReactECharts option={options} style={{ height: "100%", width: "100%" }} />;
}
