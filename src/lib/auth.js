// src/lib/auth.js
// 认证与会话管理工具库
//
// 依赖模块：
// - db.js: 数据库查询封装 (会话管理、验证码校验)

import { getSessionUser, insertSession, removeSession, updateSessionLastActive } from './db.js';

/**
 * 对密码进行 SHA-256 哈希（用于旧密码兼容验证）
 * @param {string} password - 明文密码
 * @returns {Promise<string>} 十六进制哈希字符串
 */
export async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 验证密码 - 自动兼容旧版 SHA-256 和新版 PBKDF2 哈希
 * @param {string} password - 明文密码
 * @param {string} storedHash - 数据库中存储的哈希值
 * @returns {Promise<boolean>}
 */
export async function verifyPassword(password, storedHash) {
  if (storedHash.includes(':')) {
    const [saltHex] = storedHash.split(':');
    const newHash = await generatePbkdf2Hash(password, saltHex);
    return newHash === storedHash;
  } else {
    return (await hashPassword(password)) === storedHash;
  }
}

/**
 * 使用 PBKDF2 生成强密码哈希（带随机盐，迭代 100,000 次）
 * @param {string} password - 明文密码
 * @param {string|null} saltHexStr - 可选的盐值（用于验证已有哈希）
 * @returns {Promise<string>} 格式 "salt:hash" 的十六进制字符串
 */
export async function generatePbkdf2Hash(password, saltHexStr = null) {
  const enc = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  let saltArray;
  if (saltHexStr) {
    saltArray = new Uint8Array(saltHexStr.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
  } else {
    saltArray = crypto.getRandomValues(new Uint8Array(16));
  }

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltArray,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );

  const finalSaltHex = Array.from(saltArray).map(b => b.toString(16).padStart(2, '0')).join('');
  const finalHashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${finalSaltHex}:${finalHashHex}`;
}

/**
 * 生成随机 Session Token (64 字符十六进制)
 */
export function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 生成邀请码 (16 字符十六进制)
 */
export function generateInviteCode() {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 生成 6 位纯数字验证码
 */
export function generateVerifyCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * 校验邮箱验证码（委托给 db.js）
 * @param {D1Database} db 
 * @param {string} email 
 * @param {string} code 
 * @param {string} purpose 'register' | 'login' | 'reset'
 */
export async function checkVerificationCode(db, email, code, purpose) {
  const { verifyCode } = await import('./db.js');
  return verifyCode(email, code, purpose);
}

/**
 * 创建会话 - 委托给 db.js 实现
 * @param {D1Database} db
 * @param {number} userId
 * @returns {Promise<string>} session token
 */
export async function createSession(db, userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await insertSession(userId, token, expiresAt);
  return token;
}

/**
 * 从 Cookie 获取当前登录用户（含 Session 轮换机制）
 * 
 * 每次请求检查上次活跃时间，如果距上次活跃超过 15 分钟，
 * 则生成新 token 并清除旧 token，降低会话固定攻击风险。
 * 
 * @param {D1Database} db
 * @param {import('astro').AstroCookies} cookies
 * @returns {Promise<Object|null>}
 */
export async function getCurrentUser(db, cookies) {
  const token = cookies.get('session_token')?.value;
  if (!token) return null;

  const user = await getSessionUser(token);
  if (!user) return null;

  // Session 轮换：检查上次活跃时间（15 分钟阈值）
  try {
    const rotated = await updateSessionLastActive(token);
    if (rotated && rotated.newToken) {
      // 设置新的 Cookie 替换旧的
      setSessionCookie(cookies, rotated.newToken);
    }
  } catch {
    // 轮换失败不影响登录状态
  }

  return user;
}

/**
 * 销毁会话
 */
export async function destroySession(db, cookies) {
  const token = cookies.get('session_token')?.value;
  if (token) {
    await removeSession(token);
  }
}

/**
 * 设置 Session Cookie
 */
export function setSessionCookie(cookies, token) {
  cookies.set('session_token', token, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
  });
}

/**
 * 清除 Session Cookie
 */
export function clearSessionCookie(cookies) {
  cookies.delete('session_token', { path: '/' });
}

/**
 * 检查用户是否有指定角色
 */
export function hasRole(user, allowedRoles) {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

/**
 * 角色显示名映射
 */
export function getRoleLabel(role) {
  const map = {
    owner: '站长',
    admin: '管理员',
    user: '用户',
  };
  return map[role] || role;
}
