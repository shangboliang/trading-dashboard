export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { AuthError, authErrorResponse, requireUser } from "@/lib/auth";
import { LegService } from "@/services/LegService";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "无效的 ID" }, { status: 400 });
    }

    const user = await requireUser();
    const leg = await LegService.getLegById(id, user.id);

    if (!leg) {
      return NextResponse.json({ error: "未找到该交易记录" }, { status: 404 });
    }

    return NextResponse.json(leg);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to get leg details:", error);
    return NextResponse.json({ error: "获取详情失败" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = Number(params.id);

    if (Number.isNaN(id)) {
      return NextResponse.json({ error: "无效的 ID" }, { status: 400 });
    }

    const body = await request.json();
    const user = await requireUser();

    const updatedLeg = await LegService.updateLeg(id, user.id, {
      notes: body.notes,
      strategy: body.strategy,
      setup: body.setup,
      mistakes: body.mistakes,
      tagIds: body.tagIds,
    });

    return NextResponse.json(updatedLeg);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error("Failed to update leg details:", error);
    return NextResponse.json({ error: "更新详情失败" }, { status: 500 });
  }
}
