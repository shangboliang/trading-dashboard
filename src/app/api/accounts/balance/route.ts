export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/ApiKeyService';
import { AuthError, authErrorResponse, requireUser } from '@/lib/auth';

/**
 * GET /api/accounts/balance
 * 实时获取绑定的交易所账户余额汇总
 */
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const user = await requireUser();
    const userId = user.id;
    const apiKeyIdParam = searchParams.get('apiKeyId');
    const apiKeyId = apiKeyIdParam ? parseInt(apiKeyIdParam) : undefined;
    
    const balance = await ApiKeyService.getAccountBalance(userId, apiKeyId);
    
    return NextResponse.json({ balance });
  } catch (error) {
    if (error instanceof AuthError) return authErrorResponse(error);
    console.error('Failed to fetch account balance:', error);
    // 返回 0 而不是报错，避免前端崩溃
    return NextResponse.json(
      { balance: 0, error: '获取余额失败' },
      { status: 200 } 
    );
  }
}
