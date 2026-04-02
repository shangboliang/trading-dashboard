/**
 * 数据同步服务
 * 从交易所同步历史成交数据并聚合成 Legs
 */

import prisma from '@/lib/prisma';
import { ApiKeyService } from './ApiKeyService';
import { aggregateTradesToLegs, RawTrade } from '@/lib/trade-aggregator';
import type { Exchange } from '@prisma/client';
import logger from '@/lib/logger';

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
    logger.info({ apiKeyId }, '开始同步 API Key 数据');
    
    // 更新状态为同步中
    await ApiKeyService.updateSyncStatus(apiKeyId, 'SYNCING');

    try {
      // 获取 API Key (包含解密的凭证)
      const userId = await this.getUserIdByApiKey(apiKeyId);
      const apiKeyData = await ApiKeyService.getApiKeyById(apiKeyId, userId);

      logger.info({ apiKeyId, exchange: apiKeyData.exchange }, '连接交易所');

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

        return {
          id: trade.id?.toString() || `${trade.timestamp}-${trade.symbol}`,
          symbol: `${baseAsset}${quoteAsset}`, // "BTCUSDT"
          baseAsset,
          quoteAsset,
          side: trade.side,
          price: trade.price,
          amount: trade.amount,
          fee: trade.fee?.cost || 0,
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

      // 聚合 Trades 到 Legs
      const legs = aggregateTradesToLegs(uniqueTrades);
      console.log(`聚合生成 ${legs.length} 个持仓`);

      // 批量保存 Legs
      const { created, updated } = await this.saveLegsBatch(legs, userId);

      // 更新同步状态
      await ApiKeyService.updateSyncStatus(apiKeyId, 'COMPLETED');

      // 记录同步日志
      await this.logSync(apiKeyId, {
        status: 'COMPLETED',
        tradesFound: uniqueTrades.length,
        tradesImported: importedCount,
        legsCreated: created,
        legsUpdated: updated,
      });

      return {
        tradesFound: uniqueTrades.length,
        tradesImported: importedCount,
        legsCreated: created,
        legsUpdated: updated,
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
   * 批量保存 Trades 到数据库
   */
  private static async saveTradesBatch(
    trades: RawTrade[],
    apiKeyId: number
  ): Promise<number> {
    if (trades.length === 0) {
      console.log('没有交易记录需要保存');
      return 0;
    }

    try {
      // 批量插入，自动跳过重复的 ID
      const result = await prisma.trade.createMany({
        data: trades.map(trade => ({
          id: trade.id,
          apiKeyId,
          symbol: trade.symbol,
          baseAsset: trade.baseAsset || '',
          quoteAsset: trade.quoteAsset || 'USDT',
          side: trade.side.toUpperCase() as any,
          price: trade.price,
          amount: trade.amount,
          quoteAmount: trade.price * trade.amount,
          fee: trade.fee,
          feeAsset: trade.quoteAsset || 'USDT',
          feeUsd: trade.fee,
          timestamp: trade.timestamp,
        })),
        skipDuplicates: true, // 跳过重复的 ID
      });

      console.log(`保存 ${result.count} 条新交易记录到数据库`);
      return result.count;
    } catch (error) {
      console.error('保存交易记录失败:', error);
      throw error;
    }
  }
  
  /**
   * 批量保存/更新 Legs
   */
  private static async saveLegsBatch(
    legs: any[],
    userId: number
  ): Promise<{ created: number; updated: number }> {
    if (legs.length === 0) {
      console.log('没有持仓需要保存');
      return { created: 0, updated: 0 };
    }

    let created = 0;
    let updated = 0;

    // 使用事务批量处理
    await prisma.$transaction(async (tx) => {
      for (const leg of legs) {
        // 尝试查找已存在的 Leg
        const existingLeg = await tx.leg.findFirst({
          where: {
            userId,
            symbol: leg.symbol,
            openDate: leg.openDate,
          },
        });

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

        if (existingLeg) {
          // 更新现有 Leg
          await tx.leg.update({
            where: { id: existingLeg.id },
            data: legData,
          });
          updated++;
        } else {
          // 创建新 Leg
          await tx.leg.create({
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
          });
          created++;
        }
      }
    });

    console.log(`创建 ${created} 个持仓，更新 ${updated} 个持仓`);
    return { created, updated };
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
   *
   * Binance Futures API 限制：fetchMyTrades 每次最多返回 7 天窗口内的数据。
   * 即使返回条数 < limit，也不代表结束——可能只是当前 7 天窗口内没有更多数据。
   * 因此必须按时间窗口（7天）滑动，直到覆盖到当前时间。
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
        // 当前窗口无交易，滑动到下一个窗口
        if (symbol) {
          // 只对有交易的 symbol 打印窗口跳过信息，避免日志过多
        }
        startTime = windowEnd + 1;
        // 避免请求过于频繁
        if (exchange.rateLimit) {
          await new Promise(resolve => setTimeout(resolve, exchange.rateLimit));
        }
        continue;
      }

      allTrades.push(...trades);

      const lastTradeTimestamp = trades[trades.length - 1].timestamp;

      if (trades.length === limit) {
        // 满页：窗口内可能还有更多数据，按时间戳推进（不跨窗口）
        console.log(`  └─ ${symbol ?? 'global'} 第 ${page} 页满 ${limit} 条，推进时间戳至 ${new Date(lastTradeTimestamp + 1).toISOString()}`);
        startTime = lastTradeTimestamp + 1;
      } else {
        // 未满页：当前窗口数据已全部获取，滑动到下一个窗口
        startTime = windowEnd + 1;
      }

      // 避免请求过于频繁，触发限流
      if (exchange.rateLimit) {
        await new Promise(resolve => setTimeout(resolve, exchange.rateLimit));
      }
    }

    if (page > 1) {
      console.log(`  └─ ${symbol ?? 'global'} 共请求 ${page} 次，获得 ${allTrades.length} 条`);
    }

    return allTrades;
  }
}
