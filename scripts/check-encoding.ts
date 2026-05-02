import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    // 检查客户端编码
    const result = await prisma.$queryRaw`SHOW client_encoding`;
    console.log('Client encoding:', result);
    
    // 检查服务端编码
    const serverResult = await prisma.$queryRaw`SHOW server_encoding`;
    console.log('Server encoding:', serverResult);
    
    // 检查数据库编码
    const dbResult = await prisma.$queryRaw`
      SELECT pg_encoding_to_char(encoding) 
      FROM pg_database 
      WHERE datname = current_database()
    `;
    console.log('Database encoding:', dbResult);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
