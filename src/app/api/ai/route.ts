export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { AuthError, authErrorResponse, requireUser } from '@/lib/auth';
import { AiReportService } from '@/services/AiReportService';

// POST /api/ai - 生成报告
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = await request.json();

    const { startDate, endDate, symbol, apiKeyId, aiConfigId, temperature, maxTokens, tone, customPrompt } = body;

    if (!startDate || !endDate) {
      return NextResponse.json({ error: '请提供 startDate 和 endDate' }, { status: 400 });
    }

    const report = await AiReportService.generateReport(user.id, {
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      symbol,
      apiKeyId,
      aiConfigId,
      temperature: temperature !== undefined ? parseFloat(temperature) : undefined,
      maxTokens: maxTokens !== undefined ? parseInt(maxTokens) : undefined,
      tone,
      customPrompt,
    });

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[AI Report] Generate failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '报告生成失败' },
      { status: 500 }
    );
  }
}

// GET /api/ai - 获取报告列表
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');

    const result = await AiReportService.getReports(user.id, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[AI Report] List failed:', error);
    return NextResponse.json({ error: '获取报告列表失败' }, { status: 500 });
  }
}
