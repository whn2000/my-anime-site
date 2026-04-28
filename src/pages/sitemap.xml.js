/**
 * 自动生成 Sitemap 供搜索引擎抓取
 * 
 * GET /sitemap.xml
 */
export const prerender = true;

import { getAllAnime } from '../lib/db.js';

export async function GET() {
  try {
    const animeList = await getAllAnime();
    const today = new Date().toISOString().split('T')[0];

    const animeUrls = (animeList || []).map(a => `
    <url>
      <loc>https://my-anime-site.pages.dev/?anime=${a.id}</loc>
      <lastmod>${a.created_at ? a.created_at.split(' ')[0] : today}</lastmod>
      <changefreq>weekly</changefreq>
      <priority>0.8</priority>
    </url>`).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://my-anime-site.pages.dev/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://my-anime-site.pages.dev/login</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>
  <url>
    <loc>https://my-anime-site.pages.dev/register</loc>
    <changefreq>monthly</changefreq>
    <priority>0.3</priority>
  </url>${animeUrls}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    });
  } catch (e) {
    // 降级：构建时数据库可能不可用，返回基础 sitemap
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://my-anime-site.pages.dev/</loc>
    <priority>1.0</priority>
  </url>
</urlset>`;
    return new Response(xml, {
      status: 200,
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  }
}
