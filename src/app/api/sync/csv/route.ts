export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SyncService } from '@/services/SyncService';
import { ApiKeyService } from '@/services/ApiKeyService';
import prisma from '@/lib/prisma';
import { AuthError, authErrorResponse, requireApiKeyOwner, requireUser } from '@/lib/auth';
import { decodeCsv } from '@/utils/csv-encoding';
import { type HeaderMapping } from '@/services/BinanceCsvService';

export async function POST(request: NextRequest) {
  let apiKeyId: number | undefined;
  try {
    const formData = await request.formData();
    apiKeyId = parseInt(formData.get('apiKeyId') as string);
    const file = formData.get('file') as File;
    const mappingStr = formData.get('headerMapping') as string | null;

    if (!apiKeyId || !file) {
      return NextResponse.json({ error: 'apiKeyId 或 file 缺失' }, { status: 400 });
    }

    // 解析表头映射配置
    let headerMapping: HeaderMapping | undefined;
    if (mappingStr) {
      try {
        headerMapping = JSON.parse(mappingStr);
      } catch {
        return NextResponse.json({ error: 'headerMapping 格式无效' }, { status: 400 });
      }
    }

    // 竞态保护：检查当前同步状态
    const user = await requireUser();
    await requireApiKeyOwner(apiKeyId, user.id);

    // 原子抢锁：避免“先查再更”导致并发重复触发
    const lockResult = await prisma.apiKey.updateMany({
      where: {
        id: apiKeyId,
        userId: user.id,
        syncStatus: { not: 'SYNCING' },
      },
      data: {
        syncStatus: 'SYNCING',
        errorMessage: null,
      },
    });

    if (lockResult.count === 0) {
      return NextResponse.json({ error: '数据正在同步或计算中，请勿重复触发' }, { status: 409 });
    }

    try {
      const csvContent = decodeCsv(await file.arrayBuffer());
      const result = await SyncService.syncByCsv(apiKeyId, csvContent, headerMapping);

      // 解锁状态
      await ApiKeyService.updateSyncStatus(apiKeyId, 'COMPLETED', undefined, user.id);

      return NextResponse.json({ message: 'CSV 导入成功', ...result });
    } catch (innerError) {
      const errorMessage = innerError instanceof Error ? innerError.message : 'CSV 导入失败';
      await ApiKeyService.updateSyncStatus(apiKeyId, 'FAILED', errorMessage, user.id);
      throw innerError;
    }
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('CSV Sync failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '导入过程出错' }, { status: 500 });
  }
}
