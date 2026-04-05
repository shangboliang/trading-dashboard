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
import { BinanceCsvService } from './BinanceCsvService';

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
  /**
   * 同步指定 API Key 的历史成交数据
   */
  static async syncApiKey(apiKeyId: number): Promise<SyncResult> {

    // 1. 并发拦截验证
    const apiKeyDb = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { syncStatus: true, userId: true }
    });

    if (!apiKeyDb) throw new Error('API Key 不存在');
    if (apiKeyDb.syncStatus === 'SYNCING') {
      console.warn(`API Key ${apiKeyId} 正在同步中，拦截重复请求`);
      throw new Error('数据正在同步中，请勿重复触发'); // 给前端抛出友好提示
    }

    // 2. 状态放行并锁定
    // 更新状态为同步中
    await ApiKeyService.updateSyncStatus(apiKeyId, 'SYNCING');

    try {
      // 获取 API Key (包含解密的凭证)
      const userId = await this.getUserIdByApiKey(apiKeyId);
      const apiKeyData = await ApiKeyService.getApiKeyById(apiKeyId, userId);

      // 使用 CCXT 连接交易所
      const ccxt = await import('ccxt');
      const exchangeId = EXCHANGE_MAP[apiKeyData.exchange];
      const exchange = new (ccxt as any)[exchangeId]({
        apiKey: apiKeyData.apiKey,
        secret: apiKeyData.apiSecret,
        password: apiKeyData.passphrase,
        enableRateLimit: true,
        // Node.js 不走系统代理，需要显式传入
        httpsProxy: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:7890' : undefined,
        // httpsProxy: process.env.HTTPS_PROXY,
      });

      // 强制使用合约/掉期类型
      exchange.options['defaultType'] = 'future';
      
      // 跳过 fetchCurrencies（需要提现权限，且在国内网络易超时）
      exchange.options['fetchCurrencies'] = false;

      // 加载市场数据
      const markets = await exchange.loadMarkets();

      // 获取增量同步起始时间：以数据库中最早一条未被覆盖的交易为基准，
      // 往前回溯 5 分钟作为缓冲，防止上次同步期间产生的新交易被漏拉。
      const lastTrade = await prisma.trade.findFirst({
        where: { apiKeyId },
        orderBy: { timestamp: 'desc' },
      });

      const BUFFER_MS = 5 * 60 * 1000; // 5 分钟缓冲
      const since = lastTrade
        ? lastTrade.timestamp.getTime() - BUFFER_MS
        : Date.now() - 30 * 24 * 60 * 60 * 1000; // 首次同步默认最近 30 天

      if (lastTrade) {
        console.log(`增量同步: 数据库最新交易时间 ${lastTrade.timestamp.toISOString()}，回溯 5 分钟后 since = ${new Date(since).toISOString()}`);
      } else {
        console.log(`首次同步: 无历史记录，since = ${new Date(since).toISOString()} (最近 30 天)`);
      }

      let rawTrades: any[] = [];
      const errors: { symbol?: string; error: string }[] = [];

      try {
        // 策略 1: 尝试全局拉取所有 U 本位合约交易记录
        console.log('尝试全局拉取交易记录...');
        rawTrades = await this.fetchMyTradesWithPagination(exchange, undefined, since);
        console.log(`全局拉取到 ${rawTrades.length} 条交易`);
      } catch (globalError) {
        const globalErrMsg = globalError instanceof Error ? globalError.message : String(globalError);
        console.warn(`全局拉取失败 (${globalErrMsg})，降级为按交易对遍历`);

        // 策略 2: 降级为按交易对遍历（仅限 U 本位合约）
        const activeSymbols = new Set(
          Object.values(markets)
            .filter((m: any) => m && m.linear && m.quote === 'USDT') // 过滤掉 undefined 条目
            .map((m: any) => m.symbol)
        );

        // 补充数据库中历史已交易过但可能已下架的交易对，避免漏拉
        const historicalSymbols = await prisma.trade.findMany({
          where: { apiKeyId },
          select: { symbol: true },
          distinct: ['symbol'],
        });

        // 将数据库符号转换为 CCXT 格式（BTCUSDT → BTC/USDT:USDT）
        const historicalCcxtSymbols = historicalSymbols
          .map(t => {
            // 尝试从 markets 里找到匹配的 ccxt symbol（数据库存的是 BTCUSDT 格式）
            const match = Object.values(markets).find(
              (m: any) => m.linear && m.quote === 'USDT' &&
                (m.base + m.quote) === t.symbol
            ) as any;
            return match?.symbol as string | undefined;
          })
          .filter((s): s is string => !!s && !activeSymbols.has(s));

        const uMarginSymbols = [...activeSymbols, ...historicalCcxtSymbols];

        console.log(`发现 ${activeSymbols.size} 个活跃 U 本位合约交易对，另补充 ${historicalCcxtSymbols.length} 个历史交易对`);

        let skippedCount = 0;
        let failedCount = 0;
        let processedCount = 0;

        for (const symbol of uMarginSymbols) {
          processedCount++;
          try {
            const trades = await this.fetchMyTradesWithPagination(exchange, symbol, since);
            if (trades.length > 0) {
              const oldest = new Date(Math.min(...trades.map(t => t.timestamp))).toISOString().slice(0, 10);
              const newest = new Date(Math.max(...trades.map(t => t.timestamp))).toISOString().slice(0, 10);
              console.log(`${symbol} 找到 ${trades.length} 条交易 [${oldest} ~ ${newest}]`);
              rawTrades.push(...trades);
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            // 记录所有错误类型的统计
            if (
              errorMsg.includes('not supported') ||
              errorMsg.includes('invalid symbol') ||
              errorMsg.includes('does not have market symbol')
            ) {
              skippedCount++;
            } else {
              failedCount++;
              console.error(`[ERROR] ${symbol} 拉取失败:`, errorMsg);
              errors.push({ symbol, error: errorMsg });
            }
          }

          // 每处理 100 个交易对打印一次进度
          if (processedCount % 100 === 0) {
            console.log(`进度: ${processedCount}/${uMarginSymbols.length}，已找到 ${rawTrades.length} 条，跳过 ${skippedCount} 个，失败 ${failedCount} 个`);
          }
        }

        console.log(`遍历完成: 共处理 ${processedCount} 个交易对，跳过 ${skippedCount} 个不支持的，失败 ${failedCount} 个，原始交易 ${rawTrades.length} 条`);
      }

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

        return {
          id: trade.id?.toString() || `${trade.timestamp}-${trade.symbol}`,
          symbol: `${baseAsset}${quoteAsset.split(':')[0]}`, // "BTCUSDT"
          baseAsset,
          quoteAsset: quoteAsset.split(':')[0],
          side: trade.side,
          positionSide,
          price: trade.price,
          amount: trade.amount,
          fee: rawFee,
          feeAsset: rawFeeAsset,
          feeUsd,
          timestamp: new Date(trade.timestamp),
        };
      });

      // 去重（基于 id）
      const uniqueTrades = Array.from(
        new Map(allTrades.map(t => [t.id, t])).values()
      );

      console.log(`去重后的交易数量：${uniqueTrades.length}`);

      // 批量保存到数据库
      const importedCount = await this.saveTradesBatch(uniqueTrades, apiKeyId);

      // ── 全量重聚合 ─────────────────────────────────────────────────────
      const result = await this.recalculateLegs(apiKeyId, userId);

      // 更新同步状态
      await ApiKeyService.updateSyncStatus(apiKeyId, 'COMPLETED');

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
      await ApiKeyService.updateSyncStatus(apiKeyId, 'FAILED', errorMessage);

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
  static async syncByCsv(apiKeyId: number, csvContent: string): Promise<SyncResult> {
    const userId = await this.getUserIdByApiKey(apiKeyId);
    const trades = BinanceCsvService.parseTradeHistory(csvContent);
    
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
  static async requestAsynSync(apiKeyId: number): Promise<{ downloadId: string; quotaRemaining: number }> {
    const apiKeyDb = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      include: { user: true }
    });

    if (!apiKeyDb) throw new Error('API Key 不存在');
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
      httpsProxy: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:7890' : undefined,
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
      where: { id: apiKeyId },
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
  static async checkAsynSyncStatus(apiKeyId: number, downloadId: string): Promise<{ status: string; url?: string }> {
    const apiKeyDb = await prisma.apiKey.findUnique({
      where: { id: apiKeyId }
    });

    if (!apiKeyDb) throw new Error('API Key 不存在');

    const ccxt = await import('ccxt');
    const exchange = new ccxt.binance({
      apiKey: apiKeyDb.apiKey,
      secret: await ApiKeyService.decrypt(apiKeyDb.apiSecret),
      enableRateLimit: true,
      httpsProxy: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:7890' : undefined,
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
   * 辅助方法：重新聚合所有 Legs
   */
  private static async recalculateLegs(apiKeyId: number, userId: number) {
    const allDbTrades = await prisma.trade.findMany({
      where: { apiKeyId },
      orderBy: { timestamp: 'asc' },
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
    return await this.saveLegsBatch(legs, userId);
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
   * 批量保存/更新 Legs (性能优化版：内存映射减少数据库 IO)
   */
  private static async saveLegsBatch(
    legs: any[],
    userId: number
  ): Promise<{ created: number; updated: number; newLegIds: number[] }> {
    if (legs.length === 0) return { created: 0, updated: 0, newLegIds: [] };

    let createdCount = 0;
    let updatedCount = 0;
    const newLegIds: number[] = [];

    // 1. 一次性获取该用户的所有相关交易对的现有 Leg，存入内存 Map
    // 这种做法将 O(N) 次 DB 查询降为 O(1)
    const existingLegs = await prisma.leg.findMany({
      where: { userId },
      select: { 
        id: true, 
        symbol: true, 
        openDate: true, 
        side: true, 
        status: true 
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
            netPnL: (leg.realisedPnLusd || 0) - (leg.commission || 0),
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
   */
  private static async fetchMyTradesWithPagination(
    exchange: any,
    symbol: string | undefined,
    since: number
  ): Promise<any[]> {
    let allTrades: any[] = [];
    let startTime = since;
    const limit = 1000;
    const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // Binance 单次查询最大 7 天
    const now = Date.now();
    let page = 0;

    while (startTime < now) {
      page++;
      const windowEnd = Math.min(startTime + WINDOW_MS, now);

      const trades = await exchange.fetchMyTrades(symbol, startTime, limit, {
        endTime: windowEnd,
      });

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
}
