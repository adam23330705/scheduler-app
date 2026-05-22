/**
 * Cloudflare Worker 后端 - 日程规划API
 * 用户认证 + 任务CRUD + 番茄记录 + 标签管理
 * 数据库：Cloudflare D1 (SQLite)
 */

// ===== JWT 简易实现（HMAC-SHA256） =====

async function 签名JWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encoder = new TextEncoder();

  const base64url = (obj) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const headerB64 = base64url(header);
  const payloadB64 = base64url(payload);
  const message = `${headerB64}.${payloadB64}`;

  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${message}.${sigB64}`;
}

async function 验证JWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const message = `${parts[0]}.${parts[1]}`;
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const expectedSig = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  if (sig !== expectedSig && parts[2] !== expectedSig) return null;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch {
    return null;
  }
}

// ===== 密码哈希（SHA-256 + salt） =====

async function 哈希密码(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function 生成Salt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== 工具函数 =====

function JSON响应(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

function 错误响应(message, status = 400) {
  return JSON响应({ message }, status);
}

// ===== 数据库初始化 =====

const 建表SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    due_date TEXT,
    remind_minutes INTEGER,
    priority TEXT DEFAULT '普通',
    tags TEXT DEFAULT '[]',
    repeat TEXT DEFAULT 'none',
    repeat_days TEXT,
    note TEXT,
    completed INTEGER DEFAULT 0,
    completed_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS pomodoro_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    duration INTEGER NOT NULL,
    task_id TEXT,
    completed_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#6366f1',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, name)
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(user_id, due_date);
  CREATE INDEX IF NOT EXISTS idx_pomodoro_user ON pomodoro_records(user_id);
`;

// ===== 路由处理 =====

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS预检
    if (request.method === 'OPTIONS') {
      return JSON响应({});
    }

    // 初始化数据库
    try {
      await env.DB.exec(建表SQL);
    } catch (e) {
      // 表已存在忽略
    }

    const path = url.pathname;

    // ===== 路由匹配 =====

    // 认证相关（无需token）
    if (path === '/api/auth/register' && request.method === 'POST') {
      return await 处理注册(request, env);
    }
    if (path === '/api/auth/login' && request.method === 'POST') {
      return await 处理登录(request, env);
    }

    // 以下接口需要认证
    const 用户 = await 认证中间件(request, env);
    if (!用户) return 错误响应('未登录或token已过期', 401);

    if (path === '/api/auth/me' && request.method === 'GET') {
      return JSON响应({ user: { id: 用户.id, username: 用户.username } });
    }

    // 任务
    if (path === '/api/tasks' && request.method === 'GET') {
      return await 处理获取任务(request, env, 用户);
    }
    if (path === '/api/tasks' && request.method === 'POST') {
      return await 处理创建任务(request, env, 用户);
    }
    if (path.match(/^\/api\/tasks\/[\w-]+$/) && request.method === 'PUT') {
      const id = path.split('/').pop();
      return await 处理更新任务(request, env, 用户, id);
    }
    if (path.match(/^\/api\/tasks\/[\w-]+$/) && request.method === 'DELETE') {
      const id = path.split('/').pop();
      return await 处理删除任务(env, 用户, id);
    }
    if (path.match(/^\/api\/tasks\/[\w-]+\/complete$/) && request.method === 'PATCH') {
      const id = path.split('/')[3];
      return await 处理标记完成(request, env, 用户, id);
    }

    // 番茄记录
    if (path === '/api/pomodoro' && request.method === 'POST') {
      return await 处理记录番茄(request, env, 用户);
    }
    if (path === '/api/pomodoro/stats' && request.method === 'GET') {
      return await 处理番茄统计(request, env, 用户);
    }

    // 标签
    if (path === '/api/tags' && request.method === 'GET') {
      return await 处理获取标签(env, 用户);
    }
    if (path === '/api/tags' && request.method === 'POST') {
      return await 处理创建标签(request, env, 用户);
    }

    // 404
    return 错误响应('接口不存在', 404);
  },
};

// ===== 认证中间件 =====

async function 认证中间件(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const payload = await 验证JWT(token, env.JWT_SECRET || 'default-secret-key');
  if (!payload) return null;

  return { id: payload.userId, username: payload.username };
}

// ===== 注册 =====

async function 处理注册(request, env) {
  const { username, password } = await request.json();

  if (!username || !password) return 错误响应('用户名和密码不能为空');
  if (username.length < 3 || username.length > 20) return 错误响应('用户名需要3-20个字符');
  if (password.length < 6) return 错误响应('密码至少6位');

  // 检查是否已存在
  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?')
    .bind(username).first();
  if (existing) return 错误响应('用户名已被占用');

  const id = crypto.randomUUID();
  const salt = 生成Salt();
  const hash = await 哈希密码(password, salt);

  await env.DB.prepare(
    'INSERT INTO users (id, username, password_hash, salt) VALUES (?, ?, ?, ?)'
  ).bind(id, username, hash, salt).run();

  const token = await 签名JWT(
    { userId: id, username, exp: Math.floor(Date.now() / 1000) + 86400 * 30 },
    env.JWT_SECRET || 'default-secret-key'
  );

  return JSON响应({ user: { id, username }, token }, 201);
}

// ===== 登录 =====

async function 处理登录(request, env) {
  const { username, password } = await request.json();

  if (!username || !password) return 错误响应('用户名和密码不能为空');

  const user = await env.DB.prepare(
    'SELECT id, username, password_hash, salt FROM users WHERE username = ?'
  ).bind(username).first();

  if (!user) return 错误响应('用户名或密码错误');

  const hash = await 哈希密码(password, user.salt);
  if (hash !== user.password_hash) return 错误响应('用户名或密码错误');

  const token = await 签名JWT(
    { userId: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 86400 * 30 },
    env.JWT_SECRET || 'default-secret-key'
  );

  return JSON响应({ user: { id: user.id, username: user.username }, token });
}

// ===== 任务CRUD =====

async function 处理获取任务(request, env, 用户) {
  const url = new URL(request.url);
  const 日期 = url.searchParams.get('date');
  const 优先级 = url.searchParams.get('priority');

  let sql = 'SELECT * FROM tasks WHERE user_id = ?';
  const params = [用户.id];

  if (日期) {
    sql += ' AND date(due_date) = date(?)';
    params.push(日期);
  }
  if (优先级) {
    sql += ' AND priority = ?';
    params.push(优先级);
  }

  sql += ' ORDER BY completed ASC, due_date ASC, created_at DESC';

  const 结果 = await env.DB.prepare(sql).bind(...params).all();

  // 解析tags JSON
  const tasks = 结果.results.map(t => ({
    ...t,
    tags: JSON.parse(t.tags || '[]'),
    completed: !!t.completed,
  }));

  return JSON响应({ tasks });
}

async function 处理创建任务(request, env, 用户) {
  const data = await request.json();

  if (!data.title) return 错误响应('任务标题不能为空');

  const id = data.id || crypto.randomUUID();
  const tags = JSON.stringify(data.tags || []);

  await env.DB.prepare(`
    INSERT INTO tasks (id, user_id, title, due_date, remind_minutes, priority, tags, repeat, repeat_days, note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, 用户.id, data.title, data.due_date || null,
    data.remind_minutes || null, data.priority || '普通',
    tags, data.repeat || 'none', data.repeat_days ? JSON.stringify(data.repeat_days) : null,
    data.note || null
  ).run();

  return JSON响应({
    task: {
      id, title: data.title, due_date: data.due_date,
      priority: data.priority || '普通', tags: data.tags || [],
      completed: false,
    }
  }, 201);
}

async function 处理更新任务(request, env, 用户, 任务ID) {
  const data = await request.json();
  const tags = JSON.stringify(data.tags || []);

  const 结果 = await env.DB.prepare(`
    UPDATE tasks SET title = ?, due_date = ?, remind_minutes = ?, priority = ?,
    tags = ?, repeat = ?, repeat_days = ?, note = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(
    data.title, data.due_date || null, data.remind_minutes || null,
    data.priority || '普通', tags, data.repeat || 'none',
    data.repeat_days ? JSON.stringify(data.repeat_days) : null,
    data.note || null, 任务ID, 用户.id
  ).run();

  if (!结果.meta.changes) return 错误响应('任务不存在', 404);

  return JSON响应({ message: '已更新' });
}

async function 处理删除任务(env, 用户, 任务ID) {
  const 结果 = await env.DB.prepare(
    'DELETE FROM tasks WHERE id = ? AND user_id = ?'
  ).bind(任务ID, 用户.id).run();

  if (!结果.meta.changes) return 错误响应('任务不存在', 404);

  return JSON响应({ message: '已删除' });
}

async function 处理标记完成(request, env, 用户, 任务ID) {
  const { completed } = await request.json();
  const 完成时间 = completed ? new Date().toISOString() : null;

  const 结果 = await env.DB.prepare(`
    UPDATE tasks SET completed = ?, completed_at = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `).bind(completed ? 1 : 0, 完成时间, 任务ID, 用户.id).run();

  if (!结果.meta.changes) return 错误响应('任务不存在', 404);

  return JSON响应({ message: completed ? '已完成' : '取消完成' });
}

// ===== 番茄记录 =====

async function 处理记录番茄(request, env, 用户) {
  const { duration, task_id } = await request.json();
  const id = crypto.randomUUID();

  await env.DB.prepare(`
    INSERT INTO pomodoro_records (id, user_id, duration, task_id, completed_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(id, 用户.id, duration || 25, task_id || null, new Date().toISOString()).run();

  return JSON响应({ id }, 201);
}

async function 处理番茄统计(request, env, 用户) {
  const url = new URL(request.url);
  const 日期 = url.searchParams.get('date') || new Date().toISOString().split('T')[0];

  const 结果 = await env.DB.prepare(`
    SELECT * FROM pomodoro_records
    WHERE user_id = ? AND date(completed_at) = date(?)
    ORDER BY completed_at DESC
  `).bind(用户.id, 日期).all();

  return JSON响应({ records: 结果.results });
}

// ===== 标签 =====

async function 处理获取标签(env, 用户) {
  const 结果 = await env.DB.prepare(
    'SELECT * FROM tags WHERE user_id = ? ORDER BY name'
  ).bind(用户.id).all();

  return JSON响应({ tags: 结果.results });
}

async function 处理创建标签(request, env, 用户) {
  const { name, color } = await request.json();

  if (!name) return 错误响应('标签名不能为空');

  const id = crypto.randomUUID();

  try {
    await env.DB.prepare(
      'INSERT INTO tags (id, user_id, name, color) VALUES (?, ?, ?, ?)'
    ).bind(id, 用户.id, name, color || '#6366f1').run();
  } catch (e) {
    if (e.message.includes('UNIQUE')) return 错误响应('标签已存在');
    throw e;
  }

  return JSON响应({ tag: { id, name, color: color || '#6366f1' } }, 201);
}
