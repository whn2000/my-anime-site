// src/pages/api/score.js
// 评分与见解 API - 用于站点管理员/站长在主页快捷修改评分
export const prerender = false;

import { env } from "cloudflare:workers";
import { getCurrentUser, hasRole } from "../../lib/auth.js";

/**
 * POST /api/score
 * Body: { anime_id, score, review }
 * 仅站长和管理员可操作
 */
export async function POST({ request, cookies }) {
  const db = env.DB;
  const user = await getCurrentUser(db, cookies);

  // 1. 权限校验
  if (!user || !hasRole(user, ['owner', 'admin'])) {
    return new Response(JSON.stringify({ error: '权限不足，仅限站长和管理员操作' }), { status: 403 });
  }

  try {
    const body = await request.json();
    const { anime_id, score, review } = body;

    // 2. 参数验证
    if (!anime_id) {
      return new Response(JSON.stringify({ error: 'anime_id is required' }), { status: 400 });
    }

    const numericScore = parseFloat(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 10) {
      return new Response(JSON.stringify({ error: '评分必须在 0 到 10 之间' }), { status: 400 });
    }

    // 3. 执行 UPSERT 操作
    await db.prepare(`
      INSERT INTO anime_scores (anime_id, user_id, score, review)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(anime_id, user_id) 
      DO UPDATE SET score = excluded.score, review = excluded.review, created_at = datetime('now')
    `).bind(
      parseInt(anime_id),
      user.id,
      numericScore,
      review ? review.trim() : null
    ).run();

    return new Response(JSON.stringify({ 
      success: true, 
      message: '评分与评价已保存 ✨',
      data: { score: numericScore, review }
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: '后端数据库错误：' + e.message }), { status: 500 });
  }
}
