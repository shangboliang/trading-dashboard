export function sanitizeTradeIdentifier(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeNumber(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(12).replace(/\.?0+$/, "");
}

export function buildTradeFingerprint(input: {
  symbol: string;
  timestamp: Date;
  side: string;
  price: number;
  amount: number;
  tradeId?: string | null;
  orderId?: string | null;
  scopeKey?: string | null;
}): string {
  const side = input.side.toUpperCase();
  const timestampMs = Number.isNaN(input.timestamp.getTime())
    ? "0"
    : String(input.timestamp.getTime());
  const tradeId = sanitizeTradeIdentifier(input.tradeId);
  const orderId = sanitizeTradeIdentifier(input.orderId);
  const scopeKey = sanitizeTradeIdentifier(input.scopeKey);
  const scopedPrefix = scopeKey ? `${scopeKey}:` : "";

  if (tradeId) {
    return `tid:${scopedPrefix}${tradeId}`;
  }

  if (orderId) {
    return `oid:${scopedPrefix}${orderId}:${timestampMs}:${side}:${normalizeNumber(input.price)}:${normalizeNumber(input.amount)}`;
  }

  return `fp:${scopedPrefix}${input.symbol}:${timestampMs}:${side}:${normalizeNumber(input.price)}:${normalizeNumber(input.amount)}`;
}
