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

    const candles = await this.fetchOHLCV(
      exchange,
      ccxtSymbol,
      leg.openDate.getTime(),
      leg.closeDate.getTime()
    );

    if (candles.length === 0) {
      console.warn(`[MAE/MFE] ${leg.symbol} Leg ${leg.id} 无 K 线数据，跳过`);
      return;
    }

    // candle 格式: [timestamp, open, high, low, close, volume]
    const maxHigh = Math.max(...candles.map((c: number[]) => c[2]));
    const minLow  = Math.min(...candles.map((c: number[]) => c[3]));

    const entry   = leg.averageEntry;
    const exit    = leg.averageExit;
    const isLong  = leg.side === 'LONG';

    //                  LONG                     SHORT
    // MAE (逆向): entry 以下最低点距离   vs   entry 以上最高点距离
    // MFE (顺向): entry 以上最高点距离   vs   entry 以下最低点距离
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
   * 带分页的 OHLCV 拉取（Binance 每次最多 1500 根）
   * 使用 1h 时间框架，在精度和 API 调用次数之间取得平衡。
   */
  private static async fetchOHLCV(
    exchange: any,
    symbol: string,
    since: number,
    until: number
  ): Promise<number[][]> {
    const candles: number[][] = [];
    let startTime = since;
    const limit      = 1500;
    const timeframe  = '1h';
    const CANDLE_MS  = 60 * 60 * 1000;

    while (startTime < until) {
      const batch: number[][] = await exchange.fetchOHLCV(
        symbol,
        timeframe,
        startTime,
        limit,
        { endTime: until }
      );

      if (!batch || batch.length === 0) break;

      candles.push(...batch);

      const lastTs = batch[batch.length - 1][0];

      if (batch.length < limit) break;

      // 满页：推进到下一根 K 线起点
      startTime = lastTs + CANDLE_MS;

      if (exchange.rateLimit) {
        await new Promise(r => setTimeout(r, exchange.rateLimit));
      }
    }

    return candles;
  }
}
