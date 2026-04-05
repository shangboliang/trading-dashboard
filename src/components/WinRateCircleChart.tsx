"use client";

import ReactECharts from "echarts-for-react";

interface WinRateCircleChartProps {
  title: string;
  winRate: number;
  color: string;
}

export function WinRateCircleChart({ title, winRate, color }: WinRateCircleChartProps) {
  const displayRate = isNaN(winRate) ? 0 : winRate;
  
  const option = {
    backgroundColor: 'transparent',
    title: {
      text: `${displayRate.toFixed(2)}%`,
      left: 'center',
      top: 'center',
      textStyle: {
        color: '#EAECEF',
        fontSize: 24,
        fontWeight: 'bold',
        fontFamily: 'monospace'
      }
    },
    series: [
      {
        type: 'pie',
        radius: ['65%', '85%'],
        avoidLabelOverlap: false,
        label: { show: false },
        labelLine: { show: false },
        data: [
          { 
            value: displayRate, 
            name: '获胜', 
            itemStyle: { color: color } 
          },
          { 
            value: Math.max(0, 100 - displayRate), 
            name: '失败', 
            itemStyle: { color: '#2B3139' } 
          }
        ]
      }
    ]
  };

  return (
    <div className="flex flex-col items-center">
      <h3 className="text-sm font-semibold text-textMuted mb-2">{title}</h3>
      <ReactECharts option={option} style={{ height: '180px', width: '100%' }} />
    </div>
  );
}
