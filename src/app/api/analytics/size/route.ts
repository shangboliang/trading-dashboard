export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/size
 * 获取按交易规模的交易统计
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
    const stats = await LegService.getSizeStats(filter);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to fetch size stats:', error);
    return NextResponse.json(
      { error: '获取规模统计数据失败' },
      { status: 500 }
    );
  }
}
