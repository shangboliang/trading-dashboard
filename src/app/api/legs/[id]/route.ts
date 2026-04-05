export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from 'next/server';
import { LegService } from '@/services/LegService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的 ID' }, { status: 400 });
    }

    // TODO: 实际应用中需要从 session 获取 userId
    const userId = 1;

    const leg = await LegService.getLegById(id, userId);

    if (!leg) {
      return NextResponse.json({ error: '未找到该交易记录' }, { status: 404 });
    }

    return NextResponse.json(leg);
  } catch (error) {
    console.error('Failed to get leg details:', error);
    return NextResponse.json({ error: '获取详情失败' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: '无效的 ID' }, { status: 400 });
    }

    const body = await request.json();
    // TODO: 实际应用中需要从 session 获取 userId
    const userId = 1;

    const updatedLeg = await LegService.updateLeg(id, userId, {
      notes: body.notes,
      strategy: body.strategy,
      setup: body.setup,
      mistakes: body.mistakes,
      tagIds: body.tagIds,
    });

    return NextResponse.json(updatedLeg);
  } catch (error) {
    console.error('Failed to update leg details:', error);
    return NextResponse.json({ error: '更新详情失败' }, { status: 500 });
  }
}
