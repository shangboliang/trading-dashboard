/**
 * GET /api/klines
 *
 * 服务端代理：转发 Binance Futures 公开 K 线请求。
 * 不涉及任何私钥或签名，仅代理公开数据以解决浏览器直连被墙的问题。
 *
 * Query params:
 *   symbol    - Binance 格式，如 BTCUSDT
 *   interval  - K 线周期，如 1m / 5m / 1h / 4h / 1d
 *   startTime - Unix ms
 *   endTime   - Unix ms
 *   limit     - 最多 1500（Binance 上限）
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProxyAgent, fetch as undiciFetch } from 'undici';

const BINANCE_FAPI = 'https://fapi.binance.com/fapi/v1/klines';

// 开发环境走本地代理，生产环境直连（或由运维层处理）
const proxyUrl =
  process.env.NODE_ENV === 'development'
    ? (process.env.HTTPS_PROXY || 'http://127.0.0.1:7890')
    : undefined;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // 只透传必要参数，绝不透传任何凭证
  const allowed = ['symbol', 'interval', 'startTime', 'endTime', 'limit'];
  const params = new URLSearchParams();
  for (const key of allowed) {
    const val = searchParams.get(key);
    if (val) params.set(key, val);
  }

  const url = `${BINANCE_FAPI}?${params.toString()}`;

  try {
    const fetchFn = proxyUrl
      ? (u: string) => undiciFetch(u, { dispatcher: new ProxyAgent(proxyUrl) } as any)
      : (u: string) => undiciFetch(u);

    const res = await fetchFn(url);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Binance 返回 ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/klines] 代理请求失败:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
