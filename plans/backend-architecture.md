# 后端实施计划

1. 配置 `.env`，设置 `DATABASE_URL` 和 `ENCRYPTION_KEY`。
2. 普通数据库结构变更使用 `npm run db:migrate`。
3. 不要直接运行 `prisma db push --accept-data-loss` 或 `prisma migrate reset`。
4. 只有明确接受数据丢失时，才使用：

```bash
npm run db:danger:push-lossy
npm run db:danger:reset
```

5. 危险命令必须打印目标数据库，并要求输入完整确认短语。
