# 交易历史复盘仪表盘 - 后端架构与代码解析 (Backend Documentation)

本文档旨在详述目前已生成的 Next.js 全栈后端（方案 A）架构、模块职责及其核心逻辑。该后端采用了 **Next.js API Routes (Serverless) + Prisma ORM + CCXT + PostgreSQL** 组合构建。

## 1. 核心模块与文件结构 (Core Modules)

整个后端的核心职能是将散乱的交易所原子成交记录（Trades），通过本地计算，转换为前端所能直观展示的“交易腿/单笔持仓（Legs/Positions）”，并在此基础上提供多维聚合查询。

```text
src/
├── app/api/                      # Next.js API 路由 (RESTful Endpoints)
│   ├── analytics/summary/route.ts # 提供聚合面板数据 (总盈亏、胜率等)
│   ├── legs/route.ts              # 提供已平仓交易列表 (带分页)
│   └── sync/route.ts              # 触发交易所数据抓取和归集的入口
├── lib/                          # 核心业务逻辑与工具类
│   ├── prisma.ts                  # Prisma 客户端全局单例实例
│   ├── exchange-sync.ts           # CCXT 交易所数据拉取与存库逻辑
│   └── trade-aggregator.ts        # 核心算法：原子成交 -> 完整交易腿 (Trade to Leg)
prisma/
└── schema.prisma                 # 数据库关系模型定义 (User, ApiKey, Trade, Leg)
```

## 2. 数据库模型 (Prisma Schema)

数据模型位于 `prisma/schema.prisma`。
其核心关系为：`User` 拥有多个 `ApiKey`；通过 `ApiKey` 从交易所拉取无数条 `Trade`（原子成交）；后端将 `Trade` 归集后生成 `Leg`（交易持仓）。
*   **Trade (原子成交)**：代表交易所里每一笔真实发生的买卖（含手续费、买卖方向、数量、价格）。
*   **Leg (交易腿)**：代表用户从“空仓 -> 建仓 -> 平仓 -> 空仓”的一个完整生命周期。包含 `realisedPnL` (已实现盈亏), `duration` (持仓时间), `averageEntry` (平均入场价) 等复合指标。

## 3. 核心业务逻辑解析 (Core Business Logic)

### 3.1 交易所数据同步引擎 (`src/lib/exchange-sync.ts`)
当接收到同步请求时，该引擎执行以下流水线：
1.  **鉴权与连接**：从数据库读取指定用户的 `ApiKey`，利用解密后的秘钥实例化 `ccxt` 对应的交易所客户端（如 Binance）。
2.  **数据拉取**：调用 `exchange.fetchMyTrades(symbol)` 获取原始历史成交。
3.  **持久化原始数据**：利用 Prisma 的 `upsert` 操作，按交易所提供的 `Trade ID` 作为主键存入 `Trade` 表，防止重复同步。
4.  **触发归集**：将从数据库或接口新拿到的 `Trade` 数组传递给核心算法 `aggregateTradesToLegs`。
5.  **落库存档**：遍历归集生成的 `Leg`，将所有状态为 `closed`（已平仓）的交易记录写入 `Leg` 表中供前端查询。

### 3.2 核心归集算法：Trade to Leg Aggregator (`src/lib/trade-aggregator.ts`)
这是系统的心脏，负责**先进先出 (FIFO)** 的成本均价计算。
*   **分组处理**：首先按币种 (`symbol`) 分组，确保 BTC 和 ETH 的成交独立计算。
*   **状态维护**：维护一个 `currentSize` 变量记录当前持仓净头寸（正数为多头，负数为空头），以及 `accumulatedCost` 记录当前持仓的总成本。
*   **逻辑分支**：
    *   **开新仓 (isOpening & currentSize === 0)**：初始化一个新的 Leg 对象，记录 `openDate`。
    *   **顺势加仓 (isOpening & currentSize !== 0)**：累加持仓规模和成本，但不计算盈亏。动态更新该单的最大名义价值 (`maxSizeUsd`)。
    *   **逆势减仓/平仓 (isClosing)**：
        1.  通过 `accumulatedCost / Math.abs(currentSize)` 算出**当前平均持仓成本价**。
        2.  根据本次反向订单的成交价与均价的差额，结算**已实现盈亏 (Realised PNL)**。
        3.  按比例扣减总成本。
        4.  当 `currentSize` 归零时，标记该 Leg 为 `closed`，计算最终平均出场价和持仓持续时间 (`duration`)。

### 3.3 实时聚合分析 API (`src/app/api/analytics/summary/route.ts`)
利用 PostgreSQL 的强大计算能力（通过 Prisma 封装）实时响应前端的 Dashboard 请求。
*   摒弃了在应用内存中进行海量数组遍历的低效做法。
*   使用了 Prisma 的聚合操作 (`aggregate`)：
    *   `_sum: { realisedPnLusd: true }`：一键求和计算总盈亏。
    *   `_count: { id: true }`：统计交易总笔数。
    *   `_avg: { duration: true }`：计算平均持仓时间。
*   通过 `where` 条件分别过滤出 `realisedPnLusd > 0` 的订单作为**盈利单 (Wins)**，以及 `<= 0` 的订单作为**亏损单 (Losses)**，将结构完美组装成前端所需格式返回。

## 4. 后续部署与对接指南

目前所有的前端组件 (`page.tsx`, `Overview.tsx` 等) 仍然绑定在 `src/mock/data.ts` 的静态数据上。

**若需切换至真实后端，请遵循以下步骤：**

1.  **配置数据库连接**：
    安装并运行本地 PostgreSQL 实例。复制 `.env.example` 为 `.env`，填入真实的 `DATABASE_URL`。
2.  **同步表结构 (Migration)**：
    运行 `npx prisma db push` 或 `npx prisma migrate dev`，将 `schema.prisma` 中的定义映射到真实的 PostgreSQL 数据表中。
3.  **修改前端数据获取逻辑**：
    在相应的 React 组件（如页面级别）中，引入数据获取逻辑（可以使用 SWR, React Query 或原生的 fetch API）。
    *   将读取 `MOCK_SUMMARY` 改为调用 `fetch('/api/analytics/summary')`
    *   将读取 `MOCK_LEGS` 改为调用 `fetch('/api/legs?limit=50')`
4.  **编写安全层**：
    生产环境中，必须在 API Routes 顶部加入身份验证（如 `NextAuth.js` 的 `getServerSession`），并在存储 `ApiKey` 前加入高强度的对称加解密逻辑（如 `AES-256-GCM`）。