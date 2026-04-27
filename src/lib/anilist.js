/**
 * AniList GraphQL API 封装
 * 
 * 提供统一的 AniList 搜索接口，支持番剧信息检索。
 * 结果自动格式化为应用内部使用的数据格式。
 */

const ANILIST_API = 'https://graphql.anilist.co';

/** 搜索番剧的 GraphQL 查询 */
const SEARCH_QUERY = `
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

/**
 * 在 AniList 中搜索番剧
 * @param {string} keyword - 搜索关键词
 * @returns {Promise<Array>} 格式化后的搜索结果列表
 */
export async function searchAnime(keyword) {
  if (!keyword?.trim()) return [];

  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: { search: keyword.trim() },
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList API 请求失败: ${response.status}`);
  }

  const result = await response.json();
  const mediaList = result?.data?.Page?.media ?? [];

  return mediaList.map(item => ({
    id: item.id,
    title: item.title.english || item.title.romaji || item.title.native,
    image: item.coverImage?.large,
    year: item.startDate?.year,
    score: item.averageScore ? (item.averageScore / 10).toFixed(1) : 0,
    description: item.description,
  }));
}

/**
 * 通过 ID 获取番剧的详细信息（含声优、制作公司等）
 * @param {string} search - 番剧名称
 * @returns {Promise<Object|null>}
 */
export async function getAnimeDetailInfo(search) {
  const DETAIL_QUERY = `
    query ($search: String) {
      Page (perPage: 1) {
        media (search: $search, type: ANIME) {
          title { native }
          studios(isMain: true) { nodes { name } }
          staff { edges { role node { name { full } } } }
          characters(sort: ROLE, perPage: 3) {
            edges {
              voiceActors(language: JAPANESE) { name { full } }
            }
          }
        }
      }
    }
  `;

  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query: DETAIL_QUERY,
      variables: { search },
    }),
  });

  if (!response.ok) return null;

  const result = await response.json();
  const media = result?.data?.Page?.media?.[0];
  if (!media) return null;

  return {
    title: media.title?.native,
    studios: media.studios?.nodes?.map(n => n.name) || [],
    staff: media.staff?.edges?.map(e => ({
      role: e.role,
      name: e.node?.name?.full,
    })) || [],
    voiceActors: media.characters?.edges?.map(e =>
      e.voiceActors?.map(va => va.name?.full)
    ).flat().filter(Boolean) || [],
  };
}
