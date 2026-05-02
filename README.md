# Trading Dashboard

加密货币合约交易复盘系统。从交易所同步交易数据，自动聚合为持仓（Leg），提供 P&L 分析、MAE/MFE、资金费率、交易日历、AI 报告等功能。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **数据库**: PostgreSQL + Prisma ORM
- **交易所**: CCXT (支持 Binance、OKX、Bybit 等)
- **图表**: ECharts、Lightweight Charts
- **UI**: Tailwind CSS + Lucide Icons
- **认证**: Session-based + scrypt 密码哈希
- **加密**: AES-256-GCM (交易所 API Secret 加密存储)

## 功能

- 交易所 API Key 管理（支持多交易所、多账户）
- 交易数据同步（实时 + 异步年度历史拉取）
- 自动交易聚合：原始成交 → 持仓 Leg（开仓/加仓/平仓/反转）
- 盈亏分析：已实现 P&L、手续费、资金费率、净利润
- MAE/MFE 分析（最大不利/有利波动）
- 交易日历视图
- 多维度分析仪表盘（按币种、策略、方向等）
- 标签系统（策略分类、情绪标记）
- AI 交易报告生成（支持 OpenAI / Claude / Gemini）
- CSV 数据导入

## 注意事项

- **交易所支持**：优先推荐使用 Binance，其他交易所（OKX、Bybit 等）未经过充分调试。
- **数据隔离**：用户级别数据已做隔离（Leg、Tag 等均绑定 userId），但 API Key 下挂的 Trade 数据尚未完成用户归属隔离。

## 快速开始

### 环境要求

- Node.js 18+
- PostgreSQL

### 首次安装到启动

```bash
# 0. 安装 PostgreSQL（如果尚未安装）
#    Windows: https://www.postgresql.org/download/windows/ 下载安装
#    macOS:   brew install postgresql && brew services start postgresql
#    Linux:   sudo apt install postgresql
#    安装后确保 postgres 服务已启动，并创建数据库：
#    createdb tradingdb
#    注意：数据库的用户名和密码要与下面 .env 中 DATABASE_URL 里配置的一致

# 1. 安装依赖
npm install

# 2. 生成加密密钥（用于加密交易所 API Secret）
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 3. 创建 .env 文件，填入以下内容
```

```env
DATABASE_URL="postgresql://user:password@localhost:5432/tradingdb?schema=public"
ENCRYPTION_KEY="<上一步生成的 64 位 hex 字符串>"
# HTTPS_PROXY="http://127.0.0.1:7890"     # 可选，有代理就填
```

```bash
# 4. 初始化数据库
npx prisma migrate deploy
npx prisma generate

# 5. 启动开发服务器
npm run dev
```

## 常用命令

```bash
npm run dev              # 开发服务器
npm run build            # 生产构建
npm run lint             # ESLint 检查
npm run db:migrate       # 创建迁移（检测 drift 会自动重置，慎用）
npm run db:push          # Schema 同步（无迁移文件）
npm run test:sync        # 测试交易所同步
```

## 数据库安全

生产环境有真实交易数据，**绝对不能随意重置数据库**。

- `npx prisma migrate deploy` — 安全，只应用迁移
- `npx prisma migrate dev` — 检测到 drift 时会自动重置（丢数据）
- `npm run db:danger:reset` — 需交互确认

添加新字段的安全流程：
1. 修改 `prisma/schema.prisma`
2. `npx prisma migrate dev --name 描述性名称`（首次）
3. `npx prisma migrate deploy`（应用）
4. `npx prisma generate`（重新生成 Client）

> Windows 下需先停止 dev server 再 `prisma generate`，否则 DLL 会被锁定。

## 项目结构

```
src/
  app/             # Next.js App Router 页面 + API 路由
    api/           # REST 端点
    accounts/      # 账户管理
    analytics/     # 分析仪表盘
    calendar/      # 交易日历
    reports/       # 报告视图
  components/      # React 组件
  lib/             # 核心逻辑（认证、Prisma、交易聚合）
  services/        # 业务服务（SyncService、ApiKeyService 等）
  utils/           # 工具函数（加密）
prisma/
  schema.prisma    # 数据库模型定义
  migrations/      # SQL 迁移
scripts/           # CLI 工具
```

## 核心数据模型

| 模型 | 说明 |
|------|------|
| **Trade** | 原始成交记录，不可变，按指纹去重 |
| **Leg** | 聚合持仓（开仓→平仓），核心复盘单元 |
| **ApiKey** | 交易所凭证，Secret 加密存储 |
| **FundingFee** | 资金费率流水 |
| **Tag** | 标签系统（策略/情绪分类） |
| **AiReport** | AI 生成的交易分析报告 |

## 数据流

```
交易所 API (CCXT) / CSV 导入
  → SyncService → Trade 表（原始成交）
    → trade-aggregator → Leg 表（聚合持仓）
      → P&L / MAE-MFE / 资金费率分析
```
