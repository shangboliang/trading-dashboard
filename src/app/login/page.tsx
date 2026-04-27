"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { authApi } from "@/lib/api-client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await authApi.login({ email, password });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-900/20 via-background to-background">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="w-11 h-11 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-600/30">
            T
          </div>
          <h1 className="mt-6 text-3xl font-bold text-white">登录 Trading Dashboard</h1>
          <p className="mt-2 text-sm text-textMuted">查看你的交易复盘、账户和分析数据。</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-panel border border-border rounded-lg p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-textMain mb-2">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-blue-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-textMain mb-2">密码</label>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-white outline-none focus:border-blue-500"
              placeholder="至少 8 位"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-loss/30 bg-loss/10 px-3 py-2 text-sm text-loss">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white rounded-lg py-2.5 font-medium transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
            登录
          </button>

          <p className="text-center text-sm text-textMuted">
            还没有账号？{" "}
            <Link href="/register" className="text-blue-400 hover:text-blue-300">
              去注册
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
