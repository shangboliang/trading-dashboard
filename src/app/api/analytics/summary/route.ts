import { NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

/**
 * GET /api/analytics/summary
 * 获取交易统计摘要
 */
export async function GET() {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    
    // 获取统计数据
    const stats = await LegService.getStats(userId);
    
    // 格式化响应
    return NextResponse.json({
      countPositions: stats.closedLegs,
      countTraders: 1, // 单用户模式
      countTradersInLongPosition: 0, // 暂时不使用
      countTradersInShortPosition: 0, // 暂时不使用
      totalRealisedPnL: stats.totalPnL,
      avgRealisedPnL: stats.closedLegs > 0 ? stats.totalPnL / stats.closedLegs : 0,
      avgDuration: stats.avgDuration,
      winRate: stats.winRate,
      profitFactor: stats.profitFactor,
      totalCommission: stats.totalCommission,
      wins: {
        countLegs: stats.winCount,
        totalRealisedPnL: stats.totalProfit,
        avgRealisedPnL: stats.avgWin,
      },
      loss: {
        countLegs: stats.lossCount,
        totalRealisedPnL: -stats.totalLoss,
        avgRealisedPnL: -stats.avgLoss,
      },
    });
  } catch (error) {
    console.error('Failed to fetch summary:', error);
    return NextResponse.json(
      { error: '获取统计数据失败' },
      { status: 500 }
    );
  }
}
