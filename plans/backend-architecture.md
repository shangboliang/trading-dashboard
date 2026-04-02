# 后端实施蓝图 (Backend Implementation Roadmap)

## 1. 核心技术栈
- **Runtime**: Node.js (Next.js API Routes).
- **ORM**: Prisma - 用于类型安全的数据库操作。
- **Database**: PostgreSQL (推荐 Supabase 或本地部署) - 存储海量成交记录。
- **Exchange SDK**: `ccxt` - 统一对接全球各大加密货币交易所的标准化库。
- **Auth**: NextAuth.js - 处理登录与 Session。

## 2. 关键业务流程

### A. 数据同步引擎 (Data Sync Engine)
1.  用户提交 API Key 后，后台启动 Worker。
2.  使用 `ccxt.fetchMyTrades()` 获取历史成交。
3.  对获取的 Trades 进行 **Leg-Grouping (归集算法)**。
    -   *FIFO 算法*: 先进先出，匹配买卖单。
    -   *Cost Basis*: 计算加权平均成本。
4.  将计算后的 `Leg` 写入数据库。

### B. 聚合分析引擎 (Analytics API)
为了支撑前端复杂的图表，后端需要实现以下聚合 API：

#### 1. `GET /api/analytics/summary`
- 使用 SQL `GROUP BY` 计算总盈亏、胜率、平均盈亏比。
- 逻辑：`SELECT SUM(realisedPnL), COUNT(*) FROM Leg WHERE status = 'closed'`。

#### 2. `GET /api/analytics/datetime`
- 按时间分桶聚合。
- 逻辑：使用 PostgreSQL 的 `date_trunc` 函数按小时或工作日统计盈亏分布。

#### 3. `GET /api/analytics/size-buckets`
- 交易规模分层。
- 逻辑：使用 SQL `CASE WHEN` 将 `sizeUsd` 划分为不同区间（如 $0-100, $100-500 等），统计各区间的胜负。

#### 4. `GET /api/performance/candles`
- 代理请求交易所 K 线数据。
- 逻辑：前端传入 `symbol` 和 `startTime/endTime`，后端通过 CCXT 转发给交易所并缓存结果。

## 3. 安全性设计
- **API Key 加密**: 在数据库存储前，必须使用 AES-256 对 `apiSecret` 进行加密。
- **速率限制 (Rate Limiting)**: 针对同步任务设置频率限制，防止交易所封禁 IP。
- **冷数据归档**: 超过一年的 Trade 明细可以归档，仅保留 Leg 汇总数据。

## 4. 下一步计划
1.  配置 `.env` 文件（数据库连接字符串）。
2.  运行 `npx prisma db push` 同步模型到数据库。
3.  编写 `src/lib/ccxt.ts` 交易所对接客户端。
4.  实现 `Leg-Maker` 归集工具类。
