export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';
import { NextRequest } from 'next/server';
import { AuthError, authErrorResponse, requireUser } from '@/lib/auth';

/**
 * GET /api/analytics/by-symbol
 * 按交易对统计
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
    
    const stats = await LegService.getStatsBySymbol(filter);
    
    return NextResponse.json(stats);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Failed to fetch symbol stats:', error);
    return NextResponse.json(
      { error: '获取交易对统计失败' },
      { status: 500 }
    );
  }
}
