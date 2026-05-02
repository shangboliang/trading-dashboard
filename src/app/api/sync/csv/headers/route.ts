export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { BinanceCsvService } from '@/services/BinanceCsvService';
import { AuthError, authErrorResponse, requireUser } from '@/lib/auth';
import { decodeCsv } from '@/utils/csv-encoding';

export async function POST(request: NextRequest) {
  try {
    await requireUser();

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'file 缺失' }, { status: 400 });
    }

    const csvContent = decodeCsv(await file.arrayBuffer());
    const headers = BinanceCsvService.detectHeaders(csvContent);

    return NextResponse.json({ headers });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Detect headers failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '检测表头失败' }, { status: 500 });
  }
}
