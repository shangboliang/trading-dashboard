import { NextRequest, NextResponse } from 'next/server';
import { SyncService } from '@/services/SyncService';
import logger from '@/lib/logger';

/**
 * POST /api/sync
 * 同步指定 API Key 的历史成交数据
 * 
 * Body:
 * - apiKeyId: number
 */
export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  
  try {
    const body = await request.json();
    const { apiKeyId } = body;
    
    logger.info({ requestId, apiKeyId }, '开始同步数据');
    
    if (!apiKeyId) {
      logger.warn({ requestId }, 'apiKeyId 缺失');
      return NextResponse.json(
        { error: 'apiKeyId 是必填参数' },
        { status: 400 }
      );
    }
    
    // 执行同步
    const result = await SyncService.syncApiKey(apiKeyId);
    
    logger.info({ requestId, apiKeyId, ...result }, '数据同步完成');
    
    return NextResponse.json({
      message: '同步成功',
      ...result,
    });
  } catch (error) {
    logger.error({ requestId, error }, '同步失败');
    const errorMessage = error instanceof Error ? error.message : '同步失败';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
