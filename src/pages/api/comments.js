// src/pages/api/comments.js
// 评论 API - 获取、发布、删除评论 + 获取独立评分
export const prerender = false;

import { env } from "cloudflare:workers";
import { getCurrentUser } from "../../lib/auth.js";

/**
 * GET /api/comments?anime_id=X
 * 返回指定番剧的评论列表和管理员独立评分
 */
export async function GET({ url, cookies }) {
  const db = env.DB;
  const animeId = url.searchParams.get('anime_id');

  if (!animeId) {
    return new Response(JSON.stringify({ error: 'anime_id is required' }), { status: 400 });
  }

  // 获取评论列表（含用户名和角色）
  const { results: comments } = await db.prepare(`
    SELECT c.id, c.content, c.created_at, u.username, u.role
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.anime_id = ?
    ORDER BY c.created_at DESC
  `).bind(animeId).all();

  // 获取独立评分列表
  const { results: scores } = await db.prepare(`
    SELECT s.score, s.review, s.created_at, u.username, u.role
    FROM anime_scores s
    JOIN users u ON s.user_id = u.id
    WHERE s.anime_id = ?
    ORDER BY s.created_at ASC
  `).bind(animeId).all();

  // 获取当前用户
  const currentUser = await getCurrentUser(db, cookies);

  return new Response(JSON.stringify({
    comments,
    scores,
    currentUser: currentUser ? { id: currentUser.id, username: currentUser.username, role: currentUser.role } : null,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * POST /api/comments
 * Body: { anime_id, content }
 * 需要登录
 */
export async function POST({ request, cookies }) {
  const db = env.DB;
  const user = await getCurrentUser(db, cookies);

  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401 });
  }

  const body = await request.json();
  const { anime_id, content } = body;

  if (!anime_id || !content?.trim()) {
    return new Response(JSON.stringify({ error: '评论内容不能为空' }), { status: 400 });
  }

  if (content.trim().length > 5000) {
    return new Response(JSON.stringify({ error: '评论长度不能超过 5000 字' }), { status: 400 });
  }

  try {
    await db.prepare(
      "INSERT INTO comments (anime_id, user_id, content) VALUES (?, ?, ?)"
    ).bind(anime_id, user.id, content.trim()).run();

    return new Response(JSON.stringify({ success: true, message: '评论成功' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: '评论失败：' + e.message }), { status: 500 });
  }
}

/**
 * DELETE /api/comments
 * Body: { comment_id }
 * 需要管理员或站长权限
 */
export async function DELETE({ request, cookies }) {
  const db = env.DB;
  const user = await getCurrentUser(db, cookies);

  if (!user) {
    return new Response(JSON.stringify({ error: '请先登录' }), { status: 401 });
  }

  const body = await request.json();
  const { comment_id } = body;

  if (!comment_id) {
    return new Response(JSON.stringify({ error: 'comment_id is required' }), { status: 400 });
  }

  // 检查权限：管理员/站长可以删除任何评论，用户只能删除自己的评论
  const comment = await db.prepare("SELECT * FROM comments WHERE id = ?").bind(comment_id).first();
  if (!comment) {
    return new Response(JSON.stringify({ error: '评论不存在' }), { status: 404 });
  }

  const canDelete = user.role === 'owner' || user.role === 'admin' || comment.user_id === user.id;
  if (!canDelete) {
    return new Response(JSON.stringify({ error: '没有权限删除此评论' }), { status: 403 });
  }

  try {
    await db.prepare("DELETE FROM comments WHERE id = ?").bind(comment_id).run();
    return new Response(JSON.stringify({ success: true, message: '评论已删除' }));
  } catch (e) {
    return new Response(JSON.stringify({ error: '删除失败：' + e.message }), { status: 500 });
  }
}
