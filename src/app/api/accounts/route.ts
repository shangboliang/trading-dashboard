import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/services/ApiKeyService';
import type { Exchange } from '@prisma/client';

/**
 * GET /api/accounts
 * 获取用户的所有 API Key 账户列表
 */
export async function GET() {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    
    const accounts = await ApiKeyService.getUserApiKeys(userId);
    
    return NextResponse.json(accounts);
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return NextResponse.json(
      { error: '获取账户列表失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/accounts
 * 创建新的 API Key 账户
 */
export async function POST(request: Request) {
  try {
    const userId = parseInt(process.env.DEFAULT_USER_ID || '1');
    const body = await request.json();
    
    const { name, exchange, apiKey, apiSecret, passphrase } = body;
    
    // 验证必填字段
    if (!name || !exchange || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: '缺少必填字段' },
        { status: 400 }
      );
    }
    
    // 验证交易所
    const validExchanges: string[] = ['BINANCE', 'OKX', 'BYBIT', 'HUOBI', 'GATEIO', 'KUCOIN'];
    if (!validExchanges.includes(exchange)) {
      return NextResponse.json(
        { error: '不支持的交易所' },
        { status: 400 }
      );
    }
    
    // 创建 API Key
    const newAccount = await ApiKeyService.createApiKey({
      userId,
      name,
      exchange: exchange as Exchange,
      apiKey,
      apiSecret,
      passphrase,
    });
    
    return NextResponse.json(newAccount, { status: 201 });
  } catch (error) {
    console.error('Failed to create account:', error);
    return NextResponse.json(
      { error: '创建账户失败' },
      { status: 500 }
    );
  }
}
