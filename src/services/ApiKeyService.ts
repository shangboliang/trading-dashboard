/**
 * 账号管理服务
 * 处理交易所 API Key 的增删改查、验证和同步
 */

import prisma from '@/lib/prisma';
import { encryptApiSecret, decryptApiSecret } from '@/utils/encryption';
import type { Exchange, SyncStatus } from '@prisma/client';

export interface CreateApiKeyInput {
  userId: number;
  name: string;
  exchange: Exchange;
  apiKey: string;
  apiSecret: string;
  passphrase?: string;
}

export interface UpdateApiKeyInput {
  name?: string;
  apiKey?: string;
  apiSecret?: string;
  passphrase?: string;
}

const EXCHANGE_MAP: Record<Exchange, string> = {
  BINANCE: 'binance',
  OKX: 'okx',
  BYBIT: 'bybit',
  HUOBI: 'huobi',
  GATEIO: 'gateio',
  KUCOIN: 'kucoin',
};

export class ApiKeyService {
  /**
   * 通过 CCXT 直接请求交易所获取当前 USDT 余额
   */
  static async getAccountBalance(userId: number, apiKeyId?: number): Promise<number> {
    return 0;

    // const keys = await prisma.apiKey.findMany({
    //   where: apiKeyId ? { id: apiKeyId, userId } : { userId, isVerified: true }, 
    // });

    // let totalBalance = 0;
    // if (keys.length === 0) return 0;

    // const ccxt = await import('ccxt');

    // for (const key of keys) {
    //   try {
    //     const decryptedSecret = decryptApiSecret(key.apiSecret);
    //     const decryptedPassphrase = key.passphrase ? decryptApiSecret(key.passphrase) : undefined;
        
    //     const exchangeId = EXCHANGE_MAP[key.exchange];
    //     const exchange = new (ccxt as any)[exchangeId]({
    //       apiKey: key.apiKey,
    //       secret: decryptedSecret,
    //       password: decryptedPassphrase,
    //       enableRateLimit: true,
    //       httpsProxy: process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:7890' : undefined,
    //     });

    //     // 默认获取合约账户余额
    //     exchange.options['defaultType'] = 'future';
    //     const balance = await exchange.fetchBalance();
    //     console.log('balance ' + balance);

        
    //     // 尝试获取 USDT 总权益
    //     if (balance.USDT && balance.USDT.total) {
    //       totalBalance += balance.USDT.total;
    //     } else if (balance.total && balance.total.USDT) {
    //       totalBalance += balance.total.USDT;
    //     } else if (balance.info && balance.info.totalCrossWalletBalance) {
    //       // 针对 Binance 等可能有额外返回字段的特殊处理
    //       totalBalance += parseFloat(balance.info.totalCrossWalletBalance);
    //     }
    //   } catch (err) {
    //     console.error(`获取 API Key (${key.id}) 余额失败:`, err);
    //   }
    // }

    // return totalBalance;
  }

  /**
   * 创建新的 API Key
   */
  static async createApiKey(input: CreateApiKeyInput) {
    // 加密存储 API Secret
    const encryptedSecret = encryptApiSecret(input.apiSecret);
    
    const apiKey = await prisma.apiKey.create({
      data: {
        userId: input.userId,
        name: input.name,
        exchange: input.exchange,
        apiKey: input.apiKey,
        apiSecret: encryptedSecret,
        passphrase: input.passphrase ? encryptApiSecret(input.passphrase) : undefined,
        syncStatus: 'PENDING',
      },
      select: {
        id: true,
        uuid: true,
        name: true,
        exchange: true,
        apiKey: true,
        isVerified: true,
        syncStatus: true,
        createdAt: true,
      },
    });
    
    return apiKey;
  }
  
  /**
   * 获取用户的所有 API Keys (不返回敏感信息)
   */
  static async getUserApiKeys(userId: number) {
    return prisma.apiKey.findMany({
      where: { userId },
      select: {
        id: true,
        uuid: true,
        name: true,
        exchange: true,
        apiKey: true, // 公开的 API Key (不需要解密)
        isVerified: true,
        lastSyncAt: true,
        syncStatus: true,
        errorMessage: true,
        asynSyncCount: true,
        lastAsynSyncAt: true,
        createdAt: true,
        asynSyncTasks: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 解密 API Secret
   */
  static async decrypt(encrypted: string) {
    return decryptApiSecret(encrypted);
  }
  
  /**
   * 获取单个 API Key (包含解密的凭证)
   */
  static async getApiKeyById(apiKeyId: number, userId: number) {
    const apiKey = await prisma.apiKey.findFirst({
      where: { 
        id: apiKeyId,
        userId,
      },
    });
    
    if (!apiKey) {
      throw new Error('API Key not found');
    }
    
    // 解密敏感信息
    const decryptedSecret = decryptApiSecret(apiKey.apiSecret);
    const decryptedPassphrase = apiKey.passphrase 
      ? decryptApiSecret(apiKey.passphrase) 
      : undefined;
    
    return {
      ...apiKey,
      apiSecret: decryptedSecret,
      passphrase: decryptedPassphrase,
    };
  }
  
  /**
   * 更新 API Key
   */
  static async updateApiKey(
    apiKeyId: number,
    userId: number,
    input: UpdateApiKeyInput
  ) {
    const updateData: any = {};
    
    if (input.name) {
      updateData.name = input.name;
    }
    
    if (input.apiKey) {
      updateData.apiKey = input.apiKey;
    }
    
    if (input.apiSecret) {
      updateData.apiSecret = encryptApiSecret(input.apiSecret);
    }
    
    if (input.passphrase) {
      updateData.passphrase = encryptApiSecret(input.passphrase);
    }
    
    return prisma.apiKey.update({
      where: {
        id: apiKeyId,
        userId,
      },
      data: updateData,
    });
  }
  
  /**
   * 删除 API Key
   */
  static async deleteApiKey(apiKeyId: number, userId: number) {
    return prisma.apiKey.delete({
      where: {
        id: apiKeyId,
        userId,
      },
    });
  }
  
  /**
   * 验证 API Key (调用交易所 API 验证有效性)
   */
  static async verifyApiKey(apiKeyId: number, userId: number) {
    const apiKey = await this.getApiKeyById(apiKeyId, userId);
    
    try {
      // TODO: 调用对应交易所的 API 验证
      // 这里需要根据不同交易所实现具体的验证逻辑
      
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          isVerified: true,
          verifiedAt: new Date(),
          syncStatus: 'COMPLETED',
        },
      });
      
      return { success: true, message: 'API Key 验证成功' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '验证失败';
      
      await prisma.apiKey.update({
        where: { id: apiKeyId },
        data: {
          isVerified: false,
          errorMessage,
        },
      });
      
      return { success: false, message: errorMessage };
    }
  }
  
  /**
   * 更新同步状态
   */
  static async updateSyncStatus(
    apiKeyId: number,
    status: SyncStatus,
    errorMessage?: string
  ) {
    return prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        syncStatus: status,
        lastSyncAt: status === 'COMPLETED' ? new Date() : undefined,
        errorMessage,
      },
    });
  }
}
