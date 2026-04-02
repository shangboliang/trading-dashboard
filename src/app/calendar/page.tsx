"use client";

import { useState, useEffect } from "react";
import { ProfitCalendar } from "@/components/ProfitCalendar";
import { ChevronDown, SlidersHorizontal, Loader2 } from "lucide-react";
import { analyticsApi, type WeekdayStats, type DailyPnL } from "@/lib/api-client";

export default function CalendarPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [weekdayStats, setWeekdayStats] = useState<WeekdayStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyPnL[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [weekday, daily] = await Promise.all([
          analyticsApi.getWeekday(),
          analyticsApi.getDaily(),
        ]);
        setWeekdayStats(weekday);
        setDailyStats(daily);
      } catch (err) {
        console.error('Failed to load calendar stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  // 计算最佳和最差交易日
  const weekdayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  let bestDay = { name: '无', avgPnl: 0 };
  let worstDay = { name: '无', avgPnl: 0 };

  if (weekdayStats.length > 0) {
    const weekdaysWithAvg = weekdayStats.map(ws => ({
      name: weekdayNames[ws.rangeStart - 1] || '未知',
      avgPnl: ws.countLegs > 0 ? ws.totalRealisedPnL / ws.countLegs : 0,
      total: ws.totalRealisedPnL,
    }));

    const sorted = [...weekdaysWithAvg].sort((a, b) => b.avgPnl - a.avgPnl);
    if (sorted.length > 0) {
      bestDay = sorted[0];
      worstDay = sorted[sorted.length - 1];
    }
  }

  // 计算连胜记录
  let maxStreak = 0;
  let currentStreak = 0;
  let streakStart = '';
  let streakEnd = '';
  let currentStreakStart = '';

  if (dailyStats.length > 0) {
    const sortedDaily = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date));

    sortedDaily.forEach(day => {
      if (day.pnl > 0) {
        if (currentStreak === 0) {
          currentStreakStart = day.date;
        }
        currentStreak++;
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          streakStart = currentStreakStart;
          streakEnd = day.date;
        }
      } else {
        currentStreak = 0;
      }
    });
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const [y, m, d] = dateStr.split('-');
    return `${parseInt(m)}月 ${parseInt(d)}日`;
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-end relative z-20">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">交易日历</h1>
          <p className="text-textMuted mt-2 text-lg">可视化您的每日盈亏分布与交易频率</p>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="bg-panel border border-border px-4 py-2 rounded-md text-sm text-textMain hover:bg-panel/80 transition-colors flex items-center gap-2"
          >
            <SlidersHorizontal size={14} />
            <span>筛选器</span>
            <ChevronDown size={14} className={`transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
          </button>

          {isFilterOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-panel border border-border rounded-lg shadow-xl p-4 z-50">
              <div className="mb-4">
                <label className="text-xs font-semibold text-textMuted block mb-1">选择账户</label>
                <select className="w-full bg-background border border-border text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500">
                  <option value="all">全账户汇总</option>
                  <option value="1">Binance 主账户</option>
                  <option value="2">OKX 冲锋号</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="text-xs font-semibold text-textMuted block mb-1">交易对</label>
                <select className="w-full bg-background border border-border text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500">
                  <option>全部交易对</option>
                  <option>BTC/USDT</option>
                  <option>ETH/USDT</option>
                  <option>SOL/USDT</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="text-xs font-semibold text-textMuted block mb-1">视图层级</label>
                <select defaultValue="monthly" className="w-full bg-background border border-border text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500">
                  <option value="weekly">每周</option>
                  <option value="monthly">每月</option>
                  <option value="quarterly">每季度</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="text-xs font-semibold text-textMuted block mb-1">指定年份</label>
                <select defaultValue="2026" className="w-full bg-background border border-border text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500">
                  <option value="2026">2026 年</option>
                  <option value="2025">2025 年</option>
                  <option value="2024">2024 年</option>
                </select>
              </div>
              <button
                onClick={() => setIsFilterOpen(false)}
                className="w-full bg-blue-600/20 text-blue-500 font-medium text-sm py-2 rounded-md hover:bg-blue-600/30 transition-colors"
              >
                应用筛选
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-5xl relative z-10">
        <ProfitCalendar />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl relative z-10">
          <div className="bg-panel border border-border p-6 rounded-2xl">
            <h3 className="text-textMuted text-sm font-medium mb-2 uppercase tracking-wider">最佳交易日</h3>
            <div className={`text-2xl font-bold ${bestDay.avgPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              {bestDay.name}
            </div>
            <div className="text-xs text-textMuted mt-1">
              平均盈亏: {bestDay.avgPnl >= 0 ? '+' : ''}${bestDay.avgPnl.toFixed(2)}
            </div>
          </div>
          <div className="bg-panel border border-border p-6 rounded-2xl">
            <h3 className="text-textMuted text-sm font-medium mb-2 uppercase tracking-wider">最差交易日</h3>
            <div className={`text-2xl font-bold ${worstDay.avgPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              {worstDay.name}
            </div>
            <div className="text-xs text-textMuted mt-1">
              平均盈亏: {worstDay.avgPnl >= 0 ? '+' : ''}${worstDay.avgPnl.toFixed(2)}
            </div>
          </div>
          <div className="bg-panel border border-border p-6 rounded-2xl">
            <h3 className="text-textMuted text-sm font-medium mb-2 uppercase tracking-wider">连胜记录</h3>
            <div className="text-2xl font-bold text-blue-500">{maxStreak} 天</div>
            <div className="text-xs text-textMuted mt-1">
              {maxStreak > 0 && streakStart && streakEnd
                ? `发生在 ${formatDate(streakStart)} - ${formatDate(streakEnd)}`
                : '暂无连胜记录'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
