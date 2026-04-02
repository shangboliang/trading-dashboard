import { NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/by-symbol
 * 按交易对统计
 */
export async function GET() {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    
    const stats = await LegService.getStatsBySymbol(userId);
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch symbol stats:', error);
    return NextResponse.json(
      { error: '获取交易对统计失败' },
      { status: 500 }
    );
  }
}
