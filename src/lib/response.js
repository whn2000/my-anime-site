/**
 * 统一 HTTP 响应格式
 * 
 * 所有 API 端点的标准化响应封装。
 * 提供成功/错误响应的快捷创建方式，保持全站一致的响应格式。
 */

/**
 * 创建 JSON 格式的成功响应
 * @param {Object} data - 响应数据
 * @param {Object} options
 * @param {number} options.status - HTTP 状态码 (默认 200)
 * @param {Object} options.headers - 额外的响应头
 * @returns {Response}
 */
export function success(data = {}, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify({
    success: true,
    ...data,
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * 创建 JSON 格式的错误响应
 * @param {string} message - 错误描述
 * @param {Object} options
 * @param {number} options.status - HTTP 状态码 (默认 400)
 * @param {Object} options.headers - 额外的响应头
 * @returns {Response}
 */
export function error(message = '请求失败', { status = 400, headers = {} } = {}) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
  }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * 创建未授权响应 (401)
 * @param {string} message
 * @returns {Response}
 */
export function unauthorized(message = '请先登录') {
  return error(message, { status: 401 });
}

/**
 * 创建权限不足响应 (403)
 * @param {string} message
 * @returns {Response}
 */
export function forbidden(message = '权限不足') {
  return error(message, { status: 403 });
}

/**
 * 创建资源不存在响应 (404)
 * @param {string} message
 * @returns {Response}
 */
export function notFound(message = '资源不存在') {
  return error(message, { status: 404 });
}

/**
 * 创建服务器错误响应 (500)
 * @param {string} message
 * @returns {Response}
 */
export function serverError(message = '服务器内部错误') {
  return error(message, { status: 500 });
}
