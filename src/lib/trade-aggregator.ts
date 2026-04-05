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
    /**
     * 双向持仓模式下的仓位方向（来自 Binance info.positionSide）：
     * - 'LONG'  → 该笔交易属于做多仓位
     * - 'SHORT' → 该笔交易属于做空仓位
     * - 'BOTH'  → 单向持仓模式（默认）
     */
    positionSide?: string;
    price: number;
    amount: number;
    /** 手续费原始数量（BNB 抵扣时为 BNB 数量） */
    fee: number;
    /** 手续费币种（如 "BNB"、"USDT"） */
    feeAsset: string;
    /** 手续费的 USD 等值（已换算，用于 PnL 计算） */
    feeUsd: number;
    timestamp: Date;
}

export function aggregateTradesToLegs(trades: RawTrade[]) {
    // 确保按时间升序处理 (FIFO)
    trades.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const legsByKey: Record<string, any[]> = {};
    const currentPositions: Record<string, any> = {};

    for (const trade of trades) {
        // 双向持仓：用 symbol-positionSide 区分同一标的的多空仓位
        // 单向持仓：positionSide 为 'BOTH' 或缺省，key 仅用 symbol
        const ps = trade.positionSide ?? 'BOTH';
        const posKey = ps === 'BOTH' ? trade.symbol : `${trade.symbol}-${ps}`;

        if (!legsByKey[posKey]) {
            legsByKey[posKey] = [];
            currentPositions[posKey] = null;
        }

        // 订单的带符号数量：
        //   单向持仓：买为正，卖为负
        //   双向持仓 LONG：买为正（开/加多），卖为负（平多）
        //   双向持仓 SHORT：卖为负（开/加空），买为正（平空）
        //   → 符号语义一致，聚合器核心逻辑无需区分
        let remainingAmount = trade.side === 'buy' ? trade.amount : -trade.amount;

        // 使用 while 循环：只要这笔订单还有剩余数量未被分配，就继续处理
        // 应对场景：做多 1 BTC，卖出 3 BTC。循环第一次平掉 1 BTC，第二次反向开空 2 BTC。
        // 注意：双向持仓模式下 posKey 已区分多空，不会发生反转，单向持仓才会触发反转。
        while (Math.abs(remainingAmount) > 1e-8) {
            let pos = currentPositions[posKey];

            if (!pos) {
                // ============== 1. 开新仓 ==============
                // 防御：双向持仓模式 (Hedge Mode) 下，拦截孤立平仓单
                // 在双向持仓下：LONG 频道只应有 BUY 开仓，SHORT 频道只应有 SELL 开仓
                if (ps !== 'BOTH') {
                    const isClosingInHedge = (ps === 'LONG' && remainingAmount < 0) || 
                                           (ps === 'SHORT' && remainingAmount > 0);
                    if (isClosingInHedge) {
                        console.error(`[Edge Case] 发现无头平仓单: ${trade.symbol} ${ps} ${trade.side}, 数量 ${trade.amount}, 时间 ${trade.timestamp.toISOString()}。因内存无底仓，已拦截防止反向开仓。`);
                        remainingAmount = 0;
                        break;
                    }
                }

                pos = {
                    symbol: trade.symbol,
                    baseAsset: trade.baseAsset,
                    quoteAsset: trade.quoteAsset,
                    positionSide: ps,
                    side: remainingAmount > 0 ? 'long' : 'short',
                    openDate: trade.timestamp,
                    status: 'open',
                    trades: [trade], // 记录关联的交易

                    // 核心数据追踪
                    currentSize: remainingAmount,
                    openSize: Math.abs(remainingAmount), // 最大持仓量
                    accumulatedCost: Math.abs(remainingAmount) * trade.price, // 用于算开仓均价
                    accumulatedExitValue: 0, // 用于算平仓均价

                    // 盈亏与费用（commission 统一用 feeUsd，单位始终为 USD）
                    realisedPnL: 0,
                    commission: trade.feeUsd * (Math.abs(remainingAmount) / trade.amount),
                    maxSizeUsd: Math.abs(remainingAmount) * trade.price
                };
                currentPositions[posKey] = pos;
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

                    // 手续费按比例累加（统一用 feeUsd）
                    pos.commission += trade.feeUsd * (absRemaining / trade.amount);

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

                    // 按比例分配手续费（统一用 feeUsd，如果订单被拆分手续费也要拆）
                    pos.commission += trade.feeUsd * (closeAmount / trade.amount);

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
                        legsByKey[posKey].push({...pos});
                        currentPositions[posKey] = null;

                        // 注意：如果 remainingAmount 还不为 0（单向持仓反转场景），
                        // while 循环会继续，在下一次循环走到 "1. 开新仓" 的逻辑。
                    }
                }
            }
        }
    }

    // 扁平化合并已平仓的 Leg 和 当前依然持有的 Leg
    const closedLegs = Object.values(legsByKey).flat();
    const openLegs = Object.values(currentPositions).filter(pos => pos !== null).map(pos => {
        // 给未平仓的 Leg 补充当前均价
        pos.averageEntry = pos.accumulatedCost / Math.abs(pos.currentSize);
        return pos;
    });

    return [...closedLegs, ...openLegs];
}