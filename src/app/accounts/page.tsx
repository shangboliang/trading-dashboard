"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/Card";
import { accountsApi, type ApiAccount } from "@/lib/api-client";
import { Key, Plus, Trash2, Edit2, CheckCircle2, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { format } from "date-fns";

// 交易所映射
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
  const [syncingId, setSyncingId] = useState<number | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newAccount, setNewAccount] = useState({ 
    name: "", 
    exchange: "BINANCE", 
    apiKey: "", 
    apiSecret: "",
    passphrase: ""
  });

  // 加载账户列表
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

  const handleSync = async (id: number) => {
    setSyncingId(id);
    try {
      await accountsApi.sync(id);
      alert('同步成功！');
      loadAccounts();
    } catch (err) {
      alert(err instanceof Error ? err.message : '同步失败');
    } finally {
      setSyncingId(null);
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
              
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center font-bold text-white shadow-inner uppercase">
                     {account.exchange.slice(0, 2)}
                   </div>
                   <div>
                     <h3 className="text-lg font-bold text-white flex items-center gap-2">
                       {account.name}
                       {account.isVerified ? (
                         <span className="flex items-center gap-1 text-[10px] bg-win/10 text-win px-2 py-0.5 rounded-full border border-win/20"><CheckCircle2 size={10}/> 正常</span>
                       ) : account.syncStatus === 'FAILED' ? (
                         <span className="flex items-center gap-1 text-[10px] bg-loss/10 text-loss px-2 py-0.5 rounded-full border border-loss/20"><AlertCircle size={10}/> 失效</span>
                       ) : (
                         <span className="flex items-center gap-1 text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full border border-yellow-500/20">待验证</span>
                       )}
                     </h3>
                     <div className="text-sm text-textMuted mt-1 font-mono">Key: {account.apiKey}</div>
                   </div>
                </div>
                
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleSync(account.id)}
                    disabled={syncingId === account.id}
                    className="p-2 bg-background border border-border rounded-md text-textMuted hover:text-blue-500 transition-colors disabled:opacity-50" 
                    title="同步数据"
                  >
                    {syncingId === account.id ? (
                      <Loader2 className="animate-spin" size={16} />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </button>
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
                  value={newAccount.name} onChange={e => setNewAccount({...newAccount, name: e.target.value})}
                  className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 text-sm" 
                />
              </div>

              <div>
                 <label className="block text-sm font-medium text-textMain mb-1.5">交易所平台</label>
                 <select 
                   value={newAccount.exchange} onChange={e => setNewAccount({...newAccount, exchange: e.target.value})}
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
                   value={newAccount.apiKey} onChange={e => setNewAccount({...newAccount, apiKey: e.target.value})}
                   className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 font-mono text-sm" 
                 />
              </div>
              
              <div>
                 <label className="block text-sm font-medium text-textMain mb-1.5">API Secret</label>
                 <input 
                   type="password" placeholder="输入您的 API Secret"
                   value={newAccount.apiSecret} onChange={e => setNewAccount({...newAccount, apiSecret: e.target.value})}
                   className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 font-mono text-sm" 
                 />
              </div>
              
              <div>
                 <label className="block text-sm font-medium text-textMain mb-1.5">API Passphrase <span className="text-textMuted text-xs">(OKX/Bybit 需要)</span></label>
                 <input 
                   type="password" placeholder="输入您的 API Passphrase"
                   value={newAccount.passphrase} onChange={e => setNewAccount({...newAccount, passphrase: e.target.value})}
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
