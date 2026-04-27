-- =============== 慎重警告 ===============
-- 因为改变了核心验证体系，以下语句清空了所有和旧用户相关的表。
DROP TABLE IF EXISTS anime_scores;
DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS invitations;
DROP TABLE IF EXISTS users;
-- =======================================

-- 番剧表 (原有基础表，保留不删除，但确保有 added_by)
CREATE TABLE IF NOT EXISTS anime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  score REAL,
  bgm_score REAL,
  status TEXT,
  review TEXT,
  image_url TEXT,
  added_by INTEGER,
  director TEXT,
  voice_actors TEXT,
  studio TEXT,
  progress INTEGER DEFAULT 0,
  total_episodes INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 全新用户表 (邮箱为主标识)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TEXT DEFAULT (datetime('now'))
);

-- 会话表
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 邀请码表
CREATE TABLE IF NOT EXISTS invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin',
  created_by INTEGER,
  is_used INTEGER DEFAULT 0,
  used_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 独立评分表
CREATE TABLE IF NOT EXISTS anime_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  anime_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  score REAL NOT NULL,
  review TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(anime_id, user_id)
);

-- 新增：邮箱验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- 全局设置表
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- =============== 性能优化索引 ===============
-- 会话表：按 token 和过期时间快速查询（用于每次请求的登录验证）
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- 评分表：按番剧 ID 快速查询评分（首页聚合 + 详情页）
CREATE INDEX IF NOT EXISTS idx_anime_scores_anime ON anime_scores(anime_id);
CREATE INDEX IF NOT EXISTS idx_anime_scores_user ON anime_scores(user_id);

-- 评论表：按番剧 ID 快速查询评论（详情页）
CREATE INDEX IF NOT EXISTS idx_comments_anime ON comments(anime_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

-- 验证码表：按邮箱快速查询（防刷检查）
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email_purpose ON verification_codes(email, purpose);
-- 过期清理用索引
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

-- 邀请码表：按 code 快速查询（注册验证）
CREATE INDEX IF NOT EXISTS idx_invitations_code ON invitations(code);

-- 番剧表：按状态和标题排序（首页分类展示 + 搜索）
CREATE INDEX IF NOT EXISTS idx_anime_status ON anime(status);
CREATE INDEX IF NOT EXISTS idx_anime_title ON anime(title);

-- 用户表：按邮箱快速查询（登录验证）
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
