/**
 * 站点常量与配置
 * 
 * 集中管理所有业务常量，方便后续扩展和维护。
 * 避免在各个文件中分散定义相同的常量。
 */

// ==================== 角色权限 ====================

/** 角色层级（数字越小越高） */
export const ROLE_HIERARCHY = {
  owner: 0,
  admin: 1,
  user: 2,
};

/** 可以管理番剧的角色 */
export const ADMIN_ROLES = ['owner', 'admin'];

/** 可以管理用户/邀请码的角色 */
export const SUPER_ADMIN_ROLES = ['owner'];

/** 角色显示名 */
export const ROLE_LABELS = {
  owner: '站长',
  admin: '管理员',
  user: '用户',
};

// ==================== 番剧状态 ====================

/** 番剧状态列表（保持显示顺序） */
export const ANIME_STATUSES = [
  { key: '正在追', icon: '🚀', label: '正在追' },
  { key: '已完结', icon: '✅', label: '已完结' },
  { key: '想看', icon: '✨', label: '想看' },
  { key: '弃番', icon: '🗑️', label: '弃番' },
];

/** 状态对应的主题色 */
export const STATUS_THEMES = {
  '已完结': { color: '#00b894', bg: 'rgba(0, 184, 148, 0.15)' },
  '正在追': { color: '#0984e3', bg: 'rgba(9, 132, 227, 0.15)' },
  '想看':   { color: '#fdcb6e', bg: 'rgba(253, 203, 110, 0.15)' },
  '弃番':   { color: '#d63031', bg: 'rgba(214, 48, 49, 0.15)' },
};

/** 默认状态主题 */
export const DEFAULT_STATUS_THEME = { color: '#636e72', bg: 'rgba(99, 110, 114, 0.15)' };

/**
 * 获取状态对应的主题色
 * @param {string} status
 * @returns {{color: string, bg: string}}
 */
export function getStatusTheme(status) {
  return STATUS_THEMES[status] || DEFAULT_STATUS_THEME;
}

// ==================== 验证码 ====================

/** 验证码用途 */
export const CODE_PURPOSES = {
  REGISTER: 'register',
  LOGIN: 'login',
  RESET: 'reset',
};

/** 验证码用途中文标签 */
export const CODE_PURPOSE_LABELS = {
  register: '注册',
  login: '登录',
  reset: '重置密码',
};

/** 验证码有效期限（分钟） */
export const CODE_EXPIRY_MINUTES = 10;

/** 发送间隔限制（秒） */
export const CODE_RESEND_INTERVAL = 60;

// ==================== 分页 ====================

/** 每页默认条数 */
export const DEFAULT_PAGE_SIZE = 20;

// ==================== 站点设置 ====================

/** 站点设置 Key 列表 */
export const SITE_SETTINGS_KEYS = {
  BACKGROUND_URL: 'background_url',
  SITE_TITLE: 'site_title',
  SITE_DESCRIPTION: 'site_description',
};

// ==================== 默认背景图 ====================

export const DEFAULT_BACKGROUND = 
  'https://images.unsplash.com/photo-1578632767115-351597cf2477?auto=format&fit=crop&q=80';
