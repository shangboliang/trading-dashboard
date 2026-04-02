/**
 * 交易归集引擎 (Trade to Leg/Position Aggregator)
 * 完美支持：加仓、部分减仓、完全平仓、仓位反转(超额平仓) 及 手续费按比例拆分。
 */

export interface RawTrade {
    id: string;
    symbol: string;
    baseAsset?: string;
    quoteAsset?: string;
    side: string; // 'buy' or 'sell'
    price: number;
    amount: number;
    fee: number;
    timestamp: Date;
}

export function aggregateTradesToLegs(trades: RawTrade[]) {
    // 确保按时间升序处理 (FIFO)
    trades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const legsBySymbol: Record<string, any[]> = {};
    const currentPositions: Record<string, any> = {};

    for (const trade of trades) {
        if (!legsBySymbol[trade.symbol]) {
            legsBySymbol[trade.symbol] = [];
            currentPositions[trade.symbol] = null;
        }

        // 订单的带符号数量：买为正，卖为负
        let remainingAmount = trade.side === 'buy' ? trade.amount : -trade.amount;

        // 使用 while 循环：只要这笔订单还有剩余数量未被分配，就继续处理
        // 应对场景：做多 1 BTC，卖出 3 BTC。循环第一次平掉 1 BTC，第二次反向开空 2 BTC。
        while (Math.abs(remainingAmount) > 1e-8) {
            let pos = currentPositions[trade.symbol];

            if (!pos) {
                // ============== 1. 开新仓 ==============
                pos = {
                    symbol: trade.symbol,
                    baseAsset: trade.baseAsset,
                    quoteAsset: trade.quoteAsset,
                    side: remainingAmount > 0 ? 'long' : 'short',
                    openDate: trade.timestamp,
                    status: 'open',
                    trades: [trade], // 记录关联的交易
                    
                    // 核心数据追踪
                    currentSize: remainingAmount,
                    openSize: Math.abs(remainingAmount), // 最大持仓量
                    accumulatedCost: Math.abs(remainingAmount) * trade.price, // 用于算开仓均价
                    accumulatedExitValue: 0, // 用于算平仓均价 (新增)
                    
                    // 盈亏与费用
                    realisedPnL: 0,
                    commission: trade.fee * (Math.abs(remainingAmount) / trade.amount), // 按使用比例分配手续费
                    maxSizeUsd: Math.abs(remainingAmount) * trade.price
                };
                currentPositions[trade.symbol] = pos;
                remainingAmount = 0; // 该订单消耗完毕
            } else {
                // 判断当前订单是加仓还是平仓
                const isOpening = Math.sign(pos.currentSize) === Math.sign(remainingAmount);

                if (isOpening) {
                    // ============== 2. 加仓 ==============
                    const absRemaining = Math.abs(remainingAmount);
                    pos.trades.push(trade);
                    
                    pos.currentSize += remainingAmount;
                    pos.accumulatedCost += absRemaining * trade.price;
                    
                    // 手续费按比例累加
                    pos.commission += trade.fee * (absRemaining / trade.amount);
                    
                    // 更新峰值指标
                    const currentNominal = Math.abs(pos.currentSize) * trade.price;
                    if (currentNominal > pos.maxSizeUsd) pos.maxSizeUsd = currentNominal;
                    if (Math.abs(pos.currentSize) > pos.openSize) pos.openSize = Math.abs(pos.currentSize);

                    remainingAmount = 0; // 该订单消耗完毕
                } else {
                    // ============== 3. 减仓 / 平仓 / 反转 ==============
                    // 计算本次能抵消掉的数量（取 当前仓位大小 和 剩余订单大小 的绝对值较小者）
                    const closeAmount = Math.min(Math.abs(pos.currentSize), Math.abs(remainingAmount));
                    
                    pos.trades.push(trade);

                    // 计算平仓均价与盈亏
                    const averageEntryPrice = pos.accumulatedCost / Math.abs(pos.currentSize);
                    const pnlFactor = pos.side === 'long' ? 1 : -1;
                    
                    // 累加已实现盈亏
                    pos.realisedPnL += closeAmount * (trade.price - averageEntryPrice) * pnlFactor;
                    
                    // 记录出场价值，用于最后计算精准的平均出场价
                    pos.accumulatedExitValue += closeAmount * trade.price;

                    // 扣除对应的开仓成本
                    pos.accumulatedCost -= closeAmount * averageEntryPrice;
                    
                    // 按比例分配手续费 (如果订单被拆分，手续费也要拆)
                    pos.commission += trade.fee * (closeAmount / trade.amount);

                    // 推进仓位和剩余订单量
                    pos.currentSize += (remainingAmount > 0 ? closeAmount : -closeAmount);
                    remainingAmount += (remainingAmount > 0 ? -closeAmount : closeAmount);

                    // 如果仓位归零，进行结算闭环
                    if (Math.abs(pos.currentSize) < 1e-8) {
                        pos.closeDate = trade.timestamp;
                        pos.status = 'closed';
                        pos.averageEntry = averageEntryPrice;
                        // 精准出场均价 = 总平仓价值 / 总平仓数量
                        pos.averageExit = pos.accumulatedExitValue / pos.openSize; 
                        pos.duration = (pos.closeDate.getTime() - pos.openDate.getTime()) / 1000;
                        pos.realisedPnLusd = pos.realisedPnL; 
                        pos.sizeUsd = pos.maxSizeUsd;

                        // 归档，清空当前追踪的仓位
                        legsBySymbol[trade.symbol].push({...pos});
                        currentPositions[trade.symbol] = null;
                        
                        // 注意：如果 remainingAmount 还不为 0，while 循环会继续执行
                        // 并在下一次循环走到 "1. 开新仓" 的逻辑里，实现完美的仓位反转！
                    }
                }
            }
        }
    }

    // 扁平化合并已平仓的 Leg 和 当前依然持有的 Leg
    const closedLegs = Object.values(legsBySymbol).flat();
    const openLegs = Object.values(currentPositions).filter(pos => pos !== null).map(pos => {
        // 给未平仓的 Leg 补充当前均价
        pos.averageEntry = pos.accumulatedCost / Math.abs(pos.currentSize);
        return pos;
    });

    return [...closedLegs, ...openLegs];
}