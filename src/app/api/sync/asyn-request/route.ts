export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SyncService } from '@/services/SyncService';

export async function POST(request: NextRequest) {
  try {
    const { apiKeyId } = await request.json();

    if (!apiKeyId) {
      return NextResponse.json({ error: 'apiKeyId 是必填参数' }, { status: 400 });
    }

    const result = await SyncService.requestAsynSync(apiKeyId);

    return NextResponse.json({ message: '异步导出申请成功，请稍后检查状态', ...result });
  } catch (error) {
    console.error('Asyn request failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '申请失败' }, { status: 500 });
  }
}
