export const dynamic = 'force-dynamic';
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
    const days = parseInt(searchParams.get('days') || '30');
    
    const curveData = await LegService.getPnLCurve(filter, days);
    
    return NextResponse.json(curveData);
  } catch (error) {
    console.error('Failed to fetch PnL curve:', error);
    return NextResponse.json(
      { error: '获取盈亏曲线失败' },
      { status: 500 }
    );
  }
}
