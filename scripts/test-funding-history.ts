/**
 * 测试 fetchFundingHistory 可以获取多久前的记录
 * 用法: npx tsx scripts/test-funding-history.ts
 */

import prisma from '../src/lib/prisma';
import { ApiKeyService } from '../src/services/ApiKeyService';

// 不同交易所的 CCXT ID 映射
const EXCHANGE_MAP: any = {
  BINANCE: 'binance',
  OKX: 'okx',
  BYBIT: 'bybit',
  HUOBI: 'huobi',
  GATEIO: 'gateio',
  KUCOIN: 'kucoin',
};

async function testFundingHistory() {
  console.log('开始测试 fetchFundingHistory 获取范围...\n');

  try {
    // 1. 获取第一个 API Key
    const apiKeyDb = await prisma.apiKey.findFirst();
    if (!apiKeyDb) {
      console.log('错误: 数据库中没有 API Key，请先添加。');
      return;
    }

    console.log(`使用 API Key: ${apiKeyDb.name} (${apiKeyDb.exchange})`);

    // 2. 解密并初始化 CCXT
    const apiKeyData = await ApiKeyService.getApiKeyById(apiKeyDb.id, apiKeyDb.userId);
    const ccxt = await import('ccxt');
    const exchangeId = EXCHANGE_MAP[apiKeyDb.exchange];
    
    if (!exchangeId) {
        console.error(`不支持的交易所: ${apiKeyDb.exchange}`);
        return;
    }

    const exchange = new (ccxt as any)[exchangeId]({
      apiKey: apiKeyData.apiKey,
      secret: apiKeyData.apiSecret,
      password: apiKeyData.passphrase,
      enableRateLimit: true,
      httpsProxy: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:7890' : undefined,
    });

    exchange.options['defaultType'] = 'future';
    await exchange.loadMarkets();

    if (!exchange.has['fetchFundingHistory']) {
        console.log(`该交易所 (${apiKeyDb.exchange}) 不支持 fetchFundingHistory`);
        return;
    }

    // 3. 测试不同时间跨度
    const tests = [
        { label: '最近 7 天', days: 7 },
        { label: '最近 30 天', days: 30 },
        { label: '最近 90 天', days: 90 },
        { label: '最近 180 天', days: 180 },
        { label: '最近 1 年', days: 365 },
        { label: '最近 3 年', days: 365 * 3 },
    ];

    for (const test of tests) {
        const since = Date.now() - test.days * 24 * 60 * 60 * 1000;
        console.log(`\n--- 测试范围: ${test.label} (Since: ${new Date(since).toISOString()}) ---`);
        
        try {
            // 注意：Binance 可能会限制单个 window 的长度，这里简单测试一次 fetch
            // 如果要测试全量，需要像 FundingFeeService 那样分页
            const limit = 1000;
            const history = await exchange.fetchFundingHistory(undefined, since, limit);
            
            console.log(`成功获取到 ${history.length} 条记录`);
            
            if (history.length > 0) {
                const oldest = history.reduce((prev: any, curr: any) => prev.timestamp < curr.timestamp ? prev : curr);
                const newest = history.reduce((prev: any, curr: any) => prev.timestamp > curr.timestamp ? prev : curr);
                
                console.log(`最早记录时间: ${new Date(oldest.timestamp).toISOString()} (${oldest.symbol})`);
                console.log(`最新记录时间: ${new Date(newest.timestamp).toISOString()} (${newest.symbol})`);
                
                // 如果返回的数量达到了 limit，说明可能还有更多，或者触发了 API 的某种截断
                if (history.length === limit) {
                    console.log(`注意: 达到了 limit (${limit})，可能存在更多历史记录。`);
                }
            } else {
                console.log('未找到任何资金费记录。');
            }
        } catch (err: any) {
            console.error(`获取失败: ${err.message}`);
            if (err.message.includes('within last')) {
                console.log('提示: 该交易所可能限制只能查询最近 N 天的数据。');
            }
        }
        
        // 稍微等待，避免限频
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log('\n测试完成!');

  } catch (error) {
    console.error('\n发生错误:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testFundingHistory();
