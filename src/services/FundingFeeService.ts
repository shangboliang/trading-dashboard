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
import { Prisma } from '@prisma/client';

export class FundingFeeService {
  private static readonly WRITE_CONFLICT_RETRY = 3;
  private static readonly API_RETRY_LIMIT = 3;

  private static isKnownRequestError(error: unknown, code: string): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
  }

  private static toFundingFeeCreateData(record: RawIncomeRecord) {
    return {
      apiKeyId: record.apiKeyId,
      tranId: record.tranId,
      incomeType: record.incomeType,
      asset: record.asset,
      symbol: record.symbol,
      amount: record.amount,
      amountUsd: record.amountUsd,
      info: record.info,
      timestamp: record.timestamp,
    };
  }

  private static async createRecordWithoutTranId(record: RawIncomeRecord): Promise<boolean> {
    for (let attempt = 0; attempt <= this.WRITE_CONFLICT_RETRY; attempt++) {
      try {
        return await prisma.$transaction(
          async (tx) => {
            const existing = await tx.fundingFee.findFirst({
              where: {
                apiKeyId: record.apiKeyId,
                tranId: null,
                incomeType: record.incomeType,
                symbol: record.symbol,
                timestamp: record.timestamp,
                asset: record.asset,
                amount: record.amount,
                amountUsd: record.amountUsd,
              },
              select: { id: true },
            });

            if (existing) return false;

            await tx.fundingFee.create({
              data: this.toFundingFeeCreateData(record),
            });
            return true;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (error) {
        if (this.isKnownRequestError(error, 'P2002')) return false;
        if (this.isKnownRequestError(error, 'P2034') && attempt < this.WRITE_CONFLICT_RETRY) {
          continue;
        }
        throw error;
      }
    }

    return false;
  }

  private static async syncExchangeTime(exchange: any): Promise<void> {
    try {
      const serverTime = await exchange.fetchTime();
      exchange.options['timeDifference'] = Date.now() - serverTime;
      console.log(`[FundingFee] 服务器时间同步: 本地时差 ${exchange.options['timeDifference']}ms`);
    } catch (error) {
      console.warn(
        '[FundingFee] fetchTime 失败，使用默认时间差:',
        error instanceof Error ? error.message : error
      );
    }
  }

  private static parseApiTimestamp(rawValue: unknown): Date | null {
    if (rawValue instanceof Date) {
      return Number.isNaN(rawValue.getTime()) ? null : rawValue;
    }

    if (typeof rawValue === 'number') {
      const epoch = Math.abs(rawValue) < 1e12 ? rawValue * 1000 : rawValue;
      const parsed = new Date(epoch);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed) return null;

      if (/^\d+$/.test(trimmed)) {
        const numeric = Number(trimmed);
        if (Number.isFinite(numeric)) {
          const epoch = trimmed.length <= 10 ? numeric * 1000 : numeric;
          const parsed = new Date(epoch);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
        }
      }

      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
  }

  private static async callWithRetry<T>(
    fn: () => Promise<T>,
    exchange: any,
    maxRetries = this.API_RETRY_LIMIT
  ): Promise<T> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const message = error?.message || '';
        const isTimestampError =
          message.includes('-1021') ||
          message.includes('Timestamp') ||
          message.includes('ahead of the server');

        if (isTimestampError && attempt < maxRetries) {
          console.warn(`[FundingFee] 时间戳错误，重试 ${attempt + 1}/${maxRetries}...`);
          await this.syncExchangeTime(exchange);
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        throw error;
      }
    }

    throw new Error('Funding fee sync retries exhausted');
  }

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
      password: apiKeyData.passphrase,
      enableRateLimit: true,
      adjustForTimeDifference: true, // 自动调整时间差，避免 timestamp 错误
      // Node.js 不走系统代理，需要显式传入
      httpsProxy: process.env.HTTPS_PROXY || undefined,
    });
    // 强制使用合约/掉期类型
    exchange.options['defaultType'] = 'future';
    // 增大 recvWindow 容忍时间偏差（币安默认 5000ms）
    exchange.options['recvWindow'] = 10000;
      
    // 跳过 fetchCurrencies（需要提现权限，且在国内网络易超时）
    exchange.options['fetchCurrencies'] = false;
    // 过去 3 个月的数据（Binance 限制）
    const endTime = Date.now();
    const startTime = endTime - 90 * 24 * 60 * 60 * 1000;

    console.log('[FundingFee] 开始 API 同步资金费率...');
    await this.syncExchangeTime(exchange);

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

    const records: RawIncomeRecord[] = [];
    let skippedInvalidTimestamp = 0;

    for (const item of fundingFees) {
      const timestamp = this.parseApiTimestamp(item.time);
      if (!timestamp) {
        skippedInvalidTimestamp++;
        console.warn('[FundingFee] 跳过时间无效的 API 记录:', {
          tranId: item.tranId ?? null,
          symbol: item.symbol ?? '',
          rawTime: item.time,
        });
        continue;
      }

      records.push({
        apiKeyId,
        tranId: item.tranId ? String(item.tranId) : null,
        incomeType: 'FUNDING_FEE',
        asset: item.asset || 'USDT',
        symbol: (item.symbol || '').replace('/', '').replace(':USDT', ''),
        amount: parseFloat(item.income) || 0,
        amountUsd: parseFloat(item.income) || 0, // U 本位合约资金费本身即 USDT
        info: item.info || null,
        timestamp,
      });
    }

    if (skippedInvalidTimestamp > 0) {
      console.warn(`[FundingFee] 跳过 ${skippedInvalidTimestamp} 条时间无效的 API 记录`);
    }

    if (records.length === 0) {
      throw new Error('API 返回的资金费记录时间字段均无效');
    }

    // 写入数据库
    const imported = await this.saveRecords(records);

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
   * 无 tranId 时按业务键 + 串行化事务防重，仅真实新增才计数。
   */
  private static async saveRecords(records: RawIncomeRecord[]): Promise<number> {
    let imported = 0;

    for (const record of records) {
      if (record.tranId) {
        try {
          await prisma.fundingFee.create({
            data: this.toFundingFeeCreateData(record),
          });
          imported++;
        } catch (error) {
          if (this.isKnownRequestError(error, 'P2002')) continue;
          throw error;
        }
        continue;
      }

      const created = await this.createRecordWithoutTranId(record);
      if (created) {
        imported++;
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
          const oldLegId = fee.legId;
          await prisma.fundingFee.update({
            where: { id: fee.id },
            data: { legId: newLegId },
          });
          associated++;
          if (oldLegId !== null) updatedLegIds.add(oldLegId);
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
    const where: any = { apiKey: { userId } };
    if (apiKeyId !== undefined) {
      where.apiKeyId = apiKeyId;
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
    const limit = 1000;

    while (currentTime <= endTime) {
      const batch: any[] = await this.callWithRetry(
        () =>
          exchange.fapiPrivateGetIncome({
            incomeType: 'FUNDING_FEE',
            startTime: currentTime,
            endTime,
            limit,
          }),
        exchange
      );

      if (!batch || batch.length === 0) {
        break;
      }

      results.push(...batch);

      if (batch.length === limit) {
        const lastTime = typeof batch[batch.length - 1].time === 'string'
          ? parseInt(batch[batch.length - 1].time, 10)
          : batch[batch.length - 1].time;
        currentTime = lastTime + 1;

        if (exchange.rateLimit) {
          await new Promise((resolve) => setTimeout(resolve, exchange.rateLimit));
        }
        continue;
      }

      if (exchange.rateLimit) {
        await new Promise((resolve) => setTimeout(resolve, exchange.rateLimit));
      }

      break;
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

    const records: RawIncomeRecord[] = allFunding.map((fee) => {
      const parts = String(fee.symbol || '').split('/');
      const base = parts[0] || '';
      const quote = (parts[1] || 'USDT').split(':')[0];
      return {
        apiKeyId,
        tranId: fee.id ? String(fee.id) : null,
        incomeType: 'FUNDING_FEE',
        asset: fee.currency || 'USDT',
        symbol: `${base}${quote}`,
        amount: Number(fee.amount) || 0,
        amountUsd: Number(fee.amount) || 0,
        info: null,
        timestamp: new Date(fee.timestamp),
      };
    });

    const imported = await this.saveRecords(records);

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
