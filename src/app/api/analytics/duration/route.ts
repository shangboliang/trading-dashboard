import { NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/duration
 * 获取按持续时间的交易统计
 */
export async function GET() {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const stats = await LegService.getDurationStats(userId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch duration stats:', error);
    return NextResponse.json(
      { error: '获取持续时间统计数据失败' },
      { status: 500 }
    );
  }
}
