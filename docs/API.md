# 交易复盘系统 - API 接口文档

## 概述

本文档描述了交易复盘系统后端的所有 RESTful API 接口。

**基本信息**
- **Base URL**: `http://localhost:3000/api`
- **认证方式**: 开发环境使用环境变量 `DEFAULT_USER_ID`
- **数据格式**: JSON

---

## 目录

1. [账户管理 API](#1-账户管理-api)
   - [GET /accounts](#11-get-accounts)
   - [POST /accounts](#12-post-accounts)
   - [GET /accounts/:id](#13-get-accountsid)
   - [PUT /accounts/:id](#14-put-accountsid)
   - [DELETE /accounts/:id](#15-delete-accountsid)

2. [持仓管理 API](#2-持仓管理-api)
   - [GET /legs](#21-get-legs)

3. [数据同步 API](#3-数据同步-api)
   - [POST /sync](#31-post-sync)

4. [统计分析 API](#4-统计分析-api)
   - [GET /analytics/summary](#41-get-analyticssummary)
   - [GET /analytics/pnl-curve](#42-get-analyticspnl-curve)
   - [GET /analytics/by-symbol](#43-get-analyticsby-symbol)

---

## 1. 账户管理 API

### 1.1 GET /accounts

获取用户的所有交易所 API 账户列表。

**请求参数**: 无

**响应示例**:
```json
[
  {
    "id": 1,
    "uuid": "cuid123abc",
    "userId": 1,
    "name": "Binance 主账户",
    "exchange": "BINANCE",
    "apiKey": "masked_key_****",
    "isVerified": true,
    "verifiedAt": "2026-03-31T10:00:00.000Z",
    "lastSyncAt": "2026-03-31T12:00:00.000Z",
    "syncStatus": "COMPLETED",
    "errorMessage": null,
    "createdAt": "2026-03-01T08:00:00.000Z",
    "updatedAt": "2026-03-31T12:00:00.000Z"
  },
  {
    "id": 2,
    "uuid": "cuid456def",
    "userId": 1,
    "name": "OKX 现货账户",
    "exchange": "OKX",
    "apiKey": "masked_key_****",
    "isVerified": false,
    "verifiedAt": null,
    "lastSyncAt": null,
    "syncStatus": "PENDING",
    "errorMessage": null,
    "createdAt": "2026-03-15T09:00:00.000Z",
    "updatedAt": "2026-03-15T09:00:00.000Z"
  }
]
```

**状态码**:
- `200`: 成功
- `500`: 服务器错误

---

### 1.2 POST /accounts

创建新的交易所 API 账户。

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "name": "Bybit 合约账户",
  "exchange": "BYBIT",
  "apiKey": "your-api-key",
  "apiSecret": "your-api-secret",
  "passphrase": "your-passphrase"
}
```

**字段说明**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 账户名称 |
| exchange | string | ✅ | 交易所代码 (BINANCE/OKX/BYBIT/HUOBI/GATEIO/KUCOIN) |
| apiKey | string | ✅ | API Key |
| apiSecret | string | ✅ | API Secret (会被加密存储) |
| passphrase | string | ❌ | API Passphrase (部分交易所需要) |

**响应示例**:
```json
{
  "id": 3,
  "uuid": "cuid789ghi",
  "userId": 1,
  "name": "Bybit 合约账户",
  "exchange": "BYBIT",
  "apiKey": "your-api-key",
  "isVerified": false,
  "verifiedAt": null,
  "lastSyncAt": null,
  "syncStatus": "PENDING",
  "errorMessage": null,
  "createdAt": "2026-03-31T14:00:00.000Z",
  "updatedAt": "2026-03-31T14:00:00.000Z"
}
```

**状态码**:
- `201`: 创建成功
- `400`: 参数错误（缺少必填字段或交易所不支持）
- `500`: 服务器错误

---

### 1.3 GET /accounts/:id

获取单个 API 账户的详细信息。

**路径参数**:
- `id`: 账户 ID (整数)

**请求示例**:
```
GET /api/accounts/1
```

**响应示例**:
```json
{
  "id": 1,
  "uuid": "cuid123abc",
  "userId": 1,
  "name": "Binance 主账户",
  "exchange": "BINANCE",
  "apiKey": "masked_key_****",
  "isVerified": true,
  "verifiedAt": "2026-03-31T10:00:00.000Z",
  "lastSyncAt": "2026-03-31T12:00:00.000Z",
  "syncStatus": "COMPLETED",
  "errorMessage": null,
  "permissions": {
    "read": true,
    "trade": false,
    "withdraw": false
  },
  "createdAt": "2026-03-01T08:00:00.000Z",
  "updatedAt": "2026-03-31T12:00:00.000Z"
}
```

**注意**: 响应中不会包含敏感的 `apiSecret` 和 `passphrase` 字段。

**状态码**:
- `200`: 成功
- `404`: 账户不存在
- `500`: 服务器错误

---

### 1.4 PUT /accounts/:id

更新 API 账户配置。

**路径参数**:
- `id`: 账户 ID (整数)

**请求体**:
```json
{
  "name": "更新后的账户名称",
  "apiKey": "new-api-key",
  "apiSecret": "new-api-secret",
  "passphrase": "new-passphrase"
}
```

**注意**: 所有字段均为可选，只提供需要更新的字段即可。

**响应示例**:
```json
{
  "success": true
}
```

**状态码**:
- `200`: 更新成功
- `404`: 账户不存在
- `500`: 服务器错误

---

### 1.5 DELETE /accounts/:id

删除 API 账户。

**路径参数**:
- `id`: 账户 ID (整数)

**请求示例**:
```
DELETE /api/accounts/1
```

**响应示例**:
```json
{
  "success": true
}
```

**状态码**:
- `200`: 删除成功
- `404`: 账户不存在
- `500`: 服务器错误

**注意**: 删除账户会同时删除关联的所有交易记录和同步日志。

---

## 2. 持仓管理 API

### 2.1 GET /legs

获取持仓/交易记录列表（支持筛选、分页、排序）。

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| status | string | - | 持仓状态：OPEN / CLOSED / PARTIALLY_CLOSED |
| symbol | string | - | 交易对（如 BTCUSDT） |
| side | string | - | 方向：LONG / SHORT |
| startDate | string | - | 开始日期（ISO 8601 格式） |
| endDate | string | - | 结束日期（ISO 8601 格式） |
| page | number | 1 | 页码 |
| pageSize | number | 20 | 每页数量 |
| sortBy | string | openDate | 排序字段：openDate / closeDate / netPnL / duration |
| sortOrder | string | desc | 排序方向：asc / desc |

**请求示例**:
```
GET /api/legs?status=CLOSED&symbol=BTCUSDT&page=1&pageSize=10&sortBy=netPnL&sortOrder=desc
```

**响应示例**:
```json
{
  "data": [
    {
      "id": 1,
      "uuid": "leg-uuid-123",
      "userId": 1,
      "symbol": "BTCUSDT",
      "baseAsset": "BTC",
      "quoteAsset": "USDT",
      "side": "LONG",
      "openDate": "2026-03-15T08:00:00.000Z",
      "openPrice": 62000,
      "closeDate": "2026-03-20T10:00:00.000Z",
      "closePrice": 68000,
      "status": "CLOSED",
      "openAmount": 0.5,
      "closeAmount": 0.5,
      "currentAmount": 0,
      "averageEntry": 62000,
      "averageExit": 68000,
      "realisedPnL": 3000,
      "realisedPnLusd": 3000,
      "unrealisedPnL": null,
      "commission": 0.0005,
      "commissionUsd": 62,
      "netPnL": 2938,
      "sizeUsd": 31000,
      "peakSizeUsd": 34000,
      "duration": 864000,
      "mae": -2.5,
      "mfe": 12.3,
      "entryQuality": 85,
      "exitQuality": 90,
      "strategy": "趋势跟踪",
      "notes": "突破关键阻力位后入场，持有 10 天后获利了结",
      "tags": [
        {
          "id": 1,
          "uuid": "tag-uuid",
          "name": "趋势跟踪",
          "slug": "trend-following",
          "color": "#10b981"
        }
      ],
      "createdAt": "2026-03-15T08:00:00.000Z",
      "updatedAt": "2026-03-20T10:00:00.000Z"
    }
  ],
  "total": 45,
  "page": 1,
  "pageSize": 10,
  "totalPages": 5
}
```

**状态码**:
- `200`: 成功
- `400`: 参数错误
- `500`: 服务器错误

---

## 3. 数据同步 API

### 3.1 POST /sync

触发同步指定 API 账户的历史成交数据到数据库。

**请求头**:
```
Content-Type: application/json
```

**请求体**:
```json
{
  "apiKeyId": 1
}
```

**字段说明**:
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| apiKeyId | number | ✅ | 要同步的账户 ID |

**响应示例**:
```json
{
  "message": "同步成功",
  "tradesImported": 85,
  "legsCreated": 12,
  "legsUpdated": 3,
  "duration": 15.3
}
```

**响应字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| tradesImported | number | 导入的交易记录数量 |
| legsCreated | number | 新建的持仓数量 |
| legsUpdated | number | 更新的持仓数量 |
| duration | number | 耗时（秒） |

**状态码**:
- `200`: 同步成功
- `400`: 参数错误（apiKeyId 为空）
- `404`: 账户不存在
- `500`: 同步失败（可能是 API 密钥无效或交易所限流）

**错误响应示例**:
```json
{
  "error": "Exchange API rate limit exceeded"
}
```

**注意事项**:
1. 同步过程可能需要几分钟，取决于交易历史长度
2. 建议先使用测试数据验证功能，再同步真实账户
3. 某些交易所存在 API 限流，可能需要同步多次

---

## 4. 统计分析 API

### 4.1 GET /analytics/summary

获取交易统计摘要（总体表现）。

**请求参数**: 无

**请求示例**:
```
GET /api/analytics/summary
```

**响应示例**:
```json
{
  "countPositions": 15,
  "countTraders": 1,
  "countTradersInLongPosition": 0,
  "countTradersInShortPosition": 0,
  "totalRealisedPnL": 5248.6,
  "avgRealisedPnL": 349.91,
  "avgDuration": 432000,
  "wins": {
    "countLegs": 10,
    "totalRealisedPnL": 7500,
    "avgRealisedPnL": 750
  },
  "loss": {
    "countLegs": 5,
    "totalRealisedPnL": -2251.4,
    "avgRealisedPnL": -450.28
  },
  "winRate": 0.667,
  "profitFactor": 3.33,
  "totalCommission": 125.5
}
```

**响应字段说明**:
| 字段 | 类型 | 说明 |
|------|------|------|
| countPositions | number | 已平仓数量 |
| totalRealisedPnL | number | 总实现盈亏 |
| avgRealisedPnL | number | 平均单笔盈亏 |
| avgDuration | number | 平均持仓时长（秒） |
| wins.countLegs | number | 盈利次数 |
| wins.totalRealisedPnL | number | 总盈利金额 |
| wins.avgRealisedPnL | number | 平均盈利金额 |
| loss.countLegs | number | 亏损次数 |
| loss.totalRealisedPnL | number | 总亏损金额（负数） |
| loss.avgRealisedPnL | number | 平均亏损金额 |
| winRate | number | 胜率 (0-1) |
| profitFactor | number | 盈亏比 |
| totalCommission | number | 总手续费 |

**状态码**:
- `200`: 成功
- `500`: 服务器错误

---

### 4.2 GET /analytics/pnl-curve

获取累计盈亏曲线数据（用于绘制资金曲线图）。

**查询参数**:
| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| days | number | 30 | 天数范围 |

**请求示例**:
```
GET /api/analytics/pnl-curve?days=30
```

**响应示例**:
```json
[
  {
    "date": "2026-03-01",
    "cumulativePnL": 0,
    "closedLegs": 0
  },
  {
    "date": "2026-03-02",
    "cumulativePnL": 150.5,
    "closedLegs": 1
  },
  {
    "date": "2026-03-03",
    "cumulativePnL": 150.5,
    "closedLegs": 1
  },
  {
    "date": "2026-03-04",
    "cumulativePnL": 890.2,
    "closedLegs": 2
  }
]
```

**响应字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| date | string | 日期（YYYY-MM-DD） |
| cumulativePnL | number | 累计盈亏 |
| closedLegs | number | 当日平仓数量 |

**状态码**:
- `200`: 成功
- `500`: 服务器错误

---

### 4.3 GET /analytics/by-symbol

按交易对统计交易表现。

**请求参数**: 无

**请求示例**:
```
GET /api/analytics/by-symbol
```

**响应示例**:
```json
[
  {
    "symbol": "BTCUSDT",
    "countLegs": 8,
    "winCount": 5,
    "lossCount": 3,
    "winRate": 0.625,
    "totalPnL": 3250.5,
    "avgPnL": 406.31,
    "profitFactor": 2.8
  },
  {
    "symbol": "ETHUSDT",
    "countLegs": 5,
    "winCount": 4,
    "lossCount": 1,
    "winRate": 0.8,
    "totalPnL": 1580.2,
    "avgPnL": 316.04,
    "profitFactor": 5.2
  },
  {
    "symbol": "SOLUSDT",
    "countLegs": 2,
    "winCount": 1,
    "lossCount": 1,
    "winRate": 0.5,
    "totalPnL": -120.5,
    "avgPnL": -60.25,
    "profitFactor": 0.8
  }
]
```

**响应字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| symbol | string | 交易对 |
| countLegs | number | 交易次数 |
| winCount | number | 盈利次数 |
| lossCount | number | 亏损次数 |
| winRate | number | 胜率 |
| totalPnL | number | 总盈亏 |
| avgPnL | number | 平均盈亏 |
| profitFactor | number | 盈亏比 |

**状态码**:
- `200`: 成功
- `500`: 服务器错误

---

## 附录

### A. 枚举值定义

#### Exchange (交易所)
- `BINANCE` - 币安
- `OKX` - 欧易
- `BYBIT` - Bybit
- `HUOBI` - 火币
- `GATEIO` - Gate.io
- `KUCOIN` - KuCoin

#### LegSide (方向)
- `LONG` - 做多
- `SHORT` - 做空

#### LegStatus (持仓状态)
- `OPEN` - 持仓中
- `CLOSED` - 已平仓
- `PARTIALLY_CLOSED` - 部分平仓
- `LIQUIDATED` - 强平
- `CANCELLED` - 已取消

#### SyncStatus (同步状态)
- `PENDING` - 等待同步
- `SYNCING` - 同步中
- `COMPLETED` - 已完成
- `FAILED` - 失败

### B. 错误处理

所有 API 错误统一返回格式：

```json
{
  "error": "错误描述信息"
}
```

常见错误状态码：
- `400` - 请求参数错误
- `404` - 资源不存在
- `500` - 服务器内部错误

### C. 开发环境说明

开发环境下，所有 API 都使用环境变量 `DEFAULT_USER_ID` 来识别当前用户，无需认证。

生产环境需要实现完整的用户认证系统（JWT Token 等）。

---

## 更新日志

| 版本 | 日期 | 说明 |
|------|------|------|
| 1.0 | 2026-03-31 | 初始版本，包含账户管理、持仓管理、数据同步、统计分析功能 |
