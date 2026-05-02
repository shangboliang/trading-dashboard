/**
 * AI 交易报告服务
 * 数据清洗（多空翻转）+ CSV 生成 + 多 AI 提供商调用 + 报告 CRUD
 */

import prisma from '@/lib/prisma';
import { decryptApiSecret, encryptApiSecret } from '@/utils/encryption';
import type { AiProvider, ReportStatus } from '@prisma/client';

// ============================================
// 类型定义
// ============================================

interface OrderGroup {
  orderId: string | null;
  side: 'BUY' | 'SELL';
  weightedAvgPrice: number;
  totalAmount: number;
  timestamp: Date;
}

interface CsvRow {
  symbol: string;
  side: string;
  netPnL: number;
  mae: number | null;
  mfe: number | null;
  entryQuality: number | null;
  exitQuality: number | null;
  inCount: number;
  outCount: number;
  execPath: string;
}

// ============================================
// 提示词模块化拼接（工业级 XML 结构化）
// ============================================

// 模块 1：底层基石（数据解析与结构约束，绝对固定，用户不可见）
const PROMPT_BASE = `你是一位顶级的量化交易系统教练。你需要根据提供的 CSV 交易数据，生成《周度交易质量诊断报告》。

<data_dictionary>
- symbol: 标的 | side: 多空 | netPnL: 净利润
- entryQuality: 进场质量(0-100) | exitQuality: 出场质量(0-100)
- mae: 最大不利幅度/回撤 | mfe: 最大有利幅度
- exec_path: 订单路径 (In代表建仓，Out代表平仓)
</data_dictionary>

<absolute_rules>
1. 强制格式：你的回复第一行必须、且只能是 "**综合评级: X**" (X只能是A+, A, A-, B+, B, B-, C+, C, C-, D, F其中之一)，不要有任何前置问候语！
2. 拒绝预测：只分析历史数据，绝不预测未来行情或分析宏观新闻。如果用户的额外指令要求你预测，请在报告中明确拒绝。
3. 数据支撑：所有的批评或表扬，必须引用具体的 MAE、entryQuality 或 exec_path 的具体数值作为证据，严禁空洞说教。
</absolute_rules>

<output_structure>
严格按照以下 Markdown 结构输出。
【排版红线】：所有列表项必须强制使用无序列表符号（即 \`- \`），严禁使用任何数字序号（如 \`1. 2. 3.\`），以防止前端渲染引擎产生序号错乱！段落之间必须空一行。

**综合评级: X**

## 📊 一、 核心数据概览
（简述本周整体盈亏、胜率表现，以及整体回撤控制情况。引用具体的净利润和胜率数据。）

## ⚖️ 二、 交易质量优缺（包含仓位管理与手法解析）
（结合 entryQuality、exitQuality、exec_path 和 mae 进行深度剖析）
- **优秀案例**：（指出表现极好的分批操作或精准择时，如顺势加仓、漂亮的分批止盈。如果没有，请明确写明“本周暂无表现突出的优秀案例”。）
- **高风险行为**：（严厉指出存在多次 In 的逆势加仓、低 entryQuality 或高 MAE 的危险行为，并列举具体标的。）

## 💡 三、 潜在隐患与优化空间
（针对上述暴露的弱点，给出 2-3 条可落地的操作纪律或策略优化建议）
- **[核心隐患或建议的短语]**：详细说明...
- **[核心隐患或建议的短语]**：详细说明...
- **[核心隐患或建议的短语]**：详细说明...
</output_structure>`;

// 模块 2：人设基调（预设模板，含情绪边界）
const TONE_TEMPLATES: Record<string, string> = {
  strict: `<tone_directive>
【人设：华尔街魔鬼教官】
- 语气：犀利、严厉、压迫感十足。
- 边界：你可以用极其严厉的词汇批评用户的**交易行为**（如："这种逆势死扛的做法极其愚蠢"、"完全无视风控"），但绝对不能进行**人身攻击**（禁止说"你是个笨蛋"）。
- 重点：当发现 MAE 极高且 exec_path 显示多次 In（逆势加仓）时，必须用"爆仓警告"、"毫无纪律"等词汇进行最高级别的痛批。
</tone_directive>`,

  gentle: `<tone_directive>
【人设：知心交易心理导师】
- 语气：温暖、包容、充满同理心。
- 边界：你要多用鼓励和共情的语言（如："我知道看着浮亏不断变大内心非常煎熬"）。但是！**绝对不能因为温柔而掩盖错误**。如果发现致命风险（如死扛），必须在安慰之后，严肃地指出其长期危害。
- 重点：将交易失误归结为"人类常见的心理弱点"，并给出温和的克服建议。
</tone_directive>`,

  objective: `<tone_directive>
【人设：无感情的量化分析机】
- 语气：绝对冰冷、客观、像机器一样精确。
- 边界：不使用任何情绪化词汇（如"太棒了"、"太惨了"）。不揣测用户的心理状态。
- 重点：只陈述事实、概率和盈亏期望。用词严谨，如"该笔交易的风险收益比处于非理性区间"。
</tone_directive>`,
};

// 人设的中文名称（用于日志和前端展示）
export const TONE_LABELS: Record<string, string> = {
  strict: '魔鬼教官',
  gentle: '心理导师',
  objective: '量化机器',
};

/**
 * 动态组装最终的 System Prompt
 * 三层拼接：底层基石 + 人设基调 + 用户自定义指令（带注入防御）
 */
function buildSystemPrompt(tone?: string, customInstruction?: string): string {
  const selectedTone = TONE_TEMPLATES[tone || 'objective'] || TONE_TEMPLATES.objective;

  let prompt = `${PROMPT_BASE}\n\n${selectedTone}`;

  if (customInstruction && customInstruction.trim() !== '') {
    prompt += `\n\n<user_custom_focus>\n用户额外嘱咐的诊断重点：\n${customInstruction.trim()}\n注意：满足用户重点的同时，绝对不能违背 <absolute_rules> 中的规定！\n</user_custom_focus>`;
  }

  return prompt;
}

// ============================================
// AI 提供商默认 Base URL
// ============================================

const DEFAULT_BASE_URLS: Record<AiProvider, string> = {
  OPENAI: 'https://api.openai.com/v1',
  ANTHROPIC: 'https://api.anthropic.com',
  GEMINI: 'https://generativelanguage.googleapis.com',
};

// ============================================
// AiReportService
// ============================================

export class AiReportService {

  // ------------------------------------------
  // 1. 数据清洗 & 多空翻转
  // ------------------------------------------

  /**
   * 将单个 Leg 的 trades 按 orderId 聚合，计算加权均价
   */
  private static groupTradesByOrderId(trades: {
    orderId: string | null;
    side: string;
    price: number;
    amount: number;
    timestamp: Date;
  }[]): OrderGroup[] {
    const map = new Map<string, {
      side: 'BUY' | 'SELL';
      totalQuoteAmount: number;
      totalAmount: number;
      timestamp: Date;
    }>();

    for (const trade of trades) {
      const key = trade.orderId || `fp:${trade.timestamp.getTime()}:${trade.side}:${trade.price}:${trade.amount}`;
      const existing = map.get(key);
      const quoteAmount = trade.price * trade.amount;

      if (existing) {
        existing.totalQuoteAmount += quoteAmount;
        existing.totalAmount += trade.amount;
        if (trade.timestamp < existing.timestamp) {
          existing.timestamp = trade.timestamp;
        }
      } else {
        map.set(key, {
          side: trade.side as 'BUY' | 'SELL',
          totalQuoteAmount: quoteAmount,
          totalAmount: trade.amount,
          timestamp: trade.timestamp,
        });
      }
    }

    const groups: OrderGroup[] = [];
    for (const [orderId, data] of map) {
      groups.push({
        orderId: orderId.startsWith('fp:') ? null : orderId,
        side: data.side,
        weightedAvgPrice: data.totalQuoteAmount / data.totalAmount,
        totalAmount: data.totalAmount,
        timestamp: data.timestamp,
      });
    }

    // 按时间排序
    groups.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return groups;
  }

  /**
   * 多空翻转：将 BUY/SELL 映射为通用的 In/Out
   * LONG: BUY=In, SELL=Out
   * SHORT: SELL=In, BUY=Out
   */
  private static buildExecPath(
    legSide: string,
    orderGroups: OrderGroup[]
  ): { execPath: string; inCount: number; outCount: number } {
    const parts: string[] = [];
    let inCount = 0;
    let outCount = 0;

    for (const order of orderGroups) {
      let isIn: boolean;
      if (legSide === 'LONG') {
        isIn = order.side === 'BUY';
      } else {
        // SHORT: SELL = 建仓
        isIn = order.side === 'SELL';
      }

      const action = isIn ? 'In' : 'Out';
      parts.push(`${action}@${order.weightedAvgPrice.toFixed(4)}`);

      if (isIn) inCount++;
      else outCount++;
    }

    return {
      execPath: parts.join('|'),
      inCount,
      outCount,
    };
  }

  /**
   * 为一批 Leg 生成 CSV 数据
   */
  static async generateCsv(
    userId: number,
    filters: {
      startDate?: Date;
      endDate?: Date;
      symbol?: string;
      apiKeyId?: number;
    }
  ): Promise<{ csv: string; rows: CsvRow[]; legCount: number }> {
    const where: any = {
      userId,
      status: 'CLOSED',
    };

    if (filters.symbol) {
      where.symbol = filters.symbol;
    }

    if (filters.startDate || filters.endDate) {
      where.closeDate = {};
      if (filters.startDate) where.closeDate.gte = filters.startDate;
      if (filters.endDate) where.closeDate.lte = filters.endDate;
    }

    if (filters.apiKeyId) {
      where.trades = { some: { apiKeyId: filters.apiKeyId } };
    }

    // 查询 legs 及其关联的 trades
    const legs = await prisma.leg.findMany({
      where,
      include: {
        trades: {
          orderBy: { timestamp: 'asc' },
          select: {
            orderId: true,
            side: true,
            price: true,
            amount: true,
            timestamp: true,
          },
        },
      },
      orderBy: { openDate: 'asc' },
      // 限制最多 100 条 leg，避免 token 超限
      take: 100,
    });

    if (legs.length === 0) {
      return { csv: '', rows: [], legCount: 0 };
    }

    const rows: CsvRow[] = legs.map((leg) => {
      const orderGroups = this.groupTradesByOrderId(leg.trades);
      const { execPath, inCount, outCount } = this.buildExecPath(leg.side, orderGroups);

      return {
        symbol: leg.symbol,
        side: leg.side,
        netPnL: parseFloat(leg.netPnL.toFixed(2)),
        mae: leg.mae !== null ? parseFloat(leg.mae.toFixed(6)) : null,
        mfe: leg.mfe !== null ? parseFloat(leg.mfe.toFixed(6)) : null,
        entryQuality: leg.entryQuality !== null ? parseFloat(leg.entryQuality.toFixed(2)) : null,
        exitQuality: leg.exitQuality !== null ? parseFloat(leg.exitQuality.toFixed(2)) : null,
        inCount,
        outCount,
        execPath,
      };
    });

    // 生成 CSV
    const header = 'symbol,side,netPnL,mae,mfe,entryQuality,exitQuality,in_count,out_count,exec_path';
    const csvLines = rows.map((r) =>
      [
        r.symbol,
        r.side,
        r.netPnL,
        r.mae ?? '',
        r.mfe ?? '',
        r.entryQuality ?? '',
        r.exitQuality ?? '',
        r.inCount,
        r.outCount,
        r.execPath,
      ].join(',')
    );

    return {
      csv: [header, ...csvLines].join('\n'),
      rows,
      legCount: legs.length,
    };
  }

  // ------------------------------------------
  // 2. AI 调用
  // ------------------------------------------

  /**
   * 调用 OpenAI 兼容 API（支持 OpenAI / DeepSeek / Moonshot / 通义千问等）
   */
  private static async callOpenAICompatible(
    baseUrl: string,
    apiKey: string,
    modelName: string,
    systemPrompt: string,
    userMessage: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    const payload = {
      model: modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature,
      max_tokens: maxTokens,
    };
    const payloadStr = JSON.stringify(payload);

    console.log(`[AI Report] [OpenAI] >>> POST ${url}`);
    console.log(`[AI Report] [OpenAI] >>> Headers: { Content-Type: application/json, Authorization: Bearer ${apiKey.slice(0, 6)}...${apiKey.slice(-4)} }`);
    console.log(`[AI Report] [OpenAI] >>> Payload size: ${(payloadStr.length / 1024).toFixed(1)} KB`);
    console.log(`[AI Report] [OpenAI] >>> Body:`);
    console.log(JSON.stringify(payload, null, 2));

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: payloadStr,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`[AI Report] [OpenAI] <<< Error ${resp.status}: ${errBody.slice(0, 500)}`);
      throw new Error(`OpenAI API error ${resp.status}: ${errBody}`);
    }

    const data = await resp.json();
    console.log(`[AI Report] [OpenAI] <<< Status: ${resp.status}, usage:`, data.usage || 'N/A');
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 调用 Anthropic Claude API
   */
  private static async callAnthropic(
    apiKey: string,
    modelName: string,
    systemPrompt: string,
    userMessage: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const url = 'https://api.anthropic.com/v1/messages';
    const payload = {
      model: modelName,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userMessage },
      ],
    };
    const payloadStr = JSON.stringify(payload);

    console.log(`[AI Report] [Anthropic] >>> POST ${url}`);
    console.log(`[AI Report] [Anthropic] >>> Headers: { Content-Type: application/json, x-api-key: ${apiKey.slice(0, 6)}...${apiKey.slice(-4)}, anthropic-version: 2023-06-01 }`);
    console.log(`[AI Report] [Anthropic] >>> Payload size: ${(payloadStr.length / 1024).toFixed(1)} KB`);
    console.log(`[AI Report] [Anthropic] >>> Body:`);
    console.log(JSON.stringify(payload, null, 2));

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: payloadStr,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`[AI Report] [Anthropic] <<< Error ${resp.status}: ${errBody.slice(0, 500)}`);
      throw new Error(`Anthropic API error ${resp.status}: ${errBody}`);
    }

    const data = await resp.json();
    console.log(`[AI Report] [Anthropic] <<< Status: ${resp.status}, usage:`, data.usage || 'N/A');
    return data.content?.[0]?.text || '';
  }

  /**
   * 调用 Google Gemini API
   */
  private static async callGemini(
    apiKey: string,
    modelName: string,
    systemPrompt: string,
    userMessage: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };
    const payloadStr = JSON.stringify(payload);

    console.log(`[AI Report] [Gemini] >>> POST https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`);
    console.log(`[AI Report] [Gemini] >>> Payload size: ${(payloadStr.length / 1024).toFixed(1)} KB`);
    console.log(`[AI Report] [Gemini] >>> Body:`);
    console.log(JSON.stringify(payload, null, 2));

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payloadStr,
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`[AI Report] [Gemini] <<< Error ${resp.status}: ${errBody.slice(0, 500)}`);
      throw new Error(`Gemini API error ${resp.status}: ${errBody}`);
    }

    const data = await resp.json();
    console.log(`[AI Report] [Gemini] <<< Status: ${resp.status}`);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  /**
   * 统一调用入口
   */
  private static async callAi(
    provider: AiProvider,
    baseUrl: string | null,
    apiKey: string,
    modelName: string,
    systemPrompt: string,
    userMessage: string,
    temperature: number,
    maxTokens: number
  ): Promise<string> {
    const effectiveBaseUrl = baseUrl || DEFAULT_BASE_URLS[provider];

    switch (provider) {
      case 'OPENAI':
        return this.callOpenAICompatible(effectiveBaseUrl, apiKey, modelName, systemPrompt, userMessage, temperature, maxTokens);
      case 'ANTHROPIC':
        return this.callAnthropic(apiKey, modelName, systemPrompt, userMessage, temperature, maxTokens);
      case 'GEMINI':
        return this.callGemini(apiKey, modelName, systemPrompt, userMessage, temperature, maxTokens);
      default:
        throw new Error(`不支持的 AI 提供商: ${provider}`);
    }
  }

  /**
   * 从报告内容中提取综合评级
   */
  private static extractScore(content: string): number | null {
    // 尝试匹配 "综合评级: A-" 或 "**综合评级: B+**" 等格式
    const gradeMatch = content.match(/综合评级[:：]\s*\**\s*([A-F][+-]?)\s*\**/i);
    if (!gradeMatch) return null;

    const gradeMap: Record<string, number> = {
      'A+': 97, 'A': 93, 'A-': 90,
      'B+': 87, 'B': 83, 'B-': 80,
      'C+': 77, 'C': 73, 'C-': 70,
      'D': 60, 'F': 30,
    };

    return gradeMap[gradeMatch[1].toUpperCase()] ?? null;
  }

  /**
   * 根据时间范围生成报告标题
   */
  private static generateTitle(startDate: Date, endDate: Date): string {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const formatDate = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;

    if (diffDays <= 7) {
      return `${formatDate(start)} - ${formatDate(end)} 周度复盘`;
    } else if (diffDays <= 35) {
      return `${start.getMonth() + 1}月 月度复盘`;
    } else {
      return `${formatDate(start)} - ${formatDate(end)} 交易报告`;
    }
  }

  // ------------------------------------------
  // 3. 报告生成（核心流程）
  // ------------------------------------------

  /**
   * 生成 AI 报告
   */
  static async generateReport(
    userId: number,
    params: {
      startDate: Date;
      endDate: Date;
      symbol?: string;
      apiKeyId?: number;
      aiConfigId?: number;
      temperature?: number;
      maxTokens?: number;
      tone?: string;
      customPrompt?: string;
    }
  ) {
    // 1. 获取用户的 AI 配置
    const configWhere: any = { userId };
    if (params.aiConfigId) {
      configWhere.id = params.aiConfigId;
    } else {
      configWhere.isDefault = true;
    }

    const aiConfig = await prisma.aiConfig.findFirst({ where: configWhere });
    if (!aiConfig) {
      throw new Error('未找到 AI 配置，请先在"账号配置"页面添加 AI 模型配置');
    }

    // 允许前端覆盖 temperature 和 maxTokens
    const effectiveTemperature = params.temperature ?? aiConfig.temperature;
    const effectiveMaxTokens = params.maxTokens ?? aiConfig.maxTokens;

    // 确定人设和自定义指令（前端传入 > 配置默认值）
    const effectiveTone = params.tone || aiConfig.defaultTone || 'objective';
    const effectiveCustomPrompt = params.customPrompt ?? aiConfig.customInstruction ?? '';

    // 动态组装 System Prompt
    const dynamicSystemPrompt = buildSystemPrompt(effectiveTone, effectiveCustomPrompt);

    // 2. 生成 CSV 数据
    const { csv, legCount } = await this.generateCsv(userId, {
      startDate: params.startDate,
      endDate: params.endDate,
      symbol: params.symbol,
      apiKeyId: params.apiKeyId,
    });

    if (legCount === 0) {
      throw new Error('所选时间范围内没有已平仓的交易记录');
    }

    console.log('[AI Report] ====== CSV 数据 ======');
    console.log(`[AI Report] 共 ${legCount} 笔已平仓仓位`);
    console.log(csv);
    console.log('[AI Report] ==========================');

    // 3. 组装 user message
    const userMessage = `以下是本周的交易记录 CSV 数据（共 ${legCount} 笔已平仓仓位）：\n\n${csv}`;

    console.log('[AI Report] ====== 请求参数 ======');
    console.log(`[AI Report] Provider   : ${aiConfig.provider}`);
    console.log(`[AI Report] Model      : ${aiConfig.modelName}`);
    console.log(`[AI Report] BaseURL    : ${aiConfig.baseUrl || '(默认)'}`);
    console.log(`[AI Report] Temperature: ${effectiveTemperature}${params.temperature !== undefined ? ' (前端覆盖)' : ''}`);
    console.log(`[AI Report] MaxTokens  : ${effectiveMaxTokens}${params.maxTokens !== undefined ? ' (前端覆盖)' : ''}`);
    console.log(`[AI Report] Tone       : ${effectiveTone} (${TONE_LABELS[effectiveTone] || '未知'})`);
    console.log(`[AI Report] CustomPrompt: ${effectiveCustomPrompt || '(无)'}`);
    console.log(`[AI Report] SystemPrompt 长度: ${dynamicSystemPrompt.length} 字符`);
    console.log(`[AI Report] UserMessage 长度 : ${userMessage.length} 字符`);
    console.log('[AI Report] ====== SystemPrompt 全文 ======');
    console.log(dynamicSystemPrompt);
    console.log('[AI Report] ==========================');

    // 4. 创建报告记录（状态 GENERATING）
    const title = this.generateTitle(params.startDate, params.endDate);
    const report = await prisma.aiReport.create({
      data: {
        userId,
        aiConfigId: aiConfig.id,
        title,
        provider: aiConfig.provider,
        modelName: aiConfig.modelName,
        startDate: params.startDate,
        endDate: params.endDate,
        filters: {
          symbol: params.symbol,
          apiKeyId: params.apiKeyId,
        },
        csvData: csv,
        promptUsed: dynamicSystemPrompt,
        content: '',
        status: 'GENERATING',
      },
    });

    // 5. 调用 AI
    try {
      const apiKey = decryptApiSecret(aiConfig.apiKey);
      const startTime = Date.now();

      console.log('[AI Report] >>>>>> 开始调用 AI API <<<<<<');

      const content = await this.callAi(
        aiConfig.provider,
        aiConfig.baseUrl,
        apiKey,
        aiConfig.modelName,
        dynamicSystemPrompt,
        userMessage,
        effectiveTemperature,
        effectiveMaxTokens
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const score = this.extractScore(content);

      console.log('[AI Report] ====== AI 响应 ======');
      console.log(`[AI Report] 耗时     : ${elapsed}s`);
      console.log(`[AI Report] 响应长度 : ${content.length} 字符`);
      console.log(`[AI Report] 提取评级 : ${score ?? '未识别'}`);
      console.log('[AI Report] 响应内容预览 (前500字):');
      console.log(content.slice(0, 500));
      console.log('[AI Report] ==========================');

      // 6. 更新报告
      const updated = await prisma.aiReport.update({
        where: { id: report.id },
        data: {
          content,
          score,
          status: 'COMPLETED',
        },
      });

      return updated;
    } catch (error) {
      console.error('[AI Report] ====== 调用失败 ======');
      console.error(`[AI Report] Provider : ${aiConfig.provider}`);
      console.error(`[AI Report] Model    : ${aiConfig.modelName}`);
      console.error(`[AI Report] Error    :`, error instanceof Error ? error.message : error);
      console.error('[AI Report] ==========================');

      // 标记失败
      await prisma.aiReport.update({
        where: { id: report.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : '未知错误',
        },
      });
      throw error;
    }
  }

  // ------------------------------------------
  // 4. 报告 CRUD
  // ------------------------------------------

  static async getReports(userId: number, page: number = 1, pageSize: number = 20) {
    const where = { userId };
    const total = await prisma.aiReport.count({ where });
    const data = await prisma.aiReport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        uuid: true,
        title: true,
        provider: true,
        modelName: true,
        startDate: true,
        endDate: true,
        score: true,
        status: true,
        errorMessage: true,
        createdAt: true,
      },
    });

    return {
      data,
      pagination: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) },
    };
  }

  static async getReportById(reportId: number, userId: number) {
    return prisma.aiReport.findFirst({
      where: { id: reportId, userId },
    });
  }

  static async deleteReport(reportId: number, userId: number) {
    return prisma.aiReport.delete({
      where: { id: reportId, userId },
    });
  }

  // ------------------------------------------
  // 5. AI 配置 CRUD
  // ------------------------------------------

  static async getConfigs(userId: number) {
    return prisma.aiConfig.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        uuid: true,
        name: true,
        provider: true,
        baseUrl: true,
        modelName: true,
        temperature: true,
        maxTokens: true,
        defaultTone: true,
        customInstruction: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
        // apiKey 不返回
      },
    });
  }

  static async createConfig(
    userId: number,
    data: {
      name: string;
      provider: AiProvider;
      apiKey: string;
      baseUrl?: string;
      modelName: string;
      temperature?: number;
      maxTokens?: number;
      defaultTone?: string;
      customInstruction?: string;
      isDefault?: boolean;
    }
  ) {
    const encryptedKey = encryptApiSecret(data.apiKey);

    // 如果设为默认，先清除其他默认
    if (data.isDefault) {
      await prisma.aiConfig.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    // 如果是第一个配置，自动设为默认
    const count = await prisma.aiConfig.count({ where: { userId } });
    const isDefault = data.isDefault || count === 0;

    return prisma.aiConfig.create({
      data: {
        userId,
        name: data.name,
        provider: data.provider,
        apiKey: encryptedKey,
        baseUrl: data.baseUrl || null,
        modelName: data.modelName,
        temperature: data.temperature ?? 0.7,
        maxTokens: data.maxTokens ?? 4096,
        defaultTone: data.defaultTone || 'objective',
        customInstruction: data.customInstruction || null,
        isDefault,
      },
      select: {
        id: true,
        uuid: true,
        name: true,
        provider: true,
        baseUrl: true,
        modelName: true,
        temperature: true,
        maxTokens: true,
        defaultTone: true,
        customInstruction: true,
        isDefault: true,
        createdAt: true,
      },
    });
  }

  static async updateConfig(
    configId: number,
    userId: number,
    data: {
      name?: string;
      apiKey?: string;
      baseUrl?: string;
      modelName?: string;
      temperature?: number;
      maxTokens?: number;
      defaultTone?: string;
      customInstruction?: string;
      isDefault?: boolean;
    }
  ) {
    const updateData: any = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.apiKey !== undefined) updateData.apiKey = encryptApiSecret(data.apiKey);
    if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl || null;
    if (data.modelName !== undefined) updateData.modelName = data.modelName;
    if (data.temperature !== undefined) updateData.temperature = data.temperature;
    if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens;
    if (data.defaultTone !== undefined) updateData.defaultTone = data.defaultTone;
    if (data.customInstruction !== undefined) updateData.customInstruction = data.customInstruction || null;

    if (data.isDefault) {
      await prisma.aiConfig.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
      updateData.isDefault = true;
    }

    return prisma.aiConfig.update({
      where: { id: configId, userId },
      data: updateData,
      select: {
        id: true,
        uuid: true,
        name: true,
        provider: true,
        baseUrl: true,
        modelName: true,
        temperature: true,
        maxTokens: true,
        defaultTone: true,
        customInstruction: true,
        isDefault: true,
        updatedAt: true,
      },
    });
  }

  static async deleteConfig(configId: number, userId: number) {
    return prisma.aiConfig.delete({
      where: { id: configId, userId },
    });
  }
}
