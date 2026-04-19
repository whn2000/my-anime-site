// src/pages/api/image.js
// 图片中转代理 - 解决 Bangumi 等外部站点的防盗链问题
// 利用 Cloudflare Edge Cache 实现长期缓存，等同于自建图床效果
export const prerender = false;

export async function GET({ url }) {
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing url parameter', { status: 400 });
  }

  // 安全校验：只允许代理已知的图片域名
  const allowedHosts = [
    'lain.bgm.tv',
    'bgm.tv',
    'bangumi.tv',
    'img.bgm.tv',
    'images.unsplash.com',
  ];

  let parsedHost;
  try {
    parsedHost = new URL(targetUrl).hostname;
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }

  if (!allowedHosts.some(h => parsedHost.endsWith(h))) {
    return new Response('Domain not allowed', { status: 403 });
  }

  try {
    const imgResponse = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://bgm.tv/',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      // 利用 Cloudflare 的 cf 属性设置边缘缓存
      cf: {
        cacheTtl: 86400 * 30,     // 边缘缓存 30 天
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
        'Cache-Control': 'public, max-age=31536000, immutable', // 客户端缓存 1 年
        'CDN-Cache-Control': 'max-age=2592000',                 // CDN 缓存 30 天
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (e) {
    return new Response('Proxy error: ' + e.message, { status: 502 });
  }
}
