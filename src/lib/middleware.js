/**
 * 认证与权限中间件
 * 
 * 提供快捷的登录验证和角色权限检查函数，
 * 供所有 API 端点统一使用。
 */
import { getCurrentUser, hasRole } from '../lib/auth.js';
import { unauthorized, forbidden, error } from '../lib/response.js';

/**
 * CSRF 防护：检查请求来源
 * 对 POST/PUT/DELETE 请求验证 Origin 或 Referer 头
 * 
 * @param {Request} request
 * @returns {boolean} 是否合法的请求来源
 */
export function csrfGuard(request) {
  // 仅对写操作检查
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
    return true;
  }

  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');

  // 允许没有来源的请求（例如 API 客户端）
  if (!origin && !referer) return true;

  // 动态构建允许的来源列表
  // 从 Host 头推断当前站点域名，确保同源请求总是可通过校验
  const host = request.headers.get('Host') || '';
  const protocol = request.headers.get('X-Forwarded-Proto') || 'https';
  const currentOrigin = `${protocol}://${host}`;

  const allowed = [
    currentOrigin,                                   // 动态：当前站点
    'https://my-anime-site.pages.dev',               // 保留：已部署的生产域名
    'http://localhost:4321',                         // 保留：astro dev
    'http://localhost:8788',                         // 保留：wrangler dev
  ];

  if (origin) {
    if (allowed.some(a => origin.startsWith(a))) return true;
  }
  if (referer) {
    if (allowed.some(a => referer.startsWith(a))) return true;
  }

  return false;
}

/**
 * CSRF 中间件包装器
 * 用法: export async function POST({ request }) { return csrfMiddleware(request, () => handlePost(request)); }
 */
export function csrfMiddleware(request, handler) {
  if (!csrfGuard(request)) {
    return error('CSRF 校验失败，请求来源不被允许', { status: 403 });
  }
  return handler();
}

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

