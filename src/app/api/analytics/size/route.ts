import { NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/size
 * 获取按交易规模的交易统计
 */
export async function GET() {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const stats = await LegService.getSizeStats(userId);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch size stats:', error);
    return NextResponse.json(
      { error: '获取规模统计数据失败' },
      { status: 500 }
    );
  }
}
