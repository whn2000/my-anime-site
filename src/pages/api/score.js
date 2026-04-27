export const prerender = false;

import { upsertScore } from '../../lib/db.js';
import { getCurrentUser, hasRole } from '../../lib/auth.js';
import { success, error, forbidden, serverError } from '../../lib/response.js';

/**
 * POST - UPSERT 评分与评价
 */
export async function POST({ request, cookies }) {
  try {
    const { env } = await import('cloudflare:workers');
    const db = env.DB;
    const user = await getCurrentUser(db, cookies);

    if (!user || !hasRole(user, ['owner', 'admin'])) {
      return forbidden('权限不足，仅限站长/管理员操作');
    }

    const body = await request.json();
    const { anime_id, score, review } = body;

    if (!anime_id) return error('anime_id is required');
    const numericScore = parseFloat(score);
    if (isNaN(numericScore) || numericScore < 0 || numericScore > 10) {
      return error('评分必须在 0 到 10 之间');
    }

    await upsertScore(parseInt(anime_id), user.id, numericScore, review?.trim() || null);

    return success({
      message: '评分与评价已保存 ✨',
      data: { score: numericScore, review },
    });
  } catch (e) {
    return serverError('数据库错误：' + e.message);
  }
}

