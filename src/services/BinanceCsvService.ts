
import { RawTrade } from '@/lib/trade-aggregator';

export class BinanceCsvService {
  /**
   * 解析币安合约成交历史 CSV (支持多种表头格式)
   */
  static parseTradeHistory(csvContent: string): RawTrade[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    // 获取并格式化表头，转小写以防大小写不一致
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const rows = lines.slice(1);
    
    // 建立表头映射
    const headerMap = new Map<string, number>();
    headers.forEach((h, i) => headerMap.set(h, i));

    // 适配各种常见表头变体
    const timeIdx = headerMap.get('time(utc)') ?? headerMap.get('date(utc)') ?? -1;
    const symbolIdx = headerMap.get('symbol') ?? -1;
    const sideIdx = headerMap.get('side') ?? -1;
    const posSideIdx = headerMap.get('position side') ?? -1;
    const priceIdx = headerMap.get('price') ?? -1;
    const qtyIdx = headerMap.get('quantity') ?? headerMap.get('qty') ?? -1;
    const feeIdx = headerMap.get('fee') ?? headerMap.get('commission') ?? -1;
    const feeAssetIdx = headerMap.get('fee asset') ?? headerMap.get('commission asset') ?? headerMap.get('asset') ?? -1;
    const tradeIdIdx = headerMap.get('trade id') ?? -1;

    if (timeIdx === -1 || symbolIdx === -1 || sideIdx === -1 || priceIdx === -1 || qtyIdx === -1) {
      throw new Error('CSV 缺少必要的列 (时间, 交易对, 方向, 价格, 数量)');
    }

    return rows.map((row, index) => {
      // 简单处理逗号分隔，假设没有带逗号的引号内容
      const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      
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

      // 获取或生成 Trade ID
      const tradeIdStr = tradeIdIdx !== -1 ? cols[tradeIdIdx] : '';
      const id = tradeIdStr || `csv-${symbol}-${dateStr}-${index}`;

      // 确保日期字符串能够被正确解析为 UTC 时间
      const normalizedDateStr = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : `${dateStr} Z`;

      return {
        id,
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
        timestamp: new Date(normalizedDateStr),
      };
    }).filter(t => t.symbol && !isNaN(t.timestamp.getTime()));
  }
}
