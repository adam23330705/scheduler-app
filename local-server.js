/**
 * 本地开发服务器 - 前端静态托管 + API后端
 * 用法: node local-server.js
 * 访问: http://localhost:8787
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8787;
const 前端目录 = path.join(__dirname, 'frontend');
const 数据文件 = path.join(__dirname, 'local-data.json');

// ===== 本地数据库 =====
let 数据库 = { users: [], tasks: [], pomodoro_records: [], tags: [] };

function 读取数据库() {
  try {
    if (fs.existsSync(数据文件)) {
      数据库 = JSON.parse(fs.readFileSync(数据文件, 'utf8'));
    }
  } catch (e) {
    console.warn('读取本地数据失败，使用空数据库:', e.message);
  }
}

function 保存数据库() {
  try {
    fs.writeFileSync(数据文件, JSON.stringify(数据库, null, 2), 'utf8');
  } catch (e) {
    console.warn('保存本地数据失败:', e.message);
  }
}

读取数据库();

// ===== JWT 简易实现 =====
const JWT密钥 = 'local-dev-secret-key';

function 签名JWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const base64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const message = `${base64url(header)}.${base64url(payload)}`;
  const sig = crypto.createHmac('sha256', JWT密钥).update(message).digest('base64url');
  return `${message}.${sig}`;
}

function 验证JWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const message = `${parts[0]}.${parts[1]}`;
    const expectedSig = crypto.createHmac('sha256', JWT密钥).update(message).digest('base64url');
    if (parts[2] !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

function 哈希密码(password, salt) {
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

// ===== MIME类型 =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// ===== API处理 =====

function JSON响应(data, status = 200) {
  return { status, body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } };
}

function 错误响应(message, status = 400) {
  return JSON响应({ message }, status);
}

function 解析Body(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { resolve({}); }
    });
  });
}

function 认证(req) {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return null;
  return 验证JWT(auth.slice(7));
}

// 路由处理
async function 处理API(req, url) {
  const pathName = url.pathname;
  const method = req.method;

  // CORS
  if (method === 'OPTIONS') return JSON响应({});

  // ===== 注册 =====
  if (pathName === '/api/auth/register' && method === 'POST') {
    const { username, password } = await 解析Body(req);
    if (!username || !password) return 错误响应('用户名和密码不能为空');
    if (username.length < 3 || username.length > 20) return 错误响应('用户名需要3-20个字符');
    if (password.length < 6) return 错误响应('密码至少6位');
    if (数据库.users.find(u => u.username === username)) return 错误响应('用户名已被占用');

    const id = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = 哈希密码(password, salt);
    数据库.users.push({ id, username, password_hash: hash, salt, created_at: new Date().toISOString() });
    保存数据库();

    const token = 签名JWT({ userId: id, username, exp: Math.floor(Date.now() / 1000) + 86400 * 30 });
    return JSON响应({ user: { id, username }, token }, 201);
  }

  // ===== 登录 =====
  if (pathName === '/api/auth/login' && method === 'POST') {
    const { username, password } = await 解析Body(req);
    if (!username || !password) return 错误响应('用户名和密码不能为空');
    const user = 数据库.users.find(u => u.username === username);
    if (!user) return 错误响应('用户名或密码错误');
    if (哈希密码(password, user.salt) !== user.password_hash) return 错误响应('用户名或密码错误');

    const token = 签名JWT({ userId: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 86400 * 30 });
    return JSON响应({ user: { id: user.id, username: user.username }, token });
  }

  // 以下需要认证
  const 用户 = 认证(req);
  if (!用户) return 错误响应('未登录或token已过期', 401);

  // ===== 获取用户信息 =====
  if (pathName === '/api/auth/me' && method === 'GET') {
    return JSON响应({ user: { id: 用户.id, username: 用户.username } });
  }

  // ===== 获取任务列表 =====
  if (pathName === '/api/tasks' && method === 'GET') {
    let tasks = 数据库.tasks.filter(t => t.user_id === 用户.id);
    const 日期 = url.searchParams.get('date');
    const 优先级 = url.searchParams.get('priority');
    if (日期) tasks = tasks.filter(t => t.due_date && t.due_date.startsWith(日期));
    if (优先级) tasks = tasks.filter(t => t.priority === 优先级);
    tasks.sort((a, b) => (a.completed ? 1 : 0) - (b.completed ? 1 : 0) || (b.created_at || '').localeCompare(a.created_at || ''));
    return JSON响应({ tasks: tasks.map(t => ({ ...t, tags: JSON.parse(t.tags || '[]'), completed: !!t.completed })) });
  }

  // ===== 创建任务 =====
  if (pathName === '/api/tasks' && method === 'POST') {
    const data = await 解析Body(req);
    if (!data.title) return 错误响应('任务标题不能为空');
    const id = data.id || crypto.randomUUID();
    const task = {
      id, user_id: 用户.id, title: data.title,
      due_date: data.due_date || null, remind_minutes: data.remind_minutes || null,
      priority: data.priority || '普通', tags: JSON.stringify(data.tags || []),
      repeat: data.repeat || 'none', repeat_days: data.repeat_days ? JSON.stringify(data.repeat_days) : null,
      note: data.note || null, completed: 0, completed_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    };
    数据库.tasks.push(task);
    保存数据库();
    return JSON响应({ task: { id, title: data.title, priority: data.priority || '普通', tags: data.tags || [], completed: false } }, 201);
  }

  // ===== 更新任务 =====
  const 任务更新匹配 = pathName.match(/^\/api\/tasks\/([\w-]+)$/);
  if (任务更新匹配 && method === 'PUT') {
    const 任务ID = 任务更新匹配[1];
    const data = await 解析Body(req);
    const 索引 = 数据库.tasks.findIndex(t => t.id === 任务ID && t.user_id === 用户.id);
    if (索引 === -1) return 错误响应('任务不存在', 404);
    Object.assign(数据库.tasks[索引], {
      title: data.title, due_date: data.due_date || null,
      remind_minutes: data.remind_minutes || null, priority: data.priority || '普通',
      tags: JSON.stringify(data.tags || []), repeat: data.repeat || 'none',
      repeat_days: data.repeat_days ? JSON.stringify(data.repeat_days) : null,
      note: data.note || null, updated_at: new Date().toISOString(),
    });
    保存数据库();
    return JSON响应({ message: '已更新' });
  }

  // ===== 删除任务 =====
  const 任务删除匹配 = pathName.match(/^\/api\/tasks\/([\w-]+)$/);
  if (任务删除匹配 && method === 'DELETE') {
    const 任务ID = 任务删除匹配[1];
    const 原长度 = 数据库.tasks.length;
    数据库.tasks = 数据库.tasks.filter(t => !(t.id === 任务ID && t.user_id === 用户.id));
    if (数据库.tasks.length === 原长度) return 错误响应('任务不存在', 404);
    保存数据库();
    return JSON响应({ message: '已删除' });
  }

  // ===== 标记完成 =====
  const 任务完成匹配 = pathName.match(/^\/api\/tasks\/([\w-]+)\/complete$/);
  if (任务完成匹配 && method === 'PATCH') {
    const 任务ID = 任务完成匹配[1];
    const { completed } = await 解析Body(req);
    const 任务 = 数据库.tasks.find(t => t.id === 任务ID && t.user_id === 用户.id);
    if (!任务) return 错误响应('任务不存在', 404);
    任务.completed = completed ? 1 : 0;
    任务.completed_at = completed ? new Date().toISOString() : null;
    任务.updated_at = new Date().toISOString();
    保存数据库();
    return JSON响应({ message: completed ? '已完成' : '取消完成' });
  }

  // ===== 番茄记录 =====
  if (pathName === '/api/pomodoro' && method === 'POST') {
    const { duration, task_id } = await 解析Body(req);
    const id = crypto.randomUUID();
    数据库.pomodoro_records.push({
      id, user_id: 用户.id, duration: duration || 25,
      task_id: task_id || null, completed_at: new Date().toISOString(),
    });
    保存数据库();
    return JSON响应({ id }, 201);
  }

  // ===== 番茄统计 =====
  if (pathName === '/api/pomodoro/stats' && method === 'GET') {
    const 日期 = url.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const records = 数据库.pomodoro_records.filter(r =>
      r.user_id === 用户.id && r.completed_at.startsWith(日期)
    );
    return JSON响应({ records });
  }

  // ===== 获取标签 =====
  if (pathName === '/api/tags' && method === 'GET') {
    const tags = 数据库.tags.filter(t => t.user_id === 用户.id);
    return JSON响应({ tags });
  }

  // ===== 创建标签 =====
  if (pathName === '/api/tags' && method === 'POST') {
    const { name, color } = await 解析Body(req);
    if (!name) return 错误响应('标签名不能为空');
    if (数据库.tags.find(t => t.user_id === 用户.id && t.name === name)) return 错误响应('标签已存在');
    const id = crypto.randomUUID();
    数据库.tags.push({ id, user_id: 用户.id, name, color: color || '#6366f1', created_at: new Date().toISOString() });
    保存数据库();
    return JSON响应({ tag: { id, name, color: color || '#6366f1' } }, 201);
  }

  return 错误响应('接口不存在', 404);
}

// ===== HTTP服务器 =====
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathName = url.pathname;

  // API请求
  if (pathName.startsWith('/api/')) {
    const 结果 = await 处理API(req, url);
    res.writeHead(结果.status, {
      ...结果.headers,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end(结果.body);
    return;
  }

  // 静态文件
  let 文件路径 = path.join(前端目录, pathName === '/' ? 'index.html' : pathName);

  // 如果文件不存在，回退到index.html（SPA模式）
  if (!fs.existsSync(文件路径) || fs.statSync(文件路径).isDirectory()) {
    文件路径 = path.join(前端目录, 'index.html');
  }

  const ext = path.extname(文件路径);
  const contentType = MIME[ext] || 'application/octet-stream';

  try {
    const 内容 = fs.readFileSync(文件路径);
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': ext === '.html' ? 'no-cache' : 'max-age=3600' });
    res.end(内容);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, () => {
  console.log(`\n  📅 日程规划App 本地服务器已启动！\n`);
  console.log(`  ➜  打开浏览器访问: \x1b[36mhttp://localhost:${PORT}\x1b[0m\n`);
  console.log(`  ➜  数据存储在: ${数据文件}`);
  console.log(`  ➜  按 Ctrl+C 停止服务器\n`);
});
