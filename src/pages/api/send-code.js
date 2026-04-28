/**
 * 发送邮箱验证码 API
 * 
 * POST /api/send-code
 * Body: { email: string, purpose: 'register' | 'login' | 'reset' }
 * 
 * 安全措施：
 * - 60 秒内同一邮箱只能发一次
 * - 校验 purpose 只允许特定值
 * - 先发邮件后存库，所有错误返回通用信息防止邮箱探测
 *
 * 依赖模块：
 * - db.js: 数据库查询封装
 * - email.js: 邮件发送与模板
 * - auth.js: 验证码生成
 * - response.js: 统一响应格式
 */
export const prerender = false;

import { getLatestVerificationCode, saveVerificationCode } from '../../lib/db.js';
import { sendEmail, buildVerificationEmailHtml } from '../../lib/email.js';
import { generateVerifyCode } from '../../lib/auth.js';
import { success, error, serverError } from '../../lib/response.js';

/** 允许的验证码用途 */
const ALLOWED_PURPOSES = ['register', 'login', 'reset'];

/** 用途标签映射 */
const PURPOSE_LABELS = {
  register: '注册',
  login: '登录',
  reset: '重置密码',
};

/**
 * POST - 发送验证码
 */
export async function POST({ request }) {
  try {
    const { email, purpose } = await request.json();

    // 基本参数校验
    if (!email || !purpose) return error('邮箱和用途不能为空');
    if (!ALLOWED_PURPOSES.includes(purpose)) return error('无效的请求类型');

    // 邮箱格式校验（简单规则）
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return error('邮箱格式不符合要求');

    const { env } = await import('cloudflare:workers');
    const db = env.DB;

    // 根据用途检查用户是否存在
    const existingUser = await db.prepare(
      'SELECT id FROM users WHERE email = ?'
    ).bind(email).first();

    if (purpose === 'register' && existingUser) {
      return error('该邮箱已被注册');
    }
    if (purpose === 'login' && !existingUser) {
      return error('该邮箱尚未注册');
    }
    if (purpose === 'reset' && !existingUser) {
      return error('该邮箱尚未注册');
    }

    // 频率限制：60 秒内不能重复发送
    const lastCode = await getLatestVerificationCode(email);
    if (lastCode) {
      const lastSentTime = new Date(lastCode.created_at + 'Z').getTime();
      if (Date.now() - lastSentTime < 60000) {
        return error('验证码已发送，请 60 秒后再试');
      }
    }

    // 生成验证码和过期时间
    const code = generateVerifyCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 发送邮件
    const apiKey = env.RESEND_API_KEY; 
    const purposeLabel = PURPOSE_LABELS[purpose] || purpose;
    const subject = `【我的次元日记】${purposeLabel}验证码`;
    const html = buildVerificationEmailHtml(code, purposeLabel);
    await sendEmail(apiKey, email, subject, html);

    // 存入数据库
    await saveVerificationCode(email, code, purpose, expiresAt);

    return success({ message: '验证码已发送，请查看邮箱' });
  } catch (e) {
    // 防止返回详细错误信息（邮箱探测防护）
    console.error('Send code error:', e);
    return serverError('验证码发送失败，请稍后重试');
  }
}

