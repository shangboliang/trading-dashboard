export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { AuthError, authErrorResponse, requireUser } from '@/lib/auth';
import { AiReportService } from '@/services/AiReportService';

// GET /api/ai/[id] - 获取单个报告
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const reportId = parseInt(params.id);

    if (isNaN(reportId)) {
      return NextResponse.json({ error: '无效的报告 ID' }, { status: 400 });
    }

    const report = await AiReportService.getReportById(reportId, user.id);
    if (!report) {
      return NextResponse.json({ error: '报告不存在' }, { status: 404 });
    }

    return NextResponse.json(report);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[AI Report] Get failed:', error);
    return NextResponse.json({ error: '获取报告失败' }, { status: 500 });
  }
}

// DELETE /api/ai/[id] - 删除报告
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireUser();
    const reportId = parseInt(params.id);

    if (isNaN(reportId)) {
      return NextResponse.json({ error: '无效的报告 ID' }, { status: 400 });
    }

    await AiReportService.deleteReport(reportId, user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('[AI Report] Delete failed:', error);
    return NextResponse.json({ error: '删除报告失败' }, { status: 500 });
  }
}
