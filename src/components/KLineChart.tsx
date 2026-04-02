"use client";

import { useEffect, useRef } from "react";
import { createChart, ColorType, Time, CandlestickData } from "lightweight-charts";

interface KLineChartProps {
  symbol: string;
  openDate: string;
  closeDate: string;
  openPrice: number;
  closePrice: number;
  side: "buy" | "sell";
}

export function KLineChart({ symbol, openDate, closeDate, openPrice, closePrice, side }: KLineChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#d1d4dc",
      },
      grid: {
        vertLines: { color: "#2b313f" },
        horzLines: { color: "#2b313f" },
      },
      width: chartContainerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: "#22ab94",
      downColor: "#f23645",
      borderVisible: false,
      wickUpColor: "#22ab94",
      wickDownColor: "#f23645",
    });

    // 模拟数据 - 实际应从 API 获取
    const data: CandlestickData<Time>[] = [
      {
        time: new Date(openDate).getTime() / 1000 as Time,
        open: openPrice * 0.98,
        high: openPrice * 1.02,
        low: openPrice * 0.97,
        close: openPrice,
      },
      {
        time: (new Date(openDate).getTime() / 1000 + 3600) as Time,
        open: openPrice,
        high: openPrice * 1.05,
        low: openPrice * 0.95,
        close: openPrice * 1.03,
      },
      {
        time: (new Date(openDate).getTime() / 1000 + 7200) as Time,
        open: openPrice * 1.03,
        high: openPrice * 1.08,
        low: openPrice * 1.01,
        close: closePrice,
      },
      {
        time: new Date(closeDate).getTime() / 1000 as Time,
        open: closePrice * 0.99,
        high: closePrice * 1.02,
        low: closePrice * 0.98,
        close: closePrice,
      },
    ];

    candlestickSeries.setData(data);

    // 添加开平仓标记
    candlestickSeries.setMarkers([
      {
        time: new Date(openDate).getTime() / 1000 as Time,
        position: side === "buy" ? "belowBar" : "aboveBar",
        color: side === "buy" ? "#22ab94" : "#f23645",
        shape: side === "buy" ? "arrowUp" : "arrowDown",
        text: "OPEN",
      },
      {
        time: new Date(closeDate).getTime() / 1000 as Time,
        position: side === "buy" ? "aboveBar" : "belowBar",
        color: side === "buy" ? "#f23645" : "#22ab94",
        shape: side === "buy" ? "arrowDown" : "arrowUp",
        text: "CLOSE",
      },
    ]);

    chart.timeScale().fitContent();

    const handleResize = () => {
      chart.applyOptions({ width: chartContainerRef.current?.clientWidth });
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [openDate, closeDate, side, openPrice, closePrice]);

  return <div ref={chartContainerRef} className="w-full h-[300px]" />;
}
