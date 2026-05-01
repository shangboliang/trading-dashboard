import { sanitizeTradeIdentifier } from '@/lib/trade-identity';

// 自定义表头映射配置
export interface IncomeHeaderMapping {
  time?: string;       // 时间列名
  type?: string;       // 类型列名
  amount?: string;     // 金额列名
  asset?: string;      // 资产列名
  symbol?: string;     // 交易对列名
  tranId?: string;     // 交易ID列名
}

export interface RawIncomeRecord {
  apiKeyId: number;
  tranId: string | null;
  incomeType: string;
  asset: string;
  symbol: string;
  amount: number;
  amountUsd: number;
  info: string | null;
  timestamp: Date;
}

export class IncomeCsvService {
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
   * 解析收入流水 CSV（支持自定义表头映射，支持逗号和 Tab 分隔）
   * 只保留 FUNDING_FEE 类型的记录
   */
  static parseIncomeHistory(
    csvContent: string,
    apiKeyId: number,
    headerMapping?: IncomeHeaderMapping
  ): RawIncomeRecord[] {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) return [];

    // 自动检测分隔符（Tab 或逗号）
    const separator = lines[0].includes('\t') ? '\t' : ',';
    console.log('[IncomeCsv] 分隔符:', separator === '\t' ? 'Tab' : '逗号');

    // 获取并格式化表头，转小写以防大小写不一致
    const headers = lines[0].split(separator).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    console.log('[IncomeCsv] 检测到的表头:', headers);
    const rows = lines.slice(1);

    // 建立表头映射
    const headerMap = new Map<string, number>();
    headers.forEach((h, i) => headerMap.set(h, i));
    console.log('[IncomeCsv] 表头映射:', Object.fromEntries(headerMap));

    // 优先使用自定义映射，否则使用默认匹配
    const timeIdx = headerMapping?.time
      ? (headerMap.get(headerMapping.time.toLowerCase()) ?? -1)
      : (headerMap.get('time(utc)') ?? headerMap.get('time') ?? -1);
    const typeIdx = headerMapping?.type
      ? (headerMap.get(headerMapping.type.toLowerCase()) ?? -1)
      : (headerMap.get('type') ?? headerMap.get('incometype') ?? headerMap.get('income type') ?? -1);
    const amountIdx = headerMapping?.amount
      ? (headerMap.get(headerMapping.amount.toLowerCase()) ?? -1)
      : (headerMap.get('amount') ?? headerMap.get('income') ?? -1);
    const assetIdx = headerMapping?.asset
      ? (headerMap.get(headerMapping.asset.toLowerCase()) ?? -1)
      : (headerMap.get('asset') ?? headerMap.get('资产') ?? -1);
    const symbolIdx = headerMapping?.symbol
      ? (headerMap.get(headerMapping.symbol.toLowerCase()) ?? -1)
      : (headerMap.get('symbol') ?? headerMap.get('代币名称/币种名称/币对') ?? headerMap.get('代币名称') ?? headerMap.get('币种名称') ?? headerMap.get('币对') ?? -1);
    const tranIdIdx = headerMapping?.tranId
      ? (headerMap.get(headerMapping.tranId.toLowerCase()) ?? -1)
      : (headerMap.get('trade id') ?? headerMap.get('tradeid') ?? headerMap.get('交易 id') ?? headerMap.get('tranid') ?? -1);

    console.log('[IncomeCsv] 列索引:', { timeIdx, typeIdx, amountIdx, assetIdx, symbolIdx, tranIdIdx });

    if (timeIdx === -1 || typeIdx === -1 || amountIdx === -1 || symbolIdx === -1) {
      throw new Error('CSV 缺少必要的列 (时间, 类型, 金额, 交易对)');
    }

    const records: RawIncomeRecord[] = [];

    console.log(`[IncomeCsv] 共 ${rows.length} 行数据`);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const cols = row.split(separator).map(c => c.trim().replace(/^"|"$/g, ''));

      const incomeType = cols[typeIdx]?.toUpperCase() || '';
      
      // 只保留 FUNDING_FEE 类型
      if (incomeType !== 'FUNDING_FEE') {
        if (i < 3) console.log(`[IncomeCsv] 第 ${i+2} 行类型: "${incomeType}" (跳过)`);
        continue;
      }

      const dateStr = cols[timeIdx];
      const amountStr = cols[amountIdx];
      const asset = assetIdx !== -1 ? (cols[assetIdx]?.toUpperCase() || 'USDT') : 'USDT';
      const symbol = symbolIdx !== -1 ? (cols[symbolIdx]?.toUpperCase() || '') : '';
      const tranId = tranIdIdx !== -1 ? sanitizeTradeIdentifier(cols[tranIdIdx]) : null;
      const info = null;

      const amount = parseFloat(amountStr) || 0;

      // 解析日期 - 支持多种格式
      let timestamp: Date;
      const dateStrTrimmed = dateStr.trim();
      
      // 格式1: "2026/4/27 12:00" 或 "2026-04-27 12:00:00"
      // 格式2: "26-04-24 20:00:02" (YY-MM-DD)
      // 格式3: ISO 格式 "2026-04-27T12:00:00Z"
      
      if (dateStrTrimmed.includes('T') || dateStrTrimmed.includes('Z') || dateStrTrimmed.includes('+')) {
        // ISO 格式
        timestamp = new Date(dateStrTrimmed);
      } else if (/^\d{2}-\d{2}-\d{2}\s/.test(dateStrTrimmed)) {
        // YY-MM-DD HH:MM:SS 格式，需要转换
        const parts = dateStrTrimmed.split(/[\s-:]/);
        if (parts.length >= 5) {
          const [yy, mm, dd, hh, mi, ss] = parts;
          // 假设 26 表示 2026 年
          const year = parseInt(yy) < 50 ? 2000 + parseInt(yy) : 1900 + parseInt(yy);
          timestamp = new Date(year, parseInt(mm) - 1, parseInt(dd), parseInt(hh), parseInt(mi), parseInt(ss || '0'));
        } else {
          timestamp = new Date(dateStrTrimmed);
        }
      } else {
        // YYYY/MM/DD HH:MM 或 YYYY-MM-DD HH:MM:SS 格式
        // 替换 / 为 - 统一处理
        const normalized = dateStrTrimmed.replace(/\//g, '-');
        timestamp = new Date(normalized + (normalized.includes('Z') ? '' : ' Z'));
      }

      if (isNaN(timestamp.getTime())) {
        console.log(`[IncomeCsv] 第 ${i+2} 行时间解析失败: "${dateStr}"`);
        continue;
      }

      // U 本位合约资金费本身即 USDT，amountUsd = amount
      const amountUsd = asset === 'USDT' ? amount : amount;

      console.log(`[IncomeCsv] 第 ${i+2} 行解析成功:`, { incomeType, symbol, amount, timestamp: timestamp.toISOString() });

      records.push({
        apiKeyId,
        tranId,
        incomeType,
        asset,
        symbol,
        amount,
        amountUsd,
        info,
        timestamp,
      });
    }

    return records;
  }
}
