"use client";

import { useState } from "react";
import { Card } from "@/components/Card";
import { Sparkles, Calendar, Clock, ArrowRight, Activity, AlertTriangle, Lightbulb, CheckCircle2 } from "lucide-react";

export default function ReportsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [showNewReport, setShowNewReport] = useState(false);

  const generateReport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setShowNewReport(true);
    }, 3000);
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-end relative z-20">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            AI 交易报告 <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full font-medium">BETA</span>
          </h1>
          <p className="text-textMuted mt-2 text-lg">让 AI 深度诊断您的交易习惯，生成个性化改进建议</p>
        </div>
        
        <button 
          onClick={generateReport}
          disabled={isGenerating}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50"
        >
          {isGenerating ? <Sparkles size={16} className="animate-spin" /> : <Sparkles size={16} />}
          <span>{isGenerating ? "AI 正在分析数万条数据..." : "生成最新报告"}</span>
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10">
         {/* 左侧：历史报告列表 */}
         <div className="lg:col-span-1 space-y-4">
            <h3 className="text-sm font-semibold text-textMuted uppercase tracking-wider mb-4">历史报告</h3>
            
            {showNewReport && (
              <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-xl cursor-pointer hover:bg-blue-600/20 transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-400">最新生成</span>
                  <span className="text-xs text-textMuted">刚刚</span>
                </div>
                <div className="font-bold text-white text-sm">3月第四周深度复盘</div>
                <div className="text-xs text-textMuted mt-1 flex items-center gap-1"><Activity size={12}/> 诊断得分: 88</div>
              </div>
            )}

            <div className="bg-panel border border-border p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-textMuted">常规报告</span>
                <span className="text-xs text-textMuted">3月24日</span>
              </div>
              <div className="font-bold text-white text-sm">3月第三周深度复盘</div>
              <div className="text-xs text-textMuted mt-1 flex items-center gap-1"><Activity size={12}/> 诊断得分: 72</div>
            </div>

            <div className="bg-panel border border-border p-4 rounded-xl cursor-pointer hover:bg-white/5 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-textMuted">月度总结</span>
                <span className="text-xs text-textMuted">2月28日</span>
              </div>
              <div className="font-bold text-white text-sm">2月份交易行为总览</div>
              <div className="text-xs text-textMuted mt-1 flex items-center gap-1"><Activity size={12}/> 诊断得分: 91</div>
            </div>
         </div>

         {/* 右侧：报告正文阅读区 */}
         <div className="lg:col-span-3">
           <Card className="min-h-[600px] p-8">
             {isGenerating ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20">
                  <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                     <Sparkles size={32} className="text-blue-400 animate-spin-slow" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white mb-2">AI 正在生成您的专属报告</h3>
                    <p className="text-textMuted max-w-md mx-auto">正在为您梳理盈亏分布、计算 MAE/MFE 偏移、评估风险收益比并总结行为模式，请稍候...</p>
                  </div>
                </div>
             ) : (
                <div className="space-y-8 animate-in fade-in duration-500">
                  <div className="border-b border-border pb-6">
                    <h2 className="text-3xl font-bold text-white mb-3">3月第四周深度复盘</h2>
                    <div className="flex items-center gap-4 text-sm text-textMuted">
                      <span className="flex items-center gap-1"><Calendar size={14}/> 覆盖周期: 03-24 至 03-31</span>
                      <span className="flex items-center gap-1"><Clock size={14}/> 生成时间: 刚刚</span>
                      <span className="bg-win/20 text-win px-2 py-0.5 rounded text-xs font-bold border border-win/20">综合评级: A-</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-win/5 border border-win/10 p-5 rounded-xl">
                      <h3 className="flex items-center gap-2 font-bold text-win mb-3"><CheckCircle2 size={18}/> 表现亮点</h3>
                      <ul className="space-y-3 text-sm text-textMain/90 leading-relaxed">
                        <li><strong className="text-white">趋势跟随坚决：</strong> 本周在 BTC/USDT 上的多头仓位平均获利达到了 $125.40，且盈利单的持有时间显著长于亏损单，这是非常好的“截断亏损，让利润奔跑”的体现。</li>
                        <li><strong className="text-white">胜率稳定：</strong> 整体胜率维持在 55.4%，相较于上周提升了 4.2%。</li>
                      </ul>
                    </div>
                    <div className="bg-loss/5 border border-loss/10 p-5 rounded-xl">
                      <h3 className="flex items-center gap-2 font-bold text-loss mb-3"><AlertTriangle size={18}/> 风险警告 (需改进)</h3>
                      <ul className="space-y-3 text-sm text-textMain/90 leading-relaxed">
                        <li><strong className="text-white">存在“扛单”倾向：</strong> 分析您的亏损单发现，有 3 笔空头订单的持仓时间超过了 24 小时，且最终以较大亏损平仓。您在逆势时未能果断止损。</li>
                        <li><strong className="text-white">频繁的微小交易：</strong> 在 DOGE/USDT 上存在过度交易的迹象，单周交易超过 15 笔，但净利润为负，大量资金消耗在了手续费上。</li>
                      </ul>
                    </div>
                  </div>

                  <div className="bg-blue-600/5 border border-blue-600/20 p-6 rounded-xl">
                     <h3 className="flex items-center gap-2 font-bold text-blue-400 mb-4 text-lg"><Lightbulb size={20}/> AI 核心建议</h3>
                     <div className="prose prose-invert max-w-none text-sm text-textMain/80">
                       <p>根据大模型的深度计算，您的交易模型在 <strong>日内波段（1-4小时持仓）</strong> 的期望值最高。建议在接下来的交易中：</p>
                       <ol className="list-decimal pl-5 space-y-2 mt-2">
                         <li><strong>收缩防线：</strong> 停止交易 Meme 币种（如 DOGE, PEPE），将 80% 的精力集中在您胜率最高的 BTC 和 SOL 上。</li>
                         <li><strong>强制止损纪律：</strong> 下周建议为所有新开仓位设置硬性止损线（如资金的 2%）。模型回测显示，如果您上周剔除了两笔最大的未止损亏损，您的净利润将增加 <strong>42%</strong>。</li>
                         <li><strong>周末休息：</strong> 数据显示您在周六和周日的盈亏比极差（0.45），市场流动性低时的震荡不适合您的突破策略。建议周末清仓休息。</li>
                       </ol>
                     </div>
                  </div>
                  
                  <div className="flex justify-end pt-4">
                     <button className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                        查看原始推演数据 <ArrowRight size={14} />
                     </button>
                  </div>
                </div>
             )}
           </Card>
         </div>
      </div>
    </div>
  );
}
