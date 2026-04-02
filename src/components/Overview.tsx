"use client";

import { useState, useEffect } from "react";
import { analyticsApi, type SummaryStats } from "@/lib/api-client";
import { Card } from "./Card";
import { ArrowUpRight, ArrowDownRight, Activity, TrendingUp, Clock, Target, PercentSquare, Loader2 } from "lucide-react";

// 格式化秒数为直观的耗时
function formatDuration(seconds: number) {
  if (!seconds) return '0分钟';
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  
  if (d > 0) return `${d}天 ${h}小时`;
  if (h > 0) return `${h}小时 ${m}分钟`;
  return `${m}分钟`;
}

export function Overview() {
  const [stats, setStats] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const data = await analyticsApi.getSummary();
        setStats(data);
      } catch (err) {
        console.error('Failed to load summary stats:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} title="加载中...">
            <div className="flex items-center justify-center h-10">
              <Loader2 className="animate-spin text-blue-500" size={20} />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  const data = stats || {
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

  const winRatePercent = (data.winRate * 100).toFixed(1);
  
  // 期望值 = (胜率 * 平均盈利) + (败率 * 平均亏损)
  const expectancy = (data.winRate * data.wins.avgRealisedPnL) + ((1 - data.winRate) * data.loss.avgRealisedPnL);
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card title="总实现盈亏">
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-2xl font-bold ${data.totalRealisedPnL >= 0 ? 'text-win' : 'text-loss'}`}>
              {data.totalRealisedPnL >= 0 ? '+' : ''}${data.totalRealisedPnL.toFixed(2)}
            </p>
          </div>
          <div className={`p-2 rounded-full ${data.totalRealisedPnL >= 0 ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss'}`}>
             {data.totalRealisedPnL >= 0 ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
          </div>
        </div>
      </Card>

      <Card title="总胜率">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-textMain">{winRatePercent}%</p>
            <p className="text-xs text-textMuted mt-1">
              {data.wins.countLegs} 胜 / {data.loss.countLegs} 负
            </p>
          </div>
          <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
             <TrendingUp size={18} />
          </div>
        </div>
      </Card>

      <Card title="总交易单数">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-textMain">{data.countPositions}</p>
          </div>
          <div className="p-2 rounded-full bg-purple-500/10 text-purple-500">
             <Activity size={18} />
          </div>
        </div>
      </Card>

      <Card title="期望值 (每笔预期)">
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-2xl font-bold ${expectancy >= 0 ? 'text-win' : 'text-loss'}`}>
              ${expectancy.toFixed(2)}
            </p>
          </div>
          <div className="p-2 rounded-full bg-orange-500/10 text-orange-500">
             <Target size={18} />
          </div>
        </div>
      </Card>

      <Card title="平均盈亏 (每笔)">
        <div className="flex items-end justify-between">
          <div>
            <p className={`text-2xl font-bold ${data.avgRealisedPnL >= 0 ? 'text-win' : 'text-loss'}`}>
              ${data.avgRealisedPnL.toFixed(2)}
            </p>
          </div>
          <div className="p-2 rounded-full bg-indigo-500/10 text-indigo-500">
             <PercentSquare size={18} />
          </div>
        </div>
      </Card>
      
      <Card title="平均持仓时间">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-textMain">{formatDuration(data.avgDuration)}</p>
          </div>
          <div className="p-2 rounded-full bg-teal-500/10 text-teal-500">
             <Clock size={18} />
          </div>
        </div>
      </Card>

      <Card title="盈亏比 (Profit Factor)">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-textMain">{data.profitFactor.toFixed(2)}</p>
          </div>
          <div className="p-2 rounded-full bg-pink-500/10 text-pink-500">
             <Activity size={18} />
          </div>
        </div>
      </Card>
      
      <Card title="总手续费">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-loss">-${data.totalCommission.toFixed(2)}</p>
          </div>
          <div className="p-2 rounded-full bg-red-500/10 text-red-500">
             <ArrowDownRight size={18} />
          </div>
        </div>
      </Card>
    </div>
  );
}
