# 交易历史复盘仪表盘 - 前端开发文档 (Frontend Documentation)

本项目的目标是提供一个专业、高性能且具有金融美感的交易复盘系统。前端采用 **Next.js 14+** 架构，并利用 **ECharts** 和 **Lightweight Charts** 实现深色模式下的数据可视化。

## 1. 技术栈 (Tech Stack)
- **框架**: [Next.js 14 (App Router)](https://nextjs.org/) - 提供路由、服务端渲染及现代组件模型。
- **UI 样式**: [Tailwind CSS](https://tailwindcss.com/) - 负责全局暗色模式布局。
- **状态管理**: 简单状态通过 React `useState` 管理；由于目前使用 Mock 数据，核心数据源位于 `src/mock/data.ts`。
- **可视化图表**:
  - [ECharts](https://echarts.apache.org/) (`echarts-for-react`)：用于复杂统计（如交易规模分布、每日盈亏直方图）。
  - [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) (TradingView)：用于复盘详情页的轻量级、交互式 K 线图。
- **图标**: [Lucide React](https://lucide.dev/)。

## 2. 目录结构 (Directory Structure)
```text
src/
├── app/                  # Next.js App Router 路由与布局
│   ├── globals.css       # 全局样式及 Tailwind 指令
│   ├── layout.tsx        # 根布局（定义暗色主题与侧边栏）
│   └── page.tsx          # 仪表盘主页面（包含指标、图表与列表）
├── components/           # 复用 UI 组件
│   ├── Card.tsx          # 基础容器组件
│   ├── Overview.tsx      # 总览指标卡片组
│   ├── TradeSizeChart.tsx # 交易规模堆叠图 (ECharts)
│   ├── DailyPerformanceChart.tsx # 每日盈亏柱状图 (ECharts)
│   ├── TradeDetail.tsx   # 交易复盘详情弹窗
│   └── KLineChart.tsx    # 进出场标记 K 线图 (Lightweight Charts)
└── mock/                 # 数据源与契约模型
    └── data.ts           # 基于真实 API 结构的静态 Mock 数据
```

## 3. 核心功能实现方案

### 3.1 深色主题配置 (Theming)
在 `tailwind.config.ts` 中扩展了自定义金融配色方案：
- `win`: `#22ab94` (绿)
- `loss`: `#f23645` (红)
- `background`: `#0f1115` (主背景)
- `panel`: `#1e222d` (卡片/弹窗背景)

### 3.2 复杂统计图表 (ECharts Integration)
所有 ECharts 组件均使用 `"use client"` 指令，以支持客户端交互。
- **分桶策略**: 后端提供的 `rangeStart` / `rangeEnd` 用于 Y 轴分段，通过堆叠系列 (`stack: 'total'`) 同时展示胜利与失败的成交数量。
- **响应式**: 通过监听 `resize` 事件并调用 `chart.resize()` 确保在不同屏幕下完美适配。

### 3.3 K 线进出场复盘 (K-Line Visualizer)
利用 `lightweight-charts` 实现：
- **Markers (标记)**: 通过 `candlestickSeries.setMarkers([])` 在特定的时间戳插入 `arrowUp` (买入) 和 `arrowDown` (卖出) 形状。
- **交互**: 支持缩放、平移，并自动通过 `fitContent()` 将交易区间置于视野正中心。

## 4. 数据接入指南

### 4.1 如何切换为真实后端 API
目前组件直接从 `src/mock/data.ts` 导入数据。切换步骤：
1. 在 `src/app/page.tsx` 中使用 `useEffect` 配合 `fetch()` 或 `SWR/TanStack Query`。
2. 配置 `next.config.js` 允许跨域或设置 Proxy。
3. 确保后端返回的 JSON 键名与 `src/mock/data.ts` 中的契约保持一致。

## 5. 开发建议
- **性能**: 复杂的仪表盘含有大量 DOM，建议对不常变动的图表组件使用 `React.memo`。
- **扩展性**: 如需增加 MAE/MFE 真实数据，请修改 `TradeDetail.tsx` 中的进度条计算逻辑，将模拟值替换为 `trade.mae` / `trade.mfe` 字段。
- **组件规范**: 优先使用 `Card` 组件封装业务逻辑块，保持布局的一致性。

## 6. 运行项目
```bash
npm install
npm run dev
```
访问 [http://localhost:3000](http://localhost:3000) 即可预览。
