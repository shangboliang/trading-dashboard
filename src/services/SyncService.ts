/**
 * 数据同步服务
 * 从交易所同步历史成交数据并聚合成 Legs
 */

import prisma from '@/lib/prisma';
import { ApiKeyService } from './ApiKeyService';
import { FundingFeeService } from './FundingFeeService';
import { MaeMfeService } from './MaeMfeService';
import { aggregateTradesToLegs, RawTrade } from '@/lib/trade-aggregator';
import type { Exchange } from '@prisma/client';
import { BinanceCsvService, type HeaderMapping } from './BinanceCsvService';
import { buildTradeFingerprint, sanitizeTradeIdentifier } from '@/lib/trade-identity';

/**
 * 同步时间范围超限错误
 * 当增量同步的时间跨度超过最大限制时抛出，前端捕获后弹出确认框
 */
export class SyncTimeRangeError extends Error {
  constructor(
    public daysSinceLastTrade: number,
    public maxSyncDays: number
  ) {
    super(`SyncTimeRangeError: 距上次同步已有 ${Math.floor(daysSinceLastTrade)} 天，超过 ${maxSyncDays} 天限制`);
    this.name = 'SyncTimeRangeError';
  }
}

// 不同交易所的 CCXT ID 映射
const EXCHANGE_MAP: Record<Exchange, string> = {
  BINANCE: 'binance',
  OKX: 'okx',
  BYBIT: 'bybit',
  HUOBI: 'huobi',
  GATEIO: 'gateio',
  KUCOIN: 'kucoin',
};

export interface SyncResult {
  tradesFound: number;
  tradesImported: number;
  legsCreated: number;
  legsUpdated: number;
}

export class SyncService {
  private static makeOrderFingerprint(input: {
    apiKeyId: number;
    symbol: string;
    timestamp: Date;
    side: string;
    price: number;
    amount: number;
    tradeId?: string | null;
    orderId?: string | null;
  }) {
    return buildTradeFingerprint({
      ...input,
      scopeKey: String(input.apiKeyId),
    });
  }

  /**
   * 同步指定 API Key 的历史成交数据
   * @param apiKeyId API Key ID
   * @param forceSync 强制同步（当时间超过90天时，前端确认后传入）
   */
  static async syncApiKey(apiKeyId: number, forceSync?: boolean): Promise<SyncResult> {
    // 1. 读取归属用户
    const apiKeyDb = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { userId: true }
    });

    if (!apiKeyDb) throw new Error('API Key 不存在');

    // 2. 原子抢锁：仅非 SYNCING 状态可切换为 SYNCING
    const lockResult = await prisma.apiKey.updateMany({
      where: {
        id: apiKeyId,
        userId: apiKeyDb.userId,
        syncStatus: { not: 'SYNCING' },
      },
      data: {
        syncStatus: 'SYNCING',
        errorMessage: null,
      },
    });

    if (lockResult.count === 0) {
      console.warn(`API Key ${apiKeyId} 正在同步中，拦截重复请求`);
      throw new Error('数据正在同步中，请勿重复触发');
    }

    try {
      // 获取 API Key (包含解密的凭证)
      const userId = apiKeyDb.userId;
      const apiKeyData = await ApiKeyService.getApiKeyById(apiKeyId, userId);

      // 使用 CCXT 连接交易所
      const ccxt = await import('ccxt');
      const exchangeId = EXCHANGE_MAP[apiKeyData.exchange];
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

      // 加载市场数据
      const markets = await exchange.loadMarkets();

      // 主动同步服务器时间，避免 -1021 Timestamp 错误
      // loadMarkets() 不一定触发 adjustForTimeDifference，手动 fetchTime 确保同步
      try {
        const serverTime = await exchange.fetchTime();
        const localTime = Date.now();
        exchange.options['timeDifference'] = localTime - serverTime;
        console.log(`[Sync] 服务器时间同步: 本地时差 ${exchange.options['timeDifference']}ms`);
      } catch (e) {
        console.warn('[Sync] fetchTime 失败，使用默认时间差:', e instanceof Error ? e.message : e);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 时间范围确定
      // ═══════════════════════════════════════════════════════════════════════
      const MAX_SYNC_DAYS = 90;  // 最大同步天数
      const BUFFER_MS = 5 * 60 * 1000; // 5 分钟缓冲

      const lastTrade = await prisma.trade.findFirst({
        where: { apiKeyId },
        orderBy: { timestamp: 'desc' },
      });

      let since: number;

      if (lastTrade) {
        // 增量同步：检查时间跨度
        const daysSinceLastTrade = (Date.now() - lastTrade.timestamp.getTime()) / (24 * 60 * 60 * 1000);

        if (daysSinceLastTrade > MAX_SYNC_DAYS && !forceSync) {
          // 超过90天且未强制同步，抛出自定义错误
          throw new SyncTimeRangeError(daysSinceLastTrade, MAX_SYNC_DAYS);
        }

        since = lastTrade.timestamp.getTime() - BUFFER_MS;
        console.log(`增量同步: 数据库最新交易时间 ${lastTrade.timestamp.toISOString()}，回溯 5 分钟后 since = ${new Date(since).toISOString()}`);
      } else {
        // 首次同步：默认最近 90 天
        since = Date.now() - MAX_SYNC_DAYS * 24 * 60 * 60 * 1000;
        console.log(`首次同步: 无历史记录，since = ${new Date(since).toISOString()} (最近 ${MAX_SYNC_DAYS} 天)`);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 精准定向同步：先通过 COMMISSION 发现活跃币种，再针对性拉取交易
      // ═══════════════════════════════════════════════════════════════════════
      const rawTrades: any[] = [];
      const errors: { symbol?: string; error: string }[] = [];
      const endTime = Date.now();

      // 1. 时间切片（最大 90 天一块）
      const timeChunks = this.createTimeChunks(since, endTime);
      console.log(`[Sync] 时间范围: ${new Date(since).toISOString()} → ${new Date(endTime).toISOString()}`);
      console.log(`[Sync] 切分为 ${timeChunks.length} 个时间块（每块最大 90 天）`);

      // 2. 对每个时间块循环处理
      for (let i = 0; i < timeChunks.length; i++) {
        const [chunkStart, chunkEnd] = timeChunks[i];
        console.log(`\n[Sync] 处理第 ${i + 1}/${timeChunks.length} 块: ${new Date(chunkStart).toISOString()} → ${new Date(chunkEnd).toISOString()}`);

        // 2.1 通过 COMMISSION 记录发现活跃币种
        const { ccxtSymbols, skippedSymbols } =
          await this.fetchActiveSymbolsViaCommission(exchange, chunkStart, chunkEnd, markets);

        if (skippedSymbols.length > 0) {
          console.log(`[Sync] 跳过 ${skippedSymbols.length} 个已下架币种: ${skippedSymbols.slice(0, 5).join(', ')}${skippedSymbols.length > 5 ? '...' : ''}`);
        }

        if (ccxtSymbols.length === 0) {
          console.log(`[Sync] 该时间块无活跃交易，跳过`);
          continue;
        }

        // 2.2 仅遍历活跃币种拉取交易记录
        let chunkProcessed = 0;
        let chunkSkipped = 0;
        let chunkFailed = 0;

        for (const symbol of ccxtSymbols) {
          try {
            const trades = await this.fetchMyTradesWithPagination(
              exchange, symbol, chunkStart, chunkEnd
            );
            if (trades.length > 0) {
              rawTrades.push(...trades);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (
              errorMsg.includes('not supported') ||
              errorMsg.includes('invalid symbol') ||
              errorMsg.includes('does not have market symbol')
            ) {
              chunkSkipped++;
            } else {
              chunkFailed++;
              errors.push({ symbol, error: errorMsg });
              console.error(`  [ERROR] ${symbol}: ${errorMsg}`);
            }
          }
          chunkProcessed++;
        }

        console.log(`[Sync] 块完成: 处理 ${chunkProcessed}，跳过 ${chunkSkipped}，失败 ${chunkFailed}，累计交易 ${rawTrades.length} 条`);
      }

      console.log(`\n[Sync] 汇总: 共拉取 ${rawTrades.length} 条原始交易，${errors.length} 个错误`);

      // 统一解析交易记录
      const allTrades: RawTrade[] = rawTrades.map((trade: any) => {
        const symbolParts = trade.symbol.split('/');
        const baseAsset = symbolParts[0] || '';
        const quoteAsset = symbolParts[1] || 'USDT';
        // Binance 双向持仓模式下 info.positionSide 为 'LONG' / 'SHORT' / 'BOTH'
        const positionSide: string = trade.info?.positionSide ?? 'BOTH';

        // 手续费处理：区分 BNB 抵扣和普通 USDT 手续费
        // CCXT 统一格式：trade.fee = { cost: number, currency: string }
        const feeCost: number     = trade.fee?.cost     ?? 0;
        const feeCurrency: string = trade.fee?.currency ?? quoteAsset.split(':')[0];

        // feeUsd：BNB 抵扣时需换算为 USD 等值
        // Binance 在 trade.info.realizedPnl 旁边没有直接给 bnbPrice，
        // 但 CCXT 解析后的 trade.fee.cost 已是 BNB 数量。
        // 用 info.commission 和 info.commissionAsset 是原始字段，更可靠。
        const rawFee: number         = parseFloat(trade.info?.commission ?? feeCost) || 0;
        const rawFeeAsset: string    = trade.info?.commissionAsset ?? feeCurrency;

        // 如果手续费币种就是 USDT/BUSD/USD，直接使用；
        // 否则（BNB 等）尝试用 trade.info.quoteQty 折算：
        //   BNB 实际扣费 ≈ rawFee × BNB/USDT 价格
        //   Binance 不在单笔 trade 里返回 BNB 价格，但 CCXT Pro 或私有接口也没有。
        //   现阶段最精确的近似：用当笔交易的名义价值 × 手续费率 0.075%（BNB 折扣后）
        //   注意：这是估算，真实 BNB 价格可能有偏差，后续可通过拉取历史价格改进。
        const STABLE_ASSETS = new Set(['USDT', 'BUSD', 'USDC', 'USD', 'DAI']);
        let feeUsd: number;
        if (STABLE_ASSETS.has(rawFeeAsset)) {
          feeUsd = rawFee;
        } else {
          // 用 Binance 返回的 quoteQty（名义价值，USDT）× BNB 手续费率来估算
          // info.quoteQty 是 USDT 成交额，info.commission 是 BNB 数量
          // BNB_fee_USDT ≈ commission_BNB × (quoteQty / qty) 是不对的
          // 正确近似：BNB_fee_USDT ≈ quoteQty * 0.00075（0.075% 含 BNB 折扣）
          const notionalUsdt = parseFloat(trade.info?.quoteQty ?? 0) || (trade.price * trade.amount);
          feeUsd = notionalUsdt * 0.00075;
        }

        const symbol = `${baseAsset}${quoteAsset.split(':')[0]}`;
        const side = String(trade.side || '').toUpperCase();
        const timestamp = new Date(trade.timestamp);
        const tradeId = sanitizeTradeIdentifier(
          trade.id ?? trade.info?.id ?? trade.info?.tradeId ?? trade.info?.trade_id
        );
        const orderId = sanitizeTradeIdentifier(
          trade.order ?? trade.info?.orderId ?? trade.info?.order_id
        );

        return {
          id: this.makeOrderFingerprint({
            apiKeyId,
            symbol,
            timestamp,
            side,
            price: trade.price,
            amount: trade.amount,
            tradeId,
            orderId,
          }),
          tradeId,
          orderId,
          symbol,
          baseAsset,
          quoteAsset: quoteAsset.split(':')[0],
          side,
          positionSide,
          price: trade.price,
          amount: trade.amount,
          fee: rawFee,
          feeAsset: rawFeeAsset,
          feeUsd,
          timestamp,
        };
      });

      // 去重（基于 id）
      const uniqueTrades = Array.from(
        new Map(allTrades.map(t => [t.id, t])).values()
      );

      console.log(`去重后的交易数量：${uniqueTrades.length}`);

      // 批量保存到数据库
      const importedCount = await this.saveTradesBatch(uniqueTrades, apiKeyId);

      // ── 按受影响币种重聚合 ─────────────────────────────────────────────
      const affectedSymbols = [...new Set(uniqueTrades.map(t => t.symbol))];
      const result = await this.recalculateLegs(apiKeyId, userId, affectedSymbols);

      // 更新同步状态
      await ApiKeyService.updateSyncStatus(apiKeyId, 'COMPLETED', undefined, userId);

      // 记录同步日志
      await this.logSync(apiKeyId, {
        status: 'COMPLETED',
        tradesFound: uniqueTrades.length,
        tradesImported: importedCount,
        legsCreated: result.created,
        legsUpdated: result.updated,
      });

      // ── 异步后处理（fire-and-forget，不阻塞主流程响应） ──────────────
      // 为避免并发请求同一 CCXT 实例触发交易所严格的并发/IP限流（如 Binance 418 Ban），
      // 将资金费同步和 MAE/MFE 计算在后台串行执行。
      // (async () => {
      //   try {
      //     // 1. 先同步资金费
      //     await FundingFeeService.sync(exchange, apiKeyId, since);
      //   } catch (err) {
      //     console.error('[FundingFee] 后台同步失败:', err instanceof Error ? err.message : err);
      //   }

      //   try {
      //     // 2. 资金费同步完成后，再进行 MAE/MFE 计算
      //     if (result.newLegIds.length > 0) {
      //       await MaeMfeService.calculate(exchange, result.newLegIds);
      //     }
      //   } catch (err) {
      //     console.error('[MAE/MFE] 后台计算失败:', err instanceof Error ? err.message : err);
      //   }
      // })();
      // ────────────────────────────────────────────────────────────────

      return {
        tradesFound: uniqueTrades.length,
        tradesImported: importedCount,
        legsCreated: result.created,
        legsUpdated: result.updated,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '同步失败';

      console.error('同步错误:', errorMessage);

      // 更新状态为失败
      await ApiKeyService.updateSyncStatus(apiKeyId, 'FAILED', errorMessage, apiKeyDb.userId);

      // 记录错误日志
      await this.logSync(apiKeyId, {
        status: 'FAILED',
        errorMessage,
        errorStack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  }

  /**
   * 通过上传的 CSV 数据同步
   */
  static async syncByCsv(apiKeyId: number, csvContent: string, headerMapping?: HeaderMapping): Promise<SyncResult> {
    const userId = await this.getUserIdByApiKey(apiKeyId);
    const trades = BinanceCsvService.parseTradeHistory(csvContent, apiKeyId, headerMapping);
    
    if (trades.length === 0) {
      throw new Error('CSV 文件解析为空或格式不匹配');
    }

    const importedCount = await this.saveTradesBatch(trades, apiKeyId);
    const result = await this.recalculateLegs(apiKeyId, userId);

    return {
      tradesFound: trades.length,
      tradesImported: importedCount,
      legsCreated: result.created,
      legsUpdated: result.updated,
    };
  }

  /**
   * 申请异步 API 导出 (Binance)
   */
  static async requestAsynSync(apiKeyId: number, userId: number): Promise<{ downloadId: string; quotaRemaining: number }> {
    const apiKeyDb = await prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId },
      include: { user: true }
    });

    if (!apiKeyDb) throw new Error('API Key 不存在或无权访问');
    if (apiKeyDb.exchange !== 'BINANCE') throw new Error('异步同步目前仅支持币安');

    // 额度检查 (5次/月)
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    // 如果上次同步时间在本月之前，重置计数器
    let count = apiKeyDb.asynSyncCount || 0;
    if (apiKeyDb.lastAsynSyncAt && apiKeyDb.lastAsynSyncAt < startOfMonth) {
      count = 0;
    }

    if (count >= 5) {
      throw new Error('本月 API 深度同步额度已用完 (5/5)');
    }

    // 初始化 CCXT
    const ccxt = await import('ccxt');
    const exchange = new ccxt.binance({
      apiKey: apiKeyDb.apiKey, // API Key 本身就是明文存储的
      secret: await ApiKeyService.decrypt(apiKeyDb.apiSecret), // 仅 Secret 是加密的
      enableRateLimit: true,
      httpsProxy: process.env.HTTPS_PROXY || undefined,
    });

    // 申请下载 ID
    // 过去一年的数据
    const endTime = Date.now();
    const startTime = endTime - 365 * 24 * 60 * 60 * 1000;

    const response = await (exchange as any).fapiPrivateGetTradeAsyn({
      startTime,
      endTime,
      timestamp: Date.now(),
    });

    const downloadId = response.downloadId;
    
    // 检查币安是否返回了额度（虽然文档未明确，但有些版本的接口会返回）
    const apiRemaining = response.remainingQuota;

    // 1. 更新 ApiKey 表（仅更新额度和时间，不再锁定状态）
    await prisma.apiKey.update({
      where: { id: apiKeyId, userId },
      data: {
        asynSyncCount: apiRemaining !== undefined ? (5 - apiRemaining) : { increment: 1 },
        lastAsynSyncAt: now,
        // 这里删除了 syncStatus: 'SYNCING'
      }
    });

    // 2. 创建异步任务历史记录
    await prisma.asyncSyncTask.create({
      data: {
        apiKeyId,
        downloadId,
        status: 'processing',
      }
    });

    const quotaRemaining = apiRemaining !== undefined ? apiRemaining : (5 - (count + 1));

    return { 
      downloadId, 
      quotaRemaining
    };
  }

  /**
   * 轮询检查异步 API 状态
   */
  static async checkAsynSyncStatus(apiKeyId: number, downloadId: string, userId: number): Promise<{ status: string; url?: string }> {
    const apiKeyDb = await prisma.apiKey.findFirst({
      where: { id: apiKeyId, userId }
    });

    if (!apiKeyDb) throw new Error('API Key 不存在或无权访问');

    const ccxt = await import('ccxt');
    const exchange = new ccxt.binance({
      apiKey: apiKeyDb.apiKey,
      secret: await ApiKeyService.decrypt(apiKeyDb.apiSecret),
      enableRateLimit: true,
      httpsProxy: process.env.HTTPS_PROXY || undefined,
    });

    const response = await (exchange as any).fapiPrivateGetTradeAsynId({
      downloadId,
      timestamp: Date.now(),
    });

    // 持久化更新任务状态
    await prisma.asyncSyncTask.update({
      where: { downloadId },
      data: {
        status: response.status,
        downloadUrl: response.url || undefined,
      }
    });

    return {
      status: response.status, // "completed" or "processing"
      url: response.url
    };
  }

  /**
   * 辅助方法：按受影响币种重新聚合 Legs（内存全量计算 + 数据库精准覆盖）
   */
  private static async recalculateLegs(apiKeyId: number, userId: number, affectedSymbols?: string[]) {
    const where: any = { apiKeyId };
    if (affectedSymbols?.length) {
      where.symbol = { in: affectedSymbols };
    }

    const allDbTrades = await prisma.trade.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      select: {
        id: true,
        symbol: true,
        baseAsset: true,
        quoteAsset: true,
        side: true,
        positionSide: true,
        price: true,
        amount: true,
        fee: true,
        feeAsset: true,
        feeUsd: true,
        timestamp: true,
      },
    });

    const tradesForAggregation: RawTrade[] = allDbTrades.map(t => ({
      id:           t.id,
      symbol:       t.symbol,
      baseAsset:    t.baseAsset,
      quoteAsset:   t.quoteAsset,
      side:         t.side.toLowerCase(),
      positionSide: t.positionSide,
      price:        t.price,
      amount:       t.amount,
      fee:          t.fee,
      feeAsset:     t.feeAsset,
      feeUsd:       t.feeUsd,
      timestamp:    t.timestamp,
    }));

    const legs = aggregateTradesToLegs(tradesForAggregation);
    return await this.saveLegsBatch(legs, userId, affectedSymbols);
  }
  
  /**
   * 批量保存 Trades 到数据库 (优化版：分批写入避免参数限制)
   */
  private static async saveTradesBatch(
    trades: RawTrade[],
    apiKeyId: number
  ): Promise<number> {
    if (trades.length === 0) return 0;

    const CHUNK_SIZE = 1000;
    let totalImported = 0;

    for (let i = 0; i < trades.length; i += CHUNK_SIZE) {
      const chunk = trades.slice(i, i + CHUNK_SIZE);
      const result = await prisma.trade.createMany({
        data: chunk.map(trade => ({
          id: trade.id,
          tradeId: trade.tradeId ?? null,
          orderId: trade.orderId ?? null,
          apiKeyId,
          symbol: trade.symbol,
          baseAsset: trade.baseAsset || '',
          quoteAsset: trade.quoteAsset || 'USDT',
          side: trade.side.toUpperCase() as any,
          positionSide: trade.positionSide ?? 'BOTH',
          price: trade.price,
          amount: trade.amount,
          quoteAmount: trade.price * trade.amount,
          fee: trade.fee,
          feeAsset: trade.feeAsset,
          feeUsd: trade.feeUsd,
          timestamp: trade.timestamp,
        })),
        skipDuplicates: true,
      });
      totalImported += result.count;
    }

    console.log(`保存完成：共处理 ${trades.length} 条记录，其中 ${totalImported} 条为新数据`);
    return totalImported;
  }
  
  /**
   * 批量保存/更新 Legs (内存映射 + 按受影响币种精准覆盖)
   */
  private static async saveLegsBatch(
    legs: any[],
    userId: number,
    affectedSymbols?: string[]
  ): Promise<{ created: number; updated: number; newLegIds: number[] }> {
    if (legs.length === 0) return { created: 0, updated: 0, newLegIds: [] };

    let createdCount = 0;
    let updatedCount = 0;
    const newLegIds: number[] = [];

    // 1. 获取受影响币种的现有 Leg（而非全量），存入内存 Map
    const existingLegs = await prisma.leg.findMany({
      where: { 
        userId,
        ...(affectedSymbols?.length ? { symbol: { in: affectedSymbols } } : {})
      },
      select: { 
        id: true, 
        symbol: true, 
        openDate: true, 
        side: true, 
        status: true,
        fundingFeeUsd: true,
      }
    });

    // 创建唯一索引映射: symbol:openDate:side
    const legMap = new Map<string, typeof existingLegs[0]>();
    existingLegs.forEach(l => {
      const key = `${l.symbol}:${l.openDate.getTime()}:${l.side}`;
      legMap.set(key, l);
    });

    // 2. 分批处理事务，避免事务过大锁定表太久
    const CHUNK_SIZE = 500;
    for (let i = 0; i < legs.length; i += CHUNK_SIZE) {
      const chunk = legs.slice(i, i + CHUNK_SIZE);
      
      await prisma.$transaction(async (tx) => {
        for (const leg of chunk) {
          const legKey = `${leg.symbol}:${leg.openDate.getTime()}:${leg.side.toUpperCase()}`;
          const existingLeg = legMap.get(legKey);

          const legData = {
            closeDate: leg.closeDate,
            closePrice: leg.averageExit,
            status: leg.status.toUpperCase() as any,
            currentAmount: leg.status === 'closed' ? 0 : Math.abs(leg.currentSize || 0),
            closeAmount: leg.status === 'closed' ? (leg.openSize || Math.abs(leg.currentSize || 0)) : undefined,
            averageExit: leg.averageExit,
            realisedPnL: leg.realisedPnL || 0,
            realisedPnLusd: leg.realisedPnLusd || 0,
            netPnL: existingLeg
              ? (leg.realisedPnLusd || 0) - (leg.commission || 0) + ((existingLeg as any).fundingFeeUsd || 0)
              : (leg.realisedPnLusd || 0) - (leg.commission || 0),
            commission: leg.commission || 0,
            commissionUsd: leg.commission || 0,
            duration: leg.duration,
          };

          let currentLegId: number;

          if (existingLeg) {
            await tx.leg.update({
              where: { id: existingLeg.id },
              data: legData,
            });
            currentLegId = existingLeg.id;
            updatedCount++;
            // 状态变更记录（用于后续 MAE/MFE 计算触发）
            if (existingLeg.status === 'OPEN' && legData.status === 'CLOSED') {
              newLegIds.push(existingLeg.id);
            }
          } else {
            const created = await tx.leg.create({
              data: {
                userId,
                symbol: leg.symbol,
                baseAsset: leg.baseAsset || leg.symbol.match(/^([A-Z]+)(USDT|BTC|ETH|USD|BUSD)$/)?.[1] || leg.symbol,
                quoteAsset: leg.quoteAsset || leg.symbol.match(/^([A-Z]+)(USDT|BTC|ETH|USD|BUSD)$/)?.[2] || 'USDT',
                side: leg.side.toUpperCase() as any,
                openDate: leg.openDate,
                openPrice: leg.averageEntry || 0,
                openAmount: leg.openSize || Math.abs(leg.currentSize || 0),
                averageEntry: leg.averageEntry || 0,
                sizeUsd: leg.sizeUsd || 0,
                peakSizeUsd: leg.maxSizeUsd || leg.sizeUsd || 0,
                ...legData,
              },
              select: { id: true },
            });
            currentLegId = created.id;
            newLegIds.push(created.id);
            createdCount++;
          }

          // 关键修复：将底层 Trade 关联到这个 Leg 上
          if (leg.trades && leg.trades.length > 0) {
            const tradeIds = leg.trades.map((t: any) => t.id);
            await tx.trade.updateMany({
              where: { id: { in: tradeIds } },
              data: { legId: currentLegId }
            });
          }
        }
      });
    }

    console.log(`持仓处理完成：创建 ${createdCount} 个，更新 ${updatedCount} 个`);
    return { created: createdCount, updated: updatedCount, newLegIds };
  }
  
  /**
   * 记录同步日志
   */
  private static async logSync(
    apiKeyId: number,
    data: {
      status: any;
      tradesFound?: number;
      tradesImported?: number;
      legsCreated?: number;
      legsUpdated?: number;
      errorMessage?: string;
      errorStack?: string;
    }
  ) {
    await prisma.syncLog.create({
      data: {
        apiKeyId,
        status: data.status,
        endTime: new Date(),
        tradesFound: data.tradesFound || 0,
        tradesImported: data.tradesImported || 0,
        legsCreated: data.legsCreated || 0,
        legsUpdated: data.legsUpdated || 0,
        errorMessage: data.errorMessage,
        errorStack: data.errorStack,
      },
    });
  }
  
  /**
   * 根据 API Key ID 获取用户 ID
   */
  private static async getUserIdByApiKey(apiKeyId: number): Promise<number> {
    const apiKey = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { userId: true },
    });
    
    if (!apiKey) {
      throw new Error('API Key not found');
    }
    
    return apiKey.userId;
  }

  /**
   * 分页获取用户交易记录
   * @param endTime 新增参数，支持限定结束时间
   */
  private static async fetchMyTradesWithPagination(
    exchange: any,
    symbol: string | undefined,
    since: number,
    endTime?: number
  ): Promise<any[]> {
    let allTrades: any[] = [];
    let startTime = since;
    const limit = 1000;
    const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // Binance 单次查询最大 7 天
    const now = endTime || Date.now();
    let page = 0;

    while (startTime < now) {
      page++;
      const windowEnd = Math.min(startTime + WINDOW_MS, now);

      const trades: any[] = await this.callWithRetry(() =>
        exchange.fetchMyTrades(symbol, startTime, limit, {
          endTime: windowEnd,
        }),
        3,
        exchange
      );

      if (!trades || trades.length === 0) {
        startTime = windowEnd + 1;
        if (exchange.rateLimit) {
          await new Promise(resolve => setTimeout(resolve, exchange.rateLimit));
        }
        continue;
      }

      allTrades.push(...trades);

      if (trades.length === limit) {
        const lastTimestamp = trades[trades.length - 1].timestamp;
        const firstTimestamp = trades[0].timestamp;
        if (lastTimestamp === firstTimestamp) {
          startTime = lastTimestamp + 1;
        } else {
          startTime = lastTimestamp;
        }
      } else {
        startTime = windowEnd + 1;
      }

      if (exchange.rateLimit) {
        await new Promise(resolve => setTimeout(resolve, exchange.rateLimit));
      }
    }

    return allTrades;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 精准定向同步 - 辅助函数
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 将大时间范围切分为多个小块（每块最大 90 天）
   * 用途：避免单次查询跨度太大，符合 Binance 历史数据限制
   * 
   * @param startTime 起始时间戳（ms）
   * @param endTime 结束时间戳（ms）
   * @param chunkMs 每块大小（ms），默认 90 天
   * @returns Array<[start, end]>
   */
  private static createTimeChunks(
    startTime: number,
    endTime: number,
    chunkMs: number = 90 * 24 * 60 * 60 * 1000
  ): [number, number][] {
    const chunks: [number, number][] = [];
    let current = startTime;

    while (current < endTime) {
      const chunkEnd = Math.min(current + chunkMs - 1, endTime);
      chunks.push([current, chunkEnd]);
      current = chunkEnd + 1;
    }

    return chunks;
  }

  /**
   * 带自动分页的 Income History 拉取
   * 核心逻辑：满页（1000 条）则继续拉取，直到取完该时间范围内所有数据
   * 使用 CCXT 隐式方法: exchange.fapiPrivateGetIncome(params)
   * 
   * @param exchange CCXT 交易所实例
   * @param incomeType 收入类型（如 'COMMISSION', 'FUNDING_FEE'）
   * @param startTime 起始时间戳（ms）
   * @param endTime 结束时间戳（ms）
   * @returns 所有匹配的收入记录
   */
  private static async fetchIncomeWithPagination(
    exchange: any,
    incomeType: string,
    startTime: number,
    endTime: number
  ): Promise<any[]> {
    const results: any[] = [];
    let currentTime = startTime;
    const limit = 1000;

    while (currentTime <= endTime) {
      const batch: any[] = await this.callWithRetry(() =>
        exchange.fapiPrivateGetIncome({
          incomeType,
          startTime: currentTime,
          endTime,
          limit,
        }),
        3,
        exchange
      );

      if (!batch || batch.length === 0) {
        break;
      }

      results.push(...batch);

      // 满页：还有更多数据，用最后一条的时间作为下一页起点
      if (batch.length === limit) {
        const lastTime = typeof batch[batch.length - 1].time === 'string'
          ? parseInt(batch[batch.length - 1].time)
          : batch[batch.length - 1].time;
        currentTime = lastTime + 1;
        if (exchange.rateLimit) {
          await new Promise(r => setTimeout(r, exchange.rateLimit));
        }
        continue;
      }

      // 未满页：已取完
      break;
    }

    return results;
  }

  /**
   * 通用重试封装：遇到时间戳错误时重新同步服务器时间后重试
   * @param fn 要执行的异步函数
   * @param maxRetries 最大重试次数
   */
  private static async callWithRetry<T>(fn: () => Promise<T>, maxRetries = 3, exchange?: any): Promise<T> {
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (err: any) {
        const msg = err?.message || '';
        const isTimestampError = msg.includes('-1021') || msg.includes('Timestamp') || msg.includes('ahead of the server');
        if (isTimestampError && i < maxRetries) {
          console.warn(`[Retry] 时间戳错误，${i + 1}/${maxRetries} 次重试...`);
          // 重新同步服务器时间
          if (exchange) {
            try {
              const serverTime = await exchange.fetchTime();
              exchange.options['timeDifference'] = Date.now() - serverTime;
              console.log(`[Retry] 重新同步时差: ${exchange.options['timeDifference']}ms`);
            } catch { /* ignore */ }
          }
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
        throw err;
      }
    }
    throw new Error('Max retries exceeded');
  }

  /**
   * 通过 COMMISSION 类型的 Income 记录发现活跃币种
   * 优势：只要有成交就必定有手续费，能完美覆盖日内平仓或隔日平仓场景
   * 
   * @param exchange CCXT 交易所实例
   * @param startTime 起始时间戳（ms）
   * @param endTime 结束时间戳（ms）
   * @param markets 交易所市场数据（exchange.markets）
   * @returns { ccxtSymbols: 可处理的 CCXT 格式 symbol, skippedSymbols: 已下架跳过的 symbol }
   */
  private static async fetchActiveSymbolsViaCommission(
    exchange: any,
    startTime: number,
    endTime: number,
    markets: any
  ): Promise<{
    ccxtSymbols: string[];
    skippedSymbols: string[];
  }> {
    // 1. 拉取所有 COMMISSION 记录
    const incomeRecords = await this.fetchIncomeWithPagination(
      exchange, 'COMMISSION', startTime, endTime
    );

    // 2. 提取并去重 symbol（过滤空 symbol）
    const dbSymbols = new Set<string>();
    for (const record of incomeRecords) {
      if (record.symbol && record.symbol.trim()) {
        // 原始格式可能是 "BTCUSDT" 或 "BTC/USDT"，统一为 "BTCUSDT"
        const normalized = record.symbol.replace('/', '').replace(':USDT', '');
        dbSymbols.add(normalized);
      }
    }

    // 3. 转换为 CCXT 格式，并区分已下架币种
    const ccxtSymbols: string[] = [];
    const skippedSymbols: string[] = [];
    const uMarkets = Object.values(markets).filter(
      (m: any) => m && m.linear && m.quote === 'USDT'
    );

    for (const dbSymbol of dbSymbols) {
      const match = uMarkets.find(
        (m: any) => (m.base + m.quote) === dbSymbol
      ) as any;

      if (match) {
        ccxtSymbols.push(match.symbol); // 如 'BTC/USDT:USDT'
      } else {
        skippedSymbols.push(dbSymbol); // 如 'NTRNUSDT'（已下架）
      }
    }

    console.log(`[Discovery] 发现 ${ccxtSymbols.length} 个活跃币种，${skippedSymbols.length} 个已下架跳过`);
    if (ccxtSymbols.length > 0) {
      console.log(`[Discovery] 活跃币种: ${ccxtSymbols.slice(0, 10).join(', ')}${ccxtSymbols.length > 10 ? '...' : ''}`);
    }

    return { ccxtSymbols, skippedSymbols };
  }
}
