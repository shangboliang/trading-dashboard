# 交易复盘系统 - 前端架构文档

## 1. 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router)，全客户端渲染 (`"use client"`) |
| 语言 | TypeScript |
| 样式 | Tailwind CSS，自定义暗色主题，`cn()` = `clsx` + `tailwind-merge` |
| 图表 | ECharts (`echarts-for-react`) + Lightweight Charts (TradingView K线) |
| 图标 | Lucide React |
| 状态 | React `useState` / `useMemo` / `useEffect`，无外部状态库 |
| 数据 | 统一 API 客户端 `src/lib/api-client.ts`，基于 `fetch()` |

## 2. 目录结构

```
src/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 根布局（暗色主题 + AppShell）
│   ├── page.tsx                # 仪表盘首页 "/"
│   ├── login/page.tsx          # 登录页
│   ├── register/page.tsx       # 注册页
│   ├── accounts/page.tsx       # 账户管理（API Key + AI 配置）
│   ├── analytics/page.tsx      # 深度分析仪表盘
│   ├── calendar/page.tsx       # 交易日历
│   ├── reports/page.tsx        # AI 报告
│   ├── sync/page.tsx           # 数据同步中心
│   └── api/                    # 32 个 API 路由（见第 5 节）
├── components/                 # UI 组件
│   ├── AppShell.tsx            # 根壳：侧边栏 + 主内容 + 页脚
│   ├── Sidebar.tsx             # 可折叠导航栏
│   ├── Card.tsx                # 通用卡片容器（cn() 工具函数）
│   ├── Overview.tsx            # 8 指标 KPI 卡片组
│   ├── TradeDetail.tsx         # Leg 详情弹窗
│   ├── NetWorthDisplay.tsx     # 页脚余额展示
│   ├── AiConfigModal.tsx       # AI 配置弹窗
│   ├── KLineChart.tsx          # K线图（lightweight-charts）
│   ├── ProfitCalendar.tsx      # GitHub 风格热力图日历
│   ├── CumulativePnLChart.tsx  # PnL 曲线
│   ├── DailyPerformanceChart.tsx   # 每日盈亏柱状图
│   ├── HourlyPerformanceChart.tsx  # 小时维度盈亏
│   ├── WeekdayPerformanceChart.tsx # 星期维度盈亏
│   ├── TradeDurationChart.tsx  # 持仓时长分布
│   ├── TradeSizeChart.tsx      # 交易规模分布
│   └── WinRateCircleChart.tsx  # 胜率环形图
└── lib/
    ├── api-client.ts           # 统一 API 客户端（40+ 方法）
    ├── auth.ts                 # 认证逻辑（scrypt + Session）
    ├── auth-constants.ts       # Cookie 名称等常量
    ├── prisma.ts               # Prisma Client 单例
    └── trade-aggregator.ts     # 交易聚合引擎
```

## 3. 根布局与壳

### layout.tsx
- `lang="zh-CN"`，`className="dark"`，硬编码暗色主题
- 全局字体：`font-sans`
- 所有页面包裹在 `<AppShell>` 中

### AppShell.tsx
- 检测 `/login`、`/register` → 无侧边栏/页脚，直接渲染子组件
- 其他页面 → `<Sidebar>`（左） + `<main>`（径向渐变背景，可滚动） + `<footer>`（余额 + 链接）

### Sidebar.tsx
- 6 个导航项：首页、分析、日历、同步、报告、账户
- 可折叠，显示用户信息和登出按钮

## 4. 页面功能概览

### 仪表盘 (`/`)
- 筛选栏：时间范围（7d/30d/90d/自定义）、账户、币种搜索
- `<Overview>`：8 个 KPI 卡片（总 PnL、胜率、交易数、期望值、平均 PnL、平均持仓时长、盈亏比、总手续费）
- `<CumulativePnLChart>`：累计 PnL 曲线
- 交易历史表格：分页 Leg 列表，点击打开 `<TradeDetail>` 弹窗
- 同步弹窗：快速按账户同步

### 分析 (`/analytics`)
深度分析仪表盘，包含多维度图表：
- PnL 曲线、每日/小时/星期盈亏分布
- 持仓时长分布、交易规模分布、胜率环形图
- 按币种统计

### 日历 (`/calendar`)
- GitHub 风格热力图，展示每日盈亏
- 点击日期查看当日交易明细

### 同步 (`/sync`)
- 交易所 API 同步
- CSV 文件导入
- 币安异步年度历史拉取
- MAE/MFE 计算

### 报告 (`/reports`)
- AI 生成的交易分析报告
- 支持 OpenAI / Claude / Gemini

### 账户 (`/accounts`)
- API Key 管理（CRUD + 验证）
- AI 模型配置管理

## 5. API 路由

共 32 个路由文件，全部在 `src/app/api/` 下：

### 认证 (`/api/auth/`)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 登出 |
| GET | `/api/auth/me` | 获取当前用户 |
| POST | `/api/auth/register` | 注册 |

### 账户 (`/api/accounts/`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/accounts` | 列表/创建 |
| GET/PUT/DELETE | `/api/accounts/[id]` | 详情/更新/删除 |
| GET | `/api/accounts/balance` | 账户余额 |

### 同步 (`/api/sync/`)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sync` | API 同步 |
| POST | `/api/sync/csv` | CSV 导入 |
| POST | `/api/sync/csv/headers` | CSV 表头检测 |
| POST | `/api/sync/asyn-request` | 币安异步导出请求 |
| GET | `/api/sync/asyn-status` | 轮询异步状态 |
| POST | `/api/sync/mae-mfe` | MAE/MFE 计算 |

### Legs (`/api/legs/`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/legs` | 分页列表（支持筛选） |
| GET/PUT | `/api/legs/[id]` | 详情/更新（笔记、标签等） |

### 分析 (`/api/analytics/`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/analytics/summary` | 汇总统计 |
| GET | `/api/analytics/pnl-curve` | PnL 曲线 |
| GET | `/api/analytics/by-symbol` | 按币种统计 |
| GET | `/api/analytics/weekday` | 星期维度 |
| GET | `/api/analytics/hourly` | 小时维度 |
| GET | `/api/analytics/duration` | 持仓时长分布 |
| GET | `/api/analytics/size` | 交易规模分布 |
| GET | `/api/analytics/daily` | 每日盈亏 |

### 资金费 (`/api/funding/`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/funding` | 列表/CSV 导入 |
| POST | `/api/funding/headers` | CSV 表头检测 |
| POST | `/api/funding/sync` | API 同步资金费 |
| POST | `/api/funding/associate` | 归集到 Leg |

### AI 报告 (`/api/ai/`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET/POST | `/api/ai` | 列表/生成报告 |
| GET/DELETE | `/api/ai/[id]` | 详情/删除 |
| GET/POST | `/api/ai/config` | AI 配置列表/创建 |
| GET/PUT/DELETE | `/api/ai/config/[id]` | AI 配置 CRUD |

### K线 (`/api/klines/`)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/klines` | 获取 K 线数据（CCXT） |

## 6. API 客户端

`src/lib/api-client.ts` 封装了所有前端数据请求：

- **基础方法**：`apiGet`、`apiPost`、`apiPut`、`apiDelete` — 基于 `fetch()`，自动解析 JSON 和错误
- **业务命名空间**：`authApi`、`legsApi`、`accountsApi`、`fundingApi`、`analyticsApi`、`aiApi`
- **类型定义**：`Leg`、`ApiAccount`、`SummaryStats`、`PnLPoint`、`GlobalFilter` 等
- **文件上传**：CSV 导入使用 `FormData` + 直接 `fetch()`
- **认证**：依赖 httpOnly cookie 自动携带，客户端无需额外处理

## 7. 主题与样式

### 配色方案（TradingView 风格暗色主题）

| Token | Hex | 用途 |
|-------|-----|------|
| `background` | `#0f1115` | 主背景 |
| `panel` | `#1e222d` | 卡片/弹窗背景 |
| `border` | `#2b313f` | 边框 |
| `textMain` | `#d1d4dc` | 主文本 |
| `textMuted` | `#787b86` | 次要文本 |
| `win` | `#22ab94` | 盈利/绿 |
| `loss` | `#f23645` | 亏损/红 |

### 样式方式
- 纯 Tailwind CSS 工具类，无 CSS Modules / styled-components
- `globals.css` 仅 12 行（Tailwind 指令 + `color-scheme: dark`）
- 组件内使用 `cn()` 合并 className

## 8. 图表组件

| 组件 | 图表库 | 用途 |
|------|--------|------|
| `CumulativePnLChart` | ECharts | 累计 PnL 曲线 |
| `DailyPerformanceChart` | ECharts | 每日盈亏柱状图 |
| `HourlyPerformanceChart` | ECharts | 小时维度盈亏 |
| `WeekdayPerformanceChart` | ECharts | 星期维度盈亏 |
| `TradeDurationChart` | ECharts | 持仓时长分布 |
| `TradeSizeChart` | ECharts | 交易规模分布 |
| `WinRateCircleChart` | ECharts | 胜率环形图 |
| `ProfitCalendar` | ECharts | 热力图日历 |
| `KLineChart` | Lightweight Charts | K 线蜡烛图 + 进出场标记 |

所有 ECharts 组件均为 `"use client"`，支持响应式 resize。

## 9. 认证流程

1. 用户在 `/login` 提交邮箱密码 → `POST /api/auth/login`
2. 服务端用 `scrypt` 验证密码，创建 Session（token SHA-256 哈希存 DB）
3. 设置 httpOnly cookie（30 天过期）
4. `middleware.ts` 拦截请求：
   - `/api/*` → 放行（各路由自行调用 `requireUser()`）
   - `/login`、`/register` → 已登录则重定向 `/`
   - 其他路由 → 无 cookie 则重定向 `/login?next=...`
5. 客户端通过 `GET /api/auth/me` 获取当前用户信息
