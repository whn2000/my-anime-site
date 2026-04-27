/**
 * 认证与权限中间件
 * 
 * 提供快捷的登录验证和角色权限检查函数，
 * 供所有 API 端点统一使用。
 */
import { getCurrentUser, hasRole } from '../lib/auth.js';
import { unauthorized, forbidden } from '../lib/response.js';

/**
 * 从请求中获取当前登录用户
 * @param {Object} cookies - Astro cookies 对象
 * @returns {Promise<Object|null>} 用户对象或 null
 */
export async function requireUser(cookies) {
  const { env } = await import('cloudflare:workers');
  const db = env.DB;
  return await getCurrentUser(db, cookies);
}

/**
 * 需要登录的 API 中间件
 * 如果没有登录，返回 401 错误
 * 
 * @param {Function} handler - (user, request, ...args) => Response
 * @returns {Function}
 */
export function requireAuth(handler) {
  return async (request, cookies, ...args) => {
    const { env } = await import('cloudflare:workers');
    const db = env.DB;
    const user = await getCurrentUser(db, cookies);

    if (!user) {
      return unauthorized();
    }

    return handler(user, request, cookies, ...args);
  };
}

/**
 * 需要特定角色的 API 中间件
 * 如果没有登录或角色不符，返回对应错误
 * 
 * @param {string[]} allowedRoles - 允许的角色列表
 * @param {Function} handler - (user, request, ...args) => Response
 * @returns {Function}
 */
export function requireRole(allowedRoles) {
  return (handler) => {
    return async (request, cookies, ...args) => {
      const { env } = await import('cloudflare:workers');
      const db = env.DB;
      const user = await getCurrentUser(db, cookies);

      if (!user) {
        return unauthorized();
      }

      if (!hasRole(user, allowedRoles)) {
        return forbidden('权限不足，仅限站长和管理员操作');
      }

      return handler(user, request, cookies, ...args);
    };
  };
}

/**
 * 创建统一的请求上下文对象（包含 db 和 user）
 * @param {Object} cookies - Astro cookies
 * @returns {Promise<{db: D1Database, user: Object|null}>}
 */
export async function createRequestContext(cookies) {
  const { env } = await import('cloudflare:workers');
  const db = env.DB;
  const user = await getCurrentUser(db, cookies);
  return { db, user };
}
