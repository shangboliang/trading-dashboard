import { RawTrade } from '@/lib/trade-aggregator';
import { buildTradeFingerprint, sanitizeTradeIdentifier } from '@/lib/trade-identity';

// 自定义表头映射配置
export interface HeaderMapping {
  time?: string;       // 时间列名
  symbol?: string;     // 交易对列名
  side?: string;       // 方向列名
  positionSide?: string; // 仓位方向列名
  price?: string;      // 价格列名
  quantity?: string;   // 数量列名
  fee?: string;        // 手续费列名
  feeAsset?: string;   // 手续费币种列名
  tradeId?: string;    // 成交ID列名
  orderId?: string;    // 订单ID列名
}

export class BinanceCsvService {
  /**
   * 检测 CSV 文件的表头列名（支持逗号和 Tab 分隔）
   */
  static detectHeaders(csvContent: string): string[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length === 0) return [];
    const separator = lines[0].includes('\t') ? '\t' : ',';
    return lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, ''));
  }

  /**
   * 解析币安合约成交历史 CSV (支持多种表头格式和自定义映射，支持逗号和 Tab 分隔)
   */
  static parseTradeHistory(csvContent: string, apiKeyId: number, headerMapping?: HeaderMapping): RawTrade[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    // 自动检测分隔符（Tab 或逗号）
    const separator = lines[0].includes('\t') ? '\t' : ',';

    // 获取并格式化表头，转小写以防大小写不一致
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const rows = lines.slice(1);
    
    // 建立表头映射
    const headerMap = new Map<string, number>();
    headers.forEach((h, i) => headerMap.set(h, i));

    // 优先使用自定义映射，否则使用默认匹配
    const timeIdx = headerMapping?.time 
      ? (headerMap.get(headerMapping.time.toLowerCase()) ?? -1)
      : (headerMap.get('time(utc)') ?? headerMap.get('date(utc)') ?? -1);
    const symbolIdx = headerMapping?.symbol
      ? (headerMap.get(headerMapping.symbol.toLowerCase()) ?? -1)
      : (headerMap.get('symbol') ?? -1);
    const sideIdx = headerMapping?.side
      ? (headerMap.get(headerMapping.side.toLowerCase()) ?? -1)
      : (headerMap.get('side') ?? -1);
    const posSideIdx = headerMapping?.positionSide
      ? (headerMap.get(headerMapping.positionSide.toLowerCase()) ?? -1)
      : (headerMap.get('position side') ?? -1);
    const priceIdx = headerMapping?.price
      ? (headerMap.get(headerMapping.price.toLowerCase()) ?? -1)
      : (headerMap.get('price') ?? -1);
    const qtyIdx = headerMapping?.quantity
      ? (headerMap.get(headerMapping.quantity.toLowerCase()) ?? -1)
      : (headerMap.get('quantity') ?? headerMap.get('qty') ?? -1);
    const feeIdx = headerMapping?.fee
      ? (headerMap.get(headerMapping.fee.toLowerCase()) ?? -1)
      : (headerMap.get('fee') ?? headerMap.get('commission') ?? -1);
    const feeAssetIdx = headerMapping?.feeAsset
      ? (headerMap.get(headerMapping.feeAsset.toLowerCase()) ?? -1)
      : (headerMap.get('fee asset') ?? headerMap.get('commission asset') ?? headerMap.get('asset') ?? -1);
    const tradeIdIdx = headerMapping?.tradeId
      ? (headerMap.get(headerMapping.tradeId.toLowerCase()) ?? -1)
      : (headerMap.get('trade id') ?? -1);
    const orderIdIdx = headerMapping?.orderId
      ? (headerMap.get(headerMapping.orderId.toLowerCase()) ?? -1)
      : (headerMap.get('order id') ?? -1);

    if (timeIdx === -1 || symbolIdx === -1 || sideIdx === -1 || priceIdx === -1 || qtyIdx === -1) {
      throw new Error('CSV 缺少必要的列 (时间, 交易对, 方向, 价格, 数量)');
    }

    return rows.map((row) => {
      // 简单处理逗号分隔，假设没有带逗号的引号内容
      const cols = row.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));
      
      const dateStr = cols[timeIdx];
      const symbol = cols[symbolIdx].toUpperCase();
      const side = cols[sideIdx].toUpperCase();
      const posSideStr = posSideIdx !== -1 ? cols[posSideIdx].toUpperCase() : 'BOTH';
      const priceStr = cols[priceIdx];
      const qtyStr = cols[qtyIdx];
      
      let feeStr = feeIdx !== -1 ? cols[feeIdx] : '0';
      let feeAsset = feeAssetIdx !== -1 ? cols[feeAssetIdx].toUpperCase() : '';
      
      // 有些导出格式中，手续费数字和币种混在一个字段里如 "1.25 USDT"
      if (feeStr && isNaN(Number(feeStr))) {
          const match = feeStr.match(/^([\d.]+)\s*([A-Za-z]+)$/);
          if (match) {
              feeStr = match[1];
              feeAsset = match[2].toUpperCase();
          }
      }
      
      const price = parseFloat(priceStr) || 0;
      const amount = parseFloat(qtyStr) || 0;
      const fee = parseFloat(feeStr) || 0;
      
      // 提取 Quote Asset (USDT, BUSD 等)
      const quoteAssetMatch = symbol.match(/USDT$|BUSD$|USDC$/);
      const quoteAsset = quoteAssetMatch ? quoteAssetMatch[0] : 'USDT';
      const baseAsset = symbol.replace(new RegExp(`${quoteAsset}$`), '');

      // 如果未指定手续费币种，默认使用 Quote Asset
      if (!feeAsset) {
          feeAsset = quoteAsset;
      }

      // 估算 feeUsd
      const STABLE_ASSETS = new Set(['USDT', 'BUSD', 'USDC', 'USD', 'DAI']);
      let feeUsd = fee;
      if (!STABLE_ASSETS.has(feeAsset)) {
        // 如果是 BNB 抵扣且没法确定法币价值，按默认费率近似估算
        feeUsd = (price * amount) * 0.00075;
      }

      // 确保日期字符串能够被正确解析为 UTC 时间
      const normalizedDateStr = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : `${dateStr} Z`;
      const timestamp = new Date(normalizedDateStr);
      const tradeId = sanitizeTradeIdentifier(tradeIdIdx !== -1 ? cols[tradeIdIdx] : null);
      const orderId = sanitizeTradeIdentifier(orderIdIdx !== -1 ? cols[orderIdIdx] : null);
      const id = buildTradeFingerprint({
        symbol,
        timestamp,
        side,
        price,
        amount,
        tradeId,
        orderId,
        scopeKey: String(apiKeyId),
      });

      return {
        id,
        tradeId,
        orderId,
        symbol,
        baseAsset,
        quoteAsset,
        side: side as 'BUY' | 'SELL',
        positionSide: posSideStr || 'BOTH',
        price,
        amount,
        fee,
        feeAsset,
        feeUsd,
        timestamp,
      };
    }).filter(t => t.symbol && !isNaN(t.timestamp.getTime()));
  }
}
