export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/daily
 * 获取每日盈亏数据
 */
export async function GET(request: Request) {
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
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;

    const stats = await LegService.getDailyPnL(filter, year, month);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch daily PnL:', error);
    return NextResponse.json(
      { error: '获取每日盈亏数据失败' },
      { status: 500 }
    );
  }
}
