import pino from 'pino';
import path from 'path';
import fs from 'fs';

// 确保日志目录存在
const logDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 创建 pino 日志实例
const logger = pino(
  {
    level: process.env.LOG_LEVEL || 'info',
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  // 同时输出到控制台和文件
  pino.multistream([
    { stream: pino.transport({ target: 'pino-pretty' }), level: 'info' },
    {
      stream: pino.transport({
        target: 'pino/file',
        options: {
          destination: path.join(logDir, 'app.log'),
          mkdir: true,
        },
      }),
      level: 'info',
    },
  ])
);

export default logger;
