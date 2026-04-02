# 日志系统使用指南

## 概述

项目已配置 **pino** 日志系统，所有运行日志会同时输出到：
1. **控制台** - 开发时实时查看
2. **文件** - `logs/app.log` - 持久化保存

## 日志文件位置

```
trading-dashboard/
└── logs/
    └── app.log    # 主日志文件
```

## 使用方法

### 1. 导入 logger

```typescript
import logger from '@/lib/logger';
```

### 2. 使用不同级别的日志

```typescript
// 信息级别
logger.info('应用启动');
logger.info({ userId: 123, action: 'login' }, '用户登录');

// 警告级别
logger.warn({ apiKeyId: 456 }, 'API Key 即将过期');

// 错误级别
logger.error({ error }, '同步失败');

// 调试级别
logger.debug({ data }, '详细数据');
```

### 3. 日志格式示例

日志文件中的输出格式（ISO 时间戳）：

```json
{"level":30,"time":"2026-04-02T12:34:56.789Z","pid":12345,"hostname":"localhost","requestId":"abc123","apiKeyId":1,"msg":"开始同步 API Key 数据"}
{"level":30,"time":"2026-04-02T12:34:57.123Z","pid":12345,"hostname":"localhost","requestId":"abc123","method":"POST","path":"/api/sync","msg":"HTTP 请求"}
{"level":50,"time":"2026-04-02T12:35:00.456Z","pid":12345,"hostname":"localhost","requestId":"abc123","error":{},"msg":"同步失败"}
```

### 4. 已集成的组件

- **API 路由** - `/api/sync/route.ts` 已使用 logger
- **Middleware** - `src/middleware.ts` 自动记录所有 `/api/*` 请求
- **服务层** - `SyncService.ts` 已集成日志

## 查看日志

### 实时查看（开发环境）

控制台会自动显示彩色日志。

### 查看日志文件

```bash
# 持续跟踪日志
tail -f logs/app.log

# Windows PowerShell
Get-Content logs/app.log -Wait -Tail 50

# 查看最近的日志
cat logs/app.log | tail -n 100
```

### 格式化查看

```bash
# 使用 pino-pretty 格式化查看
npx pino-pretty logs/app.log
```

## 环境变量配置

可在 `.env.local` 中配置日志级别：

```env
LOG_LEVEL=info  # debug, info, warn, error
```

## .gitignore 已包含

```
logs/
*.log
```

日志目录不会被提交到 Git。
