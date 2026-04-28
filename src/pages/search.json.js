/**
 * AniList 番剧搜索 API
 *
 * GET /search.json?q=keyword
 *
 * 依赖模块：
 * - anilist.js: AniList API 封装
 * - response.js: 统一响应格式
 */
export const prerender = false;

import { searchAnime } from '../lib/anilist.js';
import { success, serverError } from '../lib/response.js';

export async function GET({ url }) {
  try {
    const keyword = url.searchParams.get('q');
    if (!keyword) return success({ data: [] });

        const data = await searchAnime(keyword);
    return success({ data });
    } catch (e) {
    console.error('Search error:', e);
    return serverError('搜索失败');
    }
}