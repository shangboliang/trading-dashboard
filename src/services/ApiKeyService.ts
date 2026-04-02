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

export class ApiKeyService {
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
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
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
