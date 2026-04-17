CREATE TABLE IF NOT EXISTS anime (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  score REAL,
  status TEXT,
  review TEXT,
  image_url TEXT
);

-- 插入一条初始数据方便测试
INSERT INTO anime (title, score, status, review) VALUES ('葬送的芙莉莲', 9.8, '已完结', '这是我网站的第一条动态评价！');