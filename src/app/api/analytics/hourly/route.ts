import { NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/hourly
 * 获取按小时的交易统计
 */
export async function GET() {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const stats = await LegService.getHourlyStats(userId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch hourly stats:', error);
    return NextResponse.json(
      { error: '获取小时统计数据失败' },
      { status: 500 }
    );
  }
}
