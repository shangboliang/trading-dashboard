export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SyncService } from '@/services/SyncService';
import { AuthError, authErrorResponse, requireApiKeyOwner, requireUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKeyId = parseInt(searchParams.get('apiKeyId') as string);
    const downloadId = searchParams.get('downloadId') as string;

    if (!apiKeyId || !downloadId) {
      return NextResponse.json({ error: 'apiKeyId 和 downloadId 均必填' }, { status: 400 });
    }

    const user = await requireUser();
    await requireApiKeyOwner(apiKeyId, user.id);

    const result = await SyncService.checkAsynSyncStatus(apiKeyId, downloadId, user.id);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Check status failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '查询失败' }, { status: 500 });
  }
}
