export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { FundingFeeService } from '@/services/FundingFeeService';
import { AuthError, authErrorResponse, requireApiKeyOwner, requireUser } from '@/lib/auth';

/**
 * POST /api/funding/associate
 * 手动触发资金费归集到 Leg
 */
export async function POST(request: NextRequest) {
  try {
    const { apiKeyId } = await request.json();

    if (!apiKeyId) {
      return NextResponse.json({ error: 'apiKeyId 是必填参数' }, { status: 400 });
    }

    const user = await requireUser();
    await requireApiKeyOwner(Number(apiKeyId), user.id);

    const result = await FundingFeeService.associateWithLegs(apiKeyId);

    return NextResponse.json({
      message: `归集完成：关联 ${result.associated} 条资金费，更新 ${result.legsUpdated} 个持仓`,
      ...result,
    });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Funding association failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '归集失败' }, { status: 500 });
  }
}
