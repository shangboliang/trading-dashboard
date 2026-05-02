export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SyncService } from '@/services/SyncService';
import { AuthError, authErrorResponse, requireApiKeyOwner, requireUser } from '@/lib/auth';

/**
 * POST /api/sync
 * 同步指定 API Key 的历史成交数据
 * 
 * Body:
 * - apiKeyId: number
 * - forceSync?: boolean (强制同步，当时间超过90天时前端确认后传入)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKeyId, forceSync } = body;
    
    if (!apiKeyId) {
      return NextResponse.json(
        { error: 'apiKeyId 是必填参数' },
        { status: 400 }
      );
    }
    
    // 执行同步
    const user = await requireUser();
    await requireApiKeyOwner(Number(apiKeyId), user.id);

    const result = await SyncService.syncApiKey(apiKeyId, forceSync);
    
    return NextResponse.json({
      message: '同步成功',
      ...result,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Sync failed:', error);
    const errorMessage = error instanceof Error ? error.message : '同步失败';
    if (errorMessage.includes('正在同步')) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
