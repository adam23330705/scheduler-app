/**
 * API 模块 - 与后端通信
 * 所有接口调用统一在此处理
 */

// API基础地址
// 本地开发时用当前地址，部署后前端(Vercel)需要指向后端(Render)
const API基础地址 = window.location.hostname === 'localhost'
  ? window.location.origin
  : (window.__API_BASE__ || window.location.origin);

// 获取存储的token
function 获取Token() {
  return localStorage.getItem('auth_token');
}

// 通用请求函数
async function 请求(方法, 路径, 数据 = null) {
  const headers = {
    'Content-Type': 'application/json',
  };
  const token = 获取Token();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method: 方法, headers };
  if (数据 && 方法 !== 'GET') {
    options.body = JSON.stringify(数据);
  }

  try {
    const res = await fetch(API基础地址 + 路径, options);
    const json = await res.json();
    if (!res.ok) throw new Error(json.message || '请求失败');
    return json;
  } catch (err) {
    if (err.message === '请求失败' || err.message.includes('401')) throw err;
    // 离线模式 - 返回本地数据
    throw new Error('网络不可用，请检查连接');
  }
}

// ===== 用户认证 =====
const 用户API = {
  async 注册(用户名, 密码) {
    return 请求('POST', '/api/auth/register', { username: 用户名, password: 密码 });
  },
  async 登录(用户名, 密码) {
    return 请求('POST', '/api/auth/login', { username: 用户名, password: 密码 });
  },
  async 获取信息() {
    return 请求('GET', '/api/auth/me');
  }
};

// ===== 任务管理 =====
const 任务API = {
  async 获取列表(参数 = {}) {
    const query = new URLSearchParams(参数).toString();
    return 请求('GET', `/api/tasks${query ? '?' + query : ''}`);
  },
  async 创建(任务数据) {
    return 请求('POST', '/api/tasks', 任务数据);
  },
  async 更新(任务ID, 更新数据) {
    return 请求('PUT', `/api/tasks/${任务ID}`, 更新数据);
  },
  async 删除(任务ID) {
    return 请求('DELETE', `/api/tasks/${任务ID}`);
  },
  async 标记完成(任务ID, 是否完成) {
    return 请求('PATCH', `/api/tasks/${任务ID}/complete`, { completed: 是否完成 });
  }
};

// ===== 番茄钟记录 =====
const 番茄API = {
  async 记录完成(记录数据) {
    return 请求('POST', '/api/pomodoro', 记录数据);
  },
  async 获取统计(日期) {
    return 请求('GET', `/api/pomodoro/stats?date=${日期}`);
  }
};

// ===== 标签管理 =====
const 标签API = {
  async 获取列表() {
    return 请求('GET', '/api/tags');
  },
  async 创建(标签名, 颜色) {
    return 请求('POST', '/api/tags', { name: 标签名, color: 颜色 });
  }
};
