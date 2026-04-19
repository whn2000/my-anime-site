// src/pages/api/progress.js
// 追番进度 API - 支持 +1 / -1 / 设置精确值
export const prerender = false;

import { env } from "cloudflare:workers";
import { getCurrentUser, hasRole } from "../../lib/auth.js";

/**
 * POST /api/progress
 * Body: { anime_id, action: "increment" | "decrement" | "set", value?: number }
 * 仅站长和管理员可操作
 */
export async function POST({ request, cookies }) {
  const db = env.DB;
  const user = await getCurrentUser(db, cookies);

  if (!user || !hasRole(user, ['owner', 'admin'])) {
    return new Response(JSON.stringify({ error: '权限不足' }), { status: 403 });
  }

  const body = await request.json();
  const { anime_id, action } = body;

  if (!anime_id) {
    return new Response(JSON.stringify({ error: 'anime_id is required' }), { status: 400 });
  }

  // 获取当前番剧数据
  const anime = await db.prepare("SELECT progress, total_episodes FROM anime WHERE id = ?").bind(anime_id).first();
  if (!anime) {
    return new Response(JSON.stringify({ error: '番剧不存在' }), { status: 404 });
  }

  let newProgress = anime.progress || 0;
  const totalEps = anime.total_episodes || 0;

  if (action === 'increment') {
    newProgress = Math.min(newProgress + 1, totalEps > 0 ? totalEps : newProgress + 1);
  } else if (action === 'decrement') {
    newProgress = Math.max(newProgress - 1, 0);
  } else if (action === 'set') {
    newProgress = Math.max(0, Math.min(body.value || 0, totalEps > 0 ? totalEps : body.value || 0));
  } else {
    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400 });
  }

  await db.prepare("UPDATE anime SET progress = ? WHERE id = ?").bind(newProgress, anime_id).run();

  return new Response(JSON.stringify({
    success: true,
    progress: newProgress,
    total_episodes: totalEps,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
