/**
 * 资金费率同步服务
 *
 * 职责：
 *   1. 从交易所拉取合约持仓期间产生的历史资金费流水
 *   2. 从 CSV 导入资金费记录
 *   3. 写入 FundingFee 表（幂等，重复跳过）
 *   4. 将资金费按 (symbol + 时间区间) 归集到对应 Leg
 *   5. 更新 Leg.fundingFeeUsd 和 Leg.netPnL
 */

import prisma from '@/lib/prisma';
import { ApiKeyService } from './ApiKeyService';
import { IncomeCsvService, type IncomeHeaderMapping, type RawIncomeRecord } from './IncomeCsvService';

export class FundingFeeService {
  /**
   * 通过 API 同步资金费（调用 Binance Income History API）
   */
  static async syncByApi(apiKeyId: number, userId: number): Promise<number> {
    const apiKeyData = await ApiKeyService.getApiKeyById(apiKeyId, userId);

    const ccxt = await import('ccxt');
    const exchangeId = 'binance'; // 目前仅支持币安
    const exchange = new (ccxt as any)[exchangeId]({
      apiKey: apiKeyData.apiKey,
      secret: apiKeyData.apiSecret,
      enableRateLimit: true,
      httpsProxy: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:7890' : undefined,
    });

    // 过去 3 个月的数据（Binance 限制）
    const endTime = Date.now();
    const startTime = endTime - 90 * 24 * 60 * 60 * 1000;

    console.log('[FundingFee] 开始 API 同步资金费率...');

    let allIncome: any[] = [];
    try {
      allIncome = await this.fetchIncomeWithPagination(exchange, startTime, endTime);
      console.log(`[FundingFee] API 拉取到 ${allIncome.length} 条收入记录`);
    } catch (err) {
      console.warn(
        '[FundingFee] API 拉取失败:',
        err instanceof Error ? err.message : err
      );
      throw new Error('API 拉取资金费失败: ' + (err instanceof Error ? err.message : String(err)));
    }

    // 只保留 FUNDING_FEE 类型
    const fundingFees = allIncome.filter((item: any) => item.incomeType === 'FUNDING_FEE');
    console.log(`[FundingFee] 过滤后 ${fundingFees.length} 条 FUNDING_FEE 记录`);

    if (fundingFees.length === 0) return 0;

    // 写入数据库
    const imported = await this.saveRecords(fundingFees.map((item: any) => ({
      apiKeyId,
      tranId: item.tranId ? String(item.tranId) : null,
      incomeType: 'FUNDING_FEE',
      asset: item.asset || 'USDT',
      symbol: (item.symbol || '').replace('/', '').replace(':USDT', ''),
      amount: parseFloat(item.income) || 0,
      amountUsd: parseFloat(item.income) || 0, // U 本位合约资金费本身即 USDT
      info: item.info || null,
      timestamp: new Date(item.time),
    })));

    // 归集到 Leg
    await this.associateWithLegs(apiKeyId);

    return imported;
  }

  /**
   * 通过 CSV 导入资金费
   */
  static async syncByCsv(
    apiKeyId: number,
    csvContent: string,
    headerMapping?: IncomeHeaderMapping
  ): Promise<number> {
    const records = IncomeCsvService.parseIncomeHistory(csvContent, apiKeyId, headerMapping);

    if (records.length === 0) {
      throw new Error('CSV 文件解析为空或没有 FUNDING_FEE 类型的记录');
    }

    console.log(`[FundingFee] CSV 解析到 ${records.length} 条 FUNDING_FEE 记录`);

    const imported = await this.saveRecords(records);

    // 归集到 Leg
    await this.associateWithLegs(apiKeyId);

    return imported;
  }

  /**
   * 批量保存资金费记录（幂等防重）
   *
   * 有 tranId 时用 @@unique([apiKeyId, tranId, incomeType]) 去重；
   * 无 tranId 时先按 (apiKeyId, symbol, timestamp) 查重，不存在才插入。
   */
  private static async saveRecords(records: RawIncomeRecord[]): Promise<number> {
    let imported = 0;

    for (const record of records) {
      try {
        if (record.tranId) {
          await prisma.fundingFee.upsert({
            where: {
              apiKeyId_tranId_incomeType: {
                apiKeyId: record.apiKeyId,
                tranId: record.tranId,
                incomeType: record.incomeType,
              },
            },
            create: {
              apiKeyId: record.apiKeyId,
              tranId: record.tranId,
              incomeType: record.incomeType,
              asset: record.asset,
              symbol: record.symbol,
              amount: record.amount,
              amountUsd: record.amountUsd,
              info: record.info,
              timestamp: record.timestamp,
            },
            update: {},
          });
        } else {
          const existing = await prisma.fundingFee.findFirst({
            where: {
              apiKeyId: record.apiKeyId,
              symbol: record.symbol,
              timestamp: record.timestamp,
              tranId: null,
            },
          });
          if (existing) continue;

          await prisma.fundingFee.create({
            data: {
              apiKeyId: record.apiKeyId,
              tranId: null,
              incomeType: record.incomeType,
              asset: record.asset,
              symbol: record.symbol,
              amount: record.amount,
              amountUsd: record.amountUsd,
              info: record.info,
              timestamp: record.timestamp,
            },
          });
        }
        imported++;
      } catch {
        // 唯一约束冲突时静默跳过
      }
    }

    console.log(`[FundingFee] 入库 ${imported} 条新记录`);
    return imported;
  }

  /**
   * 将 FundingFee 按 (symbol + 时间区间) 关联到 Leg，并刷新 Leg.fundingFeeUsd / netPnL
   *
   * 查所有该 apiKeyId 的 fee（含已关联的），重新按时间窗口匹配。
   * 这样即使 Leg 被删除重建（onDelete: SetNull 清空 legId），或 Leg 时间窗口变化，
   * 都能正确重新归集。
   */
  static async associateWithLegs(apiKeyId: number): Promise<{ associated: number; legsUpdated: number }> {
    const apiKeyRow = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { userId: true },
    });
    if (!apiKeyRow) return { associated: 0, legsUpdated: 0 };

    // 查所有 fee（包括已关联的），用于重新匹配
    const allFees = await prisma.fundingFee.findMany({
      where: { apiKeyId },
    });

    if (allFees.length === 0) {
      console.log('[FundingFee] 无资金费记录');
      return { associated: 0, legsUpdated: 0 };
    }

    console.log(`[FundingFee] 重新归集 ${allFees.length} 条资金费...`);

    let associated = 0;
    const updatedLegIds = new Set<number>();

    const bySymbol: Record<string, typeof allFees> = {};
    for (const f of allFees) {
      (bySymbol[f.symbol] ??= []).push(f);
    }

    for (const [symbol, fees] of Object.entries(bySymbol)) {
      const legs = await prisma.leg.findMany({
        where: { userId: apiKeyRow.userId, symbol },
        orderBy: { openDate: 'asc' },
      });

      for (const fee of fees) {
        const leg = legs.find(
          l =>
            l.openDate <= fee.timestamp &&
            (l.closeDate === null || l.closeDate >= fee.timestamp)
        );

        const newLegId = leg?.id ?? null;
        if (fee.legId !== newLegId) {
          await prisma.fundingFee.update({
            where: { id: fee.id },
            data: { legId: newLegId },
          });
          associated++;
          if (newLegId !== null) updatedLegIds.add(newLegId);
        }
      }
    }

    // 重新聚合每个受影响的 Leg 的资金费总额并更新 netPnL
    let legsUpdated = 0;
    const now = new Date();
    for (const legId of updatedLegIds) {
      const leg = await prisma.leg.findUnique({
        where: { id: legId },
        select: { realisedPnLusd: true, commissionUsd: true, closeDate: true },
      });
      if (!leg) continue;

      const legFees = await prisma.fundingFee.findMany({
        where: { legId },
        select: { amountUsd: true },
      });

      const totalFundingUsd = legFees.reduce((s, f) => s + f.amountUsd, 0);

      // 只有 Leg 已平仓 且 资金费在平仓后归集，才加上 fundingFeeUsd
      const shouldIncludeFunding = leg.closeDate && now > leg.closeDate;
      const netPnL = shouldIncludeFunding
        ? leg.realisedPnLusd - leg.commissionUsd + totalFundingUsd
        : leg.realisedPnLusd - leg.commissionUsd;

      await prisma.leg.update({
        where: { id: legId },
        data: {
          fundingFeeUsd: totalFundingUsd,
          netPnL,
          fundingFeeUpdatedAt: now,
        },
      });
      legsUpdated++;
    }

    console.log(`[FundingFee] 归集完成：关联 ${associated} 条，更新 ${legsUpdated} 个 Leg`);
    return { associated, legsUpdated };
  }

  /**
   * 获取资金费列表（分页、筛选）
   */
  static async getFundingFees(params: {
    apiKeyId?: number;
    userId: number;
    symbol?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    pageSize?: number;
  }) {
    const { apiKeyId, userId, symbol, startDate, endDate, page = 1, pageSize = 50 } = params;

    // 构建查询条件
    const where: any = {};

    if (apiKeyId) {
      where.apiKeyId = apiKeyId;
    } else {
      // 如果没有指定 apiKeyId，查询该用户所有的 apiKey
      const userApiKeys = await prisma.apiKey.findMany({
        where: { userId },
        select: { id: true },
      });
      where.apiKeyId = { in: userApiKeys.map(k => k.id) };
    }

    if (symbol) {
      where.symbol = { contains: symbol, mode: 'insensitive' };
    }

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = startDate;
      if (endDate) where.timestamp.lte = endDate;
    }

    const total = await prisma.fundingFee.count({ where });

    const fees = await prisma.fundingFee.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        apiKey: { select: { name: true, exchange: true } },
        leg: { select: { id: true, symbol: true, side: true, status: true } },
      },
    });

    return {
      data: fees,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // 私有：7 天时间窗口分页（与 Trade 分页策略一致）
  // ─────────────────────────────────────────────────────────────

  private static async fetchIncomeWithPagination(
    exchange: any,
    startTime: number,
    endTime: number
  ): Promise<any[]> {
    const results: any[] = [];
    let currentTime = startTime;
    const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
    const limit = 1000;

    while (currentTime < endTime) {
      const windowEnd = Math.min(currentTime + WINDOW_MS, endTime);

      const batch: any[] = await exchange.fapiPrivateGetIncome({
        incomeType: 'FUNDING_FEE',
        startTime: currentTime,
        endTime: windowEnd,
        limit,
        timestamp: Date.now(),
      });

      if (batch && batch.length > 0) {
        results.push(...batch);

        if (batch.length === limit) {
          // 满页：继续拉同一窗口内的后续数据
          const lastTime = batch[batch.length - 1].time;
          currentTime = lastTime + 1;
          continue;
        }
      }

      // 未满页或空页：推进到下一个窗口
      currentTime = windowEnd + 1;

      if (exchange.rateLimit) {
        await new Promise(r => setTimeout(r, exchange.rateLimit));
      }
    }

    return results;
  }

  // ─────────────────────────────────────────────────────────────
  // 旧版同步方法（通过 CCXT fetchFundingHistory）
  // ─────────────────────────────────────────────────────────────

  /**
   * 同步资金费并完成归集，返回入库条数（旧版，通过 CCXT）
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
      const tranId = fee.id ? String(fee.id) : null;

      try {
        if (tranId) {
          // 有 tranId 时，使用唯一约束 upsert
          await prisma.fundingFee.upsert({
            where: {
              apiKeyId_tranId_incomeType: {
                apiKeyId,
                tranId,
                incomeType: 'FUNDING_FEE',
              },
            },
            create: {
              apiKeyId,
              tranId,
              incomeType: 'FUNDING_FEE',
              asset: fee.currency || 'USDT',
              symbol: dbSymbol,
              amount: fee.amount ?? 0,
              amountUsd: fee.amount ?? 0,
              timestamp: new Date(fee.timestamp),
            },
            update: {},
          });
        } else {
          // 没有 tranId 时，直接创建（可能重复，靠 try-catch 跳过）
          await prisma.fundingFee.create({
            data: {
              apiKeyId,
              tranId,
              incomeType: 'FUNDING_FEE',
              asset: fee.currency || 'USDT',
              symbol: dbSymbol,
              amount: fee.amount ?? 0,
              amountUsd: fee.amount ?? 0,
              timestamp: new Date(fee.timestamp),
            },
          });
        }
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
          startTime = batch[batch.length - 1].timestamp + 1;
          continue;
        }
      }

      startTime = windowEnd + 1;

      if (exchange.rateLimit) {
        await new Promise(r => setTimeout(r, exchange.rateLimit));
      }
    }

    return results;
  }
}
