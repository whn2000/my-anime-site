/**
 * 数据库通用查询封装
 * 
 * 集中管理所有 D1 数据库查询操作，提供统一的查询接口。
 * 业务逻辑通过本模块访问数据库，而非直接操作 env.DB。
 */
import { env } from "cloudflare:workers";

/**
 * 获取数据库实例
 * @returns {D1Database}
 */
export function getDB() {
  return env.DB;
}

// ==================== 缓存工具 ====================

/**
 * 带 Cloudflare Cache API 的数据库查询缓存
 * 减少高频 D1 查询，提升响应速度
 * 
 * @param {string} cacheKey - 缓存键名
 * @param {number} ttlSeconds - 缓存有效期（秒）
 * @param {Function} queryFn - 实际执行查询的函数
 * @returns {Promise<any>}
 */
const cache = caches.default;

export async function cachedQuery(cacheKey, ttlSeconds, queryFn) {
  try {
    const cachedRes = await cache.match(cacheKey);
    if (cachedRes) {
      try {
        return await cachedRes.json();
      } catch {
        // 缓存损坏，忽略
      }
    }
  } catch {
    // 缓存读取失败，继续查询
  }

  const result = await queryFn();

  try {
    const response = new Response(JSON.stringify(result), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, s-maxage=${ttlSeconds}`,
      },
    });
    await cache.put(cacheKey, response);
  } catch {
    // 缓存写入失败不影响业务
  }

  return result;
}

/**
 * 使指定缓存键失效
 * @param {string} cacheKey
 */
export async function invalidateCache(cacheKey) {
  try {
    await cache.delete(cacheKey);
  } catch {
    // 忽略
  }
}

/** 缓存键常量 */
export const CACHE_KEYS = {
  ANIME_LIST: 'https://internal/cache/anime-list',
  ANIME_COUNT: 'https://internal/cache/anime-count',
};

/**
 * 番剧相关缓存失效
 */
async function invalidateAnimeCaches() {
  await Promise.all([
    invalidateCache(CACHE_KEYS.ANIME_LIST),
    invalidateCache(CACHE_KEYS.ANIME_COUNT),
  ]);
}

// ==================== 番剧相关 ====================

/**
 * 获取番剧列表（含聚合评分，60s 缓存）
 * @returns {Promise<Array>}
 */
export async function getAllAnime() {
  return cachedQuery(CACHE_KEYS.ANIME_LIST, 60, async () => {
    const db = getDB();
    const { results } = await db.prepare(`
      SELECT 
        a.*,
        ROUND(AVG(s.score), 1) as avg_score,
        COUNT(s.id) as score_count
      FROM anime a
      LEFT JOIN anime_scores s ON a.id = s.anime_id
      GROUP BY a.id
      ORDER BY a.id DESC
    `).all();
    return results;
  });
}

/**
 * 根据 ID 获取单部番剧
 * @param {number} id
 * @returns {Promise<Object|null>}
 */
export async function getAnimeById(id) {
  const db = getDB();
  return await db.prepare("SELECT * FROM anime WHERE id = ?").bind(id).first();
}

/**
 * 创建新番剧
 * @param {Object} data
 * @returns {Promise<number>} 新番剧 ID
 */
export async function createAnime(data) {
  const db = getDB();
  const result = await db.prepare(`
    INSERT INTO anime (title, bgm_score, status, review, image_url, director, voice_actors, studio, total_episodes, added_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    data.title,
    data.bgm_score ?? null,
    data.status || '想看',
    data.review || null,
    data.image_url || null,
    data.director || null,
    data.voice_actors || null,
    data.studio || null,
    data.total_episodes ?? 0,
    data.added_by
  ).run();
  await invalidateAnimeCaches();
  return result.meta.last_row_id;
}

/**
 * 更新番剧信息（动态字段）
 * @param {number} id
 * @param {Object} updates - 要更新的字段
 * @returns {Promise<boolean>}
 */
export async function updateAnime(id, updates) {
  const db = getDB();
  const fields = [];
  const values = [];

  const fieldMap = {
    title: 'title',
    status: 'status',
    review: 'review',
    image_url: 'image_url',
    director: 'director',
    voice_actors: 'voice_actors',
    studio: 'studio',
    total_episodes: 'total_episodes',
    bgm_score: 'bgm_score',
    progress: 'progress',
  };

  for (const [key, col] of Object.entries(fieldMap)) {
    if (updates[key] !== undefined) {
      fields.push(`${col} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return false;

  values.push(id);
  await db.prepare(`UPDATE anime SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  await invalidateAnimeCaches();
  return true;
}

/**
 * 删除番剧（级联删除评分和评论）
 * @param {number} id
 */
export async function deleteAnime(id) {
  const db = getDB();
  await db.prepare("DELETE FROM anime_scores WHERE anime_id = ?").bind(id).run();
  await db.prepare("DELETE FROM comments WHERE anime_id = ?").bind(id).run();
  await db.prepare("DELETE FROM anime WHERE id = ?").bind(id).run();
  await invalidateAnimeCaches();
}

/**
 * 按状态分组获取番剧数
 * @returns {Promise<Object>}
 */
export async function getAnimeCountByStatus() {
  const db = getDB();
  const { results } = await db.prepare(
    "SELECT status, COUNT(*) as count FROM anime GROUP BY status"
  ).all();
  const counts = {};
  for (const row of results) {
    counts[row.status] = row.count;
  }
  return counts;
}

// ==================== 评论相关 ====================

/**
 * 获取番剧评论列表
 * @param {number} animeId
 * @returns {Promise<Array>}
 */
export async function getComments(animeId) {
  const db = getDB();
  const { results } = await db.prepare(`
    SELECT c.id, c.content, c.created_at, u.username, u.role
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.anime_id = ?
    ORDER BY c.created_at DESC
  `).bind(animeId).all();
  return results;
}

/**
 * 创建评论
 * @param {number} animeId
 * @param {number} userId
 * @param {string} content
 */
export async function createComment(animeId, userId, content) {
  const db = getDB();
  await db.prepare(
    "INSERT INTO comments (anime_id, user_id, content) VALUES (?, ?, ?)"
  ).bind(animeId, userId, content).run();
}

/**
 * 获取单条评论
 * @param {number} commentId
 * @returns {Promise<Object|null>}
 */
export async function getCommentById(commentId) {
  const db = getDB();
  return await db.prepare("SELECT * FROM comments WHERE id = ?").bind(commentId).first();
}

/**
 * 删除评论
 * @param {number} commentId
 */
export async function deleteComment(commentId) {
  const db = getDB();
  await db.prepare("DELETE FROM comments WHERE id = ?").bind(commentId).run();
}

// ==================== 评分相关 ====================

/**
 * 获取番剧评分列表
 * @param {number} animeId
 * @returns {Promise<Array>}
 */
export async function getScores(animeId) {
  const db = getDB();
  const { results } = await db.prepare(`
    SELECT s.score, s.review, s.created_at, u.username, u.role
    FROM anime_scores s
    JOIN users u ON s.user_id = u.id
    WHERE s.anime_id = ?
    ORDER BY s.created_at ASC
  `).bind(animeId).all();
  return results;
}

/**
 * UPSERT 评分（如果存在则更新，否则插入）
 * @param {number} animeId
 * @param {number} userId
 * @param {number} score
 * @param {string|null} review
 */
export async function upsertScore(animeId, userId, score, review) {
  const db = getDB();
  await db.prepare(`
    INSERT INTO anime_scores (anime_id, user_id, score, review)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(anime_id, user_id) 
    DO UPDATE SET score = excluded.score, review = excluded.review, created_at = datetime('now')
  `  ).bind(animeId, userId, score, review).run();
  // 评分变更，番剧列表缓存失效
  await invalidateAnimeCaches();
}

// ==================== Session 相关 ====================

/**
 * 验证 Session token 并获取用户
 * @param {string} token
 * @returns {Promise<Object|null>}
 */
export async function getSessionUser(token) {
  if (!token) return null;
  const db = getDB();
  return await db.prepare(`
    SELECT u.id, u.email, u.username, u.role
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND s.expires_at > datetime('now')
  `).bind(token).first();
}

/**
 * 创建 Session
 * @param {number} userId
 * @param {string} token
 * @param {string} expiresAt
 */
export async function insertSession(userId, token, expiresAt) {
  const db = getDB();
  await db.prepare(
    "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
  ).bind(token, userId, expiresAt).run();
}

/**
 * 删除 Session
 * @param {string} token
 */
export async function removeSession(token) {
  const db = getDB();
  await db.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
}

/**
 * 更新 Session 最后活跃时间，并进行 Token 轮换
 * 如果距上次活跃超过 15 分钟，生成新 token 并删除旧 token
 * 
 * @param {string} token
 * @returns {Promise<{newToken: string|null}>} 
 */
export async function updateSessionLastActive(token) {
  const db = getDB();
  
  // 获取当前 session 信息
  const session = await db.prepare(
    "SELECT id, user_id, expires_at, last_active_at FROM sessions WHERE token = ?"
  ).bind(token).first();
  
  if (!session) return { newToken: null };

  const now = Date.now();
  const lastActive = session.last_active_at 
    ? new Date(session.last_active_at + 'Z').getTime() 
    : 0;
  
  // 15 分钟轮换阈值
  const ROTATION_INTERVAL = 15 * 60 * 1000;

  if (now - lastActive > ROTATION_INTERVAL) {
    // 需要轮换：生成新 token，删除旧 token
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    await db.prepare(
      "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)"
    ).bind(newToken, session.user_id, session.expires_at).run();
    
    await db.prepare("DELETE FROM sessions WHERE id = ?").bind(session.id).run();
    
    return { newToken };
  }

  // 更新最后活跃时间（不轮换）
  await db.prepare(
    "UPDATE sessions SET last_active_at = datetime('now') WHERE id = ?"
  ).bind(session.id).run();

  return { newToken: null };
}

// ==================== 验证码相关 ====================

/**
 * 获取最近发送的验证码
 * @param {string} email
 * @returns {Promise<Object|null>}
 */
export async function getLatestVerificationCode(email) {
  const db = getDB();
  return await db.prepare(
    "SELECT * FROM verification_codes WHERE email = ? ORDER BY created_at DESC LIMIT 1"
  ).bind(email).first();
}

/**
 * 校验验证码
 * @param {string} email
 * @param {string} code
 * @param {string} purpose
 * @returns {Promise<boolean>}
 */
export async function verifyCode(email, code, purpose) {
  const db = getDB();
  const record = await db.prepare(
    "SELECT * FROM verification_codes WHERE email = ? AND code = ? AND purpose = ? AND expires_at > datetime('now') ORDER BY created_at DESC LIMIT 1"
  ).bind(email, code, purpose).first();

  if (!record) return false;

  // 验证后删除，防止重放
  await db.prepare("DELETE FROM verification_codes WHERE id = ?").bind(record.id).run();
  return true;
}

/**
 * 存储验证码
 * @param {string} email
 * @param {string} code
 * @param {string} purpose
 * @param {string} expiresAt
 */
export async function saveVerificationCode(email, code, purpose, expiresAt) {
  const db = getDB();
  // 先清理旧码
  await db.prepare("DELETE FROM verification_codes WHERE email = ? AND purpose = ?").bind(email, purpose).run();
  // 存入新码
  await db.prepare(
    "INSERT INTO verification_codes (email, code, purpose, expires_at) VALUES (?, ?, ?, ?)"
  ).bind(email, code, purpose, expiresAt).run();
}

// ==================== 站点设置 ====================

/**
 * 获取站点设置
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getSiteSetting(key) {
  const db = getDB();
  const row = await db.prepare("SELECT value FROM site_settings WHERE key = ?").bind(key).first();
  return row?.value ?? null;
}

/**
 * 设置站点配置
 * @param {string} key
 * @param {string} value
 */
export async function setSiteSetting(key, value) {
  const db = getDB();
  await db.prepare(
    "INSERT OR REPLACE INTO site_settings (key, value) VALUES (?, ?)"
  ).bind(key, value).run();
}
