/**
 * 健康检查端点
 * 
 * GET /api/health
 * 
 * 用于监控服务状态、D1 数据库连接是否正常。
 */
export const prerender = false;

import { success, serverError } from '../../lib/response.js';

export async function GET() {
  try {
    const { env } = await import('cloudflare:workers');
    const db = env.DB;
    
    // 简单数据库连接检查
    const result = await db.prepare('SELECT 1 as ok').first();
    
    return success({
      status: 'ok',
      db: result?.ok === 1 ? 'connected' : 'error',
      timestamp: new Date().toISOString(),
      uptime: globalThis.process?.uptime ? Math.floor(process.uptime()) : 'unknown',
    });
  } catch (e) {
    return serverError('Health check failed: ' + e.message);
  }
}
