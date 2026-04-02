import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import logger from '@/lib/logger';

export function middleware(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const startTime = Date.now();
  
  // 记录请求信息
  logger.info(
    {
      requestId,
      method: request.method,
      path: request.nextUrl.pathname,
      searchParams: Object.fromEntries(request.nextUrl.searchParams),
    },
    'HTTP 请求'
  );
  
  // 继续处理请求
  const response = NextResponse.next();
  
  // 添加请求 ID 到响应头
  response.headers.set('X-Request-ID', requestId);
  
  // 记录响应完成时间（在客户端）
  response.headers.set('X-Start-Time', startTime.toString());
  
  return response;
}

// 配置中间件匹配的路由
export const config = {
  matcher: '/api/:path*',
};
