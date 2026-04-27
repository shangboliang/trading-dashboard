export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';
import { NextRequest } from 'next/server';
import { AuthError, authErrorResponse, requireUser } from '@/lib/auth';

/**
 * GET /api/analytics/duration
 * 获取按持续时间的交易统计
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const user = await requireUser();
    const userId = user.id;
    const filter = {
      userId,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate') as string) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate') as string) : undefined,
      symbol: searchParams.get('symbol') || undefined,
      apiKeyId: searchParams.get('apiKeyId') ? parseInt(searchParams.get('apiKeyId') as string) : undefined,
    };
    const stats = await LegService.getDurationStats(filter);

    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Failed to fetch duration stats:', error);
    return NextResponse.json(
      { error: '获取持续时间统计数据失败' },
      { status: 500 }
    );
  }
}
