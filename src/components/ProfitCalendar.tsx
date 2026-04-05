"use client";

import { useState, useEffect } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, addYears, subYears } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import { analyticsApi, type DailyPnL } from "@/lib/api-client";

export function ProfitCalendar({ filters }: { filters?: any }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [dailyData, setDailyData] = useState<DailyPnL[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const data = await analyticsApi.getDaily(undefined, undefined, filters);
        setDailyData(data);
      } catch (err) {
        console.error('Failed to load daily PnL:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [filters]);

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentMonth)),
    end: endOfWeek(endOfMonth(currentMonth)),
  });

  // 获取每日盈亏
  const getDailyPnL = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const found = dailyData.find(d => d.date === dateStr);
    return found ? found.pnl : 0;
  };

  // 计算当月总盈亏
  const currentMonthPnL = dailyData
    .filter(d => {
      const date = new Date(d.date);
      return isSameMonth(date, currentMonth);
    })
    .reduce((sum, d) => sum + d.pnl, 0);

  // 计算当月获胜天数
  const winningDays = dailyData
    .filter(d => {
      const date = new Date(d.date);
      return isSameMonth(date, currentMonth) && d.pnl > 0;
    }).length;

  if (loading) {
    return (
      <div className="bg-panel border border-border rounded-2xl overflow-hidden shadow-xl flex items-center justify-center h-[500px]">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  return (
    <div className="bg-panel border border-border rounded-2xl overflow-hidden shadow-xl">
      {/* 日历头部 */}
      <div className="p-6 border-b border-border flex items-center justify-between bg-white/5">
        <h2 className="text-xl font-bold text-white flex items-center gap-3">
          <span className="bg-blue-600 w-2 h-6 rounded-full"></span>
          {format(currentMonth, 'yyyy年 MMMM', { locale: zhCN })}
        </h2>
        <div className="flex gap-2">
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setCurrentMonth(subYears(currentMonth, 1))}
              className="p-2 hover:bg-white/10 text-textMuted hover:text-white transition-colors border-r border-border"
              title="上一年"
            >
              <ChevronsLeft size={20} />
            </button>
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-white/10 text-textMuted hover:text-white transition-colors"
              title="上个月"
            >
              <ChevronLeft size={20} />
            </button>
          </div>
          <button
            onClick={() => setCurrentMonth(new Date())}
            className="px-4 hover:bg-white/10 text-textMuted hover:text-white transition-colors border border-border rounded-lg text-sm font-medium"
          >
            今天
          </button>
          <div className="flex border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-white/10 text-textMuted hover:text-white transition-colors border-r border-border"
              title="下个月"
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={() => setCurrentMonth(addYears(currentMonth, 1))}
              className="p-2 hover:bg-white/10 text-textMuted hover:text-white transition-colors"
              title="下一年"
            >
              <ChevronsRight size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* 星期表头 */}
      <div className="grid grid-cols-7 bg-panel/50 border-b border-border">
        {['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map((day) => (
          <div key={day} className="py-3 text-center text-xs font-bold text-textMuted uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* 日历网格 */}
      <div className="grid grid-cols-7">
        {days.map((day, idx) => {
          const pnl = getDailyPnL(day);
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toString()}
              className={`min-h-[120px] p-2 border-r border-b border-border last:border-r-0 relative transition-colors hover:bg-white/5 group
                ${!isCurrentMonth ? 'opacity-20 bg-black/20' : ''}
                ${isToday ? 'bg-blue-600/5' : ''}
              `}
            >
              <span className={`text-sm font-medium ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-textMuted'}`}>
                {format(day, 'd')}
              </span>

              {isCurrentMonth && pnl !== 0 && (
                <div className="mt-2 flex flex-col items-center justify-center h-16">
                  <div className={`text-sm font-bold font-mono ${pnl > 0 ? 'text-win' : 'text-loss'}`}>
                    {pnl > 0 ? '+' : ''}${Math.abs(pnl).toFixed(2)}
                  </div>
                  <div className={`w-full h-1 rounded-full mt-2 opacity-30 ${pnl > 0 ? 'bg-win' : 'bg-loss'}`}
                       style={{ width: `${Math.min(Math.abs(pnl) / 5, 100)}%` }}></div>
                </div>
              )}

              {/* 装饰性小圆点 */}
              {isCurrentMonth && pnl === 0 && (
                <div className="absolute bottom-2 right-2 w-1 h-1 rounded-full bg-border"></div>
              )}
            </div>
          );
        })}
      </div>

      {/* 底部统计 */}
      <div className="p-4 bg-panel/80 flex justify-end gap-8 text-sm border-t border-border">
        <div className="flex items-center gap-2">
          <span className="text-textMuted">月度净盈亏:</span>
          <span className={`font-bold font-mono ${currentMonthPnL >= 0 ? 'text-win' : 'text-loss'}`}>
            {currentMonthPnL >= 0 ? '+' : ''}${currentMonthPnL.toFixed(2)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-textMuted">获胜天数:</span>
          <span className="font-bold text-white">{winningDays} 天</span>
        </div>
      </div>
    </div>
  );
}
