export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { FundingFeeService } from '@/services/FundingFeeService';
import { AuthError, authErrorResponse, requireApiKeyOwner, requireUser } from '@/lib/auth';
import { decodeCsv } from '@/utils/csv-encoding';
import { type IncomeHeaderMapping } from '@/services/IncomeCsvService';

/**
 * GET /api/funding
 * 获取资金费列表（分页、筛选）
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(request.url);

    const rawApiKeyId = searchParams.get('apiKeyId');
    const apiKeyId = rawApiKeyId ? Number.parseInt(rawApiKeyId, 10) : undefined;
    const symbol = searchParams.get('symbol') || undefined;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');

    if (rawApiKeyId && !Number.isInteger(apiKeyId)) {
      return NextResponse.json({ error: 'apiKeyId 格式无效' }, { status: 400 });
    }

    if (apiKeyId !== undefined) {
      await requireApiKeyOwner(apiKeyId, user.id);
    }

    const result = await FundingFeeService.getFundingFees({
      apiKeyId,
      userId: user.id,
      symbol,
      startDate,
      endDate,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Failed to fetch funding fees:', error);
    return NextResponse.json({ error: '获取资金费列表失败' }, { status: 500 });
  }
}

/**
 * POST /api/funding
 * CSV 导入资金费
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const apiKeyId = parseInt(formData.get('apiKeyId') as string);
    const file = formData.get('file') as File;
    const mappingStr = formData.get('headerMapping') as string | null;

    if (!apiKeyId || !file) {
      return NextResponse.json({ error: 'apiKeyId 或 file 缺失' }, { status: 400 });
    }

    // 解析表头映射配置
    let headerMapping: IncomeHeaderMapping | undefined;
    if (mappingStr) {
      try {
        headerMapping = JSON.parse(mappingStr);
      } catch {
        return NextResponse.json({ error: 'headerMapping 格式无效' }, { status: 400 });
      }
    }

    // 验证用户权限
    const user = await requireUser();
    await requireApiKeyOwner(apiKeyId, user.id);

    const csvContent = decodeCsv(await file.arrayBuffer());
    const imported = await FundingFeeService.syncByCsv(apiKeyId, csvContent, headerMapping);

    return NextResponse.json({ message: '资金费导入成功', imported });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Funding CSV import failed:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : '导入失败' }, { status: 500 });
  }
}
