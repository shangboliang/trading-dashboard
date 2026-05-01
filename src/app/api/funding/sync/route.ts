export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { FundingFeeService } from '@/services/FundingFeeService';
import { AuthError, authErrorResponse, requireApiKeyOwner, requireUser } from '@/lib/auth';

/**
 * POST /api/funding/sync
 * API 同步资金费（调用 Binance Income History API）
 */
export async function POST(request: NextRequest) {
  try {
    const { apiKeyId } = await request.json();

    if (!apiKeyId) {
      return NextResponse.json({ error: 'apiKeyId 是必填参数' }, { status: 400 });
    }

    const user = await requireUser();
    await requireApiKeyOwner(Number(apiKeyId), user.id);

    const imported = await FundingFeeService.syncByApi(apiKeyId, user.id);

    return NextResponse.json({ message: '资金费 API 同步成功', imported });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Funding API sync failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '同步失败' }, { status: 500 });
  }
}
