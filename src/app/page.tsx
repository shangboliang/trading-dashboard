"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Overview } from "@/components/Overview";
import { Card } from "@/components/Card";
import { CumulativePnLChart } from "@/components/CumulativePnLChart";
import { TradeDetail } from "@/components/TradeDetail";
import { legsApi, accountsApi, type Leg, type GlobalFilter } from "@/lib/api-client";
import { format, subDays, startOfDay, endOfDay, formatISO } from "date-fns";
import { ChevronDown, SlidersHorizontal, Settings2, Loader2, Wallet, RefreshCw } from "lucide-react";

// 格式化秒数为直观的耗时
function formatDuration(seconds: number) {
  if (!seconds) return '-';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  if (d > 0) return `${d}天 ${h}小时`;
  if (h > 0) return `${h}小时 ${m}分钟`;
  return `${m}分钟`;
}

export default function Home() {
  const [selectedTrade, setSelectedTrade] = useState<Leg | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  
  // 账户状态
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncingAccountId, setSyncingAccountId] = useState<number | null>(null);

  // 筛选器状态
  const [timeframe, setTimeframe] = useState('30d');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | undefined>(undefined);
  const [selectedSymbol, setSelectedSymbol] = useState<string | undefined>(undefined);

  // 数据状态
  const [legs, setLegs] = useState<Leg[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 分页状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

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
  // 加载 Legs 数据
  const loadLegs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await legsApi.getList({
        page: currentPage,
        pageSize,
        sortBy: 'closeDate',
        sortOrder: 'desc',
        ...filters, // 传入筛选参数
      });
      
      setLegs(result.data || []);
      setTotal(result.pagination?.total || 0);
      setError(null);
    } catch (err) {
      console.error('Failed to load legs:', err);
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, filters]);

  // 加载账户列表
  const loadAccounts = useCallback(async () => {
    try {
      const data = await accountsApi.getList();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  }, []);

  useEffect(() => {
    loadLegs();
    loadAccounts();
  }, [loadLegs, loadAccounts]);

  // 处理同步
  const handleSync = async (accountId: number) => {
    setSyncingAccountId(accountId);
    setIsSyncing(true);
    
    try {
      await accountsApi.sync(accountId);
      alert('同步成功！');
      loadLegs(); // 重新加载数据
    } catch (err) {
      alert(err instanceof Error ? err.message : '同步失败');
    } finally {
      setIsSyncing(false);
      setSyncingAccountId(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 relative z-20">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">交易报告与分析</h1>
          <p className="text-textMuted mt-2 text-lg">回顾您的交易表现，优化您的策略</p>
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
            <label className="text-[10px] font-bold text-textMuted uppercase tracking-wider ml-1">选择账户</label>
            <select 
              value={selectedAccountId || ''}
              onChange={(e) => setSelectedAccountId(e.target.value ? parseInt(e.target.value) : undefined)}
              className="bg-panel border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 transition-all hover:bg-white/5 cursor-pointer"
            >
              <option value="" className="bg-[#1e222d]">全账户汇总</option>
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

          <div className="flex items-end gap-2 h-full mt-auto pb-0.5">
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
            <button 
              onClick={() => setIsSyncModalOpen(true)}
              className="bg-blue-600/10 text-blue-500 p-2 rounded-lg hover:bg-blue-600/20 transition-all border border-blue-500/30"
              title="数据同步"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>
      </header>

      <Overview filters={filters} />

      <div className="relative z-10">
        <Card title="累计盈亏 (PNL Curve)" className="h-[350px]">
           <CumulativePnLChart filters={filters} />
        </Card>
      </div>

      <div className="relative z-10">
        <Card title="最近交易历史">
          <div className="overflow-x-auto min-h-[400px]">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-64 text-red-500">
                {error}
              </div>
            ) : legs.length === 0 ? (
              <div className="flex items-center justify-center h-64 text-textMuted">
                暂无符合筛选条件的交易记录
              </div>
            ) : (
              <>
                <table className="w-full text-left">
                  <thead className="border-b border-border text-xs text-textMuted uppercase bg-panel/80">
                    <tr>
                      <th className="py-3 px-4 font-medium">符号</th>
                      <th className="py-3 px-4 font-medium text-right">价格 (入/出)</th>
                      <th className="py-3 px-4 font-medium text-right">持仓时间</th>
                      <th className="py-3 px-4 font-medium text-right">净利润</th>
                      <th className="py-3 px-4 font-medium text-right">时间</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-border/50">
                    {legs.map((leg, idx) => (
                      <tr 
                        key={`${leg.id}-${idx}`} 
                        onClick={() => setSelectedTrade(leg)}
                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                      >
                        <td className="py-4 px-4 font-semibold text-white group-hover:text-blue-400 transition-colors">
                          <div className="flex items-center gap-2">
                            {leg.symbol}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${leg.side === 'LONG' ? 'bg-win/20 text-win' : 'bg-loss/20 text-loss'}`}>
                              {leg.side}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-textMain font-mono">
                          {leg.averageEntry.toFixed(4)} / {leg.averageExit?.toFixed(4) || '-'}
                        </td>
                        <td className="py-4 px-4 text-right text-textMuted text-xs">
                          {formatDuration(leg.duration)}
                        </td>
                        <td className={`py-4 px-4 text-right font-bold font-mono ${leg.netPnL >= 0 ? 'text-win' : 'text-loss'}`}>
                          {leg.netPnL >= 0 ? '+' : ''}${leg.netPnL.toFixed(2)}
                        </td>
                        <td className="py-4 px-4 text-right text-textMuted text-xs">
                          {leg.closeDate ? format(new Date(leg.closeDate), 'yyyy-MM-dd HH:mm') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* 分页控制 */}
                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 text-sm text-textMuted border-t border-border pt-4 gap-4">
                  <div className="flex items-center gap-2">
                    <span>每页显示</span>
                    <select 
                      value={pageSize} 
                      onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} 
                      className="bg-background border border-border rounded px-2 py-1 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                    <span>条</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>第 <b className="text-white">{currentPage}</b> / {totalPages} 页 (共 {total} 条)</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                        disabled={currentPage === 1} 
                        className="px-3 py-1.5 bg-background border border-border rounded hover:bg-panel disabled:opacity-50 disabled:hover:bg-background transition-colors"
                      >
                        上一页
                      </button>
                      <button 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                        disabled={currentPage === totalPages} 
                        className="px-3 py-1.5 bg-background border border-border rounded hover:bg-panel disabled:opacity-50 disabled:hover:bg-background transition-colors"
                      >
                        下一页
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>

      {selectedTrade && <TradeDetail trade={selectedTrade} onClose={() => setSelectedTrade(null)} />}

      {/* 同步弹窗 */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-panel border border-border rounded-xl shadow-2xl w-full max-md p-6">
            <h2 className="text-xl font-bold text-white mb-6">快速数据同步</h2>
            <div className="space-y-3 max-h-[300px] overflow-y-auto mb-6 pr-1">
              {accounts.map((account) => (
                <div key={account.id} className="bg-background border border-border rounded-lg p-4 flex justify-between items-center group">
                  <div className="flex items-center gap-3">
                    <div className="bg-panel p-2 rounded-md"><Wallet size={18} className="text-blue-400" /></div>
                    <div>
                      <div className="font-semibold text-white text-sm">{account.name}</div>
                      <div className="text-xs text-textMuted mt-0.5">
                        {account.exchange} • {account.lastSyncAt ? `上次同步：${format(new Date(account.lastSyncAt), 'MM-dd HH:mm')}` : '未同步'}
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleSync(account.id)}
                    disabled={isSyncing || syncingAccountId === account.id}
                    className="bg-blue-600/20 text-blue-500 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-blue-600 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {syncingAccountId === account.id ? (
                      <><Loader2 className="animate-spin" size={14} /> 同步中...</>
                    ) : (
                      <><RefreshCw size={14} /> 同步</>
                    )}
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center mt-6">
               <a href="/accounts" className="text-blue-500 hover:text-blue-400 text-sm font-medium flex items-center gap-1">
                 <Settings2 size={14} /> 前往配置新账号
               </a>
               <button onClick={() => setIsSyncModalOpen(false)} className="px-4 py-2 text-textMuted hover:text-white bg-white/5 rounded-lg transition-colors text-sm">
                 关闭
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
