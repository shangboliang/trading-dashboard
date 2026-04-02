import { NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/weekday
 * 获取按星期几的交易统计
 */
export async function GET() {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const stats = await LegService.getWeekdayStats(userId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch weekday stats:', error);
    return NextResponse.json(
      { error: '获取星期统计数据失败' },
      { status: 500 }
    );
  }
}
