/**
 * 资金费率同步服务
 *
 * 职责：
 *   1. 从交易所拉取合约持仓期间产生的历史资金费流水
 *   2. 写入 FundingFee 表（幂等，重复跳过）
 *   3. 将资金费按 (symbol + 时间区间) 归集到对应 Leg
 *   4. 更新 Leg.fundingFeeUsd 和 Leg.netPnL
 */

import prisma from '@/lib/prisma';

export class FundingFeeService {
  /**
   * 同步资金费并完成归集，返回入库条数
   */
  static async sync(
    exchange: any,
    apiKeyId: number,
    since: number
  ): Promise<number> {
    console.log('[FundingFee] 开始同步资金费率...');

    let allFunding: any[] = [];

    try {
      // Binance Futures fetchFundingHistory 可不传 symbol，全量拉取
      allFunding = await this.fetchWithPagination(exchange, undefined, since);
      console.log(`[FundingFee] 拉取到 ${allFunding.length} 条资金费记录`);
    } catch (err) {
      console.warn(
        '[FundingFee] 全局拉取失败，跳过资金费同步:',
        err instanceof Error ? err.message : err
      );
      return 0;
    }

    if (allFunding.length === 0) return 0;

    // 写入数据库（upsert 防重）
    let imported = 0;
    for (const fee of allFunding) {
      const parts = (fee.symbol as string).split('/');
      const base  = parts[0] || '';
      const quote = (parts[1] || 'USDT').split(':')[0];
      const dbSymbol = `${base}${quote}`;

      try {
        await prisma.fundingFee.upsert({
          where: {
            apiKeyId_symbol_timestamp: {
              apiKeyId,
              symbol: dbSymbol,
              timestamp: new Date(fee.timestamp),
            },
          },
          create: {
            apiKeyId,
            symbol:    dbSymbol,
            amount:    fee.amount    ?? 0,
            amountUsd: fee.amount    ?? 0, // U 本位合约资金费本身即 USDT
            timestamp: new Date(fee.timestamp),
          },
          update: {}, // 已存在则不更新
        });
        imported++;
      } catch {
        // 唯一约束冲突时静默跳过
      }
    }

    console.log(`[FundingFee] 入库 ${imported} 条新记录`);

    // 归集到 Leg，更新 netPnL
    await this.associateWithLegs(apiKeyId);

    return imported;
  }

  /**
   * 将 FundingFee 按 (symbol + 时间区间) 关联到 Leg，并刷新 Leg.fundingFeeUsd / netPnL
   */
  static async associateWithLegs(apiKeyId: number): Promise<void> {
    const unlinked = await prisma.fundingFee.findMany({
      where: { apiKeyId, legId: null },
    });

    if (unlinked.length === 0) return;

    console.log(`[FundingFee] 关联 ${unlinked.length} 条未归集资金费到 Leg...`);

    const apiKeyRow = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { userId: true },
    });
    if (!apiKeyRow) return;

    // 按 symbol 分组，批量查 Leg，减少 N+1 查询
    const bySymbol: Record<string, typeof unlinked> = {};
    for (const f of unlinked) {
      (bySymbol[f.symbol] ??= []).push(f);
    }

    for (const [symbol, fees] of Object.entries(bySymbol)) {
      const legs = await prisma.leg.findMany({
        where: { userId: apiKeyRow.userId, symbol },
        orderBy: { openDate: 'asc' },
      });

      // 为每条资金费找到它落在哪个 Leg 的时间窗口
      for (const fee of fees) {
        const leg = legs.find(
          l =>
            l.openDate <= fee.timestamp &&
            (l.closeDate === null || l.closeDate >= fee.timestamp)
        );
        if (!leg) continue;

        await prisma.fundingFee.update({
          where: { id: fee.id },
          data: { legId: leg.id },
        });
      }

      // 重新聚合每个 Leg 的资金费总额并更新 netPnL
      for (const leg of legs) {
        const legFees = await prisma.fundingFee.findMany({
          where: { legId: leg.id },
          select: { amountUsd: true },
        });

        const totalFundingUsd = legFees.reduce((s, f) => s + f.amountUsd, 0);

        await prisma.leg.update({
          where: { id: leg.id },
          data: {
            fundingFeeUsd: totalFundingUsd,
            netPnL: leg.realisedPnLusd - leg.commissionUsd + totalFundingUsd,
          },
        });
      }
    }

    console.log('[FundingFee] 归集完成');
  }

  // ─────────────────────────────────────────────────────────────
  // 私有：7 天时间窗口分页（与 Trade 分页策略一致）
  // ─────────────────────────────────────────────────────────────

  private static async fetchWithPagination(
    exchange: any,
    symbol: string | undefined,
    since: number
  ): Promise<any[]> {
    const results: any[] = [];
    let startTime = since;
    const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    const limit = 1000;
    const now = Date.now();

    while (startTime < now) {
      const windowEnd = Math.min(startTime + WINDOW_MS, now);

      const batch: any[] = await exchange.fetchFundingHistory(
        symbol,
        startTime,
        limit,
        { endTime: windowEnd }
      );

      if (batch && batch.length > 0) {
        results.push(...batch);

        if (batch.length === limit) {
          // 满页：继续拉同一窗口内的后续数据
          startTime = batch[batch.length - 1].timestamp + 1;
          continue;
        }
      }

      // 未满页或空页：推进到下一个窗口
      startTime = windowEnd + 1;

      if (exchange.rateLimit) {
        await new Promise(r => setTimeout(r, exchange.rateLimit));
      }
    }

    return results;
  }
}
