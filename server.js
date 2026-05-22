/**
 * 日程规划 API 服务器 - 生产版
 * 部署方案：前端Vercel + 后端Render + 数据库Supabase
 * 数据库：PostgreSQL (Supabase) / 本地JSON回退
 */

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cors = require('cors');

// ===== 数据库连接 =====
// 优先 PostgreSQL (Supabase)，回退到本地JSON
let pgPool = null;

if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    pgPool.on('error', (err) => {
      console.error('PostgreSQL连接异常:', err.message);
    });
    console.log('✅ PostgreSQL(Supabase)配置已加载');
  } catch (e) {
    console.warn('⚠️ pg模块不可用:', e.message);
    pgPool = null;
  }
} else {
  console.log('ℹ️ 未设置DATABASE_URL，使用本地JSON存储');
}

// ===== JSON文件数据库回退 =====
const JSON_DB_PATH = path.join(__dirname, 'data', 'db.json');
const fs = require('fs');

function 确保目录存在(文件路径) {
  const dir = path.dirname(文件路径);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function 读取JSON() {
  try {
    if (fs.existsSync(JSON_DB_PATH)) return JSON.parse(fs.readFileSync(JSON_DB_PATH, 'utf8'));
  } catch {}
  return { users: [], tasks: [], pomodoro_records: [], tags: [] };
}

function 写入JSON(数据) {
  确保目录存在(JSON_DB_PATH);
  fs.writeFileSync(JSON_DB_PATH, JSON.stringify(数据, null, 2), 'utf8');
}

// ===== 数据库操作层（PostgreSQL / JSON统一接口） =====

async function 初始化数据库() {
  if (pgPool) {
    try {
      await pgPool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL, salt TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS tasks (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL,
          due_date TEXT, remind_minutes INTEGER, priority TEXT DEFAULT '普通',
          tags TEXT DEFAULT '[]', repeat TEXT DEFAULT 'none', repeat_days TEXT,
          note TEXT, completed INTEGER DEFAULT 0, completed_at TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS pomodoro_records (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, duration INTEGER NOT NULL,
          task_id TEXT, completed_at TEXT NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
        CREATE TABLE IF NOT EXISTS tags (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL,
          color TEXT DEFAULT '#6366f1', created_at TIMESTAMPTZ DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id), UNIQUE(user_id, name)
        );
        CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
        CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(user_id, due_date);
      `);
      console.log('✅ PostgreSQL数据库表已就绪');
    } catch (e) {
      console.error('❌ PostgreSQL初始化失败:', e.message);
    }
  }
}

async function 查询用户(用户名) {
  if (pgPool) {
    const { rows } = await pgPool.query('SELECT * FROM users WHERE username = $1', [用户名]);
    return rows[0] || null;
  }
  return 读取JSON().users.find(u => u.username === 用户名) || null;
}

async function 创建用户(id, username, hash, salt) {
  if (pgPool) {
    await pgPool.query('INSERT INTO users (id, username, password_hash, salt) VALUES ($1, $2, $3, $4)', [id, username, hash, salt]);
  } else {
    const 数据 = 读取JSON();
    数据.users.push({ id, username, password_hash: hash, salt, created_at: new Date().toISOString() });
    写入JSON(数据);
  }
}

async function 查询任务列表(用户ID, 日期, 优先级) {
  if (pgPool) {
    let sql = 'SELECT * FROM tasks WHERE user_id = $1';
    const params = [用户ID];
    let idx = 2;
    if (日期) { sql += ` AND due_date::date = $${idx}::date`; params.push(日期); idx++; }
    if (优先级) { sql += ` AND priority = $${idx}`; params.push(优先级); idx++; }
    sql += ' ORDER BY completed ASC, due_date ASC, created_at DESC';
    const { rows } = await pgPool.query(sql, params);
    return rows;
  }
  let tasks = 读取JSON().tasks.filter(t => t.user_id === 用户ID);
  if (日期) tasks = tasks.filter(t => t.due_date && t.due_date.startsWith(日期));
  if (优先级) tasks = tasks.filter(t => t.priority === 优先级);
  return tasks;
}

async function 创建任务到DB(任务数据) {
  if (pgPool) {
    await pgPool.query(
      `INSERT INTO tasks (id, user_id, title, due_date, remind_minutes, priority, tags, repeat, repeat_days, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [任务数据.id, 任务数据.user_id, 任务数据.title, 任务数据.due_date,
       任务数据.remind_minutes, 任务数据.priority, 任务数据.tags,
       任务数据.repeat, 任务数据.repeat_days, 任务数据.note]
    );
  } else {
    const 数据 = 读取JSON();
    数据.tasks.push({ ...任务数据, completed: 0, completed_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    写入JSON(数据);
  }
}

async function 更新任务到DB(任务ID, 用户ID, data) {
  if (pgPool) {
    const tags = JSON.stringify(data.tags || []);
    const { rowCount } = await pgPool.query(
      `UPDATE tasks SET title=$1, due_date=$2, remind_minutes=$3, priority=$4,
       tags=$5, repeat=$6, repeat_days=$7, note=$8, updated_at=NOW()
       WHERE id=$9 AND user_id=$10`,
      [data.title, data.due_date || null, data.remind_minutes || null,
       data.priority || '普通', tags, data.repeat || 'none',
       data.repeat_days ? JSON.stringify(data.repeat_days) : null,
       data.note || null, 任务ID, 用户ID]
    );
    return rowCount > 0;
  }
  const 数据 = 读取JSON();
  const idx = 数据.tasks.findIndex(t => t.id === 任务ID && t.user_id === 用户ID);
  if (idx === -1) return false;
  Object.assign(数据.tasks[idx], { title: data.title, due_date: data.due_date, priority: data.priority, updated_at: new Date().toISOString() });
  写入JSON(数据);
  return true;
}

async function 删除任务从DB(任务ID, 用户ID) {
  if (pgPool) {
    const { rowCount } = await pgPool.query('DELETE FROM tasks WHERE id=$1 AND user_id=$2', [任务ID, 用户ID]);
    return rowCount > 0;
  }
  const 数据 = 读取JSON();
  const 原长 = 数据.tasks.length;
  数据.tasks = 数据.tasks.filter(t => !(t.id === 任务ID && t.user_id === 用户ID));
  写入JSON(数据);
  return 数据.tasks.length < 原长;
}

async function 标记任务完成(任务ID, 用户ID, completed) {
  if (pgPool) {
    const 完成时间 = completed ? new Date().toISOString() : null;
    const { rowCount } = await pgPool.query(
      'UPDATE tasks SET completed=$1, completed_at=$2, updated_at=NOW() WHERE id=$3 AND user_id=$4',
      [completed ? 1 : 0, 完成时间, 任务ID, 用户ID]
    );
    return rowCount > 0;
  }
  const 数据 = 读取JSON();
  const 任务 = 数据.tasks.find(t => t.id === 任务ID && t.user_id === 用户ID);
  if (!任务) return false;
  任务.completed = completed ? 1 : 0;
  任务.completed_at = completed ? new Date().toISOString() : null;
  写入JSON(数据);
  return true;
}

async function 记录番茄到DB(用户ID, duration, task_id) {
  const id = crypto.randomUUID();
  if (pgPool) {
    await pgPool.query(
      'INSERT INTO pomodoro_records (id, user_id, duration, task_id, completed_at) VALUES ($1, $2, $3, $4, $5)',
      [id, 用户ID, duration || 25, task_id || null, new Date().toISOString()]
    );
  } else {
    const 数据 = 读取JSON();
    数据.pomodoro_records.push({ id, user_id: 用户ID, duration: duration || 25, task_id, completed_at: new Date().toISOString() });
    写入JSON(数据);
  }
  return id;
}

async function 查询番茄统计(用户ID, 日期) {
  if (pgPool) {
    const { rows } = await pgPool.query(
      'SELECT * FROM pomodoro_records WHERE user_id=$1 AND completed_at::date = $2::date ORDER BY completed_at DESC',
      [用户ID, 日期]
    );
    return rows;
  }
  return 读取JSON().pomodoro_records.filter(r => r.user_id === 用户ID && r.completed_at.startsWith(日期));
}

async function 查询标签列表(用户ID) {
  if (pgPool) {
    const { rows } = await pgPool.query('SELECT * FROM tags WHERE user_id=$1 ORDER BY name', [用户ID]);
    return rows;
  }
  return 读取JSON().tags.filter(t => t.user_id === 用户ID);
}

async function 创建标签到DB(用户ID, name, color) {
  const id = crypto.randomUUID();
  if (pgPool) {
    try {
      await pgPool.query('INSERT INTO tags (id, user_id, name, color) VALUES ($1, $2, $3, $4)', [id, 用户ID, name, color || '#6366f1']);
    } catch (e) {
      if (e.message.includes('unique') || e.message.includes('UNIQUE') || e.code === '23505') return null;
      throw e;
    }
  } else {
    const 数据 = 读取JSON();
    if (数据.tags.find(t => t.user_id === 用户ID && t.name === name)) return null;
    数据.tags.push({ id, user_id: 用户ID, name, color: color || '#6366f1', created_at: new Date().toISOString() });
    写入JSON(数据);
  }
  return id;
}

// ===== JWT =====
const JWT密钥 = process.env.JWT_SECRET || 'scheduler-jwt-secret-change-in-prod';

function 签名JWT(payload) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const message = `${b64url(header)}.${b64url(payload)}`;
  const sig = crypto.createHmac('sha256', JWT密钥).update(message).digest('base64url');
  return `${message}.${sig}`;
}

function 验证JWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const message = `${parts[0]}.${parts[1]}`;
    const expected = crypto.createHmac('sha256', JWT密钥).update(message).digest('base64url');
    if (parts[2] !== expected) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

function 哈希密码(password, salt) {
  return crypto.createHash('sha256').update(salt + password).digest('hex');
}

// ===== Express App =====
const app = express();
app.use(cors());
app.use(express.json());

// 前端静态文件（仅本地开发/单一部署时使用）
const 前端目录 = path.join(__dirname, 'frontend');
app.use(express.static(前端目录));

// ===== 认证中间件 =====
function 认证(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ message: '未登录或token已过期' });
  const payload = 验证JWT(auth.slice(7));
  if (!payload) return res.status(401).json({ message: '未登录或token已过期' });
  req.user = { id: payload.userId, username: payload.username };
  next();
}

// ===== API路由 =====

// 注册
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });
    if (username.length < 3 || username.length > 20) return res.status(400).json({ message: '用户名需要3-20个字符' });
    if (password.length < 6) return res.status(400).json({ message: '密码至少6位' });

    if (await 查询用户(username)) return res.status(400).json({ message: '用户名已被占用' });

    const id = crypto.randomUUID();
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = 哈希密码(password, salt);
    await 创建用户(id, username, hash, salt);

    const token = 签名JWT({ userId: id, username, exp: Math.floor(Date.now() / 1000) + 86400 * 30 });
    res.status(201).json({ user: { id, username }, token });
  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登录
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: '用户名和密码不能为空' });

    const user = await 查询用户(username);
    if (!user) return res.status(400).json({ message: '用户名或密码错误' });
    if (哈希密码(password, user.salt) !== user.password_hash) return res.status(400).json({ message: '用户名或密码错误' });

    const token = 签名JWT({ userId: user.id, username: user.username, exp: Math.floor(Date.now() / 1000) + 86400 * 30 });
    res.json({ user: { id: user.id, username: user.username }, token });
  } catch (err) {
    console.error('登录错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取用户信息
app.get('/api/auth/me', 认证, (req, res) => {
  res.json({ user: { id: req.user.id, username: req.user.username } });
});

// 获取任务列表
app.get('/api/tasks', 认证, async (req, res) => {
  try {
    const tasks = await 查询任务列表(req.user.id, req.query.date, req.query.priority);
    res.json({ tasks: tasks.map(t => ({ ...t, tags: JSON.parse(t.tags || '[]'), completed: !!t.completed })) });
  } catch (err) {
    console.error('查询任务错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建任务
app.post('/api/tasks', 认证, async (req, res) => {
  try {
    const data = req.body;
    if (!data.title) return res.status(400).json({ message: '任务标题不能为空' });

    const id = data.id || crypto.randomUUID();
    await 创建任务到DB({
      id, user_id: req.user.id, title: data.title,
      due_date: data.due_date || null, remind_minutes: data.remind_minutes || null,
      priority: data.priority || '普通', tags: JSON.stringify(data.tags || []),
      repeat: data.repeat || 'none', repeat_days: data.repeat_days ? JSON.stringify(data.repeat_days) : null,
      note: data.note || null,
    });

    res.status(201).json({ task: { id, title: data.title, priority: data.priority || '普通', tags: data.tags || [], completed: false } });
  } catch (err) {
    console.error('创建任务错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新任务
app.put('/api/tasks/:id', 认证, async (req, res) => {
  try {
    const ok = await 更新任务到DB(req.params.id, req.user.id, req.body);
    if (!ok) return res.status(404).json({ message: '任务不存在' });
    res.json({ message: '已更新' });
  } catch (err) {
    console.error('更新任务错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 删除任务
app.delete('/api/tasks/:id', 认证, async (req, res) => {
  try {
    const ok = await 删除任务从DB(req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ message: '任务不存在' });
    res.json({ message: '已删除' });
  } catch (err) {
    console.error('删除任务错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 标记完成
app.patch('/api/tasks/:id/complete', 认证, async (req, res) => {
  try {
    const { completed } = req.body;
    const ok = await 标记任务完成(req.params.id, req.user.id, completed);
    if (!ok) return res.status(404).json({ message: '任务不存在' });
    res.json({ message: completed ? '已完成' : '取消完成' });
  } catch (err) {
    console.error('标记完成错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 番茄记录
app.post('/api/pomodoro', 认证, async (req, res) => {
  try {
    const { duration, task_id } = req.body;
    const id = await 记录番茄到DB(req.user.id, duration, task_id);
    res.status(201).json({ id });
  } catch (err) {
    console.error('番茄记录错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 番茄统计
app.get('/api/pomodoro/stats', 认证, async (req, res) => {
  try {
    const 日期 = req.query.date || new Date().toISOString().split('T')[0];
    res.json({ records: await 查询番茄统计(req.user.id, 日期) });
  } catch (err) {
    console.error('番茄统计错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 获取标签
app.get('/api/tags', 认证, async (req, res) => {
  try {
    res.json({ tags: await 查询标签列表(req.user.id) });
  } catch (err) {
    console.error('获取标签错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 创建标签
app.post('/api/tags', 认证, async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ message: '标签名不能为空' });
    const id = await 创建标签到DB(req.user.id, name, color);
    if (!id) return res.status(400).json({ message: '标签已存在' });
    res.status(201).json({ tag: { id, name, color: color || '#6366f1' } });
  } catch (err) {
    console.error('创建标签错误:', err);
    res.status(500).json({ message: '服务器错误' });
  }
});

// SPA回退（仅本地开发/单一部署时使用）
app.get('*', (req, res) => {
  res.sendFile(path.join(前端目录, 'index.html'));
});

// ===== 启动 =====
const PORT = process.env.PORT || 8787;

初始化数据库().then(() => {
  app.listen(PORT, () => {
    console.log(`\n  📅 日程规划App 服务器已启动！`);
    console.log(`  ➜  本地访问: http://localhost:${PORT}`);
    console.log(`  ➜  数据库: ${pgPool ? 'PostgreSQL(Supabase)' : 'JSON文件'}`);
    console.log(`  ➜  按 Ctrl+C 停止\n`);
  });
}).catch(err => {
  console.error('数据库初始化失败:', err);
  // 即使数据库初始化失败，也启动服务器（JSON回退模式）
  app.listen(PORT, () => {
    console.log(`\n  📅 日程规划App 服务器已启动！(JSON回退模式)`);
    console.log(`  ➜  本地访问: http://localhost:${PORT}`);
  });
});
