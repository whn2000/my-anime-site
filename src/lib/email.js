/**
 * 邮件发送模块
 * 
 * 通过 Resend API 发送各类通知邮件。
 * 支持验证码邮件、通知邮件等模板。
 */

/**
 * 通过 Resend API 发送邮件
 * @param {string} apiKey - Resend API Key
 * @param {string} to - 收件人邮箱
 * @param {string} subject - 邮件主题
 * @param {string} html - HTML 内容
 * @returns {Promise<Object>}
 */
export async function sendEmail(apiKey, to, subject, html) {
  if (!apiKey) throw new Error('RESEND_API_KEY 未配置');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'onboarding@resend.dev',
      to: [to],
      subject,
      html,
    }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || '邮件发送失败');
  }
  return data;
}

/**
 * 生成验证码邮件 HTML
 * @param {string} code - 6 位验证码
 * @param {string} purposeLabel - 用途标签（注册/登录/重置密码）
 * @returns {string} HTML 内容
 */
export function buildVerificationEmailHtml(code, purposeLabel) {
  return `
    <div style="max-width:480px; margin:0 auto; padding:30px; background:#fff; border-radius:16px; font-family:sans-serif;">
      <div style="text-align:center; margin-bottom:24px;">
        <span style="font-size:40px;">🌸</span>
        <h2 style="margin:8px 0; color:#2d3436;">我的次元日记</h2>
      </div>
      <p style="color:#636e72; font-size:16px; line-height:1.6;">
        你好！你正在 <strong>${purposeLabel}</strong>，请使用以下验证码：
      </p>
      <div style="text-align:center; margin:30px 0; padding:20px; background:#f8f9fa; border-radius:12px;">
        <span style="font-size:36px; font-weight:900; letter-spacing:8px; color:#fb929e; font-family:monospace;">
          ${code}
        </span>
      </div>
      <p style="color:#b2bec3; font-size:13px;">
        此验证码有效期为 <strong>10 分钟</strong>。如非本人操作，请忽略此邮件。
      </p>
      <hr style="border:none; border-top:1px solid #eee; margin:24px 0;">
      <p style="color:#b2bec3; font-size:12px; text-align:center;">
        🌸 我的次元日记 · 记录每一个心动的追番瞬间
      </p>
    </div>
  `;
}
