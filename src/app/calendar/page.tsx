"use client";

import { useState, useEffect, useMemo } from "react";
import { ProfitCalendar } from "@/components/ProfitCalendar";
import { Loader2, Search, User } from "lucide-react";
import { analyticsApi, accountsApi, type WeekdayStats, type DailyPnL, type ApiAccount } from "@/lib/api-client";
import { format, parseISO, startOfWeek } from "date-fns";
import ReactECharts from "echarts-for-react";
import { Card } from "@/components/Card";

type ViewLevel = 'daily' | 'weekly' | 'monthly' | 'yearly';

export default function CalendarPage() {
  const [weekdayStats, setWeekdayStats] = useState<WeekdayStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyPnL[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  
  // Filters state
  const [accountId, setAccountId] = useState<number | undefined>(undefined);
  const [symbol, setSymbol] = useState<string | undefined>(undefined);
  const [viewLevel, setViewLevel] = useState<ViewLevel>('daily');

  const filters = useMemo(() => ({
    apiKeyId: accountId,
    symbol: symbol,
  }), [accountId, symbol]);

  useEffect(() => {
    accountsApi.getList().then(setAccounts).catch(console.error);
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true);
        const [weekday, daily] = await Promise.all([
          analyticsApi.getWeekday(filters),
          analyticsApi.getDaily(undefined, undefined, filters),
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
  }, [filters]);

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

  // 聚合周度/月度/年度数据
  const aggregatedData = useMemo(() => {
    if (viewLevel === 'daily') return null;
    
    const map: Record<string, number> = {};
    dailyStats.forEach(d => {
      const date = parseISO(d.date);
      let key = '';
      if (viewLevel === 'weekly') {
        key = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
      } else if (viewLevel === 'monthly') {
        key = format(date, 'yyyy-MM');
      } else {
        key = format(date, 'yyyy');
      }
      map[key] = (map[key] || 0) + d.pnl;
    });
    
    const sortedKeys = Object.keys(map).sort();
    return {
      keys: sortedKeys,
      displayKeys: sortedKeys.map(k => {
        if (viewLevel === 'weekly') return format(parseISO(k), 'MM/dd') + '周';
        return k;
      }),
      values: sortedKeys.map(k => map[k]),
    };
  }, [dailyStats, viewLevel]);

  const chartOption = useMemo(() => {
    if (!aggregatedData) return {};
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a1e26',
        borderColor: '#2b313f',
        textStyle: { color: '#fff' },
        formatter: (params: any) => {
          const pnl = params[0].value;
          return `${params[0].name}<br/>净盈亏: <b style="color:${pnl >= 0 ? '#22ab94' : '#f23645'}">$${pnl.toFixed(2)}</b>`;
        }
      },
      grid: { left: '3%', right: '3%', top: '10%', bottom: '15%', containLabel: true },
      xAxis: {
        type: 'category',
        data: aggregatedData.displayKeys,
        axisLine: { lineStyle: { color: '#2b313f' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 }
      },
      yAxis: {
        type: 'value',
        splitLine: { lineStyle: { color: '#2b313f' } },
        axisLabel: { color: '#94a3b8', fontSize: 11 }
      },
      series: [
        {
          data: aggregatedData.values,
          type: 'bar',
          barMaxWidth: 40,
          itemStyle: {
            color: (params: any) => params.value >= 0 ? '#22ab94' : '#f23645',
            borderRadius: [4, 4, 0, 0]
          }
        }
      ]
    };
  }, [aggregatedData]);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-20">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">交易日历</h1>
          <p className="text-textMuted mt-1 text-lg">可视化您的每日盈亏分布与交易频率</p>
        </div>

        <div className="flex flex-wrap items-center gap-4 bg-panel/50 p-2 rounded-xl border border-border/50">
          {/* 账户选择 */}
          <div className="relative flex items-center">
            <div className="absolute left-3 text-textMuted pointer-events-none">
              <User size={14} />
            </div>
            <select 
              value={accountId || ''} 
              onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-background border border-border text-white text-sm rounded-lg pl-9 pr-8 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 appearance-none min-w-[140px] cursor-pointer"
            >
              <option value="">所有账户</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>{acc.name}</option>
              ))}
            </select>
          </div>

          {/* 交易对筛选 */}
          <div className="relative flex items-center">
            <div className="absolute left-3 text-textMuted pointer-events-none">
              <Search size={14} />
            </div>
            <input 
              type="text" 
              placeholder="交易对 (如 BTCUSDT)"
              value={symbol || ''}
              onChange={(e) => setSymbol(e.target.value.toUpperCase() || undefined)}
              className="bg-background border border-border text-white text-sm rounded-lg pl-9 pr-4 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 w-44"
            />
          </div>

          <div className="h-6 w-[1px] bg-border/50 mx-1 hidden sm:block"></div>

          {/* 视图切换单选按钮 */}
          <div className="flex bg-background border border-border rounded-lg p-1">
            {(['daily', 'weekly', 'monthly', 'yearly'] as ViewLevel[]).map((level) => (
              <button
                key={level}
                onClick={() => setViewLevel(level)}
                className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 ${
                  viewLevel === level 
                    ? 'bg-blue-600 text-white shadow-lg' 
                    : 'text-textMuted hover:text-white hover:bg-white/5'
                }`}
              >
                {level === 'daily' ? '每日' : level === 'weekly' ? '每周' : level === 'monthly' ? '每月' : '每年'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-5xl relative z-10">
        {viewLevel === 'daily' ? (
          <ProfitCalendar filters={filters} />
        ) : (
          <Card title={`${viewLevel === 'weekly' ? '每周' : viewLevel === 'monthly' ? '每月' : '每年'}盈亏统计`}>
            <div className="h-[450px] mt-4">
              {aggregatedData && aggregatedData.keys.length > 0 ? (
                <ReactECharts 
                  option={chartOption} 
                  style={{ height: '100%', width: '100%' }} 
                  theme="dark"
                  notMerge={true}
                  lazyUpdate={true}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-textMuted gap-2">
                  <div className="w-12 h-12 rounded-full bg-border/20 flex items-center justify-center">
                    <Search size={20} />
                  </div>
                  <p>暂无数据</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="animate-spin text-blue-500" size={32} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl relative z-10">
          <div className="bg-panel border border-border p-6 rounded-2xl shadow-sm hover:border-border/80 transition-colors">
            <h3 className="text-textMuted text-xs font-bold mb-2 uppercase tracking-widest">最佳交易日</h3>
            <div className={`text-2xl font-bold ${bestDay.avgPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              {bestDay.name}
            </div>
            <div className="text-xs text-textMuted mt-1 font-mono">
              平均盈亏: {bestDay.avgPnl >= 0 ? '+' : ''}${bestDay.avgPnl.toFixed(2)}
            </div>
          </div>
          <div className="bg-panel border border-border p-6 rounded-2xl shadow-sm hover:border-border/80 transition-colors">
            <h3 className="text-textMuted text-xs font-bold mb-2 uppercase tracking-widest">最差交易日</h3>
            <div className={`text-2xl font-bold ${worstDay.avgPnl >= 0 ? 'text-win' : 'text-loss'}`}>
              {worstDay.name}
            </div>
            <div className="text-xs text-textMuted mt-1 font-mono">
              平均盈亏: {worstDay.avgPnl >= 0 ? '+' : ''}${worstDay.avgPnl.toFixed(2)}
            </div>
          </div>
          <div className="bg-panel border border-border p-6 rounded-2xl shadow-sm hover:border-border/80 transition-colors">
            <h3 className="text-textMuted text-xs font-bold mb-2 uppercase tracking-widest">连胜记录</h3>
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
