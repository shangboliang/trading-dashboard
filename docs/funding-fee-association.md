# 资金费用归集文档

## 概述

资金费用（Funding Fee）是合约交易中每 8 小时收取/支付一次的费用。系统会将资金费用归集到对应的持仓（Leg），用于计算真实的净利润。

## 数据模型

### FundingFee 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Int | 主键 |
| apiKeyId | Int | 关联的 API Key |
| legId | Int? | 归集到的 Leg（null 表示未归集） |
| tranId | String? | Binance 流水号，用于去重 |
| incomeType | String | 收入类型：FUNDING_FEE / COMMISSION / REALIZED_PNL |
| asset | String | 资产币种（如 USDT） |
| symbol | String | 交易对（如 BTCUSDT） |
| amount | Float | 资金费金额（负=支付，正=收入） |
| amountUsd | Float | USD 等值金额 |
| timestamp | DateTime | 资金费发生时间 |

### Leg 表相关字段

| 字段 | 类型 | 说明 |
|------|------|------|
| fundingFeeUsd | Float | 持仓期间累计资金费（USD） |
| fundingFeeUpdatedAt | DateTime? | 上次归集时间 |
| netPnL | Float | 最终净利润（见下方计算规则） |

### netPnL 计算规则

净利润的计算取决于资金费归集时间与持仓平仓时间的关系：

| 条件 | netPnL 公式 |
|------|-------------|
| `closeDate` 为 null（未平仓） | `realisedPnLusd - commissionUsd` |
| `fundingFeeUpdatedAt > closeDate` | `realisedPnLusd - commissionUsd + fundingFeeUsd` |
| `fundingFeeUpdatedAt <= closeDate` | `realisedPnLusd - commissionUsd` |
| `fundingFeeUpdatedAt` 为 null | `realisedPnLusd - commissionUsd` |

**核心规则：只有 Leg 已平仓 且 资金费在平仓后归集，才加上 fundingFeeUsd。**

这意味着：
- 平仓之前归集的资金费，不计入该 Leg 的净利润
- 未平仓的持仓，不计算资金费影响
- 只有平仓后才完成归集的资金费，才会计入净利润

## 归集逻辑

### 核心算法

```
对于每条未归集的 FundingFee：
1. 获取该 fee 的 symbol 和 timestamp
2. 查找该用户所有相同 symbol 的 Leg（按 openDate 排序）
3. 找到时间窗口包含该 fee 的 Leg：
   - openDate <= fee.timestamp
   - closeDate === null（未平仓）或 closeDate >= fee.timestamp
4. 将 fee 的 legId 指向匹配的 Leg
5. 重新计算该 Leg 的 fundingFeeUsd 和 netPnL
```

### 归集时机

| 场景 | 触发方式 | 说明 |
|------|----------|------|
| CSV 导入资金费 | 自动 | `syncByCsv` 完成后自动调用 `associateWithLegs` |
| API 同步资金费 | 自动 | `syncByApi` 完成后自动调用 `associateWithLegs` |
| Leg 状态变更 | 自动 | `SyncService.recalculateLegs` 完成后调用 |
| 手动触发 | API | `POST /api/funding/associate` |

### 数据流

```
┌─────────────────────────────────────────────────────────────┐
│                      数据导入                                │
├─────────────────────────────────────────────────────────────┤
│  CSV 文件 / Binance API                                     │
│       ↓                                                     │
│  IncomeCsvService.parseIncomeHistory()                      │
│  - 自动检测分隔符（Tab/逗号）                                 │
│  - 只保留 FUNDING_FEE 类型                                   │
│  - 解析多种日期格式                                          │
│       ↓                                                     │
│  FundingFeeService.saveRecords()                            │
│  - 按 tranId + incomeType 去重                              │
│  - 写入 FundingFee 表                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      归集处理                                │
├─────────────────────────────────────────────────────────────┤
│  FundingFeeService.associateWithLegs(apiKeyId)              │
│       ↓                                                     │
│  1. 查找 legId === null 的 FundingFee                       │
│       ↓                                                     │
│  2. 按 symbol 分组                                          │
│       ↓                                                     │
│  3. 对每个 symbol，查找匹配的 Leg                            │
│     - Leg.openDate <= fee.timestamp                         │
│     - Leg.closeDate === null || Leg.closeDate >= fee.time   │
│       ↓                                                     │
│  4. 更新 fee.legId = leg.id                                 │
│       ↓                                                     │
│  5. 重新计算 Leg 的 fundingFeeUsd                           │
│     - SUM(所有关联的 FundingFee.amountUsd)                   │
│       ↓                                                     │
│  6. 更新 Leg.netPnL                                         │
│     - 仅当 Leg 已平仓 且 fundingFeeUpdatedAt > closeDate     │
│       时才加上 fundingFeeUsd                                  │
│     - 否则 netPnL = realisedPnLusd - commissionUsd            │
│       ↓                                                     │
│  7. 更新 Leg.fundingFeeUpdatedAt = now()                    │
└─────────────────────────────────────────────────────────────┘
```

## CSV 格式要求

### 必填字段

| 字段 | 说明 | 示例 |
|------|------|------|
| 时间 | 资金费发生时间 | 2026/4/27 12:00 |
| 类型 | 收入类型 | FUNDING_FEE |
| 金额 | 资金费金额 | -0.00572446 |
| 交易对 | 交易对名称 | CCUSDT |

### 可选字段

| 字段 | 说明 | 示例 |
|------|------|------|
| 资产 | 资产币种 | USDT |
| 交易ID | Binance 流水号 | 1011155467801067521 |

### 示例 CSV

```
时间	类型	金额	资产	代币名称/币种名称/币对	交易 ID
2026/4/27 12:00	FUNDING_FEE	-0.00572446	USDT	CCUSDT	1011155467801067521
2026/4/27 11:32	COMMISSION	-0.03015	USDT	CFGUSDT	10501011196700
2026/4/27 8:00	FUNDING_FEE	-0.00574636	USDT	CCUSDT	1010551535714304001
```

> 注意：系统只导入类型为 `FUNDING_FEE` 的记录，其他类型（如 COMMISSION、REALIZED_PNL）会被忽略。

## API 接口

### CSV 导入

```
POST /api/funding
Content-Type: multipart/form-data

apiKeyId: number      // API Key ID
file: File            // CSV 文件
headerMapping?: string // JSON 格式的表头映射
```

### API 同步

```
POST /api/funding/sync
Content-Type: application/json

{
  "apiKeyId": number
}
```

### 手动归集

```
POST /api/funding/associate
Content-Type: application/json

{
  "apiKeyId": number
}

Response:
{
  "message": "归集完成：关联 5 条资金费，更新 3 个持仓",
  "associated": 5,
  "legsUpdated": 3
}
```

### 获取列表

```
GET /api/funding?apiKeyId=1&page=1&pageSize=50

Response:
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "pageSize": 50,
    "totalPages": 2
  }
}
```

## 常见问题

### Q: 为什么有些资金费没有关联到 Leg？

A: 可能的原因：
1. 该时间点没有对应的持仓（Leg）
2. Leg 的 openDate/closeDate 时间窗口不包含该资金费时间
3. 交易对不匹配

### Q: 如何重新归集所有资金费？

A: 调用 `POST /api/funding/associate` 接口，传入 apiKeyId。系统会自动查找所有未关联的 fee 并尝试归集。

### Q: 资金费如何影响净利润？

A: 净利润的计算取决于资金费归集时间与持仓平仓时间的关系：

| 条件 | netPnL 公式 |
|------|-------------|
| `closeDate` 为 null（未平仓） | `realisedPnLusd - commissionUsd` |
| `fundingFeeUpdatedAt > closeDate` | `realisedPnLusd - commissionUsd + fundingFeeUsd` |
| `fundingFeeUpdatedAt <= closeDate` | `realisedPnLusd - commissionUsd` |
| `fundingFeeUpdatedAt` 为 null | `realisedPnLusd - commissionUsd` |

**核心规则：只有 Leg 已平仓 且 资金费在平仓后归集，才加上 fundingFeeUsd。**

字段说明：
- `realisedPnLusd`：已实现盈亏（USD）
- `commissionUsd`：手续费（USD）
- `fundingFeeUsd`：资金费（USD，负数表示支付，正数表示收入）

### Q: 为什么需要 fundingFeeUpdatedAt？

A: 用于追踪上次归集时间，支持增量归集和状态监控。在 Leg 列表中可以显示归集状态。
