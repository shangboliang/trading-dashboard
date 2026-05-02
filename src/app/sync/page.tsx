"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/Card";
import { accountsApi, fundingApi, type ApiAccount } from "@/lib/api-client";
import {
  RefreshCw, FileText, History, Info, Loader2, Upload, Download, DollarSign, Zap, Link as LinkIcon,
} from "lucide-react";

export default function SyncPage() {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [activeSection, setActiveSection] = useState<'trades' | 'funding' | 'mae-mfe'>('trades');

  // 同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // CSV 相关 - 订单
  const tradeFileRef = useRef<HTMLInputElement>(null);
  const [tradeCsvHeaders, setTradeCsvHeaders] = useState<string[]>([]);
  const [tradeHeaderMapping, setTradeHeaderMapping] = useState<Record<string, string>>({});
  const [isDetectingTradeHeaders, setIsDetectingTradeHeaders] = useState(false);

  // CSV 相关 - 资金费
  const fundingFileRef = useRef<HTMLInputElement>(null);
  const [fundingCsvHeaders, setFundingCsvHeaders] = useState<string[]>([]);
  const [fundingHeaderMapping, setFundingHeaderMapping] = useState<Record<string, string>>({});
  const [isDetectingFundingHeaders, setIsDetectingFundingHeaders] = useState(false);

  // 异步同步相关
  const [isAsynProcessing, setIsAsynProcessing] = useState(false);
  const [asynDownloadUrl, setAsynDownloadUrl] = useState<string | null>(null);

  // 订单 CSV 字段映射
  const TRADE_MAPPING_FIELDS = [
    { key: 'time', label: '时间', required: true, defaultNames: ['time(utc)', 'date(utc)', '时间'] },
    { key: 'symbol', label: '交易对', required: true, defaultNames: ['symbol', '代币名称/币种名称/币对', '代币名称', '币种名称', '币对'] },
    { key: 'side', label: '方向', required: true, defaultNames: ['side', '方向'] },
    { key: 'positionSide', label: '仓位方向', required: false, defaultNames: ['position side', '仓位方向'] },
    { key: 'price', label: '价格', required: true, defaultNames: ['price', '价格'] },
    { key: 'quantity', label: '数量', required: true, defaultNames: ['quantity', 'qty', '数量'] },
    { key: 'fee', label: '手续费', required: false, defaultNames: ['fee', 'commission', '手续费'] },
    { key: 'tradeId', label: '成交ID', required: false, defaultNames: ['trade id', '交易 id'] },
    { key: 'orderId', label: '订单ID', required: false, defaultNames: ['order id', '订单编号'] },
  ];

  // 资金费 CSV 字段映射
  const FUNDING_MAPPING_FIELDS = [
    { key: 'time', label: '时间', required: true, defaultNames: ['time(utc)', 'time', '时间'] },
    { key: 'type', label: '类型', required: true, defaultNames: ['type', 'incometype', 'income type', '类型'] },
    { key: 'amount', label: '金额', required: true, defaultNames: ['amount', 'income', '金额'] },
    { key: 'asset', label: '资产', required: false, defaultNames: ['asset', '资产'] },
    { key: 'symbol', label: '交易对', required: true, defaultNames: ['symbol', '代币名称/币种名称/币对', '代币名称', '币种名称', '币对'] },
    { key: 'tranId', label: '交易ID', required: false, defaultNames: ['trade id', 'tradeid', '交易 id', '交易id', 'tranid'] },
  ];

  // 加载账户列表
  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await accountsApi.getList();
      setAccounts(data);
      if (data.length > 0 && !selectedAccountId) {
        setSelectedAccountId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  // 获取当前选中的账户
  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // ─────────────────────────────────────────────────────────────
  // 订单同步相关
  // ─────────────────────────────────────────────────────────────

  const handleTradeApiSync = async (forceSync = false) => {
    if (!selectedAccountId) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      await accountsApi.sync(selectedAccountId, forceSync);
      setSyncMessage('订单 API 同步成功！');
      loadAccounts(); // 刷新账户列表
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '同步失败';
      
      // 检测时间范围超限错误
      if (errorMsg.includes('SyncTimeRangeError')) {
        setIsSyncing(false); // 先停止 loading
        const daysMatch = errorMsg.match(/(\d+) 天/);
        const days = daysMatch ? parseInt(daysMatch[1]) : 90;
        
        if (window.confirm(
          `距上次同步已有 ${Math.floor(days)} 天，数据量较大。\n\n点击"确定"仅同步最近 90 天数据\n点击"取消"放弃同步`
        )) {
          setIsSyncing(true);
          await handleTradeApiSync(true); // 递归调用，带 forceSync=true
          return;
        }
      } else {
        setSyncMessage(errorMsg);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleTradeCsvImport = async () => {
    if (!selectedAccountId || !tradeFileRef.current?.files?.[0]) {
      alert('请选择账户和 CSV 文件');
      return;
    }
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const file = tradeFileRef.current.files[0];
      await accountsApi.syncByCsv(selectedAccountId, file, tradeHeaderMapping);
      setSyncMessage('订单 CSV 导入成功！');
      setTradeCsvHeaders([]);
      setTradeHeaderMapping({});
      // 清除文件选择
      if (tradeFileRef.current) tradeFileRef.current.value = '';
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : '导入失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDetectTradeHeaders = async () => {
    const file = tradeFileRef.current?.files?.[0];
    if (!file) return;
    setIsDetectingTradeHeaders(true);
    try {
      const { headers } = await accountsApi.detectCsvHeaders(file);
      setTradeCsvHeaders(headers);
      const autoMapping: Record<string, string> = {};
      for (const field of TRADE_MAPPING_FIELDS) {
        const matched = headers.find(h => field.defaultNames.includes(h.toLowerCase()));
        if (matched) autoMapping[field.key] = matched;
      }
      setTradeHeaderMapping(autoMapping);
    } catch {
      alert('检测表头失败');
    } finally {
      setIsDetectingTradeHeaders(false);
    }
  };

  const handleRequestAsyn = async () => {
    if (!selectedAccountId) return;
    setIsAsynProcessing(true);
    try {
      const res: any = await accountsApi.requestAsynSync(selectedAccountId);
      setSyncMessage(`异步同步申请成功！本月剩余次数: ${res.quotaRemaining}/5`);
      startPollingStatus(selectedAccountId, res.downloadId);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : '申请失败');
      setIsAsynProcessing(false);
    }
  };

  const startPollingStatus = useCallback((apiKeyId: number, downloadId: string) => {
    setIsAsynProcessing(true);
    const timer = setInterval(async () => {
      try {
        const statusRes = await accountsApi.checkAsynSyncStatus(apiKeyId, downloadId);
        if (statusRes.status === 'completed' && statusRes.url) {
          clearInterval(timer);
          setAsynDownloadUrl(statusRes.url);
          setIsAsynProcessing(false);
        }
      } catch {
        clearInterval(timer);
        setIsAsynProcessing(false);
      }
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // 资金费同步相关
  // ─────────────────────────────────────────────────────────────

  const handleFundingApiSync = async () => {
    if (!selectedAccountId) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await fundingApi.syncByApi(selectedAccountId);
      setSyncMessage(`资金费 API 同步成功！导入 ${(result as any).imported || 0} 条记录`);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : '同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFundingCsvImport = async () => {
    if (!selectedAccountId || !fundingFileRef.current?.files?.[0]) {
      alert('请选择账户和 CSV 文件');
      return;
    }
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const file = fundingFileRef.current.files[0];
      const result = await fundingApi.syncByCsv(selectedAccountId, file, fundingHeaderMapping);
      setSyncMessage(`资金费 CSV 导入成功！导入 ${(result as any).imported || 0} 条记录`);
      setFundingCsvHeaders([]);
      setFundingHeaderMapping({});
      // 清除文件选择
      if (fundingFileRef.current) fundingFileRef.current.value = '';
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : '导入失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDetectFundingHeaders = async () => {
    const file = fundingFileRef.current?.files?.[0];
    if (!file) return;
    setIsDetectingFundingHeaders(true);
    try {
      const { headers } = await fundingApi.detectCsvHeaders(file);
      setFundingCsvHeaders(headers);
      const autoMapping: Record<string, string> = {};
      for (const field of FUNDING_MAPPING_FIELDS) {
        const matched = headers.find(h => field.defaultNames.includes(h.toLowerCase()));
        if (matched) autoMapping[field.key] = matched;
      }
      setFundingHeaderMapping(autoMapping);
    } catch {
      alert('检测表头失败');
    } finally {
      setIsDetectingFundingHeaders(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 资金费归集相关
  // ─────────────────────────────────────────────────────────────

  const handleAssociateFunding = async () => {
    if (!selectedAccountId) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await fundingApi.associate(selectedAccountId);
      setSyncMessage(result.message);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : '归集失败');
    } finally {
      setIsSyncing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // MAE/MFE 相关
  // ─────────────────────────────────────────────────────────────

  const handleCalculateMaeMfe = async () => {
    if (!selectedAccountId) return;
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const res = await accountsApi.calculateMaeMfe(selectedAccountId);
      setSyncMessage((res as any).message || 'MAE/MFE 补算完成！');
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : '计算失败');
    } finally {
      setIsSyncing(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // 渲染
  // ─────────────────────────────────────────────────────────────

  const sections = [
    { key: 'trades', label: '订单记录', icon: FileText, color: 'blue' },
    { key: 'funding', label: '资金费用', icon: DollarSign, color: 'green' },
    { key: 'mae-mfe', label: 'MAE/MFE', icon: Zap, color: 'purple' },
  ] as const;

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <RefreshCw className="text-blue-400" size={28} />
          数据同步
        </h1>
        <p className="text-textMuted mt-2 text-lg">同步订单记录、资金费用，补算 MAE/MFE 质量指标</p>
      </header>

      {/* 使用建议 */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Info className="text-amber-400 mt-0.5 shrink-0" size={20} />
          <div className="space-y-3 text-sm">
            <div className="font-bold text-amber-400 text-base">导入方式选择建议</div>

            <div className="space-y-1.5">
              <div className="text-white font-medium">推荐：CSV 导入</div>
              <ul className="list-disc list-inside text-textMuted space-y-0.5">
                <li>支持全部历史数据，不受 API 时间范围限制</li>
                <li>数据完整可靠，不会因 API 机制遗漏交易</li>
                <li>Binance 下载路径：数据下载中心 → 交易历史 → 交易历史 / 资金流水</li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <div className="text-white font-medium">API 同步的局限性</div>
              <ul className="list-disc list-inside text-textMuted space-y-0.5">
                <li>仅支持最近 90 天内的数据，更早的历史无法拉取</li>
                <li>通过佣金记录反推活跃币种，零费率活动期间的交易可能被遗漏</li>
                <li>已下架的交易对会被自动跳过</li>
                <li>不支持币本位（反向）合约，仅支持 USDT 本位</li>
              </ul>
            </div>

            <div className="border-t border-amber-500/10 pt-3">
              <div className="text-white font-medium mb-1.5">重要：时间格式统一</div>
              <p className="text-textMuted">
                订单 CSV 与资金费用 CSV 的时间格式必须保持一致 —— 同时使用 UTC 或同时使用 UTC+8。
                如果两者时间基准不同，资金费用将无法正确归集到对应持仓，导致 P&L 计算偏差。
              </p>
            </div>

            <div className="border-t border-amber-500/10 pt-3">
              <div className="text-white font-medium mb-1.5">Binance CSV 下载参考</div>
              <p className="text-textMuted mb-2">
                交易历史：合约 → 交易历史 → 下载交易历史<br />
                交易历史：合约 → 交易历史 → 下载资金流水
              </p>
              <div className="flex gap-3 flex-wrap">
                <a href="/guide/binance-trade-history.png" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2">
                  <Download size={12} /> 交易历史下载截图
                </a>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 账户选择 */}
      <Card>
        <div className="flex items-center gap-4">
          <label className="text-sm text-textMuted">选择账户：</label>
          {loading ? (
            <Loader2 className="animate-spin text-blue-500" size={16} />
          ) : (
            <select
              value={selectedAccountId || ''}
              onChange={e => setSelectedAccountId(Number(e.target.value) || null)}
              className="bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 min-w-[200px]"
            >
              {accounts.map(account => (
                <option key={account.id} value={account.id}>
                  {account.name} ({account.exchange})
                </option>
              ))}
            </select>
          )}
          {selectedAccount && (
            <span className="text-xs text-textMuted">
              上次同步：{selectedAccount.lastSyncAt
                ? new Date(selectedAccount.lastSyncAt).toLocaleString('zh-CN')
                : '未同步'}
            </span>
          )}
        </div>
      </Card>

      {/* 同步类型选择 */}
      <div className="flex gap-3">
        {sections.map(section => {
          const Icon = section.icon;
          const isActive = activeSection === section.key;
          const colorMap = {
            blue: { bg: 'bg-blue-600/10', border: 'border-blue-500', text: 'text-blue-400', iconBg: 'bg-blue-600' },
            green: { bg: 'bg-green-600/10', border: 'border-green-500', text: 'text-green-400', iconBg: 'bg-green-600' },
            purple: { bg: 'bg-purple-600/10', border: 'border-purple-500', text: 'text-purple-400', iconBg: 'bg-purple-600' },
          };
          const colors = colorMap[section.color];

          return (
            <button
              key={section.key}
              onClick={() => { setActiveSection(section.key); setSyncMessage(null); }}
              className={`flex items-center gap-3 px-5 py-3 rounded-xl border transition-all ${
                isActive
                  ? `${colors.bg} ${colors.border} shadow-lg`
                  : 'bg-background border-border hover:border-textMuted/50'
              }`}
            >
              <div className={`p-1.5 rounded-lg ${isActive ? `${colors.iconBg} text-white` : 'bg-background border border-border text-textMuted'}`}>
                <Icon size={16} />
              </div>
              <span className={`text-sm font-medium ${isActive ? 'text-white' : 'text-textMuted'}`}>
                {section.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* 同步消息提示 */}
      {syncMessage && (
        <div className={`p-4 rounded-xl text-sm ${
          syncMessage.includes('成功')
            ? 'bg-green-500/10 border border-green-500/20 text-green-400'
            : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {syncMessage}
        </div>
      )}

      {/* ───────── 订单记录同步 ───────── */}
      {activeSection === 'trades' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* API 快速同步 */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-600 text-white">
                <RefreshCw size={18} />
              </div>
              <div>
                <div className="font-bold text-white">API 快速同步</div>
                <div className="text-xs text-textMuted">最近 30 天</div>
              </div>
            </div>
            <p className="text-sm text-textMuted mb-4">
              通过交易所 API 拉取最近 90 天的成交记录。仅支持 USDT 本位合约，零费率期间的交易可能遗漏。
            </p>
            <button
              onClick={() => handleTradeApiSync()}
              disabled={isSyncing || !selectedAccountId}
              className="w-full bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isSyncing ? '同步中...' : '开始 API 同步'}
            </button>
          </Card>

          {/* CSV 导入 */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-600 text-white">
                <FileText size={18} />
              </div>
              <div>
                <div className="font-bold text-white">CSV 导入</div>
                <div className="text-xs text-textMuted">支持所有历史</div>
              </div>
            </div>

            <div className="bg-background/50 border border-border rounded-lg p-2.5 text-[11px] text-textMuted mb-3">
              <div className="font-medium text-white mb-1">必填字段</div>
              <div className="grid grid-cols-3 gap-1">
                <div><span className="text-blue-400">Time(UTC)</span></div>
                <div><span className="text-blue-400">Symbol</span></div>
                <div><span className="text-blue-400">Side</span></div>
                <div><span className="text-blue-400">Price</span></div>
                <div><span className="text-blue-400">Quantity</span></div>
              </div>
              <div className="mt-1.5 text-[10px] text-amber-300/70">下载路径：资产 → 交易历史 → 下载交易历史</div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-2 text-[11px] text-amber-300/80 mb-3">
              时间字段请选择 <span className="font-medium text-amber-300">UTC</span> 或 <span className="font-medium text-amber-300">UTC+8</span>，且与资金费用 CSV 保持一致，否则归集会出错。
            </div>

            <input
              type="file" accept=".csv" ref={tradeFileRef}
              onChange={handleDetectTradeHeaders}
              className="text-xs text-textMuted file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer w-full"
            />

            {isDetectingTradeHeaders && (
              <div className="flex items-center gap-2 text-xs text-textMuted mt-2">
                <Loader2 size={12} className="animate-spin" /> 检测表头...
              </div>
            )}

            {tradeCsvHeaders.length > 0 && !isDetectingTradeHeaders && (
              <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                {TRADE_MAPPING_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-2">
                    <label className="text-[11px] text-textMuted w-14 shrink-0">
                      {field.label}{field.required && <span className="text-loss">*</span>}
                    </label>
                    <select
                      value={tradeHeaderMapping[field.key] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setTradeHeaderMapping(prev => {
                          const next = { ...prev };
                          if (val) next[field.key] = val;
                          else delete next[field.key];
                          return next;
                        });
                      }}
                      className="flex-1 bg-panel border border-border rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">--</option>
                      {tradeCsvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
                <button
                  onClick={handleTradeCsvImport}
                  disabled={isSyncing}
                  className="w-full mt-2 bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-green-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  导入
                </button>
              </div>
            )}
          </Card>

          {/* API 深度同步 */}
          {selectedAccount?.exchange === 'BINANCE' && (
            <Card>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-yellow-600 text-white">
                  <History size={18} />
                </div>
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    深度同步
                    <span className="text-[10px] bg-yellow-600/20 text-yellow-400 px-1.5 py-0.5 rounded border border-yellow-500/30">BINANCE</span>
                  </div>
                  <div className="text-xs text-textMuted">可拉取 1 年</div>
                </div>
              </div>
              <p className="text-sm text-textMuted mb-3">
                通过异步接口申请导出过去一年的数据。需等待 1-5 分钟生成链接。
              </p>
              <div className="flex items-center gap-2 text-xs text-yellow-400/80 mb-4">
                <Info size={12} />
                本月剩余：{(() => {
                  const now = new Date();
                  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                  const lastSync = selectedAccount?.lastAsynSyncAt ? new Date(selectedAccount.lastAsynSyncAt) : null;
                  const count = (lastSync && lastSync >= startOfMonth) ? (selectedAccount?.asynSyncCount || 0) : 0;
                  return 5 - count;
                })()}/5
              </div>

              <button
                onClick={handleRequestAsyn}
                disabled={isAsynProcessing || !selectedAccountId}
                className="w-full bg-yellow-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isAsynProcessing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                {isAsynProcessing ? '申请中...' : '申请导出 (1年)'}
              </button>

              {asynDownloadUrl && (
                <div className="mt-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="text-green-400 text-xs font-bold mb-1">导出已就绪！</div>
                  <a href={asynDownloadUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 underline break-all">
                    下载 ZIP 并解压上传 CSV
                  </a>
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ───────── 资金费用同步 ───────── */}
      {activeSection === 'funding' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* API 同步 */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-green-600 text-white">
                <RefreshCw size={18} />
              </div>
              <div>
                <div className="font-bold text-white">API 同步</div>
                <div className="text-xs text-textMuted">最近 3 个月</div>
              </div>
            </div>
            <p className="text-sm text-textMuted mb-4">
              调用交易所 API 拉取最近 3 个月的资金费记录。仅支持 USDT 本位合约，自动过滤 FUNDING_FEE 类型并关联到对应持仓。
            </p>
            <button
              onClick={handleFundingApiSync}
              disabled={isSyncing || !selectedAccountId}
              className="w-full bg-green-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-green-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              {isSyncing ? '同步中...' : '开始 API 同步'}
            </button>
          </Card>

          {/* CSV 导入 */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-600 text-white">
                <FileText size={18} />
              </div>
              <div>
                <div className="font-bold text-white">CSV 导入</div>
                <div className="text-xs text-textMuted">收入流水文件</div>
              </div>
            </div>

            <div className="bg-background/50 border border-border rounded-lg p-2.5 text-[11px] text-textMuted mb-3">
              <div className="font-medium text-white mb-1">必填字段</div>
              <div className="grid grid-cols-2 gap-1">
                <div><span className="text-green-400">时间</span> <span className="text-loss">*</span></div>
                <div><span className="text-green-400">类型</span> <span className="text-loss">*</span></div>
                <div><span className="text-green-400">金额</span> <span className="text-loss">*</span></div>
                <div><span className="text-green-400">交易对</span> <span className="text-loss">*</span></div>
              </div>
              <div className="mt-1 text-[10px] text-textMuted/60">只导入 FUNDING_FEE 类型</div>
              <div className="mt-1 text-[10px] text-amber-300/70">下载路径：资产 → 交易历史 → 下载资金流水</div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/15 rounded-lg p-2 text-[11px] text-amber-300/80 mb-3">
              时间基准必须与订单 CSV 一致（同为 UTC 或同为 UTC+8），否则资金费用无法正确归集到持仓。
            </div>

            <input
              type="file" accept=".csv" ref={fundingFileRef}
              onChange={handleDetectFundingHeaders}
              className="text-xs text-textMuted file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-xs file:bg-green-600 file:text-white hover:file:bg-green-500 cursor-pointer w-full"
            />

            {isDetectingFundingHeaders && (
              <div className="flex items-center gap-2 text-xs text-textMuted mt-2">
                <Loader2 size={12} className="animate-spin" /> 检测表头...
              </div>
            )}

            {fundingCsvHeaders.length > 0 && !isDetectingFundingHeaders && (
              <div className="mt-3 space-y-1.5 max-h-48 overflow-y-auto">
                {FUNDING_MAPPING_FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-2">
                    <label className="text-[11px] text-textMuted w-14 shrink-0">
                      {field.label}{field.required && <span className="text-loss">*</span>}
                    </label>
                    <select
                      value={fundingHeaderMapping[field.key] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setFundingHeaderMapping(prev => {
                          const next = { ...prev };
                          if (val) next[field.key] = val;
                          else delete next[field.key];
                          return next;
                        });
                      }}
                      className="flex-1 bg-panel border border-border rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">--</option>
                      {fundingCsvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
                <button
                  onClick={handleFundingCsvImport}
                  disabled={isSyncing}
                  className="w-full mt-2 bg-green-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-green-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSyncing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  导入
                </button>
              </div>
            )}
          </Card>

          {/* 归集到持仓 */}
          <Card>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-yellow-600 text-white">
                <LinkIcon size={18} />
              </div>
              <div>
                <div className="font-bold text-white">归集到持仓</div>
                <div className="text-xs text-textMuted">关联资金费到 Leg</div>
              </div>
            </div>
            <p className="text-sm text-textMuted mb-4">
              将未关联的资金费按时间窗口归集到对应的持仓。导入资金费后会自动触发，也可手动执行。
            </p>
            <button
              onClick={handleAssociateFunding}
              disabled={isSyncing || !selectedAccountId}
              className="w-full bg-yellow-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-yellow-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <LinkIcon size={14} />}
              {isSyncing ? '归集中...' : '手动归集资金费'}
            </button>
          </Card>
        </div>
      )}

      {/* ───────── MAE/MFE 补算 ───────── */}
      {activeSection === 'mae-mfe' && (
        <Card>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-purple-600 text-white">
              <Zap size={18} />
            </div>
            <div>
              <div className="font-bold text-white">补算 MAE/MFE 质量指标</div>
              <div className="text-xs text-textMuted">最大不利波动 / 最大有利波动</div>
            </div>
          </div>
          <p className="text-sm text-textMuted mb-4">
            单独获取 K 线数据以补全该账号下已平仓但尚未计算的 MAE（最大不利波动）和 MFE（最大有利波动）进出场质量分数。
            这些指标用于评估进场和出场的质量。
          </p>
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-xs text-purple-300 mb-4">
            <div className="font-medium text-purple-400 mb-1">计算说明</div>
            <ul className="list-disc list-inside space-y-0.5 text-textMuted">
              <li>只计算状态为 CLOSED 且尚未计算 MAE 的持仓</li>
              <li>需要从交易所拉取持仓期间的 K 线数据</li>
              <li>计算完成后会更新 Leg 的 mae、mfe、entryQuality、exitQuality 字段</li>
            </ul>
          </div>
          <button
            onClick={handleCalculateMaeMfe}
            disabled={isSyncing || !selectedAccountId}
            className="bg-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-purple-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
            {isSyncing ? '计算中...' : '开始计算 MAE/MFE'}
          </button>
        </Card>
      )}
    </div>
  );
}
