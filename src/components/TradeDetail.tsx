"use client";

import { Card } from "./Card";
import { KLineChart } from "./KLineChart";
import { X, FileText, LayoutGrid, TrendingUp, Activity } from "lucide-react";

interface TradeDetailProps {
  trade: any;
  onClose: () => void;
}

export function TradeDetail({ trade, onClose }: TradeDetailProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-border w-full max-w-5xl rounded-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-panel">
          <div className="flex items-center gap-4">
             <h2 className="text-xl font-bold text-white">{trade.symbol}</h2>
             <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'buy' ? 'bg-win/20 text-win' : 'bg-loss/20 text-loss'}`}>
               {trade.side.toUpperCase()}
             </span>
             <span className="text-textMuted text-sm">#ID {trade.id}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-border rounded-full transition-colors text-textMuted">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Charts & Tabs */}
            <div className="lg:col-span-2 space-y-6">
              <div className="flex border-b border-border mb-4">
                 <button className="px-4 py-2 border-b-2 border-blue-500 text-blue-500 text-sm font-medium flex items-center gap-2">
                   <LayoutGrid size={16} /> 汇总表
                 </button>
                 <button className="px-4 py-2 text-textMuted hover:text-textMain text-sm font-medium flex items-center gap-2">
                   <Activity size={16} /> 成交
                 </button>
                 <button className="px-4 py-2 text-textMuted hover:text-textMain text-sm font-medium flex items-center gap-2">
                   <FileText size={16} /> 说明
                 </button>
              </div>

              <Card className="p-0 overflow-hidden bg-panel/50">
                 <KLineChart 
                    symbol={trade.symbol}
                    openDate={trade.openDate}
                    closeDate={trade.closeDate}
                    openPrice={trade.averageEntry}
                    closePrice={trade.averageExit}
                    side={trade.side}
                 />
              </Card>

              {/* MAE/MFE 模拟 */}
              <div className="grid grid-cols-2 gap-4">
                 <Card title="入场质量">
                    <div className="flex items-center justify-center h-20">
                       <span className="text-2xl font-bold text-win">65% Good</span>
                    </div>
                 </Card>
                 <Card title="MAE / MFE">
                    <div className="space-y-4 pt-2">
                       <div>
                          <div className="flex justify-between text-[10px] text-textMuted mb-1">
                             <span>MAE -0.68%</span>
                             <span>MFE +1.28%</span>
                          </div>
                          <div className="h-2 w-full bg-border rounded-full overflow-hidden flex">
                             <div className="h-full bg-loss" style={{ width: '30%' }}></div>
                             <div className="h-full bg-win" style={{ width: '70%' }}></div>
                          </div>
                       </div>
                    </div>
                 </Card>
              </div>
            </div>

            {/* Right: Info Panel */}
            <div className="space-y-6">
               <Card title="统计指标">
                  <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-textMuted">已实施 PNL</span>
                        <span className={`font-mono font-bold ${trade.realisedPnLusd >= 0 ? 'text-win' : 'text-loss'}`}>
                           {trade.realisedPnLusd >= 0 ? '+' : ''}${trade.realisedPnLusd.toFixed(2)}
                        </span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-textMuted">手续费</span>
                        <span className="font-mono text-textMain">${Math.abs(trade.commission).toFixed(4)}</span>
                     </div>
                     <div className="flex justify-between items-center">
                        <span className="text-sm text-textMuted">持仓时间</span>
                        <span className="text-textMain">{Math.floor(trade.duration / 3600)}h {Math.floor((trade.duration % 3600) / 60)}m</span>
                     </div>
                  </div>
               </Card>

               <Card title="入场/出场">
                  <div className="space-y-4">
                     <div>
                        <p className="text-[10px] text-textMuted uppercase mb-1">Entry</p>
                        <p className="font-mono text-white text-lg">${trade.averageEntry.toFixed(4)}</p>
                     </div>
                     <div>
                        <p className="text-[10px] text-textMuted uppercase mb-1">Exit</p>
                        <p className="font-mono text-white text-lg">${trade.averageExit.toFixed(4)}</p>
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
