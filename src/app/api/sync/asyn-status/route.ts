export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SyncService } from '@/services/SyncService';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const apiKeyId = parseInt(searchParams.get('apiKeyId') as string);
    const downloadId = searchParams.get('downloadId') as string;

    if (!apiKeyId || !downloadId) {
      return NextResponse.json({ error: 'apiKeyId 和 downloadId 均必填' }, { status: 400 });
    }

    const result = await SyncService.checkAsynSyncStatus(apiKeyId, downloadId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Check status failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '查询失败' }, { status: 500 });
  }
}
