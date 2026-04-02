/**
 * 加密工具模块
 * 用于加密/解密交易所 API Key 和 Secret
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits

// 获取加密密钥 (从环境变量)
function getEncryptionKey(): Buffer {
  const keyHex = process.env.ENCRYPTION_KEY;
  
  if (!keyHex) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  
  const key = Buffer.from(keyHex, 'hex');
  
  if (key.length !== KEY_LENGTH) {
    throw new Error(`ENCRYPTION_KEY must be ${KEY_LENGTH} bytes (64 hex characters)`);
  }
  
  return key;
}

/**
 * 加密文本
 * @param text - 要加密的明文
 * @returns 包含密文、IV 和认证标签的对象
 */
export function encrypt(text: string): { encrypted: string; iv: string; tag: string } {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  };
}

/**
 * 解密文本
 * @param data - 包含密文、IV 和认证标签的对象
 * @returns 解密后的明文
 */
export function decrypt(data: { encrypted: string; iv: string; tag: string }): string {
  const key = getEncryptionKey();
  const iv = Buffer.from(data.iv, 'hex');
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(Buffer.from(data.tag, 'hex'));
  
  let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * 加密 API Secret (便捷方法)
 * @param secret - API Secret 明文
 * @returns 加密后的字符串 (格式：iv:tag:encrypted)
 */
export function encryptApiSecret(secret: string): string {
  const { encrypted, iv, tag } = encrypt(secret);
  // 将三部分拼接成一个字符串存储
  return `${iv}:${tag}:${encrypted}`;
}

/**
 * 解密 API Secret (便捷方法)
 * @param encrypted - 加密的字符串 (格式：iv:tag:encrypted)
 * @returns API Secret 明文
 */
export function decryptApiSecret(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format');
  }
  
  const [iv, tag, encryptedData] = parts;
  return decrypt({ iv, tag, encrypted: encryptedData });
}
