/**
 * 番剧管理 API - 支持增删改查
 * 
 * GET    /api/anime?id=X      - 获取单部番剧详情
 * POST   /api/anime           - 新增番剧（管理员/站长）
 * PUT    /api/anime           - 更新番剧信息（管理员/站长）
 * DELETE /api/anime?id=X      - 删除番剧（站长专属）
 *
 * 依赖模块：
 * - db.js: 数据库查询封装
 * - auth.js: 认证与会话管理
 * - response.js: 统一响应格式
 * - middleware.js: CSRF 防护
 */
export const prerender = false;

import { getAnimeById, createAnime, updateAnime, deleteAnime } from '../../lib/db.js';
import { getCurrentUser, hasRole } from '../../lib/auth.js';
import { success, error, notFound, serverError } from '../../lib/response.js';
import { csrfGuard } from '../../lib/middleware.js';

/**
 * GET - 获取番剧详情
 */
export async function GET({ url }) {
  try {
  const animeId = url.searchParams.get('id');
    if (!animeId) return error('id 参数不能为空');

    const anime = await getAnimeById(animeId);
    if (!anime) return notFound('番剧不存在');

    return success({ data: anime });
  } catch (e) {
    return serverError('获取番剧失败：' + e.message);
  }
}

/**
 * POST - 新增番剧
 */
export async function POST({ request, cookies }) {
  try {
    // CSRF 防护
    if (!csrfGuard(request)) {
      return error('CSRF 校验失败', { status: 403 });
    }

    const { env } = await import('cloudflare:workers');
    const db = env.DB;
    const user = await getCurrentUser(db, cookies);

    if (!user || !hasRole(user, ['owner', 'admin'])) {
      return error('权限不足，仅限管理员操作', { status: 403 });
    }

    const body = await request.json();
    const { title, bgm_score, status, review, image_url, director, voice_actors, studio, total_episodes } = body;

    if (!title?.trim()) return error('番剧名称不能为空');

    const newId = await createAnime({
      title: title.trim(),
      bgm_score: bgm_score ? parseFloat(bgm_score) : null,
      status: status || '想看',
      review: review || null,
      image_url: image_url || null,
      director: director || null,
      voice_actors: voice_actors || null,
      studio: studio || null,
      total_episodes: total_episodes ? parseInt(total_episodes) : 0,
      added_by: user.id,
    });

    return success({ message: `✨ 《${title}》已添加到追番列表`, id: newId });
  } catch (e) {
    console.error('Create anime error:', e);
    return serverError('添加失败');
  }
}

/**
 * PUT - 更新番剧
 */
export async function PUT({ request, cookies }) {
  try {
    if (!csrfGuard(request)) {
      return error('CSRF 校验失败', { status: 403 });
    }

    const { env } = await import('cloudflare:workers');
    const db = env.DB;
    const user = await getCurrentUser(db, cookies);

    if (!user || !hasRole(user, ['owner', 'admin'])) {
      return error('权限不足，仅限管理员操作', { status: 403 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return error('番剧 ID 不能为空');

    const updated = await updateAnime(id, updates);
    if (!updated) return error('没有要更新的字段');

    return success({ message: '✅ 番剧信息已更新' });
  } catch (e) {
    console.error('Update anime error:', e);
    return serverError('更新失败');
  }
}

/**
 * DELETE - 删除番剧
 */
export async function DELETE({ url, request, cookies }) {
  try {
    if (!csrfGuard(request)) {
      return error('CSRF 校验失败', { status: 403 });
    }

    const { env } = await import('cloudflare:workers');
    const db = env.DB;
    const user = await getCurrentUser(db, cookies);

    if (!user || !hasRole(user, ['owner'])) {
      return error('权限不足，仅限站长操作', { status: 403 });
    }

    const animeId = url.searchParams.get('id');
    if (!animeId) return error('id 参数不能为空');

    await deleteAnime(animeId);
    return success({ message: '🗑️ 番剧及相关数据已删除' });
  } catch (e) {
    console.error('Delete anime error:', e);
    return serverError('删除失败');
  }
}

