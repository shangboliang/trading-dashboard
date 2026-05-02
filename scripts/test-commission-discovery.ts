/**
 * 测试 COMMISSION 类型的 Income History 接口
 * 
 * 测试内容：
 * 1. 返回数据结构验证
 * 2. symbol 格式确认
 * 3. 分页逻辑测试
 * 4. 与 markets 的匹配测试
 * 
 * 用法: npx tsx scripts/test-commission-discovery.ts
 */

import prisma from '../src/lib/prisma';
import { ApiKeyService } from '../src/services/ApiKeyService';

// CCXT 交易所映射
const EXCHANGE_MAP: any = {
  BINANCE: 'binance',
  OKX: 'okx',
  BYBIT: 'bybit',
  HUOBI: 'huobi',
  GATEIO: 'gateio',
  KUCOIN: 'kucoin',
};

interface CommissionRecord {
  symbol: string;
  incomeType: string;
  income: string;
  asset: string;
  info: string;
  time: number;
  tranId: string;
  tradeId: string;
}

async function testCommissionDiscovery() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  COMMISSION Income History 接口测试');
  console.log('═══════════════════════════════════════════════════════\n');

  try {
    // ═══════════════════════════════════════════════════════════
    // 1. 初始化交易所连接
    // ═══════════════════════════════════════════════════════════
    const apiKeyDb = await prisma.apiKey.findFirst();
    if (!apiKeyDb) {
      console.error('错误: 数据库中没有 API Key');
      return;
    }

    console.log(`使用 API Key: ${apiKeyDb.name} (${apiKeyDb.exchange})`);

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
    options: {
        defaultType: 'swap',
        // 核心参数：开启自动时间同步修正
        adjustForTimeDifference: true, 
        recvWindow: 10000, // 核心：放大接收窗口到 10 秒
    },
    });

    exchange.options['defaultType'] = 'future';
    await exchange.loadMarkets();

    // ═══════════════════════════════════════════════════════════
    // 2. 测试 1: 单次请求，查看返回数据结构
    // ═══════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────');
    console.log('测试 1: 单次请求 - 查看返回数据结构');
    console.log('────────────────────────────────────────────────────');

    const endTime = Date.now();
    const startTime = endTime - 7 * 24 * 60 * 60 * 1000; // 最近 7 天

    console.log(`请求参数: incomeType=COMMISSION, startTime=${startTime}, endTime=${endTime}`);

    const singleBatch: CommissionRecord[] = await exchange.fapiPrivateGetIncome({
      incomeType: 'COMMISSION',
      startTime,
      endTime,
      limit: 1000,
    });

    console.log(`返回数量: ${singleBatch.length} 条`);

    if (singleBatch.length > 0) {
      console.log('\n第一条记录完整结构:');
      console.log(JSON.stringify(singleBatch[0], null, 2));

      console.log('\n字段分析:');
      console.log(`  symbol: "${singleBatch[0].symbol}" (类型: ${typeof singleBatch[0].symbol})`);
      console.log(`  incomeType: "${singleBatch[0].incomeType}"`);
      console.log(`  income: "${singleBatch[0].income}"`);
      console.log(`  asset: "${singleBatch[0].asset}"`);
      console.log(`  time: ${singleBatch[0].time} (类型: ${typeof singleBatch[0].time})`);
      const timeMs = typeof singleBatch[0].time === 'string' ? parseInt(singleBatch[0].time) : singleBatch[0].time;
      console.log(`  time 转换: ${new Date(timeMs).toISOString()}`);
      console.log(`  tranId: "${singleBatch[0].tranId}"`);
      console.log(`  tradeId: "${singleBatch[0].tradeId}"`);

      // 收集所有唯一的 symbol
      const uniqueSymbols = new Set(singleBatch.map(r => r.symbol).filter(s => s && s.trim()));
      console.log(`\n去重后的 symbol 列表 (${uniqueSymbols.size} 个):`);
      uniqueSymbols.forEach(s => console.log(`  - "${s}"`));
    }

    // ═══════════════════════════════════════════════════════════
    // 3. 测试 2: 分页逻辑验证
    // ═══════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────');
    console.log('测试 2: 分页逻辑验证');
    console.log('────────────────────────────────────────────────────');

    const thirtyDaysAgo = endTime - 30 * 24 * 60 * 60 * 1000;
    let allRecords: CommissionRecord[] = [];
    let currentTime = thirtyDaysAgo;
    let pageCount = 0;
    const limit = 1000;

    console.log(`请求 30 天数据，测试分页...`);

    while (currentTime <= endTime) {
      pageCount++;
      const batch: CommissionRecord[] = await exchange.fapiPrivateGetIncome({
        incomeType: 'COMMISSION',
        startTime: currentTime,
        endTime,
        limit,
      });

      console.log(`  第 ${pageCount} 页: 返回 ${batch.length} 条`);

      if (!batch || batch.length === 0) break;

      allRecords.push(...batch);

      if (batch.length === limit) {
        // 满页，继续
        const lastTimeRaw = batch[batch.length - 1].time;
        const lastTime = typeof lastTimeRaw === 'string' ? parseInt(lastTimeRaw) : lastTimeRaw;
        console.log(`    满页，继续拉取，lastTime=${new Date(lastTime).toISOString()}`);
        currentTime = lastTime + 1;
        await new Promise(r => setTimeout(r, exchange.rateLimit || 100));
      } else {
        // 未满页，结束
        console.log(`    未满页，分页结束`);
        break;
      }
    }

    console.log(`\n分页结果: 共 ${allRecords.length} 条记录，${pageCount} 页`);

    // ═══════════════════════════════════════════════════════════
    // 4. 测试 3: symbol 格式分析
    // ═══════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────');
    console.log('测试 3: symbol 格式分析');
    console.log('────────────────────────────────────────────────────');

    const symbolStats = new Map<string, number>();
    for (const record of allRecords) {
      const sym = record.symbol || '(空)';
      symbolStats.set(sym, (symbolStats.get(sym) || 0) + 1);
    }

    console.log('symbol 出现次数统计:');
    const sortedSymbols = [...symbolStats.entries()].sort((a, b) => b[1] - a[1]);
    for (const [sym, count] of sortedSymbols.slice(0, 20)) {
      console.log(`  "${sym}": ${count} 次`);
    }
    if (sortedSymbols.length > 20) {
      console.log(`  ... 还有 ${sortedSymbols.length - 20} 个 symbol`);
    }

    // 分析 symbol 格式
    console.log('\nsymbol 格式分析:');
    const symbolsWithoutEmpty = [...symbolStats.keys()].filter(s => s !== '(空)');
    const hasSlash = symbolsWithoutEmpty.some(s => s.includes('/'));
    const hasColon = symbolsWithoutEmpty.some(s => s.includes(':'));
    const isUpperCase = symbolsWithoutEmpty.every(s => s === s.toUpperCase());

    console.log(`  包含 '/': ${hasSlash ? '是' : '否'}`);
    console.log(`  包含 ':': ${hasColon ? '是' : '否'}`);
    console.log(`  全大写: ${isUpperCase ? '是' : '否'}`);
    console.log(`  推断格式: ${hasSlash ? 'BTC/USDT:USDT' : 'BTCUSDT'}`);

    // ═══════════════════════════════════════════════════════════
    // 5. 测试 4: 与 markets 的匹配测试
    // ═══════════════════════════════════════════════════════════
    console.log('\n────────────────────────────────────────────────────');
    console.log('测试 4: 与 markets 的匹配测试');
    console.log('────────────────────────────────────────────────────');
await exchange.loadTimeDifference();
    const markets = exchange.markets;
    const uMarkets = Object.values(markets).filter((m: any) => m && m.linear && m.quote === 'USDT');

    console.log(`当前 markets 中 U 本位合约数量: ${uMarkets.length}`);

    let matchedCount = 0;
    let matchedSymbols: string[] = [];
    let unmatchedSymbols: string[] = [];

    for (const sym of symbolsWithoutEmpty) {
      // 尝试不同格式匹配
      const normalized = sym.replace('/', '').replace(':USDT', '');
      const match = uMarkets.find((m: any) => (m.base + m.quote) === normalized);

      if (match) {
        matchedCount++;
        matchedSymbols.push(`${sym} → ${(match as any).symbol}`);
      } else {
        unmatchedSymbols.push(sym);
      }
    }

    console.log(`\n匹配成功: ${matchedCount} 个`);
    if (matchedSymbols.length > 0) {
      console.log('匹配示例:');
      for (const m of matchedSymbols.slice(0, 5)) {
        console.log(`  ${m}`);
      }
    }

    console.log(`\n未匹配（可能已下架）: ${unmatchedSymbols.length} 个`);
    if (unmatchedSymbols.length > 0) {
      console.log('未匹配 symbol:');
      for (const sym of unmatchedSymbols) {
        console.log(`  - "${sym}"`);
      }
    }

    // ═══════════════════════════════════════════════════════════
    // 6. 测试结论
    // ═══════════════════════════════════════════════════════════
    console.log('\n═══════════════════════════════════════════════════════');
    console.log('  测试结论');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`
1. symbol 格式: ${hasSlash ? 'BTC/USDT:USDT' : 'BTCUSDT'}
2. 分页逻辑: ${pageCount > 1 ? '需要分页（满页会继续拉取）' : '单页足够'}
3. 活跃币种数量: ${symbolsWithoutEmpty.length} 个
4. 已下架币种: ${unmatchedSymbols.length} 个
5. 推荐处理方式: ${hasSlash ? '直接使用返回的 symbol' : '需要转换为 CCXT 格式 (BTCUSDT → BTC/USDT:USDT)'}
`);

    if (unmatchedSymbols.length > 0) {
      console.log('已下架币种（API 同步将跳过）:');
      for (const sym of unmatchedSymbols) {
        console.log(`  - ${sym}`);
      }
    }

  } catch (error) {
    console.error('\n发生错误:');
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

testCommissionDiscovery();
