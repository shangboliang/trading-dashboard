import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetSyncStatus() {
  console.log('正在检查卡住的同步任务...');
  
  const result = await prisma.apiKey.updateMany({
    where: {
      syncStatus: 'SYNCING',
    },
    data: {
      syncStatus: 'PENDING',
      errorMessage: '任务已手动重置',
    },
  });

  console.log(`成功重置了 ${result.count} 个 API Key 的状态。`);
  await prisma.$disconnect();
}

resetSyncStatus().catch(err => {
  console.error('重置失败:', err);
  process.exit(1);
});
