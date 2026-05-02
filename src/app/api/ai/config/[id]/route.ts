export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { AuthError, authErrorResponse, requireUser } from '@/lib/auth';
import { AiReportService } from '@/services/AiReportService';

// PUT /api/ai/config/[id] - 更新 AI 配置
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const configId = parseInt(params.id);

    if (isNaN(configId)) {
      return NextResponse.json({ error: '无效的配置 ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, apiKey, baseUrl, modelName, temperature, maxTokens, defaultTone, customInstruction, isDefault } = body;

    const config = await AiReportService.updateConfig(configId, user.id, {
      name,
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
    console.error('[AI Config] Update failed:', error);
    return NextResponse.json({ error: '更新 AI 配置失败' }, { status: 500 });
  }
}

// DELETE /api/ai/config/[id] - 删除 AI 配置
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const configId = parseInt(params.id);

    if (isNaN(configId)) {
      return NextResponse.json({ error: '无效的配置 ID' }, { status: 400 });
    }

    await AiReportService.deleteConfig(configId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[AI Config] Delete failed:', error);
    return NextResponse.json({ error: '删除 AI 配置失败' }, { status: 500 });
  }
}
