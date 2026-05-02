# 数据同步与 Leg 字段说明文档

## 目录

1. [API 同步流程](#1-api-同步流程)
2. [CSV 同步流程](#2-csv-同步流程)
3. [交易归集计算逻辑](#3-交易归集计算逻辑)
4. [Leg 表字段详解](#4-leg-表字段详解)
5. [MAE/MFE 计算](#5-maemfe-计算)

---

## 1. API 同步流程

### 1.1 概述

API 同步通过 CCXT 库连接交易所（主要支持币安），自动拉取历史成交记录并聚合成 Leg（持仓头寸）。

### 1.2 核心流程

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API 同步主流程                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. 并发拦截                                                                 │
│     └→ 检查 syncStatus，防止重复同步                                        │
│                                                                              │
│  2. 时间范围确定                                                             │
│     ├→ 首次同步：最近 90 天                                                  │
│     └→ 增量同步：最后一条交易时间 - 5分钟缓冲                                │
│                                                                              │
│  3. 时间切片（最大 90 天一块）                                               │
│     └→ createTimeChunks()                                                   │
│                                                                              │
│  4. 活跃币种发现（精准定向）                                                 │
│     ├→ 调用 fapiPrivateGetIncome({ incomeType: 'COMMISSION' })              │
│     ├→ 自动分页处理（limit=1000）                                           │
│     └→ 提取去重 symbol，转换为 CCXT 格式                                    │
│                                                                              │
│  5. 精准拉取交易记录                                                         │
│     └→ 仅遍历活跃币种，调用 fetchMyTrades                                   │
│                                                                              │
│  6. 数据解析与去重                                                           │
│     ├→ 转换为 RawTrade 格式                                                 │
│     └→ 基于 fingerprint 去重                                                │
│                                                                              │
│  7. 批量保存到数据库                                                         │
│     └→ prisma.trade.createMany({ skipDuplicates: true })                    │
│                                                                              │
│  8. 全量重聚合                                                               │
│     └→ aggregateTradesToLegs() → 生成 Leg                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 关键函数

#### `syncApiKey(apiKeyId, forceSync?)`

主同步函数，协调整个同步流程。

**参数：**
- `apiKeyId`: API Key 的数据库 ID
- `forceSync`: 强制同步标志（当时间超过 90 天时，前端确认后传入）

**返回：**
```typescript
interface SyncResult {
  tradesFound: number;    // 发现的交易数量
  tradesImported: number; // 新导入的交易数量
  legsCreated: number;    // 新创建的 Leg 数量
  legsUpdated: number;    // 更新的 Leg 数量
}
```

#### `createTimeChunks(startTime, endTime, chunkMs)`

将大时间范围切分为多个小块。

**参数：**
- `startTime`: 起始时间戳（ms）
- `endTime`: 结束时间戳（ms）
- `chunkMs`: 每块大小（ms），默认 90 天

**返回：** `Array<[start, end]>`

#### `fetchIncomeWithPagination(exchange, incomeType, startTime, endTime)`

带自动分页的 Income History 拉取。

**核心逻辑：**
- 满页（1000 条）则继续拉取
- 使用最后一条记录的时间作为下一页起点
- 处理 time 字段可能是字符串的情况

#### `fetchActiveSymbolsViaCommission(exchange, startTime, endTime, markets)`

通过 COMMISSION 记录发现活跃币种。

**返回：**
```typescript
{
  ccxtSymbols: string[];    // 可处理的 CCXT 格式 symbol
  skippedSymbols: string[]; // 已下架跳过的 symbol
}
```

### 1.4 时间范围逻辑

| 场景 | 行为 |
|------|------|
| 首次同步 | 最近 90 天 |
| 增量同步 (< 90天) | 从最后交易时间开始 |
| 增量同步 (> 90天) | 抛出 `SyncTimeRangeError`，前端弹出确认框 |

### 1.5 分页策略

```
┌─────────────────────────────────────────────────────────────────┐
│                      分页处理逻辑                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Income History (fapiPrivateGetIncome)                           │
│  ├─ limit = 1000                                                │
│  ├─ 满页 → lastTime + 1 作为下一页 startTime                    │
│  └─ 未满页 → 结束                                               │
│                                                                  │
│  User Trades (fetchMyTrades)                                     │
│  ├─ limit = 1000                                                │
│  ├─ 时间窗口 = 7天（Binance 限制）                              │
│  ├─ 满页 → lastTimestamp 作为下一页 startTime                   │
│  └─ 未满页 → 跳到下一个 7天窗口                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. CSV 同步流程

### 2.1 概述

CSV 同步支持导入币安导出的成交历史 CSV 文件，适用于无法通过 API 获取的历史数据。

### 2.2 支持的格式

- 逗号分隔（标准 CSV）
- Tab 分隔（TSV）
- 自动检测分隔符

### 2.3 默认表头映射

| CSV 列名 | 数据库字段 | 说明 |
|----------|-----------|------|
| `Time(UTC)` / `Date(UTC)` | `timestamp` | 交易时间 |
| `Symbol` | `symbol` | 交易对 |
| `Side` | `side` | 买卖方向 |
| `Position Side` | `positionSide` | 仓位方向 (LONG/SHORT/BOTH) |
| `Price` | `price` | 成交价格 |
| `Quantity` / `Qty` | `amount` | 成交数量 |
| `Fee` / `Commission` | `fee` | 手续费数量 |
| `Fee Asset` / `Commission Asset` | `feeAsset` | 手续费币种 |
| `Trade Id` | `tradeId` | 成交 ID |
| `Order Id` | `orderId` | 订单 ID |

### 2.4 自定义表头映射

如果 CSV 列名与默认不同，可通过 `headerMapping` 参数自定义：

```typescript
interface HeaderMapping {
  time?: string;         // 时间列名
  symbol?: string;       // 交易对列名
  side?: string;         // 方向列名
  positionSide?: string; // 仓位方向列名
  price?: string;        // 价格列名
  quantity?: string;     // 数量列名
  fee?: string;          // 手续费列名
  feeAsset?: string;     // 手续费币种列名
  tradeId?: string;      // 成交ID列名
  orderId?: string;      // 订单ID列名
}
```

### 2.5 处理流程

```
CSV 文件上传
    ↓
BinanceCsvService.parseTradeHistory()
    ├─ 自动检测分隔符
    ├─ 解析表头
    ├─ 逐行解析为 RawTrade
    └─ 生成唯一 fingerprint ID
    ↓
saveTradesBatch()
    └─ prisma.trade.createMany({ skipDuplicates: true })
    ↓
recalculateLegs()
    └─ aggregateTradesToLegs()
```

---

## 3. 交易归集计算逻辑

### 3.1 核心概念

**Leg（持仓头寸）**：一个完整的交易生命周期，从开仓到平仓。

**归集引擎**：将多笔底层 Trade 聚合成一个 Leg，支持：
- 加仓
- 部分减仓
- 完全平仓
- 仓位反转（超额平仓）

### 3.2 归集键（Position Key）

```
单向持仓: symbol (如 "BTCUSDT")
双向持仓: symbol-positionSide (如 "BTCUSDT-LONG", "BTCUSDT-SHORT")
```

### 3.3 归集算法

```
按时间升序处理每笔 Trade
    ↓
┌─────────────────────────────────────────────────────────────────┐
│                      仓位状态判断                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 无当前仓位 → 开新仓                                          │
│     ├─ currentSize = amount (正=多, 负=空)                       │
│     ├─ accumulatedCost = amount * price                          │
│     └─ commission = feeUsd                                       │
│                                                                  │
│  2. 有仓位且同方向 → 加仓                                        │
│     ├─ currentSize += amount                                     │
│     ├─ accumulatedCost += amount * price                         │
│     └─ commission += feeUsd * (amount / totalAmount)             │
│                                                                  │
│  3. 有仓位且反方向 → 减仓/平仓/反转                              │
│     ├─ closeAmount = min(|currentSize|, |remaining|)             │
│     ├─ realisedPnL += closeAmount * (price - avgEntry) * factor  │
│     ├─ accumulatedExitValue += closeAmount * price               │
│     ├─ accumulatedCost -= closeAmount * avgEntry                 │
│     ├─ currentSize 趋向 0                                        │
│     └─ 如果 currentSize = 0 → 结算闭环                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.4 盈亏计算公式

```typescript
// 加权平均开仓价
averageEntry = accumulatedCost / |currentSize|

// 加权平均平仓价
averageExit = accumulatedExitValue / openSize

// 已实现盈亏（多头）
realisedPnL = closeAmount * (exitPrice - averageEntry)

// 已实现盈亏（空头）
realisedPnL = closeAmount * (averageEntry - exitPrice)

// 净利润
netPnL = realisedPnLusd - commissionUsd + fundingFeeUsd
```

### 3.5 手续费处理

- **BNB 抵扣**：通过 `quoteQty * 0.00075` 估算 USD 等值
- **稳定币直接扣**：直接使用 feeUsd
- **按比例分配**：加仓/减仓时按数量比例分配手续费

---

## 4. Leg 表字段详解

### 4.1 基础信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | Int | 内部主键，自增 |
| `uuid` | String | 外部唯一标识，cuid 生成 |
| `userId` | Int | 所属用户 ID |
| `symbol` | String | 交易对名称，如 "BTCUSDT" |
| `baseAsset` | String | 基础资产，如 "BTC" |
| `quoteAsset` | String | 计价资产，如 "USDT" |
| `side` | LegSide | 仓位方向：`LONG`(做多) / `SHORT`(做空) |

### 4.2 时间信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `openDate` | DateTime | 首次建仓时间（第一笔开仓 Trade 的时间） |
| `closeDate` | DateTime? | 完全平仓时间 |
| `duration` | Int? | 持仓时长（秒），即 `closeDate - openDate` |

### 4.3 价格信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `openPrice` | Float | 首笔开仓的成交价格 |
| `closePrice` | Float? | 完全平仓时的出场价格 |
| `averageEntry` | Float | 加权平均开仓成本价 |
| `averageExit` | Float? | 加权平均平仓出场价 |

### 4.4 数量信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `openAmount` | Float | 累计最大开仓数量（历史峰值仓位大小） |
| `closeAmount` | Float? | 累计已经平仓的数量 |
| `currentAmount` | Float | 当前尚未平仓的剩余数量 |

### 4.5 状态信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | LegStatus | 头寸当前状态 |

**LegStatus 枚举值：**

| 值 | 说明 |
|----|------|
| `OPEN` | 持仓中 |
| `CLOSED` | 已平仓 |
| `PARTIALLY_CLOSED` | 部分平仓 |
| `LIQUIDATED` | 已强平 |
| `CANCELLED` | 已取消 |

### 4.6 盈亏信息

| 字段 | 类型 | 说明 |
|------|------|------|
| `realisedPnL` | Float | 已实现盈亏（按计价币种算，如 USDT） |
| `realisedPnLusd` | Float | 转换为 USD 的已实现盈亏 |
| `unrealisedPnL` | Float? | 浮动盈亏（当前未平仓部分按最新市价算出的账面盈亏） |
| `commission` | Float | 累计消耗的交易手续费（原币种） |
| `commissionUsd` | Float | 转换为 USD 的手续费 |
| `fundingFeeUsd` | Float | 持仓期间累计产生的资金费（负=支付，正=收入），USD 计价 |
| `netPnL` | Float | 最终净利润 = `realisedPnLusd - commissionUsd + fundingFeeUsd` |

### 4.7 仓位规模

| 字段 | 类型 | 说明 |
|------|------|------|
| `sizeUsd` | Float | 仓位初始的名义价值（转换为 USD） |
| `peakSizeUsd` | Float? | 持仓期间仓位达到的最大名义价值（反映极限资金占用情况） |

### 4.8 质量指标

| 字段 | 类型 | 说明 |
|------|------|------|
| `mae` | Float? | MAE (Max Adverse Excursion) - 最大不利波动，持仓期间最大浮亏 |
| `mfe` | Float? | MFE (Max Favorable Excursion) - 最大有利波动，持仓期间最大浮盈 |
| `entryQuality` | Float? | 进场质量得分 (0-100%)，评价买点好坏 |
| `exitQuality` | Float? | 出场质量得分 (0-100%)，评价卖点好坏 |

### 4.9 复盘元数据

| 字段 | 类型 | 说明 |
|------|------|------|
| `notes` | String? | 用户的自由格式交易笔记/心得 |
| `strategy` | String? | 使用的交易策略名称（如：突破、均值回归、SMC） |
| `setup` | String? | 交易形态/Setup（如：头肩底、2B法则） |
| `mistakes` | String? | 犯错记录（如：FOMO、扛单、没设止损） |
| `snapshotData` | Json? | 交易快照数据（用于还原开仓时的前端图表截图、指标参数等） |

### 4.10 时间戳

| 字段 | 类型 | 说明 |
|------|------|------|
| `createdAt` | DateTime | Leg 记录生成时间 |
| `updatedAt` | DateTime | 状态最后更新时间 |
| `fundingFeeUpdatedAt` | DateTime? | 上次资金费归集时间 |

---

## 5. MAE/MFE 计算

### 5.1 概述

MAE/MFE 服务基于 K 线数据，为已平仓的 Leg 计算：

- **MAE (Max Adverse Excursion)**：持仓期间最大逆向价格波动（体现实际承受的最大浮亏）
- **MFE (Max Favorable Excursion)**：持仓期间最大顺向价格波动（体现最大浮盈机会）

### 5.2 计算公式

```typescript
// 进场质量
entryQuality = MFE / (MFE + MAE) × 100
// 越高说明开仓时机越好

// 出场质量
exitQuality = (exitPrice - worstPrice) / (bestPrice - worstPrice) × 100
```

### 5.3 K 线选择策略

根据持仓时长动态选择 timeframe：

| 持仓时长 | Timeframe | 说明 |
|----------|-----------|------|
| < 1 小时 | 1m | 1 分钟 K 线 |
| < 6 小时 | 5m | 5 分钟 K 线 |
| < 24 小时 | 15m | 15 分钟 K 线 |
| ≥ 24 小时 | 1h | 1 小时 K 线 |

### 5.4 计算流程

```
选择需要计算的 Leg (已平仓且 mae 为 null)
    ↓
根据持仓时长选择 timeframe
    ↓
拉取 K 线数据 (fetchOHLCV)
    ↓
遍历 K 线，记录最高价和最低价
    ↓
计算 MAE 和 MFE
    ↓
计算进场质量和出场质量
    ↓
更新 Leg 表
```

---

## 6. 相关文件

| 文件 | 说明 |
|------|------|
| `src/services/SyncService.ts` | 核心同步服务 |
| `src/services/BinanceCsvService.ts` | CSV 解析服务 |
| `src/services/FundingFeeService.ts` | 资金费同步服务 |
| `src/services/MaeMfeService.ts` | MAE/MFE 计算服务 |
| `src/lib/trade-aggregator.ts` | 交易归集引擎 |
| `src/lib/trade-identity.ts` | 交易指纹/去重 |
| `prisma/schema.prisma` | 数据库 Schema |
