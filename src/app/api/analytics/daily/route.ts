import { NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/daily
 * 获取每日盈亏数据
 */
export async function GET(request: Request) {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;

    const stats = await LegService.getDailyPnL(userId, year, month);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch daily PnL:', error);
    return NextResponse.json(
      { error: '获取每日盈亏数据失败' },
      { status: 500 }
    );
  }
}
