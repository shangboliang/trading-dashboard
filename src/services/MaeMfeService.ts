/**
 * MAE / MFE 计算服务
 *
 * 基于 1h K 线数据，为已平仓的 Leg 计算：
 *   MAE (Max Adverse Excursion)  — 持仓期间最大逆向价格波动（体现实际承受的最大浮亏）
 *   MFE (Max Favorable Excursion) — 持仓期间最大顺向价格波动（体现最大浮盈机会）
 *   进场质量 = MFE / (MFE + MAE) × 100   → 越高说明开仓时机越好
 *   出场质量 = (exitPrice - worstPrice) / (bestPrice - worstPrice) × 100
 *
 * MAE/MFE 单位：每合约的价格差（USDT/contract），与 averageEntry 同单位。
 */

import prisma from '@/lib/prisma';

type LegRow = {
  id: number;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  side: string;
  openDate: Date;
  closeDate: Date | null;
  averageEntry: number;
  averageExit: number | null;
};

export class MaeMfeService {
  /**
   * 对给定的 Leg ID 列表计算 MAE/MFE（仅处理已平仓且尚未计算的 Leg）
   */
  static async calculate(exchange: any, legIds: number[]): Promise<void> {
    if (legIds.length === 0) return;

    const legs = await prisma.leg.findMany({
      where: {
        id:        { in: legIds },
        status:    'CLOSED',
        closeDate: { not: null },
        mae:       null, // 只处理尚未计算的
      },
      select: {
        id:           true,
        symbol:       true,
        baseAsset:    true,
        quoteAsset:   true,
        side:         true,
        openDate:     true,
        closeDate:    true,
        averageEntry: true,
        averageExit:  true,
      },
    });

    if (legs.length === 0) return;

    console.log(`[MAE/MFE] 计算 ${legs.length} 个 Leg...`);

    let done = 0;
    for (const leg of legs) {
      try {
        await this.calculateForLeg(exchange, leg);
        done++;
      } catch (err) {
        console.error(
          `[MAE/MFE] Leg ${leg.id} (${leg.symbol}) 失败:`,
          err instanceof Error ? err.message : err
        );
      }
    }

    console.log(`[MAE/MFE] 完成 ${done}/${legs.length}`);
  }

  // ─────────────────────────────────────────────────────────────────────────

private static async calculateForLeg(exchange: any, leg: LegRow): Promise<void> {
    if (!leg.closeDate || leg.averageExit == null) return;

    // 数据库 symbol (BTCUSDT) → CCXT symbol (BTC/USDT:USDT)
    const ccxtSymbol = `${leg.baseAsset}/${leg.quoteAsset}:${leg.quoteAsset}`;

    // 1. 动态决定 Timeframe 和单根 K 线的毫秒数
    const durationMs = leg.closeDate.getTime() - leg.openDate.getTime();
    let timeframe = '1h';
    let candleMs = 60 * 60 * 1000;

    if (durationMs <= 2 * 60 * 60 * 1000) {
      // 持仓小于 2 小时，用 1 分钟线
      timeframe = '1m';
      candleMs = 60 * 1000;
    } else if (durationMs <= 12 * 60 * 60 * 1000) {
      // 持仓小于 12 小时，用 5 分钟线
      timeframe = '5m';
      candleMs = 5 * 60 * 1000;
    } else if (durationMs <= 3 * 24 * 60 * 60 * 1000) {
      // 持仓小于 3 天，用 15 分钟线
      timeframe = '15m';
      candleMs = 15 * 60 * 1000;
    } 
    // 更长的持仓默认使用 1h

    // 2. 时间戳抹零对齐，防止短线数据被交易所整点过滤机制漏掉
    // 向下取整：确保能拉取到开仓所在的这根 K 线
    const since = Math.floor(leg.openDate.getTime() / candleMs) * candleMs;
    // 向上取整加宽界限：确保包含平仓时的波动
    const until = Math.ceil(leg.closeDate.getTime() / candleMs) * candleMs + candleMs;

    const candles = await this.fetchOHLCV(
      exchange,
      ccxtSymbol,
      timeframe,
      candleMs,
      since,
      until
    );

    if (candles.length === 0) {
      console.warn(`[MAE/MFE] ${leg.symbol} Leg ${leg.id} 无 K 线数据，跳过 (Timeframe: ${timeframe})`);
      return;
    }

    // candle 格式: [timestamp, open, high, low, close, volume]
    const maxHigh = Math.max(...candles.map((c: number[]) => c[2]));
    const minLow  = Math.min(...candles.map((c: number[]) => c[3]));

    const entry   = leg.averageEntry;
    const exit    = leg.averageExit;
    const isLong  = leg.side === 'LONG';

    // MAE (逆向): entry 以下最低点距离 vs entry 以上最高点距离
    // MFE (顺向): entry 以上最高点距离 vs entry 以下最低点距离
    const mae = isLong
      ? Math.max(0, entry - minLow)
      : Math.max(0, maxHigh - entry);

    const mfe = isLong
      ? Math.max(0, maxHigh - entry)
      : Math.max(0, entry - minLow);

    // 进出场质量（0~100%）
    const range = maxHigh - minLow;
    let entryQuality: number | null = null;
    let exitQuality:  number | null = null;

    if (range > 0 && (mfe + mae) > 0) {
      entryQuality = (mfe / (mfe + mae)) * 100;
      // 出场质量 = 实际出场价在整个波动区间的位置
      exitQuality = isLong
        ? ((exit - minLow) / range) * 100
        : ((maxHigh - exit) / range) * 100;
    }

    await prisma.leg.update({
      where: { id: leg.id },
      data: { mae, mfe, entryQuality, exitQuality },
    });
  }

  /**
   * 带分页的 OHLCV 拉取 (防封禁智能优化版)
   */
  private static async fetchOHLCV(
    exchange: any,
    symbol: string,
    timeframe: string,
    candleMs: number,
    since: number,
    until: number
  ): Promise<number[][]> {
    const candles: number[][] = [];
    let startTime = since;

    // 绝对上限设置为 1000，彻底避开 >1000 触发的权重 10 惩罚
    const MAX_LIMIT = 1000;

    while (startTime < until) {
      // 1. 精确计算本次实际需要的 K 线数量，绝不多拉
      const requiredCandles = Math.ceil((until - startTime) / candleMs);
      let currentLimit = Math.min(MAX_LIMIT, requiredCandles);

      // 2. 智能降级（权重极客优化）
      // 避免刚刚越过界限触发高权重惩罚，比如需要 505 根时截断为 499 (权重由 5 降为 2)
      if (currentLimit >= 500 && currentLimit < 750) {
        currentLimit = 499;
      }

      const batch: number[][] = await exchange.fetchOHLCV(
        symbol,
        timeframe,
        startTime,
        currentLimit,
        { endTime: until }
      );

      if (!batch || batch.length === 0) break;

      candles.push(...batch);

      const lastTs = batch[batch.length - 1][0];

      // 如果拉出来的数据不到期望的数量，说明数据已经到头了
      if (batch.length < currentLimit) break;

      // 满页：推进到下一根 K 线起点
      startTime = lastTs + candleMs;

      // 防止异常数据导致的死循环
      if (startTime <= lastTs) {
        startTime = lastTs + 1;
      }

      // 3. 动态权重休眠保护
      // 计算本次请求消耗的 Binance 权重
      let weightConsumed = 1;
      if (currentLimit >= 500) {
        weightConsumed = 5;
      } else if (currentLimit >= 100) {
        weightConsumed = 2; 
      }

      // 让大权重请求后强制多休息一会儿，保护服务器 IP 不被拉黑
      const baseRateLimit = exchange.rateLimit || 100;
      const sleepMs = Math.max(baseRateLimit, weightConsumed * 50); 
      
      await new Promise(r => setTimeout(r, sleepMs));
    }

    return candles;
  }
}
