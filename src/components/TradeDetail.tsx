"use client";

import { useState, useEffect } from "react";
import { Card } from "./Card";
import { KLineChart } from "./KLineChart";
import { X, FileText, LayoutGrid, TrendingUp, Activity, ExternalLink, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { legsApi } from "@/lib/api-client";

interface TradeDetailProps {
  trade: any;
  onClose: () => void;
}

export function TradeDetail({ trade, onClose }: TradeDetailProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'trades' | 'funding' | 'notes'>('summary');
  const [fullTradeDetails, setFullTradeDetails] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // KLine related state - moving this here since it was implicitly used in the component before
  const [klineInterval, setKlineInterval] = useState('auto');

  // Notes state
  const [strategy, setStrategy] = useState(trade.strategy || "");
  const [notes, setNotes] = useState(trade.notes || "");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  useEffect(() => {
    async function fetchDetails() {
      setIsLoading(true);
      try {
        const data = await legsApi.getById(trade.id);
        setFullTradeDetails(data);
        if (data) {
          setStrategy(data.strategy || "");
          setNotes(data.notes || "");
        }
      } catch (err) {
        console.error("Failed to fetch full trade details:", err);
      } finally {
        setIsLoading(false);
      }
    }
    
    if (trade && trade.id) {
      fetchDetails();
    }
  }, [trade]);

  const handleSaveNotes = async () => {
    setIsSavingNotes(true);
    try {
      await legsApi.update(trade.id, { strategy, notes });
      // update local trade object optimisticly
      trade.strategy = strategy;
      trade.notes = notes;
      alert('保存成功！');
    } catch (err) {
      console.error("Failed to save notes:", err);
      alert('保存失败，请重试');
    } finally {
      setIsSavingNotes(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border w-full max-w-5xl rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-panel">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold text-white">{trade.symbol}</h2>
             <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'LONG' || trade.side === 'buy' ? 'bg-win/20 text-win' : 'bg-loss/20 text-loss'}`}>
               {trade.side.toUpperCase()}
             </span>
             <span className="text-textMuted text-sm font-mono">#ID {trade.id}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors text-textMuted hover:text-white">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left: Charts & Tabs */}
            <div className="lg:col-span-2 flex flex-col h-full">
              {/* Tabs */}
              <div className="flex border-b border-border mb-6">
                 <button 
                   onClick={() => setActiveTab('summary')}
                   className={`px-5 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'summary' ? 'border-blue-500 text-blue-500' : 'border-transparent text-textMuted hover:text-white hover:border-border'}`}
                 >
                   <LayoutGrid size={16} /> 汇总表
                 </button>
                 <button 
                   onClick={() => setActiveTab('trades')}
                   className={`px-5 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'trades' ? 'border-blue-500 text-blue-500' : 'border-transparent text-textMuted hover:text-white hover:border-border'}`}
                 >
                   <Activity size={16} /> 成交明细
                 </button>
                 <button 
                   onClick={() => setActiveTab('funding')}
                   className={`px-5 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'funding' ? 'border-blue-500 text-blue-500' : 'border-transparent text-textMuted hover:text-white hover:border-border'}`}
                 >
                   <DollarSign size={16} /> 资金费用
                 </button>
                 <button 
                   onClick={() => setActiveTab('notes')}
                   className={`px-5 py-2.5 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'notes' ? 'border-blue-500 text-blue-500' : 'border-transparent text-textMuted hover:text-white hover:border-border'}`}
                 >
                   <FileText size={16} /> 交易说明
                 </button>
              </div>

              {/* Tab Content */}
              <div className="flex-1 min-h-[400px]">
                {activeTab === 'summary' && (
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {['auto', '1m', '5m', '15m', '1h', '4h', '1d'].map((itv) => (
                          <button
                            key={itv}
                            onClick={() => setKlineInterval(itv)}
                            className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded transition-colors ${
                              klineInterval === itv
                                ? 'bg-blue-600 text-white'
                                : 'bg-panel border border-border text-textMuted hover:text-white hover:border-border-hover'
                            }`}
                          >
                            {itv === 'auto' ? 'Auto' : itv}
                          </button>
                        ))}
                      </div>
                      <Card className="p-0 overflow-hidden bg-panel/50 border-border/50">
                        <KLineChart
                            symbol={trade.symbol}
                            openDate={trade.openDate}
                            closeDate={trade.closeDate ?? null}
                            openPrice={trade.averageEntry}
                            closePrice={trade.averageExit ?? null}
                            side={trade.side}
                            interval={klineInterval === 'auto' ? undefined : klineInterval}
                        />
                      </Card>
                    </div>

                    {/* MAE/MFE 真实数据渲染 (仅平仓后显示) */}
                    {trade.status === 'CLOSED' && (
                      <div className="grid grid-cols-2 gap-4">
                         <Card title="入场质量" className="border-border/50 bg-panel/50">
                            <div className="flex items-center justify-center h-20">
                               {isLoading ? (
                                 <span className="text-textMuted text-sm animate-pulse">加载中...</span>
                               ) : fullTradeDetails?.entryQuality != null ? (
                                 <span className={`text-2xl font-bold ${fullTradeDetails.entryQuality >= 50 ? 'text-win' : 'text-loss'}`}>
                                   {fullTradeDetails.entryQuality.toFixed(1)}% {fullTradeDetails.entryQuality >= 50 ? 'Good' : 'Poor'}
                                 </span>
                               ) : (
                                 <span className="text-textMuted text-sm">暂无数据</span>
                               )}
                            </div>
                         </Card>
                         <Card title="MAE / MFE" className="border-border/50 bg-panel/50">
                            <div className="space-y-4 pt-2">
                               {isLoading ? (
                                 <div className="flex items-center justify-center h-14">
                                   <span className="text-textMuted text-sm animate-pulse">加载中...</span>
                                 </div>
                               ) : fullTradeDetails?.mae != null && fullTradeDetails?.mfe != null ? (
                                 <div>
                                    <div className="flex justify-between text-[10px] text-textMuted mb-1">
                                       <span>MAE {(fullTradeDetails.mae * 100).toFixed(2)}%</span>
                                       <span>MFE +{(fullTradeDetails.mfe * 100).toFixed(2)}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-border rounded-full overflow-hidden flex">
                                       {(() => {
                                          const absMae = Math.abs(fullTradeDetails.mae);
                                          const mfe = fullTradeDetails.mfe;
                                          const total = absMae + mfe;
                                          const maePercent = total > 0 ? (absMae / total) * 100 : 0;
                                          const mfePercent = total > 0 ? (mfe / total) * 100 : 0;
                                          
                                          return (
                                            <>
                                              <div className="h-full bg-loss" style={{ width: `${maePercent}%` }}></div>
                                              <div className="h-full bg-win" style={{ width: `${mfePercent}%` }}></div>
                                            </>
                                          );
                                       })()}
                                    </div>
                                 </div>
                               ) : (
                                 <div className="flex items-center justify-center h-14">
                                   <span className="text-textMuted text-sm">系统计算中...</span>
                                 </div>
                               )}
                            </div>
                         </Card>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'trades' && (
                  <Card title="原始成交记录 (Raw Trades)" className="h-full border-border/50 bg-panel/50">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center h-64 text-textMuted">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                        <p>加载中...</p>
                      </div>
                    ) : (!fullTradeDetails || !fullTradeDetails.trades || fullTradeDetails.trades.length === 0) ? (
                      <div className="text-sm text-textMuted flex flex-col h-full justify-center items-center py-12">
                        <Activity size={48} className="text-border mb-4" />
                        <p>没有找到相关成交记录。</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-textMuted uppercase bg-black/20 border-b border-border/50">
                            <tr>
                              <th className="px-4 py-3">时间</th>
                              <th className="px-4 py-3">方向</th>
                              <th className="px-4 py-3">价格</th>
                              <th className="px-4 py-3">数量</th>
                              <th className="px-4 py-3">手续费</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fullTradeDetails.trades.map((t: any, index: number) => (
                              <tr key={t.id || index} className="border-b border-border/50 hover:bg-white/5">
                                <td className="px-4 py-3 font-mono">{format(new Date(t.timestamp), 'MM-dd HH:mm:ss')}</td>
                                <td className={`px-4 py-3 font-bold ${t.side === 'BUY' ? 'text-win' : 'text-loss'}`}>
                                  {t.side}
                                </td>
                                <td className="px-4 py-3 font-mono">${Number(t.price).toFixed(4)}</td>
                                <td className="px-4 py-3 font-mono">{Number(t.amount)}</td>
                                <td className="px-4 py-3 font-mono">{Number(t.fee).toFixed(4)} {t.feeAsset}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}

                {activeTab === 'funding' && (
                  <Card title="资金费用记录 (Funding Fees)" className="h-full border-border/50 bg-panel/50">
                    {isLoading ? (
                      <div className="flex flex-col items-center justify-center h-64 text-textMuted">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-4"></div>
                        <p>加载中...</p>
                      </div>
                    ) : (!fullTradeDetails || !fullTradeDetails.fundingFees || fullTradeDetails.fundingFees.length === 0) ? (
                      <div className="text-sm text-textMuted flex flex-col h-full justify-center items-center py-12">
                        <DollarSign size={48} className="text-border mb-4" />
                        <p>暂无资金费用记录。</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                          <thead className="text-xs text-textMuted uppercase bg-black/20 border-b border-border/50">
                            <tr>
                              <th className="px-4 py-3">时间</th>
                              <th className="px-4 py-3">类型</th>
                              <th className="px-4 py-3">金额</th>
                              <th className="px-4 py-3">USD等值</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fullTradeDetails.fundingFees.map((f: any, index: number) => (
                              <tr key={f.id || index} className="border-b border-border/50 hover:bg-white/5">
                                <td className="px-4 py-3 font-mono">{format(new Date(f.timestamp), 'MM-dd HH:mm:ss')}</td>
                                <td className="px-4 py-3 text-textMuted">{f.incomeType}</td>
                                <td className={`px-4 py-3 font-mono ${f.amount >= 0 ? 'text-win' : 'text-loss'}`}>
                                  {f.amount >= 0 ? '+' : ''}{Number(f.amount).toFixed(4)} {f.asset}
                                </td>
                                <td className={`px-4 py-3 font-mono ${f.amountUsd >= 0 ? 'text-win' : 'text-loss'}`}>
                                  {f.amountUsd >= 0 ? '+' : ''}${Number(f.amountUsd).toFixed(4)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}

                {activeTab === 'notes' && (
                  <Card title="交易复盘与说明" className="h-full border-border/50 bg-panel/50 flex flex-col">
                    <div className="flex-1 space-y-4">
                      <div>
                        <label className="text-xs font-bold text-textMuted uppercase mb-1 block">策略 (Strategy)</label>
                        <textarea 
                          className="w-full bg-background border border-border rounded-md p-3 text-sm text-white resize-none h-20 focus:border-blue-500 focus:outline-none transition-colors placeholder:text-textMuted/30"
                          placeholder="您为什么开这一单？使用的什么策略？"
                          value={strategy}
                          onChange={(e) => setStrategy(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-textMuted uppercase mb-1 block">复盘笔记 (Notes)</label>
                        <textarea 
                          className="w-full bg-background border border-border rounded-md p-3 text-sm text-white resize-none h-32 focus:border-blue-500 focus:outline-none transition-colors placeholder:text-textMuted/30"
                          placeholder="交易结束后的思考，做对了什么，做错了什么？"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                        />
                      </div>
                      <div className="flex justify-end pt-2">
                        <button 
                          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                          onClick={handleSaveNotes}
                          disabled={isSavingNotes}
                        >
                          {isSavingNotes ? '保存中...' : '保存笔记'}
                        </button>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            </div>

            {/* Right: Info Panel */}
            <div className="space-y-6">
               <Card title="统计指标" className="border-border/50 bg-panel/50">
                  <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-textMuted">已实施 PNL</span>
                        <span className={`font-mono font-bold ${trade.realisedPnLusd >= 0 ? 'text-win' : 'text-loss'}`}>
                           {trade.realisedPnLusd >= 0 ? '+' : ''}${trade.realisedPnLusd.toFixed(2)}
                        </span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-textMuted">手续费</span>
                        <span className="font-mono text-textMain">${Math.abs(trade.commission || 0).toFixed(4)}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-textMuted">资金费用</span>
                        <span className={`font-mono ${(trade.fundingFeeUsd || 0) >= 0 ? 'text-win' : 'text-loss'}`}>
                           {(trade.fundingFeeUsd || 0) >= 0 ? '+' : ''}${(trade.fundingFeeUsd || 0).toFixed(4)}
                        </span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-textMuted">最大持仓量</span>
                        <span className="font-mono text-textMain">${(trade.sizeUsd || 0).toFixed(2)}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-textMuted">持仓时间</span>
                        <span className="text-textMain font-mono text-sm">
                          {trade.duration != null
                            ? `${Math.floor(trade.duration / 3600)}h ${Math.floor((trade.duration % 3600) / 60)}m`
                            : '持仓中'}
                        </span>
                     </div>
                  </div>
               </Card>

               <Card title="开仓/平仓信息" className="border-border/50 bg-panel/50">
                  <div className="space-y-6">
                     <div className="relative pl-4 border-l-2 border-border/50">
                        <div className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-500"></div>
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-bold text-textMuted uppercase tracking-wider">Entry (入场)</p>
                          <p className="text-[10px] text-textMuted font-mono">
                            {format(new Date(trade.openDate), 'MM-dd HH:mm:ss')}
                          </p>
                        </div>
                        <p className="font-mono text-white text-lg">${(trade.averageEntry || 0).toFixed(4)}</p>
                     </div>
                     
                     <div className="relative pl-4 border-l-2 border-border/50">
                        <div className={`absolute -left-[5px] top-1 w-2 h-2 rounded-full ${trade.status === 'CLOSED' ? 'bg-textMuted' : 'bg-green-500 animate-pulse'}`}></div>
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-xs font-bold text-textMuted uppercase tracking-wider">Exit (出场)</p>
                          {trade.closeDate && (
                            <p className="text-[10px] text-textMuted font-mono">
                              {format(new Date(trade.closeDate), 'MM-dd HH:mm:ss')}
                            </p>
                          )}
                        </div>
                        <p className="font-mono text-white text-lg">
                          {trade.status === 'CLOSED' ? `$${(trade.averageExit || 0).toFixed(4)}` : <span className="text-win text-sm">持仓中 (Open)</span>}
                        </p>
                     </div>
                  </div>
               </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
