import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/ApiKeyService';
import { MaeMfeService } from '@/services/MaeMfeService';
import prisma from '@/lib/prisma';
import type { Exchange } from '@prisma/client';
import { AuthError, authErrorResponse, requireApiKeyOwner, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const EXCHANGE_MAP: Record<Exchange, string> = {
  BINANCE: 'binance',
  OKX: 'okx',
  BYBIT: 'bybit',
  HUOBI: 'huobi',
  GATEIO: 'gateio',
  KUCOIN: 'kucoin',
};

/**
 * POST /api/sync/mae-mfe
 * 手动触发 MAE/MFE 重新计算
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const apiKeyId = body.apiKeyId;

    if (!apiKeyId) {
      return NextResponse.json({ error: '缺少 apiKeyId' }, { status: 400 });
    }

    // 1. 竞态保护：检查状态
    const user = await requireUser();
    await requireApiKeyOwner(Number(apiKeyId), user.id);

    const apiKeyDb = await prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { syncStatus: true, userId: true }
    });

    if (!apiKeyDb) throw new Error('API Key 不存在');
    if (apiKeyDb.syncStatus === 'SYNCING') {
      return NextResponse.json({ error: '数据正在同步或计算中，请稍后再试' }, { status: 409 });
    }

    // 2. 锁定状态
    await ApiKeyService.updateSyncStatus(apiKeyId, 'SYNCING', undefined, user.id);

    try {
      // 3. 获取 API 凭证以初始化 CCXT
      const userId = apiKeyDb.userId;
      const apiKeyData = await ApiKeyService.getApiKeyById(apiKeyId, userId);

      const ccxt = await import('ccxt');
      const exchangeId = EXCHANGE_MAP[apiKeyData.exchange];
      const exchange = new (ccxt as any)[exchangeId]({
        apiKey: apiKeyData.apiKey,
        secret: apiKeyData.apiSecret,
        password: apiKeyData.passphrase,
        enableRateLimit: true,
        httpsProxy: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:7890' : undefined,
      });

      // 4. 获取该账号下所有没有 mae 数据并且状态为 CLOSED 的 Leg
      // 我们也可以让用户选择重算，这里默认计算缺失的
      const legsToCalculate = await prisma.leg.findMany({
        where: {
          userId: userId,
          trades: {
            some: {
              apiKeyId: apiKeyId
            }
          },
          status: 'CLOSED',
          mae: null
        },
        select: { id: true }
      });

      const legIds = legsToCalculate.map(l => l.id);

      if (legIds.length > 0) {
        // 调用服务计算
        await MaeMfeService.calculate(exchange, legIds);
      }

      // 5. 释放状态
      await ApiKeyService.updateSyncStatus(apiKeyId, 'COMPLETED', undefined, user.id);

      return NextResponse.json({ message: `成功计算了 ${legIds.length} 个订单的 MAE/MFE` });

    } catch (innerError) {
      // 发生错误，释放状态并记录错误
      const errorMessage = innerError instanceof Error ? innerError.message : 'MAE/MFE 计算失败';
      await ApiKeyService.updateSyncStatus(apiKeyId, 'FAILED', errorMessage, user.id);
      throw innerError;
    }

  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('MAE/MFE 手动触发失败:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '计算请求失败' },
      { status: 500 }
    );
  }
}
