"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { accountsApi, aiApi, type ApiAccount, type AiConfigItem } from "@/lib/api-client";
import { Key, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { format } from "date-fns";
import AiConfigModal from "@/components/AiConfigModal";

const EXCHANGE_MAP: Record<string, string> = {
  BINANCE: 'binance',
  OKX: 'okx',
  BYBIT: 'bybit',
  HUOBI: 'huobi',
  GATEIO: 'gateio',
  KUCOIN: 'kucoin',
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<ApiAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const [isAdding, setIsAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({
    name: "",
    exchange: "BINANCE",
    apiKey: "",
    apiSecret: "",
    passphrase: ""
  });

  // AI 配置状态
  const [aiConfigs, setAiConfigs] = useState<AiConfigItem[]>([]);
  const [aiLoading, setAiLoading] = useState(true);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [editingAiConfig, setEditingAiConfig] = useState<AiConfigItem | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      setLoading(true);
      const data = await accountsApi.getList();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to load accounts:', err);
      alert('加载账户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const loadAiConfigs = useCallback(async () => {
    try {
      setAiLoading(true);
      const data = await aiApi.getConfigs();
      setAiConfigs(data);
    } catch (err) {
      console.error('Failed to load AI configs:', err);
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAiConfigs();
  }, [loadAiConfigs]);

  const handleDeleteAiConfig = async (id: number) => {
    if (confirm("确定要删除此 AI 配置吗？")) {
      try {
        await aiApi.deleteConfig(id);
        loadAiConfigs();
      } catch (err) {
        alert('删除 AI 配置失败');
      }
    }
  };

  const PROVIDER_LABELS: Record<string, string> = {
    OPENAI: 'OpenAI 兼容',
    ANTHROPIC: 'Anthropic',
    GEMINI: 'Gemini',
  };

  const handleAdd = async () => {
    if (!newAccount.name || !newAccount.apiKey || !newAccount.apiSecret) {
      alert("请填写完整信息");
      return;
    }

    try {
      await accountsApi.create({
        name: newAccount.name,
        exchange: newAccount.exchange,
        apiKey: newAccount.apiKey,
        apiSecret: newAccount.apiSecret,
        passphrase: newAccount.passphrase || undefined,
      });

      loadAccounts();
      setIsAdding(false);
      setNewAccount({ name: "", exchange: "BINANCE", apiKey: "", apiSecret: "", passphrase: "" });
      alert('账户添加成功！');
    } catch (err) {
      alert(err instanceof Error ? err.message : '添加账户失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("确定要删除此 API 账户吗？这不会删除已同步的历史订单。")) {
      try {
        await accountsApi.delete(id);
        loadAccounts();
      } catch (err) {
        alert('删除账户失败');
      }
    }
  };

  return (
    <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <header className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">账号管理 (API Keys)</h1>
          <p className="text-textMuted mt-2 text-lg">安全地绑定您的交易所 API 以自动同步历史订单</p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
        >
          <Plus size={16} /> 添加新账号
        </button>
      </header>

      {/* 预警提示 */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3 text-sm text-blue-200">
        <Key className="text-blue-400 mt-0.5" size={18} />
        <div>
          <p className="font-bold text-blue-400 mb-1">安全提示</p>
          <p>请确保您生成的 API Key <strong className="text-white">仅开启"只读 (Read Only)"权限</strong>。我们的系统只用于获取历史订单进行复盘分析，绝不要求提现或交易权限。所有密钥在服务器端均采用 AES-256 加密保存。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full flex items-center justify-center h-64">
            <Loader2 className="animate-spin text-blue-500" size={32} />
          </div>
        ) : accounts.length === 0 ? (
          <div className="col-span-full text-center text-textMuted py-12">
            暂无绑定的交易所账户，请点击右上角添加新账户
          </div>
        ) : (
          accounts.map(account => (
            <Card key={account.id} className="relative group overflow-hidden">
              {account.syncStatus === 'FAILED' ? (
                <div className="absolute top-0 left-0 w-1 h-full bg-loss"></div>
              ) : account.isVerified ? (
                <div className="absolute top-0 left-0 w-1 h-full bg-win"></div>
              ) : null}

              <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center font-bold text-white shadow-inner uppercase shrink-0">
                    {account.exchange.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold text-white flex flex-wrap items-center gap-2">
                      <span className="truncate">{account.name}</span>
                      {account.isVerified ? (
                        <span className="flex items-center gap-1 text-[10px] bg-win/10 text-win px-2 py-0.5 rounded-full border border-win/20 whitespace-nowrap"><CheckCircle2 size={10} /> 正常</span>
                      ) : account.syncStatus === 'FAILED' ? (
                        <span className="flex items-center gap-1 text-[10px] bg-loss/10 text-loss px-2 py-0.5 rounded-full border border-loss/20 whitespace-nowrap"><AlertCircle size={10} /> 失效</span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full border border-yellow-500/20 whitespace-nowrap">待验证</span>
                      )}
                    </h3>
                    <div className="text-sm text-textMuted mt-1 font-mono truncate max-w-[200px] sm:max-w-xs">Key: {account.apiKey}</div>
                  </div>
                </div>

                <div className="flex gap-2 transition-opacity shrink-0">
                  <button className="p-2 bg-background border border-border rounded-md text-textMuted hover:text-white transition-colors" title="重新配置">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDelete(account.id)} className="p-2 bg-background border border-border rounded-md text-textMuted hover:text-loss transition-colors" title="删除">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border flex justify-between items-center text-sm">
                <div className="text-textMuted">平台: <span className="text-white uppercase">{EXCHANGE_MAP[account.exchange] || account.exchange}</span></div>
                <div className="text-textMuted">
                  {account.lastSyncAt ? (
                    <>上次同步：<span className="text-white">{format(new Date(account.lastSyncAt), 'MM-dd HH:mm')}</span></>
                  ) : (
                    <>上次同步：<span className="text-white">未同步</span></>
                  )}
                </div>
              </div>

              {account.errorMessage && (
                <div className="mt-3 text-xs text-loss bg-loss/10 px-3 py-2 rounded">
                  错误：{account.errorMessage}
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* ========== AI 模型配置区 ========== */}
      <div className="border-t border-border pt-10 mt-10">
        <header className="flex justify-between items-end mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <Sparkles size={22} className="text-blue-400" />
              AI 模型配置
            </h2>
            <p className="text-textMuted mt-1">配置 AI 大模型以生成交易诊断报告</p>
          </div>
          <button
            onClick={() => { setEditingAiConfig(null); setAiModalOpen(true); }}
            className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 flex items-center gap-2"
          >
            <Plus size={16} /> 添加 AI 配置
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {aiLoading ? (
            <div className="col-span-full flex items-center justify-center h-32">
              <Loader2 className="animate-spin text-blue-500" size={24} />
            </div>
          ) : aiConfigs.length === 0 ? (
            <div className="col-span-full text-center text-textMuted py-8 bg-panel border border-border rounded-xl">
              暂无 AI 配置，请点击右上角添加
            </div>
          ) : (
            aiConfigs.map(config => (
              <Card key={config.id} className="relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <Sparkles size={20} className="text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white flex flex-wrap items-center gap-2">
                        <span className="truncate">{config.name}</span>
                        {config.isDefault && (
                          <span className="flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 whitespace-nowrap">
                            默认
                          </span>
                        )}
                      </h3>
                      <div className="text-sm text-textMuted mt-1">
                        {PROVIDER_LABELS[config.provider] || config.provider} · <span className="font-mono">{config.modelName}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => { setEditingAiConfig(config); setAiModalOpen(true); }}
                      className="p-2 bg-background border border-border rounded-md text-textMuted hover:text-white transition-colors"
                      title="编辑"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteAiConfig(config.id)}
                      className="p-2 bg-background border border-border rounded-md text-textMuted hover:text-loss transition-colors"
                      title="删除"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {config.baseUrl && (
                  <div className="mt-3 pt-3 border-t border-border text-xs text-textMuted">
                    Base URL: <span className="font-mono text-textMain">{config.baseUrl}</span>
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* AI 配置弹窗 */}
      <AiConfigModal
        isOpen={aiModalOpen}
        onClose={() => { setAiModalOpen(false); setEditingAiConfig(null); }}
        onSaved={loadAiConfigs}
        editConfig={editingAiConfig}
      />

      {/* 添加新账号弹窗 */}
      {isAdding && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-panel border border-border rounded-xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-white mb-6">配置交易所 API</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textMain mb-1.5">账户别名 (便于区分)</label>
                <input
                  type="text" placeholder="例如：Binance 主力号"
                  value={newAccount.name} onChange={e => setNewAccount({ ...newAccount, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-textMain mb-1.5">交易所平台</label>
                <select
                  value={newAccount.exchange} onChange={e => setNewAccount({ ...newAccount, exchange: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="BINANCE">Binance (币安)</option>
                  <option value="OKX">OKX (欧易)</option>
                  <option value="BYBIT">Bybit</option>
                  <option value="HUOBI">HTX (火币)</option>
                  <option value="GATEIO">Gate.io</option>
                  <option value="KUCOIN">KuCoin</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-textMain mb-1.5">API Key</label>
                <input
                  type="text" placeholder="输入您的 API Key"
                  value={newAccount.apiKey} onChange={e => setNewAccount({ ...newAccount, apiKey: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-textMain mb-1.5">API Secret</label>
                <input
                  type="password" placeholder="输入您的 API Secret"
                  value={newAccount.apiSecret} onChange={e => setNewAccount({ ...newAccount, apiSecret: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-textMain mb-1.5">API Passphrase <span className="text-textMuted text-xs">(OKX/Bybit 需要)</span></label>
                <input
                  type="password" placeholder="输入您的 API Passphrase"
                  value={newAccount.passphrase} onChange={e => setNewAccount({ ...newAccount, passphrase: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 font-mono text-sm"
                />
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm"
              >
                取消
              </button>
              <button
                onClick={handleAdd}
                className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-blue-500 transition-colors"
              >
                验证并保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
