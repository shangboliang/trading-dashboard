export const dynamic = 'force-dynamic';
/**
 * GET /api/klines
 *
 * 服务端代理：转发 Binance Futures 公开 K 线请求。
 * 不涉及任何私钥或签名，仅代理公开数据以解决浏览器直连被墙的问题。
 * 
 * 使用 ccxt 替代 undici 以避免依赖缺失问题，并复用其成熟的代理处理能力。
 *
 * Query params:
 *   symbol    - Binance 格式，如 BTCUSDT
 *   interval  - K 线周期，如 1m / 5m / 1h / 4h / 1d
 *   startTime - Unix ms
 *   endTime   - Unix ms
 *   limit     - 最多 1500（Binance 上限）
 */

import { NextRequest, NextResponse } from 'next/server';
import ccxt from 'ccxt';

// 开发环境走本地代理
const proxyUrl =
  process.env.NODE_ENV === 'development'
    ? (process.env.HTTPS_PROXY || 'http://127.0.0.1:7890')
    : undefined;

// 初始化一个只读的币安实例用于公开数据请求
const binance = new ccxt.binance({
  httpsProxy: proxyUrl,
  options: {
    'defaultType': 'future', // 强制走 fapi.binance.com
  }
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval') || '1h';
  const startTime = searchParams.get('startTime');
  const endTime = searchParams.get('endTime');
  const limit = searchParams.get('limit');

  if (!symbol) {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 });
  }

  try {
    // 使用 ccxt 的隐式调用直接请求 Binance API
    // fapiPublicGetKlines 对应 GET /fapi/v1/klines
    const params: any = {
      symbol: symbol.toUpperCase(),
      interval,
    };
    if (startTime) params.startTime = startTime;
    if (endTime) params.endTime = endTime;
    if (limit) params.limit = limit;

    const data = await binance.fapiPublicGetKlines(params);

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/klines] 代理请求失败:', msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
