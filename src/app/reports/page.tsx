"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import {
  aiApi,
  accountsApi,
  type AiReportItem,
  type AiReportDetail,
  type AiConfigItem,
  type ApiAccount,
} from "@/lib/api-client";
import {
  Sparkles,
  Calendar,
  Clock,
  AlertTriangle,
  Loader2,
  Trash2,
  ChevronDown,
  FileText,
  RefreshCw,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, subWeeks, subMonths, startOfMonth, endOfMonth } from "date-fns";

// 日期快捷预设
const DATE_PRESETS = [
  { label: "本周", value: "thisWeek" },
  { label: "上周", value: "lastWeek" },
  { label: "本月", value: "thisMonth" },
  { label: "上月", value: "lastMonth" },
  { label: "自定义", value: "custom" },
];

function getPresetRange(preset: string): { startDate: string; endDate: string } {
  const now = new Date();
  switch (preset) {
    case "thisWeek":
      return {
        startDate: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        endDate: format(now, "yyyy-MM-dd"),
      };
    case "lastWeek": {
      const lastWeek = subWeeks(now, 1);
      return {
        startDate: format(startOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        endDate: format(endOfWeek(lastWeek, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    case "thisMonth":
      return {
        startDate: format(startOfMonth(now), "yyyy-MM-dd"),
        endDate: format(now, "yyyy-MM-dd"),
      };
    case "lastMonth": {
      const lastMonth = subMonths(now, 1);
      return {
        startDate: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        endDate: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      };
    }
    default:
      return { startDate: "", endDate: "" };
  }
}

// 简单 Markdown 转 HTML
function renderMarkdown(md: string): string {
  let html = md;
  // 标题
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-white mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-white mt-8 mb-4 pb-2 border-b border-border">$1</h2>');
  // 粗体
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
  // 有序列表
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li class="ml-5 list-decimal mb-1">$1</li>');
  // 无序列表
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li class="ml-5 list-disc mb-1">$1</li>');
  // 分隔线
  html = html.replace(/^---$/gm, '<hr class="border-border my-6" />');
  // 换行
  html = html.replace(/\n\n/g, '</p><p class="mb-3">');
  html = html.replace(/\n/g, "<br/>");
  return `<p class="mb-3">${html}</p>`;
}

export default function ReportsPage() {
  // 报告列表
  const [reports, setReports] = useState<AiReportItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<AiReportDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // AI 配置
  const [aiConfigs, setAiConfigs] = useState<AiConfigItem[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<number | undefined>(undefined);

  // 交易所账户（用于筛选）
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);

  // 筛选条件
  const [preset, setPreset] = useState("thisWeek");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [symbol, setSymbol] = useState("");
  const [apiKeyId, setApiKeyId] = useState<number | undefined>(undefined);

  // AI 生成参数
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [tone, setTone] = useState("objective");
  const [customPrompt, setCustomPrompt] = useState("");

  // 生成状态
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // 加载报告列表
  const loadReports = useCallback(async () => {
    try {
      setReportsLoading(true);
      const result = await aiApi.getList({ pageSize: 50 });
      setReports(result.data);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setReportsLoading(false);
    }
  }, []);

  // 加载 AI 配置
  const loadConfigs = useCallback(async () => {
    try {
      const configs = await aiApi.getConfigs();
      setAiConfigs(configs);
      const defaultConfig = configs.find((c) => c.isDefault);
      if (defaultConfig) {
        setSelectedConfigId(defaultConfig.id);
        setTemperature(defaultConfig.temperature ?? 0.7);
        setMaxTokens(defaultConfig.maxTokens ?? 4096);
        setTone(defaultConfig.defaultTone || "objective");
        setCustomPrompt(defaultConfig.customInstruction || "");
      } else if (configs.length > 0) {
        setSelectedConfigId(configs[0].id);
        setTemperature(configs[0].temperature ?? 0.7);
        setMaxTokens(configs[0].maxTokens ?? 4096);
        setTone(configs[0].defaultTone || "objective");
        setCustomPrompt(configs[0].customInstruction || "");
      }
    } catch (err) {
      console.error("Failed to load AI configs:", err);
    }
  }, []);

  // 加载交易所账户
  const loadAccounts = useCallback(async () => {
    try {
      const data = await accountsApi.getList();
      setAccounts(data);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }, []);

  useEffect(() => {
    loadReports();
    loadConfigs();
    loadAccounts();
  }, [loadReports, loadConfigs, loadAccounts]);

  // 预设变化时更新日期
  useEffect(() => {
    if (preset !== "custom") {
      const range = getPresetRange(preset);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  }, [preset]);

  // AI 模型切换时同步 temperature/maxTokens
  const handleConfigChange = (configId: number) => {
    setSelectedConfigId(configId);
    const config = aiConfigs.find((c) => c.id === configId);
    if (config) {
      setTemperature(config.temperature ?? 0.7);
      setMaxTokens(config.maxTokens ?? 4096);
      setTone(config.defaultTone || "objective");
      setCustomPrompt(config.customInstruction || "");
    }
  };

  // 生成报告
  const handleGenerate = async () => {
    const effectiveStart = startDate;
    const effectiveEnd = endDate;

    if (!effectiveStart || !effectiveEnd) {
      alert("请选择时间范围");
      return;
    }

    if (!selectedConfigId && aiConfigs.length === 0) {
      alert('请先在"账号配置"页面添加 AI 模型配置');
      return;
    }

    try {
      setGenerating(true);
      setGenerateError(null);

      const report = await aiApi.generate({
        startDate: effectiveStart,
        endDate: effectiveEnd,
        symbol: symbol || undefined,
        apiKeyId: apiKeyId || undefined,
        aiConfigId: selectedConfigId,
        temperature,
        maxTokens,
        tone,
        customPrompt: customPrompt || undefined,
      });

      // 刷新列表并选中新报告
      await loadReports();
      setSelectedReport(report as AiReportDetail);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "报告生成失败");
    } finally {
      setGenerating(false);
    }
  };

  // 查看报告详情
  const handleViewReport = async (id: number) => {
    try {
      setDetailLoading(true);
      const report = await aiApi.getById(id);
      setSelectedReport(report);
    } catch (err) {
      console.error("Failed to load report:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  // 删除报告
  const handleDeleteReport = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("确定要删除此报告吗？")) return;
    try {
      await aiApi.delete(id);
      if (selectedReport?.id === id) setSelectedReport(null);
      loadReports();
    } catch (err) {
      alert("删除失败");
    }
  };

  const formatDateRange = (start: string, end: string) => {
    try {
      return `${format(new Date(start), "M月d日")} - ${format(new Date(end), "M月d日")}`;
    } catch {
      return start;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 头部 */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            AI 交易报告
            <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded-full font-medium">BETA</span>
          </h1>
          <p className="text-textMuted mt-2 text-lg">让 AI 深度诊断您的交易习惯，生成个性化改进建议</p>
        </div>
      </header>

      {/* 筛选器 + 生成 */}
      <Card className="p-5">
        <div className="flex flex-wrap items-end gap-4">
          {/* 时间预设 */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5">时间范围</label>
            <div className="flex gap-1">
              {DATE_PRESETS.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPreset(p.value)}
                  className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                    preset === p.value
                      ? "bg-blue-600 text-white"
                      : "bg-background border border-border text-textMuted hover:text-white"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 自定义日期 */}
          {preset === "custom" && (
            <>
              <div>
                <label className="block text-xs font-medium text-textMuted mb-1.5">开始日期</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-background border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-textMuted mb-1.5">结束日期</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-background border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
                />
              </div>
            </>
          )}

          {/* Symbol 筛选 */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5">标的 (可选)</label>
            <input
              type="text"
              placeholder="如 BTC"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="bg-background border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 w-28"
            />
          </div>

          {/* 账户筛选 */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5">账户 (可选)</label>
            <select
              value={apiKeyId || ""}
              onChange={(e) => setApiKeyId(e.target.value ? Number(e.target.value) : undefined)}
              className="bg-background border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value="">全部</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* AI 模型选择 */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5">AI 模型</label>
            <select
              value={selectedConfigId || ""}
              onChange={(e) => handleConfigChange(Number(e.target.value))}
              className="bg-background border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              {aiConfigs.length === 0 ? (
                <option value="">未配置</option>
              ) : (
                aiConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.modelName})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5">
              Temperature <span className="text-textMuted/60">({temperature})</span>
            </label>
            <div className="flex items-center gap-2 h-[38px]">
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                className="w-24 accent-blue-500"
              />
              <span className="text-xs text-white font-mono w-8">{temperature}</span>
            </div>
          </div>

          {/* Max Tokens */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5">Max Tokens</label>
            <select
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              className="bg-background border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
            >
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
              <option value={8192}>8192</option>
              <option value={16384}>16384</option>
            </select>
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={generating || aiConfigs.length === 0}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2 disabled:opacity-50 ml-auto"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            <span>{generating ? "AI 正在分析..." : "生成报告"}</span>
          </button>
        </div>

        {/* 第二行：人设 + 自定义指令 */}
        <div className="mt-4 space-y-3">
          {/* 人设选择 */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-2">AI 人设</label>
            <div className="flex gap-2">
              {[
                { value: "strict", label: "魔鬼教官", desc: "狠狠骂我，专治逆势死扛", icon: "😈" },
                { value: "gentle", label: "心理导师", desc: "亏麻了，求安慰和鼓励", icon: "👼" },
                { value: "objective", label: "量化机器", desc: "只需数据和概率", icon: "🤖" },
              ].map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTone(t.value)}
                  className={`flex-1 text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    tone === t.value
                      ? "bg-blue-600/15 border-blue-500/40 text-blue-400"
                      : "bg-background border-border text-textMuted hover:text-white hover:border-border"
                  }`}
                >
                  <div className="text-sm font-medium">{t.icon} {t.label}</div>
                  <div className="text-[10px] text-textMuted/70 mt-0.5">{t.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 自定义指令 */}
          <div>
            <label className="block text-xs font-medium text-textMuted mb-1.5">
              专属关注点 <span className="text-textMuted/50">(可选，告诉 AI 你最想诊断的问题)</span>
            </label>
            <div className="flex gap-2 mb-2">
              {["重点分析我的进场时机", "我这周容易 FOMO", "帮我盯一下胜率", "有没有过度交易"].map((tag) => (
                <button
                  key={tag}
                  onClick={() => setCustomPrompt((prev) => prev ? `${prev}；${tag}` : tag)}
                  className="text-[11px] px-2 py-1 rounded-md bg-background border border-border text-textMuted hover:text-white hover:border-blue-500/40 transition-colors whitespace-nowrap"
                >
                  + {tag}
                </button>
              ))}
            </div>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="例如：我这周做了几次左侧摸底，帮我看看有没有管住手..."
              rows={2}
              className="w-full bg-background border border-border text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500 resize-none placeholder:text-textMuted/40"
            />
          </div>
        </div>

        {generateError && (
          <div className="mt-3 text-sm text-loss bg-loss/10 border border-loss/20 rounded-lg px-4 py-2 flex items-center gap-2">
            <AlertTriangle size={14} />
            {generateError}
          </div>
        )}

        {aiConfigs.length === 0 && (
          <div className="mt-3 text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2">
            请先在{" "}
            <a href="/accounts" className="underline text-blue-400">
              账号配置
            </a>{" "}
            页面添加 AI 模型配置
          </div>
        )}
      </Card>

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* 左侧：历史报告列表 */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-textMuted uppercase tracking-wider mb-3">历史报告</h3>

          {reportsLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-blue-500" size={20} />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center text-textMuted py-8 text-sm">暂无报告，点击上方生成</div>
          ) : (
            reports.map((report) => (
              <div
                key={report.id}
                onClick={() => handleViewReport(report.id)}
                className={`bg-panel border rounded-xl p-4 cursor-pointer transition-colors ${
                  selectedReport?.id === report.id
                    ? "border-blue-500/40 bg-blue-600/10"
                    : "border-border hover:bg-white/5"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${
                      report.status === "COMPLETED"
                        ? "bg-win/10 text-win"
                        : report.status === "FAILED"
                        ? "bg-loss/10 text-loss"
                        : "bg-yellow-500/10 text-yellow-500"
                    }`}
                  >
                    {report.status === "COMPLETED" ? "已完成" : report.status === "FAILED" ? "失败" : "生成中"}
                  </span>
                  <button
                    onClick={(e) => handleDeleteReport(report.id, e)}
                    className="text-textMuted hover:text-loss transition-colors p-1"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="font-bold text-white text-sm truncate">{report.title}</div>
                <div className="text-xs text-textMuted mt-1">
                  {formatDateRange(report.startDate, report.endDate)}
                </div>
                {report.score !== null && (
                  <div className="text-xs text-textMuted mt-1 flex items-center gap-1">
                    <FileText size={12} /> 综合评级: {report.score}
                  </div>
                )}
                <div className="text-[10px] text-textMuted/60 mt-1">
                  {format(new Date(report.createdAt), "MM-dd HH:mm")}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 右侧：报告正文 */}
        <div className="lg:col-span-3">
          <Card className="min-h-[600px] p-8">
            {generating ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-6 py-20">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                  <Sparkles size={32} className="text-blue-400 animate-spin" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">AI 正在生成您的专属报告</h3>
                  <p className="text-textMuted max-w-md mx-auto">
                    正在为您梳理盈亏分布、计算 MAE/MFE 偏移、评估风险收益比并总结行为模式，请稍候...
                  </p>
                </div>
              </div>
            ) : detailLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-500" size={24} />
              </div>
            ) : selectedReport ? (
              <div className="space-y-6 animate-in fade-in duration-500">
                {/* 报告头 */}
                <div className="border-b border-border pb-6">
                  <h2 className="text-3xl font-bold text-white mb-3">{selectedReport.title}</h2>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-textMuted">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} /> 覆盖周期:{" "}
                      {formatDateRange(selectedReport.startDate, selectedReport.endDate)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={14} /> 生成时间:{" "}
                      {format(new Date(selectedReport.createdAt), "MM-dd HH:mm")}
                    </span>
                    {selectedReport.score !== null && (
                      <span className="bg-win/20 text-win px-2 py-0.5 rounded text-xs font-bold border border-win/20">
                        综合评级: {selectedReport.score}
                      </span>
                    )}
                    <span className="text-xs text-textMuted/60">
                      {selectedReport.provider} · {selectedReport.modelName}
                    </span>
                  </div>
                </div>

                {/* 报告内容 */}
                <div
                  className="prose prose-invert max-w-none text-sm text-textMain/80 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedReport.content) }}
                />

                {/* 失败信息 */}
                {selectedReport.status === "FAILED" && selectedReport.errorMessage && (
                  <div className="bg-loss/5 border border-loss/20 rounded-xl p-4">
                    <h3 className="flex items-center gap-2 font-bold text-loss mb-2">
                      <AlertTriangle size={16} /> 生成错误
                    </h3>
                    <p className="text-sm text-textMuted">{selectedReport.errorMessage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                <div className="w-16 h-16 rounded-full bg-panel border border-border flex items-center justify-center">
                  <FileText size={28} className="text-textMuted" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">选择一份历史报告</h3>
                  <p className="text-textMuted text-sm">或使用上方筛选器生成新的 AI 诊断报告</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
