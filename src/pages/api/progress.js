// src/pages/api/progress.js
/**
 * 追番进度 API - 支持 +1 / -1 / 设置精确值
 *
 * POST /api/progress
 * Body: { anime_id, action: "increment" | "decrement" | "set", value?: number }
 * 仅站长/管理员可操作
 *
 * 依赖模块：
 * - db.js: 数据库查询封装
 * - response.js: 统一响应格式
 */
export const prerender = false;

import { getAnimeById, updateAnime } from '../../lib/db.js';
import { getCurrentUser, hasRole } from '../../lib/auth.js';
import { success, error, forbidden, notFound, serverError } from '../../lib/response.js';
import { csrfGuard } from '../../lib/middleware.js';

/**
 * POST - 更新追番进度
 */
export async function POST({ request, cookies }) {
  try {
    if (!csrfGuard(request)) {
      return error('CSRF 校验失败', { status: 403 });
    }

    const { env } = await import('cloudflare:workers');
  const db = env.DB;
  const user = await getCurrentUser(db, cookies);

  if (!user || !hasRole(user, ['owner', 'admin'])) {
      return forbidden('权限不足');
  }

  const body = await request.json();
  const { anime_id, action } = body;

    if (!anime_id) return error('anime_id is required');

    const anime = await getAnimeById(anime_id);
    if (!anime) return notFound('番剧不存在');
  let newProgress = anime.progress || 0;
  const totalEps = anime.total_episodes || 0;

  if (action === 'increment') {
    newProgress = Math.min(newProgress + 1, totalEps > 0 ? totalEps : newProgress + 1);
  } else if (action === 'decrement') {
    newProgress = Math.max(newProgress - 1, 0);
  } else if (action === 'set') {
    newProgress = Math.max(0, Math.min(body.value || 0, totalEps > 0 ? totalEps : body.value || 0));
  } else {
      return error('Invalid action');
  }

    await updateAnime(anime_id, { progress: newProgress });

    return success({
      message: `🎬 进度已更新：${newProgress} / ${totalEps} 集`,
    progress: newProgress,
    total_episodes: totalEps,
  });
  } catch (e) {
    console.error('Update progress error:', e);
    return serverError('更新进度失败');
}
}

