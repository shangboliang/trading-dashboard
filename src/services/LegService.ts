/**
 * 持仓/Leg 管理服务
 * 处理 Leg 的查询、统计和分析
 */

import prisma from '@/lib/prisma';
import type { LegStatus, LegSide } from '@prisma/client';

export interface LegFilter {
  userId: number;
  status?: LegStatus;
  symbol?: string;
  side?: LegSide;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  pageSize?: number;
  sortBy?: 'openDate' | 'closeDate' | 'netPnL' | 'duration';
  sortOrder?: 'asc' | 'desc';
}

export interface LegStats {
  totalLegs: number;
  closedLegs: number;
  openLegs: number;
  totalPnL: number;
  totalProfit: number;
  totalLoss: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  totalCommission: number;
  avgDuration: number;
}

export class LegService {
  /**
   * 获取 Legs 列表 (支持筛选和分页)
   */
  static async getLegs(filter: LegFilter) {
    const {
      userId,
      status,
      symbol,
      side,
      startDate,
      endDate,
      page = 1,
      pageSize = 20,
      sortBy = 'openDate',
      sortOrder = 'desc',
    } = filter;
    
    // 构建查询条件
    const where: any = { userId };
    
    if (status) where.status = status;
    if (symbol) where.symbol = symbol;
    if (side) where.side = side;
    
    if (startDate || endDate) {
      where.openDate = {};
      if (startDate) where.openDate.gte = startDate;
      if (endDate) where.openDate.lte = endDate;
    }
    
    // 排序字段映射
    const orderByMap: Record<string, any> = {
      openDate: { openDate: sortOrder },
      closeDate: { closeDate: sortOrder },
      netPnL: { netPnL: sortOrder },
      duration: { duration: sortOrder },
    };
    
    // 获取总数
    const total = await prisma.leg.count({ where });
    
    // 获取数据
    const legs = await prisma.leg.findMany({
      where,
      orderBy: orderByMap[sortBy] || orderByMap.openDate,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        tags: true,
      },
    });
    
    return {
      data: legs.map(leg => ({
        ...leg,
        result: leg.netPnL > 0 ? 'win' : leg.netPnL < 0 ? 'loss' : 'breakeven',
      })),
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
  
  /**
   * 获取单个 Leg 详情
   */
  static async getLegById(legId: number, userId: number) {
    return prisma.leg.findFirst({
      where: {
        id: legId,
        userId,
      },
      include: {
        tags: true,
        trades: {
          orderBy: { timestamp: 'asc' },
        },
      },
    });
  }
  
  /**
   * 更新 Leg (笔记、标签等)
   */
  static async updateLeg(
    legId: number,
    userId: number,
    data: {
      notes?: string;
      strategy?: string;
      setup?: string;
      mistakes?: string;
      tagIds?: number[];
    }
  ) {
    const { notes, strategy, setup, mistakes, tagIds } = data;
    
    // 处理标签关联
    if (tagIds !== undefined) {
      // 删除旧的关联
      await prisma.leg.update({
        where: { id: legId },
        data: { tags: { set: [] } },
      });
      
      // 添加新的关联
      if (tagIds.length > 0) {
        await prisma.leg.update({
          where: { id: legId },
          data: {
            tags: {
              connect: tagIds.map(id => ({ id })),
            },
          },
        });
      }
    }
    
    return prisma.leg.update({
      where: {
        id: legId,
        userId,
      },
      data: {
        notes,
        strategy,
        setup,
        mistakes,
      },
    });
  }
  
  /**
   * 删除 Leg
   */
  static async deleteLeg(legId: number, userId: number) {
    return prisma.leg.delete({
      where: {
        id: legId,
        userId,
      },
    });
  }
  
  /**
   * 获取统计数据
   */
  static async getStats(userId: number): Promise<LegStats> {
    // 获取所有已平仓的 Leg
    const legs = await prisma.leg.findMany({
      where: {
        userId,
        status: 'CLOSED',
      },
      select: {
        netPnL: true,
        commission: true,
        duration: true,
      },
    });
    
    const totalLegs = await prisma.leg.count({ where: { userId } });
    const closedLegs = legs.length;
    const openLegs = totalLegs - closedLegs;
    
    // 计算盈亏统计
    const wins = legs.filter(l => l.netPnL > 0);
    const losses = legs.filter(l => l.netPnL < 0);
    
    const totalPnL = legs.reduce((sum, l) => sum + l.netPnL, 0);
    const totalProfit = wins.reduce((sum, l) => sum + l.netPnL, 0);
    const totalLoss = Math.abs(losses.reduce((sum, l) => sum + l.netPnL, 0));
    const totalCommission = legs.reduce((sum, l) => sum + (l.commission || 0), 0);
    
    const validDurations = legs.filter(l => l.duration !== null).map(l => l.duration as number);
    const avgDuration = validDurations.length > 0 ? validDurations.reduce((sum, d) => sum + d, 0) / validDurations.length : 0;
    
    const winCount = wins.length;
    const lossCount = losses.length;
    const winRate = closedLegs > 0 ? (winCount / closedLegs) : 0;
    
    const avgWin = winCount > 0 ? totalProfit / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLoss / lossCount : 0;
    
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
    
    return {
      totalLegs,
      closedLegs,
      openLegs,
      totalPnL,
      totalProfit,
      totalLoss,
      winCount,
      lossCount,
      winRate,
      avgWin,
      avgLoss,
      profitFactor,
      totalCommission,
      avgDuration,
    };
  }
  
  /**
   * 获取累计盈亏曲线数据
   */
  static async getPnLCurve(userId: number, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // 获取指定时间范围内的所有已平仓 Leg
    const legs = await prisma.leg.findMany({
      where: {
        userId,
        status: 'CLOSED',
        closeDate: {
          gte: startDate,
        },
      },
      select: {
        closeDate: true,
        netPnL: true,
      },
      orderBy: {
        closeDate: 'asc',
      },
    });
    
    // 按天累加盈亏
    const curveData: { date: string; cumulativePnL: number; closedLegs: number }[] = [];
    let cumulativePnL = 0;
    
    // 生成每天的數據
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      
      // 加上当天平仓的所有 Leg 的盈亏
      const legsOnThisDay = legs.filter(
        l => l.closeDate && new Date(l.closeDate).toISOString().split('T')[0] === dateStr
      );
      
      legsOnThisDay.forEach(l => {
        cumulativePnL += l.netPnL;
      });
      
      curveData.push({
        date: dateStr,
        cumulativePnL: parseFloat(cumulativePnL.toFixed(2)),
        closedLegs: legsOnThisDay.length,
      });
    }
    
    return curveData;
  }
  
  /**
   * 按交易对统计
   */
  static async getStatsBySymbol(userId: number) {
    const legs = await prisma.leg.findMany({
      where: {
        userId,
        status: 'CLOSED',
      },
      select: {
        symbol: true,
        netPnL: true,
        duration: true,
      },
    });

    const symbolStatsMap: Record<string, {
      count: number;
      winCount: number;
      lossCount: number;
      totalPnL: number;
      totalDuration: number;
      totalProfit: number;
      totalLoss: number;
    }> = {};

    legs.forEach(leg => {
      const sym = leg.symbol;
      if (!symbolStatsMap[sym]) {
        symbolStatsMap[sym] = { count: 0, winCount: 0, lossCount: 0, totalPnL: 0, totalDuration: 0, totalProfit: 0, totalLoss: 0 };
      }

      symbolStatsMap[sym].count += 1;
      symbolStatsMap[sym].totalPnL += leg.netPnL;
      if (leg.duration) {
        symbolStatsMap[sym].totalDuration += leg.duration;
      }

      if (leg.netPnL > 0) {
        symbolStatsMap[sym].winCount += 1;
        symbolStatsMap[sym].totalProfit += leg.netPnL;
      } else if (leg.netPnL < 0) {
        symbolStatsMap[sym].lossCount += 1;
        symbolStatsMap[sym].totalLoss += Math.abs(leg.netPnL);
      }
    });

    return Object.entries(symbolStatsMap).map(([symbol, stats]) => {
      const winRate = stats.count > 0 ? stats.winCount / stats.count : 0;
      const profitFactor = stats.totalLoss > 0 ? stats.totalProfit / stats.totalLoss : (stats.totalProfit > 0 ? Infinity : 0);
      return {
        symbol,
        countLegs: stats.count,
        winCount: stats.winCount,
        lossCount: stats.lossCount,
        winRate: parseFloat(winRate.toFixed(4)),
        totalPnL: parseFloat(stats.totalPnL.toFixed(2)),
        avgPnL: stats.count > 0 ? parseFloat((stats.totalPnL / stats.count).toFixed(2)) : 0,
        profitFactor: profitFactor === Infinity ? 999 : parseFloat(profitFactor.toFixed(2)),
        avgDuration: stats.count > 0 ? Math.floor(stats.totalDuration / stats.count) : 0,
      };
    });
  }

  /**
   * 按星期几统计
   */
  static async getWeekdayStats(userId: number) {
    const legs = await prisma.leg.findMany({
      where: {
        userId,
        status: 'CLOSED',
        closeDate: { not: null },
      },
      select: {
        closeDate: true,
        netPnL: true,
      },
    });

    // 初始化星期统计 (1=周一, 7=周日)
    const weekdayStats = Array.from({ length: 7 }, (_, i) => ({
      rangeStart: i + 1,
      countLegs: 0,
      totalRealisedPnL: 0,
    }));

    legs.forEach(leg => {
      if (leg.closeDate) {
        // getDay() 返回 0=周日, 1=周一...6=周六
        const dayOfWeek = new Date(leg.closeDate).getDay();
        // 转换为 1=周一, 7=周日
        const weekday = dayOfWeek === 0 ? 7 : dayOfWeek;
        const idx = weekday - 1;

        weekdayStats[idx].countLegs += 1;
        weekdayStats[idx].totalRealisedPnL += leg.netPnL;
      }
    });

    return weekdayStats;
  }

  /**
   * 按小时统计
   */
  static async getHourlyStats(userId: number) {
    const legs = await prisma.leg.findMany({
      where: {
        userId,
        status: 'CLOSED',
        closeDate: { not: null },
      },
      select: {
        closeDate: true,
        netPnL: true,
      },
    });

    // 初始化24小时统计
    const hourlyStats = Array.from({ length: 24 }, (_, i) => ({
      rangeStart: i,
      countLegs: 0,
      totalRealisedPnL: 0,
    }));

    legs.forEach(leg => {
      if (leg.closeDate) {
        const hour = new Date(leg.closeDate).getHours();
        hourlyStats[hour].countLegs += 1;
        hourlyStats[hour].totalRealisedPnL += leg.netPnL;
      }
    });

    return hourlyStats;
  }

  /**
   * 按持续时间统计
   */
  static async getDurationStats(userId: number) {
    const legs = await prisma.leg.findMany({
      where: {
        userId,
        status: 'CLOSED',
        duration: { not: null },
      },
      select: {
        duration: true,
        netPnL: true,
      },
    });

    // 定义持续时间区间（秒）
    const ranges = [
      { label: '0-1小时', min: 0, max: 3600, count: 0, pnl: 0 },
      { label: '1-4小时', min: 3600, max: 14400, count: 0, pnl: 0 },
      { label: '4-12小时', min: 14400, max: 43200, count: 0, pnl: 0 },
      { label: '12-24小时', min: 43200, max: 86400, count: 0, pnl: 0 },
      { label: '1天-3天', min: 86400, max: 259200, count: 0, pnl: 0 },
      { label: '>3天', min: 259200, max: Infinity, count: 0, pnl: 0 },
    ];

    legs.forEach(leg => {
      if (leg.duration !== null) {
        const range = ranges.find(r => leg.duration! >= r.min && leg.duration! < r.max);
        if (range) {
          range.count += 1;
          range.pnl += leg.netPnL;
        }
      }
    });

    return ranges.map(r => ({
      range: r.label,
      count: r.count,
      pnl: parseFloat(r.pnl.toFixed(2)),
    }));
  }

  /**
   * 按交易规模统计
   */
  static async getSizeStats(userId: number) {
    const legs = await prisma.leg.findMany({
      where: {
        userId,
        status: 'CLOSED',
      },
      select: {
        sizeUsd: true,
        netPnL: true,
      },
    });

    // 定义规模区间
    const ranges = [
      { rangeStart: 0, rangeEnd: 100, wins: 0, loss: 0 },
      { rangeStart: 100, rangeEnd: 500, wins: 0, loss: 0 },
      { rangeStart: 500, rangeEnd: 1000, wins: 0, loss: 0 },
      { rangeStart: 1000, rangeEnd: 5000, wins: 0, loss: 0 },
      { rangeStart: 5000, rangeEnd: Infinity, wins: 0, loss: 0 },
    ];

    legs.forEach(leg => {
      const range = ranges.find(r => leg.sizeUsd >= r.rangeStart && leg.sizeUsd < r.rangeEnd);
      if (range) {
        if (leg.netPnL > 0) {
          range.wins += 1;
        } else if (leg.netPnL < 0) {
          range.loss += 1;
        }
      }
    });

    return ranges.map(r => ({
      rangeStart: r.rangeStart,
      wins: { countLegs: r.wins },
      loss: { countLegs: r.loss },
    }));
  }

  /**
   * 获取每日盈亏（用于日历）
   */
  static async getDailyPnL(userId: number, year?: number, month?: number) {
    const where: any = {
      userId,
      status: 'CLOSED',
      closeDate: { not: null },
    };

    // 如果指定了年月，则筛选该月份
    if (year && month) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      where.closeDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const legs = await prisma.leg.findMany({
      where,
      select: {
        closeDate: true,
        netPnL: true,
      },
    });

    // 按日期聚合
    const dailyMap: Record<string, { date: string; pnl: number; count: number }> = {};

    legs.forEach(leg => {
      if (leg.closeDate) {
        const dateStr = new Date(leg.closeDate).toISOString().split('T')[0];
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { date: dateStr, pnl: 0, count: 0 };
        }
        dailyMap[dateStr].pnl += leg.netPnL;
        dailyMap[dateStr].count += 1;
      }
    });

    return Object.values(dailyMap).map(d => ({
      date: d.date,
      pnl: parseFloat(d.pnl.toFixed(2)),
      count: d.count,
    }));
  }
}
