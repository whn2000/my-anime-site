// src/pages/search.json.js
export const prerender = false;

export async function GET({ url }) {
    const keyword = url.searchParams.get('q');
    if (!keyword) return new Response(JSON.stringify({ data: [] }));

    // AniList GraphQL 查询语句
    const query = `
    query ($search: String) {
      Page (perPage: 5) {
        media (search: $search, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          coverImage {
            large
          }
          startDate {
            year
          }
          averageScore
          description
        }
      }
    }
  `;

    try {
        const response = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                query: query,
                variables: { search: keyword }
            })
        });

        const result = await response.json();

        // 格式化输出，方便前端使用
        const formattedData = result.data.Page.media.map(item => ({
            id: item.id,
            title: item.title.english || item.title.romaji || item.title.native,
            image: item.coverImage.large,
            year: item.startDate.year,
            score: item.averageScore ? (item.averageScore / 10).toFixed(1) : 0, // AniList 是百分制，转为 10 分制
            description: item.description
        }));

        return new Response(JSON.stringify({ data: formattedData }));
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}