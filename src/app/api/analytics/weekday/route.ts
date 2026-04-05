export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/weekday
 * 获取按星期几的交易统计
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const filter = {
      userId,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate') as string) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate') as string) : undefined,
      symbol: searchParams.get('symbol') || undefined,
      apiKeyId: searchParams.get('apiKeyId') ? parseInt(searchParams.get('apiKeyId') as string) : undefined,
    };
    const stats = await LegService.getWeekdayStats(filter);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch weekday stats:', error);
    return NextResponse.json(
      { error: '获取星期统计数据失败' },
      { status: 500 }
    );
  }
}
