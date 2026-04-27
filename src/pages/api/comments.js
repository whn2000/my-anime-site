/**
 * 评论 API - 获取、发布、删除评论 + 获取独立评分
 *
 * GET    /api/comments?anime_id=X    - 获取评论列表和评分
 * POST   /api/comments                - 发布评论（需登录）
 * DELETE /api/comments                - 删除评论（管理员或本人）
 *
 * 依赖模块：
 * - db.js: 数据库查询封装
 * - response.js: 统一响应格式
 */
export const prerender = false;

import { getComments, getScores, createComment, getCommentById, deleteComment } from '../../lib/db.js';
import { getCurrentUser } from '../../lib/auth.js';
import { success, error, unauthorized, forbidden, serverError } from '../../lib/response.js';
/**
 * GET - 获取指定番剧的评论列表和独立评分
 */
export async function GET({ url, cookies }) {
  try {
    const animeId = url.searchParams.get('anime_id');
    if (!animeId) return error('anime_id is required');

    const [comments, scores] = await Promise.all([
      getComments(animeId),
      getScores(animeId),
    ]);

    const { env } = await import('cloudflare:workers');
  const db = env.DB;
    const currentUser = await getCurrentUser(db, cookies);

    return success({
      comments,
      scores,
      currentUser: currentUser
        ? { id: currentUser.id, username: currentUser.username, role: currentUser.role }
        : null,
    });
  } catch (e) {
    return serverError('获取评论失败：' + e.message);
  }
}

/**
 * POST - 发布评论（需要登录）
 */
export async function POST({ request, cookies }) {
  try {
    const { env } = await import('cloudflare:workers');
    const db = env.DB;
    const user = await getCurrentUser(db, cookies);

    if (!user) return unauthorized();

    const body = await request.json();
    const { anime_id, content } = body;

    if (!anime_id || !content?.trim()) return error('评论内容不能为空');
    if (content.trim().length > 5000) return error('评论长度不能超过 5000 字');

    await createComment(anime_id, user.id, content.trim());
    return success({ message: '评论成功' });
  } catch (e) {
    return serverError('评论失败：' + e.message);
  }
}

/**
 * DELETE - 删除评论（管理员或本人）
 */
export async function DELETE({ request, cookies }) {
  try {
    const { env } = await import('cloudflare:workers');
    const db = env.DB;
    const user = await getCurrentUser(db, cookies);

    if (!user) return unauthorized();

    const body = await request.json();
    const { comment_id } = body;

    if (!comment_id) return error('comment_id is required');

    const comment = await getCommentById(comment_id);
    if (!comment) return error('评论不存在', { status: 404 });

    const canDelete = user.role === 'owner' || user.role === 'admin' || comment.user_id === user.id;
    if (!canDelete) return forbidden('没有权限删除此评论');

    await deleteComment(comment_id);
    return success({ message: '评论已删除' });
  } catch (e) {
    return serverError('删除失败：' + e.message);
  }
}

