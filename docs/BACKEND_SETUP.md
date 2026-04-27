# 后端启动与数据库命令说明

## 数据库命令

日常开发优先使用安全命令：

```bash
npm run db:migrate
npm run db:push
```

不要直接运行下面这些命令：

```bash
prisma migrate reset
prisma db push --accept-data-loss
npm run db:reset
npm run db:setup
```

原因：

- `prisma migrate reset` 会清空数据库并重建表。
- `prisma db push --accept-data-loss` 允许 Prisma 为了同步结构而删除数据。
- 旧的 `db:setup`、`db:reset` 命名不够明确，容易误操作。

如果确实要执行会造成数据丢失的操作，只能使用带确认门禁的危险命令：

```bash
npm run db:danger:reset
npm run db:danger:push-lossy
```

执行时脚本会打印目标数据库和实际命令，并要求输入完整确认短语。确认短语不一致会直接中止。

## 命令含义

- `npm run db:migrate`：正常开发迁移，推荐使用。
- `npm run db:push`：普通结构同步，不带 `--accept-data-loss`。
- `npm run db:danger:reset`：危险操作，删除所有数据并重建表。
- `npm run db:danger:push-lossy`：危险操作，允许 Prisma 删除数据来同步结构。
