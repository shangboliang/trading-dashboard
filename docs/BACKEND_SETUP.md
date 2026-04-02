# 后端启动指南

## 前置条件

1. **Node.js 18+** - [下载地址](https://nodejs.org/)
2. **PostgreSQL 15+** - [下载地址](https://www.postgresql.org/download/)

## 第一步：配置数据库

### 1.1 创建 PostgreSQL 数据库

```bash
# 使用 psql 命令行工具
psql -U postgres

# 在 PostgreSQL 中执行
CREATE DATABASE tradingdb;
CREATE USER trader WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE tradingdb TO trader;
```

### 1.2 配置 .env 文件

复制环境变量文件：

```bash
cp .env.example .env
```

修改 `.env` 文件中的数据库连接字符串：

```env
DATABASE_URL="postgresql://trader:yourpassword@localhost:5432/tradingdb?schema=public"

# 加密密钥 (生成 32 字节 hex 字符串)
# Linux/Mac: openssl rand -hex 32
# Windows: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY="change-this-to-a-random-32-byte-hex-key-in-production"

# 默认用户 ID (开发环境使用)
DEFAULT_USER_ID=1
```

## 第二步：安装依赖

```bash
npm install
```

## 第三步：初始化数据库

```bash
# 生成 Prisma 客户端
npx prisma generate

# 创建数据库迁移
npx prisma migrate dev --name init

# (可选) 查看数据库内容
npx prisma studio
```

## 第四步：启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

---

## 常见问题

### Q: `DATABASE_URL` 格式说明

```
postgresql://用户名:密码@主机:端口/数据库名?schema=public
```

示例：
- 本地开发：`postgresql://postgres:123456@localhost:5432/tradingdb`
- Docker：`postgresql://postgres:postgres@db:5432/tradingdb`

### Q: 如何生成 ENCRYPTION_KEY？

```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32
```

### Q: Prisma 迁移失败怎么办？

```bash
# 重置数据库迁移 (会删除所有数据！)
npx prisma migrate reset

# 或者手动删除 _MigrationHistory 表后重试
```

### Q: 如何添加测试数据？

使用 Prisma Studio：

```bash
npx prisma studio
```

在图形界面中手动添加用户和 API Key。

---

## API 端点列表

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/accounts | 获取账户列表 |
| POST | /api/accounts | 创建新账户 |
| GET | /api/accounts/:id | 获取账户详情 |
| PUT | /api/accounts/:id | 更新账户 |
| DELETE | /api/accounts/:id | 删除账户 |
| POST | /api/sync | 同步交易所数据 |
| GET | /api/legs | 获取持仓列表 |
| GET | /api/analytics/summary | 获取统计摘要 |
| GET | /api/analytics/pnl-curve | 获取盈亏曲线 |
| GET | /api/analytics/by-symbol | 按交易对统计 |

---

## 下一步

1. 访问 http://localhost:3000/accounts 添加交易所 API Key
2. 点击同步按钮从交易所拉取历史数据
3. 返回首页查看交易分析报告

---

*最后更新：2026-03-31*
