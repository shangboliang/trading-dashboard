import { NextRequest, NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/pnl-curve
 * 获取累计盈亏曲线数据
 * 
 * Query Params:
 * - days: 天数 (默认 30)
 */
export async function GET(request: NextRequest) {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');
    
    const curveData = await LegService.getPnLCurve(userId, days);
    
    return NextResponse.json(curveData);
  } catch (error) {
    console.error('Failed to fetch PnL curve:', error);
    return NextResponse.json(
      { error: '获取盈亏曲线失败' },
      { status: 500 }
    );
  }
}
