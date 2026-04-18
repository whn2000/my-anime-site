// src/lib/auth.js
// 认证与会话管理工具库

/**
 * SHA-256 哈希密码
 */
export async function hashPassword(password) {
  const msgUint8 = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
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
 * 通过 Resend API 发送邮件 (Cloudflare Workers 环境)
 */
export async function sendEmailWithResend(apiKey, to, subject, html) {
  if (!apiKey) throw new Error("RESEND_API_KEY is not configured.");
  
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev', // Resend 测试限制：必须用这个发件人
      to: [to],
      subject: subject,
      html: html
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || '邮件发送失败');
  }
  return data;
}

/**
 * 校验邮箱验证码
 * @param {D1Database} db 
 * @param {string} email 
 * @param {string} code 
 * @param {string} purpose 'register' | 'login' | 'reset'
 */
export async function checkVerificationCode(db, email, code, purpose) {
  const record = await db.prepare(
    "SELECT * FROM verification_codes WHERE email = ? AND code = ? AND purpose = ? AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
  ).bind(email, code, purpose).first();

  if (!record) return false;

  // 验证码验证成功后，立即让它作废，防止暴力重用
  await db.prepare("DELETE FROM verification_codes WHERE id = ?").bind(record.id).run();
  return true;
}

/**
 * 创建会话 - 在 DB 中插入 session 记录，返回 token
 * @param {D1Database} db
 * @param {number} userId
 * @returns {Promise<string>} session token
 */
export async function createSession(db, userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).bind(token, userId, expiresAt).run();
  return token;
}

/**
 * 从 Cookie 获取当前登录用户
 * @param {D1Database} db
 * @param {import('astro').AstroCookies} cookies
 * @returns {Promise<{id: number, email: string, username: string, role: string} | null>}
 */
export async function getCurrentUser(db, cookies) {
  const token = cookies.get('session_token')?.value;
  if (!token) return null;

  const row = await db.prepare(`
    SELECT u.id, u.email, u.username, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(token).first();

  return row || null;
}

/**
 * 销毁会话
 */
export async function destroySession(db, cookies) {
  const token = cookies.get('session_token')?.value;
  if (token) {
    await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
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
