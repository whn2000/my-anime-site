/**
 * 图片中转代理
 * 
 * GET /api/image?url=...
 * 
 * 解决 Bangumi 等外部站点的防盗链问题。
 * 利用 Cloudflare Edge Cache 实现长期缓存。
 * 
 * 依赖模块：
 * - response.js: 统一响应格式
 */
export const prerender = false;

import { error } from '../../lib/response.js';

/** 允许代理的域名白名单 */
const ALLOWED_HOSTS = [
  'lain.bgm.tv',
  'bgm.tv',
  'bangumi.tv',
  'img.bgm.tv',
  'images.unsplash.com',
];

/**
 * 安全检查：URL 是否在代理白名单中
 * @param {string} url 
 * @returns {boolean}
 */
function isAllowedUrl(url) {
  try {
    const hostname = new URL(url).hostname;
    return ALLOWED_HOSTS.some(h => hostname.endsWith(h));
  } catch {
    return false;
  }
}

/**
 * GET - 代理图片并设置强缓存
 */
export async function GET({ url }) {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) return error('Missing url parameter');
  if (!isAllowedUrl(targetUrl)) return error('Domain not allowed', { status: 403 });

  try {
    const imgResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://bgm.tv/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      cf: {
        cacheTtl: 86400 * 30,
        cacheEverything: true,
      },
    });

    if (!imgResponse.ok) {
      return new Response('Failed to fetch image', { status: imgResponse.status });
    }

    const contentType = imgResponse.headers.get('Content-Type') || 'image/jpeg';
    const imageBody = await imgResponse.arrayBuffer();

    return new Response(imageBody, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'CDN-Cache-Control': 'max-age=2592000',
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
      },
    });
  } catch (e) {
    return new Response('Proxy error: ' + e.message, { status: 502 });
  }
}
