# 后端说明

本项目后端使用：

- Next.js API Routes
- Prisma
- PostgreSQL
- CCXT

## 数据库结构变更

普通结构变更优先使用：

```bash
npm run db:migrate
```

不要直接执行破坏性 Prisma 命令，例如：

```bash
prisma migrate reset
prisma db push --accept-data-loss
```

如果确实需要执行可能丢数据的操作，必须使用受保护脚本：

```bash
npm run db:danger:push-lossy
npm run db:danger:reset
```

这两个命令会先打印目标数据库，并要求输入精确确认短语后才会继续。

## 数据安全原则

- 任何会删除数据的命令都必须在命令名中明确标出 `danger`。
- 任何会删除数据的命令都必须要求人工输入确认短语。
- 默认文档和日常开发流程不能引导直接运行重置数据库命令。
