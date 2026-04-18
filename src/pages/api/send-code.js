// src/pages/api/send-code.js
export const prerender = false;
import { env } from "cloudflare:workers";
import { generateVerifyCode, sendEmailWithResend } from "../../lib/auth.js";

export async function POST({ request }) {
  try {
    const { email, purpose } = await request.json();

    if (!email || !purpose) {
      return new Response(JSON.stringify({ error: "邮箱和请求类型不能为空" }), { status: 400 });
    }

    // 简单验证邮箱格式
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "邮箱格式不符合要求" }), { status: 400 });
    }

    const db = env.DB;

    // 1. 根据目的（purpose）检查用户是否存在
    const existingUser = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    
    if (purpose === 'register' && existingUser) {
      return new Response(JSON.stringify({ error: "此邮箱已被注册，请直接登录" }), { status: 400 });
    }
    
    if ((purpose === 'login' || purpose === 'reset') && !existingUser) {
      return new Response(JSON.stringify({ error: "此邮箱未注册，请先注册" }), { status: 400 });
    }

    // 2. 防刷机制：同一个邮箱 60 秒内只能发一次
    const lastCode = await db.prepare(
      "SELECT created_at FROM verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1"
    ).bind(email).first();

    if (lastCode) {
      // created_at 是 UTC 字符串，转成本地时间戳计算
      const lastSentTime = new Date(lastCode.created_at + 'Z').getTime();
      const now = Date.now();
      if (now - lastSentTime < 60000) {
        return new Response(JSON.stringify({ error: "发送太过频繁，请 60 秒后再试" }), { status: 429 });
      }
    }

    // 3. 生成验证码和过期时间
    const code = generateVerifyCode();
    // 设定 10 分钟后过期
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString();

    // 4. 发送邮件
    let subject = "验证码";
    if (purpose === 'register') subject = "账号注册验证码 - MyAnimeList";
    if (purpose === 'login') subject = "登录验证码 - MyAnimeList";
    if (purpose === 'reset') subject = "重置密码验证码 - MyAnimeList";

    const html = `
      <div style="font-family: sans-serif; padding: 20px;">
        <h2>MyAnimeList 身份验证</h2>
        <p>您的验证码是: <strong style="font-size: 24px; color: #f09199;">${code}</strong></p>
        <p>该验证码将在 10 分钟后过期。请勿告诉他人。</p>
      </div>
    `;

    // 必须在环境变量里配置 RESEND_API_KEY
    const apiKey = env.RESEND_API_KEY; 
    await sendEmailWithResend(apiKey, email, subject, html);

    // 5. 存入数据库
    await db.prepare(
      "INSERT INTO verification_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)"
    ).bind(email, code, purpose, expiresAt).run();

    return new Response(JSON.stringify({ success: true, message: "验证码已发送至您的邮箱" }));

  } catch (error) {
    return new Response(JSON.stringify({ error: "邮件发送失败：" + error.message }), { status: 500 });
  }
}
