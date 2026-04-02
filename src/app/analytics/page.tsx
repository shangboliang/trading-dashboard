"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/Card";
import { WeekdayPerformanceChart } from "@/components/WeekdayPerformanceChart";
import { HourlyPerformanceChart } from "@/components/HourlyPerformanceChart";
import { TradeSizeChart } from "@/components/TradeSizeChart";
import { TradeDurationChart } from "@/components/TradeDurationChart";
import { WinRateCircleChart } from "@/components/WinRateCircleChart";
import { analyticsApi, type SummaryStats, type SymbolStats } from "@/lib/api-client";
import { ChevronDown, SlidersHorizontal, ShieldAlert, Loader2 } from "lucide-react";

export default function AnalyticsPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [symbolReports, setSymbolReports] = useState<SymbolStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [summaryData, symbolData] = await Promise.all([
          analyticsApi.getSummary(),
          analyticsApi.getBySymbol(),
        ]);
        setSummary(summaryData);
        setSymbolReports(symbolData || []);
      } catch (err) {
        console.error('Failed to load analytics data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  // Fallback to 0 if data is not available yet
  const data = summary || {
    totalRealisedPnL: 0,
    avgRealisedPnL: 0,
    winRate: 0,
    profitFactor: 0,
    totalCommission: 0,
    avgDuration: 0,
    countPositions: 0,
    wins: { countLegs: 0, totalRealisedPnL: 0, avgRealisedPnL: 0 },
    loss: { countLegs: 0, totalRealisedPnL: 0, avgRealisedPnL: 0 },
  };

  // 1. 核心大指标数据计算
  const winRateNum = data.winRate;
  const totalVolume = 0; // Requires order matching volume, default 0
  const lsRatio = "0.00"; // Requires detailed LS counting, default 0
  
  // 2. 详细统计资料计算
  const netProfit = data.totalRealisedPnL;
  const profitLossRatio = data.profitFactor > 0 && data.profitFactor !== 999 
    ? data.profitFactor.toFixed(2) 
    : data.profitFactor === 999 ? "∞" : "0.00";
  const avgDailyGain = (netProfit / 30).toFixed(2); 
  const avgDailyVolume = (totalVolume / 30).toFixed(2);
  const maxConsecutiveWins = 0; 
  const maxConsecutiveLosses = 0; 
  const maxDrawdown = 0; 

  // Format duration
  const formatDuration = (seconds: number) => {
    if (!seconds) return '0分钟';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}天 ${h}小时`;
    if (h > 0) return `${h}小时 ${m}分钟`;
    return `${m}分钟`;
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 头部与筛选器 */}
      <header className="flex justify-between items-end relative z-20">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">深入分析</h1>
          <p className="text-textMuted mt-2 text-sm">解构您的交易表现细节</p>
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
                <label className="text-xs font-semibold text-textMuted block mb-1">时间范围 (Timeframe)</label>
                <select defaultValue="30d" className="w-full bg-background border border-border text-white text-sm rounded-md px-2 py-1.5 focus:outline-none focus:border-blue-500">
                  <option value="7d">最近 7 天</option>
                  <option value="30d">最近 30 天</option>
                </select>
              </div>
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="w-full bg-blue-600/20 text-blue-500 font-medium text-sm py-2 rounded-md hover:bg-blue-600/30 transition-colors"
              >
                关闭
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 第一层：4个核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        <Card title="总交易单数 (Total Legs)">
           <div className="text-2xl font-bold font-mono">{data.countPositions}</div>
        </Card>
        <Card title="综合胜率 (Win Rate)">
           <div className="text-2xl font-bold font-mono">{(winRateNum * 100).toFixed(1)}%</div>
        </Card>
        <Card title="平均持仓时间 (Avg Duration)">
           <div className="text-2xl font-bold font-mono">{formatDuration(data.avgDuration)}</div>
        </Card>
        <Card title="总手续费 (Total Comm)">
           <div className="text-2xl font-bold font-mono text-loss">-${data.totalCommission.toFixed(2)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        <div className="lg:col-span-1">
          <Card title="统计资料 (Statistics)" className="h-full">
             <div className="space-y-4 text-sm mt-2">
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">净利润额</span>
                  <span className={`font-mono font-bold ${netProfit >= 0 ? 'text-win' : 'text-loss'}`}>${netProfit.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">盈亏比 (P/L Ratio)</span>
                  <span className="font-mono font-bold text-blue-400">{profitLossRatio}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">日均增益 (按30天)</span>
                  <span className="font-mono font-bold text-win">${avgDailyGain}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">日均成交量</span>
                  <span className="font-mono">${Number(avgDailyVolume).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">交易总量 (单)</span>
                  <span className="font-mono">{data.countPositions}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">平均交易成功盈利</span>
                  <span className="font-mono text-win">+${data.wins.avgRealisedPnL.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">平均交易损失</span>
                  <span className="font-mono text-loss">-${Math.abs(data.loss.avgRealisedPnL).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">最大连续利润次数</span>
                  <span className="font-mono text-win">{maxConsecutiveWins}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">最大连续亏损次数</span>
                  <span className="font-mono text-loss">{maxConsecutiveLosses}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-textMuted flex items-center gap-1"><ShieldAlert size={14} className="text-orange-500"/>重大损失 (Max Drawdown)</span>
                  <span className="font-mono font-bold text-loss">-${Math.abs(maxDrawdown).toFixed(2)}</span>
                </div>
             </div>
          </Card>
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
           <Card title="整体表现拆解">
              <div className="grid grid-cols-2 gap-8 mt-4">
                 <WinRateCircleChart title="总体交易胜率" winRate={winRateNum * 100} color="#22ab94" />
                 <WinRateCircleChart title="总体交易亏损率" winRate={(1 - winRateNum) * 100} color="#f59e0b" />
              </div>
              <div className="grid grid-cols-2 gap-8 mt-8 border-t border-border pt-6">
                 <div className="text-center">
                    <div className="text-xs text-textMuted mb-1">平均单笔盈利</div>
                    <div className="text-xl font-bold font-mono text-win">${data.wins.avgRealisedPnL.toFixed(2)}</div>
                 </div>
                 <div className="text-center">
                    <div className="text-xs text-textMuted mb-1">平均单笔亏损</div>
                    <div className="text-xl font-bold font-mono text-loss">-${Math.abs(data.loss.avgRealisedPnL).toFixed(2)}</div>
                 </div>
              </div>
           </Card>
        </div>
      </div>

      <div className="relative z-10">
        <Card title="交易币种报告 (Symbol Report)">
          {symbolReports.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-textMuted text-sm">暂无数据</div>
          ) : (
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead className="border-b border-border text-xs text-textMuted uppercase bg-panel/30">
                   <tr>
                     <th className="py-3 px-4 font-medium">符号 (Symbol)</th>
                     <th className="py-3 px-4 font-medium text-right">交易次数</th>
                     <th className="py-3 px-4 font-medium text-right">获胜百分比</th>
                     <th className="py-3 px-4 font-medium text-right">盈亏比</th>
                     <th className="py-3 px-4 font-medium text-right">平均持仓时间</th>
                     <th className="py-3 px-4 font-medium text-right">平均收益</th>
                     <th className="py-3 px-4 font-medium text-right">总净利润</th>
                   </tr>
                 </thead>
                 <tbody className="text-sm divide-y divide-border/50">
                    {symbolReports.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors group">
                        <td className="py-3 px-4 font-bold text-white group-hover:text-blue-400 transition-colors">
                          {row.symbol}
                        </td>
                        <td className="py-3 px-4 text-right text-textMuted font-mono">
                          {row.countLegs}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono">{(row.winRate * 100).toFixed(1)}%</span>
                            <div className="w-12 h-1.5 bg-background rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${row.winRate * 100}%` }}></div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-textMuted">
                          {row.profitFactor === 999 ? '∞' : (row.profitFactor || 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-textMuted">
                          {formatDuration(row.avgDuration)}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold font-mono ${row.avgPnL >= 0 ? 'text-win' : 'text-loss'}`}>
                          {row.avgPnL >= 0 ? '+' : ''}${row.avgPnL.toFixed(2)}
                        </td>
                        <td className={`py-3 px-4 text-right font-bold font-mono ${row.totalPnL >= 0 ? 'text-win' : 'text-loss'}`}>
                          {row.totalPnL >= 0 ? '+' : ''}${row.totalPnL.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                 </tbody>
               </table>
            </div>
          )}
        </Card>
      </div>

      <h2 className="text-xl font-bold text-white mt-12 mb-4 border-b border-border pb-2">多维图表分析</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        <Card title="按天计算的结果 (Weekday PnL)" className="h-[350px]">
          {summary?.countPositions === 0 ? <div className="flex justify-center items-center h-full text-textMuted text-sm">暂无数据</div> : <WeekdayPerformanceChart />}
        </Card>
        <Card title="按时间分列计算的 (Hourly PnL)" className="h-[350px]">
          {summary?.countPositions === 0 ? <div className="flex justify-center items-center h-full text-textMuted text-sm">暂无数据</div> : <HourlyPerformanceChart />}
        </Card>
        <Card title="交易持续时间报告 (Duration Report)" className="h-[350px]">
          {summary?.countPositions === 0 ? <div className="flex justify-center items-center h-full text-textMuted text-sm">暂无数据</div> : <TradeDurationChart />}
        </Card>
        <Card title="交易规模报告 (Size Report)" className="h-[350px]">
          {summary?.countPositions === 0 ? <div className="flex justify-center items-center h-full text-textMuted text-sm">暂无数据</div> : <TradeSizeChart />}
        </Card>
      </div>

    </div>
  );
}
