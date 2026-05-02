export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { AuthError, authErrorResponse, requireUser } from '@/lib/auth';
import { AiReportService } from '@/services/AiReportService';

// GET /api/ai/config - 获取 AI 配置列表
export async function GET() {
  try {
    const user = await requireUser();
    const configs = await AiReportService.getConfigs(user.id);
    return NextResponse.json(configs);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[AI Config] List failed:', error);
    return NextResponse.json({ error: '获取 AI 配置失败' }, { status: 500 });
  }
}

// POST /api/ai/config - 创建 AI 配置
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { name, provider, apiKey, baseUrl, modelName, temperature, maxTokens, defaultTone, customInstruction, isDefault } = body;

    if (!name || !provider || !apiKey || !modelName) {
      return NextResponse.json(
        { error: '请填写 name, provider, apiKey, modelName' },
        { status: 400 }
      );
    }

    const validProviders = ['OPENAI', 'ANTHROPIC', 'GEMINI'];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { error: `provider 必须是 ${validProviders.join(', ')} 之一` },
        { status: 400 }
      );
    }

    const config = await AiReportService.createConfig(user.id, {
      name,
      provider,
      apiKey,
      baseUrl,
      modelName,
      temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
      maxTokens: maxTokens !== undefined ? parseInt(maxTokens) : undefined,
      defaultTone,
      customInstruction,
      isDefault,
    });

    return NextResponse.json(config);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[AI Config] Create failed:', error);
    return NextResponse.json({ error: '创建 AI 配置失败' }, { status: 500 });
  }
}
