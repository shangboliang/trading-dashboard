export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';
import type { LegStatus, LegSide } from '@prisma/client';

/**
 * GET /api/legs
 * 获取 Legs 列表 (支持筛选和分页)
 * 
 * Query Params:
 * - status: 'OPEN' | 'CLOSED'
 * - symbol: 交易对
 * - side: 'LONG' | 'SHORT'
 * - startDate: 开始日期 (ISO string)
 * - endDate: 结束日期 (ISO string)
 * - page: 页码 (默认 1)
 * - pageSize: 每页数量 (默认 20)
 * - sortBy: 排序字段 (openDate | closeDate | netPnL | duration)
 * - sortOrder: 排序方向 (asc | desc)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 开发环境使用默认用户 ID
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    
    // 解析查询参数
    const status = searchParams.get('status') as LegStatus | undefined;
    const symbol = searchParams.get('symbol') || undefined;
    const side = searchParams.get('side') as LegSide | undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const sortBy = searchParams.get('sortBy') as 'openDate' | 'closeDate' | 'netPnL' | 'duration' | undefined;
    const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';
    
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (searchParams.has('startDate')) {
      startDate = new Date(searchParams.get('startDate')!);
    }
    if (searchParams.has('endDate')) {
      endDate = new Date(searchParams.get('endDate')!);
    }
    
    // 获取 Legs
    const result = await LegService.getLegs({
      userId,
      status,
      symbol,
      side,
      startDate,
      endDate,
      page,
      pageSize,
      sortBy,
      sortOrder,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch legs:', error);
    return NextResponse.json(
      { error: '获取交易记录失败' },
      { status: 500 }
    );
  }
}
