"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createChart, ColorType, Time, CandlestickData } from "lightweight-charts";

interface KLineChartProps {
  symbol: string;       // DB 格式，如 "BTCUSDT"
  openDate: string;
  closeDate: string | null;
  openPrice: number;
  closePrice: number | null;
  side: string;         // "LONG" | "SHORT" | "buy" | "sell"
}

// 根据持仓时长自动选取合适的 K 线周期
function resolveInterval(openDate: string, closeDate: string | null) {
  const open  = new Date(openDate).getTime();
  const close = closeDate ? new Date(closeDate).getTime() : Date.now();
  const dur   = close - open;
  const H = 3_600_000;

  if (dur < 2 * H)        return { interval: '1m',  paddingMs: 30 * 60_000 };
  if (dur < 12 * H)       return { interval: '5m',  paddingMs: 2 * H };
  if (dur < 3 * 24 * H)   return { interval: '1h',  paddingMs: 6 * H };
  if (dur < 14 * 24 * H)  return { interval: '4h',  paddingMs: 24 * H };
  return                         { interval: '1d',  paddingMs: 3 * 24 * H };
}

// Binance 返回的 kline 数组: [openTime, open, high, low, close, ...]
type BinanceKline = [number, string, string, string, string, ...unknown[]];

async function fetchKlines(
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number,
  useProxy: boolean
): Promise<BinanceKline[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    startTime: String(startTime),
    endTime:   String(endTime),
    limit:     '1500',
  });

  const url = useProxy
    ? `/api/klines?${params}`
    : `https://fapi.binance.com/fapi/v1/klines?${params}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function KLineChart({
  symbol,
  openDate,
  closeDate,
  openPrice,
  closePrice,
  side,
}: KLineChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');

  const isLong = side === 'LONG' || side === 'buy';

  const load = useCallback(async () => {
    setStatus('loading');
    const { interval, paddingMs } = resolveInterval(openDate, closeDate);
    const startTime = new Date(openDate).getTime() - paddingMs;
    const endTime   = (closeDate ? new Date(closeDate).getTime() : Date.now()) + paddingMs;

    let klines: BinanceKline[] | null = null;

    // 1️⃣ 优先尝试浏览器直连
    try {
      klines = await fetchKlines(symbol, interval, startTime, endTime, false);
    } catch {
      // 直连失败 → 降级到服务端代理
      try {
        klines = await fetchKlines(symbol, interval, startTime, endTime, true);
      } catch (err) {
        setErrMsg(err instanceof Error ? err.message : String(err));
        setStatus('error');
        return;
      }
    }

    if (!klines || klines.length === 0) {
      setErrMsg('无 K 线数据');
      setStatus('error');
      return;
    }

    setStatus('ok');
    renderChart(klines, interval);
  }, [symbol, openDate, closeDate, openPrice, closePrice, side]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  function renderChart(klines: BinanceKline[], interval: string) {
    if (!containerRef.current) return;

    // 清空旧图表
    containerRef.current.innerHTML = '';

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b313f' },
        horzLines: { color: '#2b313f' },
      },
      width:  containerRef.current.clientWidth,
      height: 300,
      timeScale: {
        timeVisible: true,
        secondsVisible: interval === '1m',
      },
    });

    const series = chart.addCandlestickSeries({
      upColor:      '#22ab94',
      downColor:    '#f23645',
      borderVisible: false,
      wickUpColor:  '#22ab94',
      wickDownColor:'#f23645',
    });

    const data: CandlestickData<Time>[] = klines.map(k => ({
      time:  Math.floor(k[0] / 1000) as Time,
      open:  parseFloat(k[1] as string),
      high:  parseFloat(k[2] as string),
      low:   parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
    }));

    series.setData(data);

    // 标记开仓点
    const markers: any[] = [
      {
        time:     Math.floor(new Date(openDate).getTime() / 1000) as Time,
        position: isLong ? 'belowBar' : 'aboveBar',
        color:    isLong ? '#22ab94' : '#f23645',
        shape:    isLong ? 'arrowUp' : 'arrowDown',
        text:     `OPEN $${openPrice}`,
      },
    ];

    // 标记平仓点（仅已平仓）
    if (closeDate && closePrice != null) {
      markers.push({
        time:     Math.floor(new Date(closeDate).getTime() / 1000) as Time,
        position: isLong ? 'aboveBar' : 'belowBar',
        color:    isLong ? '#f23645' : '#22ab94',
        shape:    isLong ? 'arrowDown' : 'arrowUp',
        text:     `CLOSE $${closePrice}`,
      });
    }

    series.setMarkers(markers);
    chart.timeScale().fitContent();

    const onResize = () => {
      chart.applyOptions({ width: containerRef.current?.clientWidth });
    };
    window.addEventListener('resize', onResize);

    // 组件卸载时清理
    containerRef.current.dataset.cleanup = 'pending';
    const cleanup = () => {
      window.removeEventListener('resize', onResize);
      chart.remove();
    };
    (containerRef.current as any)._chartCleanup = cleanup;
  }

  // 组件卸载时销毁图表
  useEffect(() => {
    return () => {
      const el = containerRef.current as any;
      el?._chartCleanup?.();
    };
  }, []);

  return (
    <div className="relative w-full h-[300px]">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center text-textMuted text-sm">
          加载 K 线中...
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
          <span className="text-textMuted text-sm">K 线加载失败：{errMsg}</span>
          <button
            onClick={load}
            className="text-xs text-blue-400 hover:underline"
          >
            重试
          </button>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
}
