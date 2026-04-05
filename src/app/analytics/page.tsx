"use client";

import { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/Card";
import { WeekdayPerformanceChart } from "@/components/WeekdayPerformanceChart";
import { HourlyPerformanceChart } from "@/components/HourlyPerformanceChart";
import { TradeSizeChart } from "@/components/TradeSizeChart";
import { TradeDurationChart } from "@/components/TradeDurationChart";
import { WinRateCircleChart } from "@/components/WinRateCircleChart";
import { analyticsApi, accountsApi, type SummaryStats, type SymbolStats, type GlobalFilter, type ApiAccount } from "@/lib/api-client";
import { ChevronDown, SlidersHorizontal, ShieldAlert, Loader2, Info, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw  } from "lucide-react";
import { subDays, startOfDay, endOfDay, formatISO } from "date-fns";


type SortColumn = 'symbol' | 'countLegs' | 'winRate' | 'profitFactor' | 'avgDuration' | 'avgPnL' | 'totalPnL';

export default function AnalyticsPage() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  
  // 筛选器状态
  const [timeframe, setTimeframe] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [selectedSymbol, setSelectedSymbol] = useState<string | undefined>(undefined);

  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [symbolReports, setSymbolReports] = useState<SymbolStats[]>([]);
  const [loading, setLoading] = useState(true);

  // 排序状态
  const [sortColumn, setSortColumn] = useState<SortColumn>('totalPnL');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // 计算 GlobalFilter 对象
  const filters = useMemo((): GlobalFilter => {
    let startDate: string | undefined;
    let endDate = formatISO(endOfDay(new Date()));

    if (timeframe === '7d') {
      startDate = formatISO(startOfDay(subDays(new Date(), 7)));
    } else if (timeframe === '30d') {
      startDate = formatISO(startOfDay(subDays(new Date(), 30)));
    } else if (timeframe === '90d') {
      startDate = formatISO(startOfDay(subDays(new Date(), 90)));
    } else if (timeframe === '1y') {
      startDate = formatISO(startOfDay(subDays(new Date(), 365)));
    } else if (timeframe === 'custom') {
      if (customStartDate) startDate = formatISO(startOfDay(new Date(customStartDate)));
      if (customEndDate) endDate = formatISO(endOfDay(new Date(customEndDate)));
    }

    return {
      startDate,
      endDate,
      apiKeyId: selectedAccountId,
      symbol: selectedSymbol,
    };
  }, [timeframe, customStartDate, customEndDate, selectedAccountId, selectedSymbol]);

  // 加载账户列表
  useEffect(() => {
    accountsApi.getList().then(setAccounts).catch(console.error);
  }, []);

  // 核心数据加载
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [summaryData, symbolData] = await Promise.all([
          analyticsApi.getSummary(filters),
          analyticsApi.getBySymbol(filters),
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
  }, [filters]);

  // 1. 核心大指标数据计算
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

  const winRateNum = data.winRate;
  const netProfit = data.totalRealisedPnL;
  const profitLossRatio = data.profitFactor > 0 && data.profitFactor !== 999 
    ? data.profitFactor.toFixed(2) 
    : data.profitFactor === 999 ? "∞" : "0.00";

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

  // 排序处理
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Symbol Report Pagination
  const [symbolPage, setSymbolPage] = useState(1);
  const symbolPageSize = 10;

  const sortedSymbolReports = useMemo(() => {
    return [...symbolReports].sort((a, b) => {
      let valA: any = a[sortColumn];
      let valB: any = b[sortColumn];
      
      if (sortColumn === 'profitFactor') {
        valA = valA === 999 ? Infinity : (valA || 0);
        valB = valB === 999 ? Infinity : (valB || 0);
      } else {
        valA = valA || 0;
        valB = valB || 0;
      }
      
      // string comparison for symbol
      if (sortColumn === 'symbol') {
        return sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [symbolReports, sortColumn, sortDirection]);

  // Handle page resets when sorting or filtering changes
  useEffect(() => {
    setSymbolPage(1);
  }, [sortedSymbolReports.length, sortColumn, sortDirection]);

  const paginatedSymbolReports = useMemo(() => {
    const start = (symbolPage - 1) * symbolPageSize;
    return sortedSymbolReports.slice(start, start + symbolPageSize);
  }, [sortedSymbolReports, symbolPage]);

  const totalSymbolPages = Math.ceil(sortedSymbolReports.length / symbolPageSize);

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown size={14} className="inline ml-1 opacity-40 group-hover:opacity-100" />;
    return sortDirection === 'asc' ? <ArrowUp size={14} className="inline ml-1 text-blue-400" /> : <ArrowDown size={14} className="inline ml-1 text-blue-400" />;
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 头部与筛选器 */}
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative z-20">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">深入分析</h1>
          <p className="text-textMuted mt-2 text-sm">解构您的交易表现细节</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto bg-panel/40 p-4 rounded-xl border border-border/50">
          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider ml-1">时间范围</label>
            <div className="flex items-center gap-2">
              <select 
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="bg-panel border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-all hover:bg-white/5 cursor-pointer"
              >
                <option value="all" className="bg-[#1e222d]">全部时间</option>
                <option value="7d" className="bg-[#1e222d]">最近 7 天</option>
                <option value="30d" className="bg-[#1e222d]">最近 30 天</option>
                <option value="90d" className="bg-[#1e222d]">最近 90 天</option>
                <option value="1y" className="bg-[#1e222d]">最近 1 年</option>
                <option value="custom" className="bg-[#1e222d]">自定义</option>
              </select>
              
              {timeframe === 'custom' && (
                <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                  <input 
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="bg-panel border border-border text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-blue-500"
                  />
                  <span className="text-textMuted">-</span>
                  <input 
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="bg-panel border border-border text-white text-xs rounded-lg px-2 py-2 focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider ml-1">账户筛选</label>
            <select 
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="bg-panel border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-all hover:bg-white/5 cursor-pointer"
            >
              <option value="" className="bg-[#1e222d]">全部账户</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id} className="bg-[#1e222d]">{acc.name} ({acc.exchange})</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 min-w-[140px]">
            <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider ml-1">交易对搜索</label>
            <input 
              type="text"
              placeholder="BTCUSDT"
              value={selectedSymbol || ''}
              onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase() || undefined)}
              className="bg-panel border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-all hover:bg-white/5"
            />
          </div>

          <div className="flex items-end h-full mt-auto pb-0.5">
            <button 
              onClick={() => {
                setTimeframe('30d');
                setSelectedAccountId(undefined);
                setSelectedSymbol(undefined);
                setCustomStartDate('');
                setCustomEndDate('');
              }}
              className="p-2 bg-white/5 hover:bg-white/10 text-textMuted rounded-lg transition-colors group border border-border/50"
              title="重置筛选"
              >
                <RefreshCw size={18} className="group-active:rotate-180 transition-transform duration-500" />
            </button>
          </div>
        </div>
      </header>

      {/* 第一层：4个核心指标 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
        <Card title="总交易单数">
           {loading ? <Loader2 className="animate-spin text-blue-500" size={20}/> : <div className="text-2xl font-bold font-mono">{data.countPositions}</div>}
        </Card>
        <Card title="综合胜率">
           {loading ? <Loader2 className="animate-spin text-blue-500" size={20}/> : <div className="text-2xl font-bold font-mono">{(winRateNum * 100).toFixed(1)}%</div>}
        </Card>
        <Card title="平均持仓时间">
           {loading ? <Loader2 className="animate-spin text-blue-500" size={20}/> : <div className="text-2xl font-bold font-mono">{formatDuration(data.avgDuration)}</div>}
        </Card>
        <Card title="总手续费">
           {loading ? <Loader2 className="animate-spin text-blue-500" size={20}/> : <div className="text-2xl font-bold font-mono text-loss">-${data.totalCommission.toFixed(2)}</div>}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        <div className="lg:col-span-1">
          <Card title="统计资料" className="h-full">
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
                  <span className="text-textMuted">交易总量 (单)</span>
                  <span className="font-mono">{data.countPositions}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">平均获利单</span>
                  <span className="font-mono text-win">+${data.wins.avgRealisedPnL.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-white/5">
                  <span className="text-textMuted">平均损失单</span>
                  <span className="font-mono text-loss">-${Math.abs(data.loss.avgRealisedPnL).toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-textMuted flex items-center gap-1"><Info size={14} className="text-blue-400"/>统计状态</span>
                  <span className="text-xs text-textMuted uppercase">{timeframe} / {selectedAccountId ? '特定账户' : '全部账户'}</span>
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

      <h2 className="text-xl font-bold text-white mt-12 mb-4 border-b border-border pb-2">多维图表分析</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 relative z-10">
        <Card title="按天计算的结果 (Weekday PnL)" className="h-[350px]">
          {data.countPositions === 0 ? <div className="flex justify-center items-center h-full text-textMuted text-sm">暂无数据</div> : <WeekdayPerformanceChart filters={filters} />}
        </Card>
        <Card title="按时间分列计算的 (Hourly PnL)" className="h-[350px]">
          {data.countPositions === 0 ? <div className="flex justify-center items-center h-full text-textMuted text-sm">暂无数据</div> : <HourlyPerformanceChart filters={filters} />}
        </Card>
        <Card title="交易持续时间报告 (Duration Report)" className="h-[350px]">
          {data.countPositions === 0 ? <div className="flex justify-center items-center h-full text-textMuted text-sm">暂无数据</div> : <TradeDurationChart filters={filters} />}
        </Card>
        <Card title="交易规模报告 (Size Report)" className="h-[350px]">
          {data.countPositions === 0 ? <div className="flex justify-center items-center h-full text-textMuted text-sm">暂无数据</div> : <TradeSizeChart filters={filters} />}
        </Card>
      </div>

      <div className="relative z-10 mt-12">
        <Card title="交易币种报告 (Symbol Report)">
          {loading ? (
             <div className="flex items-center justify-center h-32"><Loader2 className="animate-spin text-blue-500" /></div>
          ) : symbolReports.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-textMuted text-sm">暂无数据</div>
          ) : (
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                 <thead className="border-b border-border text-xs text-textMuted uppercase bg-panel/30">
                   <tr>
                     <th className="py-3 px-4 font-medium cursor-pointer hover:bg-white/5 group" onClick={() => handleSort('symbol')}>符号 (Symbol) <SortIcon column="symbol" /></th>
                     <th className="py-3 px-4 font-medium text-right cursor-pointer hover:bg-white/5 group" onClick={() => handleSort('countLegs')}>交易次数 <SortIcon column="countLegs" /></th>
                     <th className="py-3 px-4 font-medium text-right cursor-pointer hover:bg-white/5 group" onClick={() => handleSort('winRate')}>获胜百分比 <SortIcon column="winRate" /></th>
                     <th className="py-3 px-4 font-medium text-right cursor-pointer hover:bg-white/5 group" onClick={() => handleSort('profitFactor')}>盈亏比 <SortIcon column="profitFactor" /></th>
                     <th className="py-3 px-4 font-medium text-right cursor-pointer hover:bg-white/5 group" onClick={() => handleSort('avgDuration')}>平均持仓时间 <SortIcon column="avgDuration" /></th>
                     <th className="py-3 px-4 font-medium text-right cursor-pointer hover:bg-white/5 group" onClick={() => handleSort('avgPnL')}>平均收益 <SortIcon column="avgPnL" /></th>
                     <th className="py-3 px-4 font-medium text-right cursor-pointer hover:bg-white/5 group" onClick={() => handleSort('totalPnL')}>总净利润 <SortIcon column="totalPnL" /></th>
                   </tr>
                 </thead>
                 <tbody className="text-sm divide-y divide-border/50">
                    {paginatedSymbolReports.map((row, idx) => (
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
          
          {/* Pagination Controls */}
          {totalSymbolPages > 1 && (
            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
              <span className="text-xs text-textMuted">
                显示 {((symbolPage - 1) * symbolPageSize) + 1} 到 {Math.min(symbolPage * symbolPageSize, sortedSymbolReports.length)} 条，共 {sortedSymbolReports.length} 条
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setSymbolPage(p => Math.max(1, p - 1))}
                  disabled={symbolPage === 1}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-sm rounded-md transition-colors"
                >
                  上一页
                </button>
                <div className="flex items-center px-2 text-sm text-textMuted font-mono">
                  {symbolPage} / {totalSymbolPages}
                </div>
                <button 
                  onClick={() => setSymbolPage(p => Math.min(totalSymbolPages, p + 1))}
                  disabled={symbolPage === totalSymbolPages}
                  className="px-3 py-1 bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-white/5 text-sm rounded-md transition-colors"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}
