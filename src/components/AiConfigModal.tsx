"use client";

import { useState, useEffect } from "react";
import { aiApi, type AiConfigItem } from "@/lib/api-client";
import { Sparkles, Loader2 } from "lucide-react";

interface AiConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  editConfig?: AiConfigItem | null;
}

const PROVIDER_OPTIONS = [
  { value: "OPENAI", label: "OpenAI 兼容", desc: "OpenAI / DeepSeek / Moonshot / 通义千问等" },
  { value: "ANTHROPIC", label: "Anthropic Claude", desc: "Claude 系列模型" },
  { value: "GEMINI", label: "Google Gemini", desc: "Gemini 系列模型" },
];

const MODEL_SUGGESTIONS: Record<string, string[]> = {
  OPENAI: ["gpt-4o", "gpt-4o-mini", "deepseek-chat", "moonshot-v1-8k", "qwen-turbo"],
  ANTHROPIC: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022", "claude-3-opus-20240229"],
  GEMINI: ["gemini-2.0-flash", "gemini-2.5-pro-preview-05-06", "gemini-1.5-flash"],
};

export default function AiConfigModal({ isOpen, onClose, onSaved, editConfig }: AiConfigModalProps) {
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("OPENAI");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [modelName, setModelName] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);
  const [defaultTone, setDefaultTone] = useState("objective");
  const [customInstruction, setCustomInstruction] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editConfig) {
      setName(editConfig.name);
      setProvider(editConfig.provider);
      setApiKey("");
      setBaseUrl(editConfig.baseUrl || "");
      setModelName(editConfig.modelName);
      setTemperature(editConfig.temperature ?? 0.7);
      setMaxTokens(editConfig.maxTokens ?? 4096);
      setDefaultTone(editConfig.defaultTone || "objective");
      setCustomInstruction(editConfig.customInstruction || "");
      setIsDefault(editConfig.isDefault);
    } else {
      setName("");
      setProvider("OPENAI");
      setApiKey("");
      setBaseUrl("");
      setModelName("");
      setTemperature(0.7);
      setMaxTokens(4096);
      setDefaultTone("objective");
      setCustomInstruction("");
      setIsDefault(false);
    }
  }, [editConfig, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!name || !apiKey || !modelName) {
      alert("请填写配置名称、API Key 和模型名称");
      return;
    }

    try {
      setSaving(true);
      if (editConfig) {
        await aiApi.updateConfig(editConfig.id, {
          name,
          apiKey,
          baseUrl: baseUrl || undefined,
          modelName,
          temperature,
          maxTokens,
          defaultTone,
          customInstruction,
          isDefault,
        });
      } else {
        await aiApi.createConfig({
          name,
          provider,
          apiKey,
          baseUrl: baseUrl || undefined,
          modelName,
          temperature,
          maxTokens,
          defaultTone,
          customInstruction,
          isDefault,
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const suggestions = MODEL_SUGGESTIONS[provider] || [];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-panel border border-border rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Sparkles size={20} className="text-blue-400" />
          {editConfig ? "编辑 AI 配置" : "添加 AI 模型配置"}
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-textMain mb-1.5">配置名称</label>
            <input
              type="text"
              placeholder="例如：DeepSeek、GPT-4o"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-textMain mb-1.5">AI 服务商</label>
            <select
              value={provider}
              onChange={(e) => {
                setProvider(e.target.value);
                setModelName("");
                setBaseUrl("");
              }}
              disabled={!!editConfig}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 text-sm disabled:opacity-50"
            >
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.desc}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-textMain mb-1.5">
              API Key
              {editConfig && <span className="text-textMuted text-xs ml-2">(留空则不修改)</span>}
            </label>
            <input
              type="password"
              placeholder="输入 API Key"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
          </div>

          {provider === "OPENAI" && (
            <div>
              <label className="block text-sm font-medium text-textMain mb-1.5">
                Base URL <span className="text-textMuted text-xs">(可选，留空使用官方地址)</span>
              </label>
              <input
                type="text"
                placeholder="https://api.openai.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-textMain mb-1.5">模型名称</label>
            <input
              type="text"
              placeholder={suggestions[0] || "输入模型名称"}
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-white placeholder:text-textMuted/50 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setModelName(s)}
                    className={`text-xs px-2 py-1 rounded-md border transition-colors ${
                      modelName === s
                        ? "bg-blue-600/20 border-blue-500/40 text-blue-400"
                        : "bg-background border-border text-textMuted hover:text-white hover:border-border"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-border bg-background"
            />
            <label htmlFor="isDefault" className="text-sm text-textMain cursor-pointer">
              设为默认配置
            </label>
          </div>

          {/* 高级参数 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-textMain mb-1.5">
                Temperature <span className="text-textMuted text-xs">(0-2)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <span className="text-sm text-white font-mono w-10 text-right">{temperature}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-textMain mb-1.5">
                Max Tokens <span className="text-textMuted text-xs">(最大输出长度)</span>
              </label>
              <select
                value={maxTokens}
                onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value={1024}>1024</option>
                <option value={2048}>2048</option>
                <option value={4096}>4096</option>
                <option value={8192}>8192</option>
                <option value={16384}>16384</option>
              </select>
            </div>
          </div>

          {/* 默认人设 */}
          <div>
            <label className="block text-sm font-medium text-textMain mb-1.5">默认 AI 人设</label>
            <div className="flex gap-2">
              {[
                { value: "strict", label: "😈 魔鬼教官" },
                { value: "gentle", label: "👼 心理导师" },
                { value: "objective", label: "🤖 量化机器" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setDefaultTone(t.value)}
                  className={`flex-1 text-sm px-3 py-2 rounded-lg border transition-colors ${
                    defaultTone === t.value
                      ? "bg-blue-600/15 border-blue-500/40 text-blue-400"
                      : "bg-background border-border text-textMuted hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 自定义指令 */}
          <div>
            <label className="block text-sm font-medium text-textMain mb-1.5">
              默认自定义指令 <span className="text-textMuted text-xs">(可选，追加到提示词末尾)</span>
            </label>
            <textarea
              value={customInstruction}
              onChange={(e) => setCustomInstruction(e.target.value)}
              placeholder="例如：重点分析我的进场时机、帮我盯一下胜率..."
              rows={2}
              className="w-full bg-background border border-border rounded-lg p-2.5 text-white focus:outline-none focus:border-blue-500 text-sm resize-none placeholder:text-textMuted/40"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded border-border bg-background"
            />
            <label htmlFor="isDefault" className="text-sm text-textMain cursor-pointer">
              设为默认配置
            </label>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-textMuted hover:text-white hover:bg-white/5 rounded-lg transition-colors text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium text-sm hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
