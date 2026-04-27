export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { SyncService } from '@/services/SyncService';
import { AuthError, authErrorResponse, requireApiKeyOwner, requireUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { apiKeyId } = await request.json();

    if (!apiKeyId) {
      return NextResponse.json({ error: 'apiKeyId 是必填参数' }, { status: 400 });
    }

    const user = await requireUser();
    await requireApiKeyOwner(Number(apiKeyId), user.id);

    const result = await SyncService.requestAsynSync(apiKeyId);

    return NextResponse.json({ message: '异步导出申请成功，请稍后检查状态', ...result });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Asyn request failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '申请失败' }, { status: 500 });
  }
}
