export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/ApiKeyService';

/**
 * GET /api/accounts/[id]
 * 获取单个账户详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const apiKeyId = parseInt(params.id);
    
    const account = await ApiKeyService.getApiKeyById(apiKeyId, userId);
    
    // 不返回敏感的 apiSecret 和 passphrase
    const { apiSecret: _, passphrase: __, ...safeAccount } = account;
    
    return NextResponse.json(safeAccount);
  } catch (error) {
    console.error('Failed to fetch account:', error);
    return NextResponse.json(
      { error: '获取账户详情失败' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/accounts/[id]
 * 更新账户配置
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const apiKeyId = parseInt(params.id);
    const body = await request.json();
    
    const { name, apiKey, apiSecret, passphrase } = body;
    
    await ApiKeyService.updateApiKey(apiKeyId, userId, {
      name,
      apiKey,
      apiSecret,
      passphrase,
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to update account:', error);
    return NextResponse.json(
      { error: '更新账户失败' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/accounts/[id]
 * 删除账户
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const apiKeyId = parseInt(params.id);
    
    await ApiKeyService.deleteApiKey(apiKeyId, userId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete account:', error);
    return NextResponse.json(
      { error: '删除账户失败' },
      { status: 500 }
    );
  }
}
