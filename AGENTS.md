# AGENTS.md

## Project Overview

Next.js 14 App Router trading review dashboard. Users sync crypto futures trades from exchanges (Binance primary), which get aggregated into position "Legs" for P&L analysis.

## Commands

```bash
npm run dev          # Start dev server (Next.js)
npm run build        # Production build
npm run lint         # ESLint
npm run db:migrate   # Prisma migrate dev (creates migration)
npm run db:push      # Prisma db push (schema sync, no migration)
npm run test:sync    # Test exchange sync (tsx scripts/test-sync.ts)
```

**No test framework is configured.** There are no unit/integration tests.

## !! 数据库安全 !!

**绝对不能随意重置数据库。** 生产环境和开发环境都有真实交易数据。

- `npx prisma migrate dev` — 检测到 schema drift 时**会自动重置数据库（丢数据）**
- `npx prisma migrate deploy` — **安全**，只应用迁移，不会重置
- `npm run db:danger:reset` — 会重置数据库，需要交互确认
- `npm run db:danger:push-lossy` — 可能丢数据，需要交互确认

**添加新字段/表时的安全流程：**
1. 先写好 `schema.prisma` 变更
2. 创建迁移：`npx prisma migrate dev --name 描述性名称`（仅首次，如果数据库已同步）
3. 应用迁移：`npx prisma migrate deploy`
4. 重新生成 Client：`npx prisma generate`

## Critical: Prisma Client Regeneration

After ANY change to `prisma/schema.prisma`, you MUST regenerate the Prisma client:

```bash
npx prisma generate
```

**On Windows:** The Prisma client DLL gets locked by the running Next.js dev server. Stop the dev server (Ctrl+C) first, then run `npx prisma generate`, then restart.

If you see errors like `Unknown argument 'X'. Did you mean 'Y'?` when calling Prisma, the client is stale — regenerate it.

## Architecture

### Data Flow
```
Exchange API (CCXT) or CSV upload
  → SyncService → Trade table (raw trades)
    → trade-aggregator.ts → Leg table (aggregated positions)
```

### Key Models (Prisma)
- **Trade** — Raw immutable trade records. ID is a fingerprint (`tid:`, `oid:`, or `fp:` prefix). Deduped by `(apiKeyId, tradeId)` unique constraint.
- **Leg** — Aggregated position lifecycle (open → add → close). Core review unit with P&L, MAE/MFE, commission.
- **ApiKey** — Exchange credentials. `apiSecret` is AES-256-GCM encrypted; `apiKey` is stored plaintext.
- **FundingFee** — Per-position funding payments/receipts.

### Trade Identity (`src/lib/trade-identity.ts`)
Trade IDs are fingerprinted, not sequential. Three strategies in priority order:
1. `tid:{scopeKey}:{tradeId}` — when exchange provides a trade ID
2. `oid:{scopeKey}:{orderId}:{timestamp}:{side}:{price}:{amount}` — fallback to order ID
3. `fp:{scopeKey}:{symbol}:{timestamp}:{side}:{price}:{amount}` — last resort

### Trade Aggregator (`src/lib/trade-aggregator.ts`)
Processes trades chronologically per `symbol-positionSide` key. Handles: adding to position, partial close, full close, position reversal (excess close flips side).

### Auth (`src/lib/auth.ts`)
Session-based with scrypt password hashing. Sessions stored in DB, token hashed with SHA-256. Cookie name from `src/lib/auth-constants.ts`. Middleware protects all non-API routes; `/api/*` routes handle auth themselves via `requireUser()`.

### Encryption (`src/utils/encryption.ts`)
API secrets encrypted with AES-256-GCM. Stored format: `iv:tag:encrypted` (hex). Requires `ENCRYPTION_KEY` env var (32 bytes / 64 hex chars).

## Directory Layout

```
src/
  app/           # Next.js App Router pages + API routes
    api/         # REST endpoints (all handle auth individually)
    accounts/    # Account management UI
    analytics/   # Analytics dashboards
    calendar/    # Trading calendar view
    reports/     # Report views
  components/    # React components (charts use echarts-for-react, lightweight-charts)
  lib/           # Core logic (auth, prisma singleton, trade aggregation)
  services/      # Business logic classes (SyncService, ApiKeyService, etc.)
  utils/         # Utilities (encryption)
  mock/          # Mock data
prisma/
  schema.prisma  # Database schema
  migrations/    # SQL migrations
scripts/         # CLI utilities (tsx runner)
```

## Environment Setup

Required in `.env`:
- `DATABASE_URL` — PostgreSQL connection string
- `ENCRYPTION_KEY` — 32-byte hex key for API secret encryption
- Optional: `HTTPS_PROXY` for exchange API requests from China

## Gotchas

- **CCXT is externalized** from Next.js bundling (`serverComponentsExternalPackages` in `next.config.js`).
- **PowerShell on Windows**: Use `;` not `&&` to chain commands. Or use `workdir` parameter in bash tool.
- **Dangerous DB commands** require interactive confirmation via `scripts/confirm-db-danger.ts`: `npm run db:danger:push-lossy`, `npm run db:danger:reset`.
- **Symbol format mismatch**: DB stores `BTCUSDT`, CCXT uses `BTC/USDT:USDT`. Conversion happens in SyncService.
- **No `quoteAmount` field in RawTrade interface** — it's computed as `price * amount` during save.
- **`feeAsset` field in Trade model** stores the raw fee currency (e.g., "BNB"), not the fee amount.
- **Leg aggregation runs on ALL trades** for an apiKeyId after any sync (full recalculation, not incremental).
