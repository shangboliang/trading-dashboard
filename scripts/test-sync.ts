/**
 * 测试数据同步功能
 * 用法: npx tsx scripts/test-sync.ts
 */

import { SyncService } from '../src/services/SyncService';
import { ApiKeyService } from '../src/services/ApiKeyService';
import prisma from '../src/lib/prisma';

async function testSync() {
  console.log('开始测试数据同步...\n');

  try {
    // 1. 检查是否有 API Key
    const apiKeys = await prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        exchange: true,
        syncStatus: true,
        lastSyncAt: true,
      },
    });

    if (apiKeys.length === 0) {
      console.log('没有找到 API Key');
      console.log('请先在界面中添加交易所 API Key');
      return;
    }

    console.log(`找到 ${apiKeys.length} 个 API Key:\n`);
    apiKeys.forEach((key, index) => {
      console.log(`${index + 1}. ${key.name} (${key.exchange})`);
      console.log(`   状态: ${key.syncStatus}`);
      console.log(`   上次同步: ${key.lastSyncAt || '从未同步'}\n`);
    });

    // 2. 选择第一个 API Key 进行测试
    const testApiKey = apiKeys[0];
    console.log(`开始同步: ${testApiKey.name}\n`);

    // 3. 执行同步
    const startTime = Date.now();
    const result = await SyncService.syncApiKey(testApiKey.id);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 4. 显示结果
    console.log('\n同步完成!\n');
    console.log('同步结果:');
    console.log(`   找到交易: ${result.tradesFound} 条`);
    console.log(`   导入交易: ${result.tradesImported} 条`);
    console.log(`   创建持仓: ${result.legsCreated} 个`);
    console.log(`   更新持仓: ${result.legsUpdated} 个`);
    console.log(`   耗时: ${duration} 秒\n`);

    // 5. 验证数据
    console.log('验证数据库...\n');

    const tradeCount = await prisma.trade.count({
      where: { apiKeyId: testApiKey.id },
    });

    const legCount = await prisma.leg.count({
      where: { user: { apiKeys: { some: { id: testApiKey.id } } } },
    });

    const recentTrades = await prisma.trade.findMany({
      where: { apiKeyId: testApiKey.id },
      orderBy: { timestamp: 'desc' },
      take: 5,
      select: {
        symbol: true,
        side: true,
        price: true,
        amount: true,
        timestamp: true,
      },
    });

    console.log(`   Trade 表: ${tradeCount} 条记录`);
    console.log(`   Leg 表: ${legCount} 条记录\n`);

    if (recentTrades.length > 0) {
      console.log('最近 5 条交易:');
      recentTrades.forEach((trade, index) => {
        console.log(
          `   ${index + 1}. ${trade.symbol} ${trade.side.toUpperCase()} ` +
          `${trade.amount} @ $${trade.price.toFixed(2)} ` +
          `(${new Date(trade.timestamp).toLocaleString('zh-CN')})`
        );
      });
    } else {
      console.log('没有找到交易记录');
      console.log('可能原因:');
      console.log('   - API Key 权限不足（需要读取交易历史权限）');
      console.log('   - 该账户没有交易记录');
      console.log('   - 时间范围内没有交易');
    }

    console.log('\n测试完成!');

  } catch (error) {
    console.error('\n同步失败:');
    console.error(error instanceof Error ? error.message : String(error));

    if (error instanceof Error && error.stack) {
      console.error('\n错误堆栈:');
      console.error(error.stack);
    }

    // 检查常见问题
    console.log('\n常见问题排查:');
    console.log('1. 检查 API Key 权限是否包含"读取交易历史"');
    console.log('2. 检查 API Key 和 Secret 是否正确');
    console.log('3. 检查交易所 API 是否有速率限制');
    console.log('4. 检查网络连接是否正常');
    console.log('5. 某些交易所可能需要 passphrase');
  } finally {
    await prisma.$disconnect();
  }
}

// 运行测试
testSync();
