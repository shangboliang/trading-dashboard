export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { IncomeCsvService } from '@/services/IncomeCsvService';
import { AuthError, authErrorResponse, requireUser } from '@/lib/auth';

/**
 * POST /api/funding/headers
 * 检测 CSV 表头
 */
export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'file 缺失' }, { status: 400 });
    }

    const csvContent = await file.text();
    const headers = IncomeCsvService.detectHeaders(csvContent);

    return NextResponse.json({ headers });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Detect headers failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '检测表头失败' }, { status: 500 });
  }
}
