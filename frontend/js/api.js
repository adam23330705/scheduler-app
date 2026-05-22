/**
 * API 模块 - Supabase直连版
 * 不再需要Express后端，前端直接操作Supabase
 */

// ===== Supabase 配置 =====
const SUPABASE_URL = 'https://mpgepjjswopzuopssrvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1wZ2Vwampzd29wenVvcHNzcnZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NTE0OTEsImV4cCI6MjA5NTAyNzQ5MX0._ErJLmNgQBUOYupWo71GuRwr-B4run1ir7bsY7Q-YnA';

// 加载 Supabase JS SDK
let supabase = null;

async function 初始化Supabase() {
  if (supabase) return supabase;

  // 等待 HTML 中的 <script> 标签加载完 SDK
  let 等待次数 = 0;
  while ((!window.supabase || !window.supabase.createClient) && 等待次数 < 30) {
    await new Promise(r => setTimeout(r, 200));
    等待次数++;
  }

  if (!window.supabase || !window.supabase.createClient) {
    throw new Error('网络连接失败，无法加载服务，请检查网络后刷新页面');
  }

  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 监听认证状态变化
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') {
      应用状态.用户 = null;
      localStorage.removeItem(存储键.用户信息);
      document.getElementById('页面-主').style.display = 'none';
      document.getElementById('页面-登录').style.display = 'flex';
    }
  });

  return supabase;
}

// 获取当前用户
function 获取当前用户() {
  return supabase?.auth.getUser();
}

// 获取当前用户ID（异步，兼容Supabase JS v2）
async function 获取用户ID异步() {
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id || null;
}

// 同步获取用户ID（从缓存，用于非关键场景）
function 获取用户ID() {
  const 缓存 = localStorage.getItem(存储键.用户信息);
  if (缓存) {
    try { return JSON.parse(缓存).id; } catch {}
  }
  return null;
}

// ===== 用户认证 =====
const 用户API = {
  async 注册(用户名, 密码) {
    await 初始化Supabase();
    // Supabase Auth 需要 email，我们用 用户名@scheduler.app 作为虚拟邮箱
    const email = `${用户名}@scheduler.app`;
    const { data, error } = await supabase.auth.signUp({
      email,
      password: 密码,
      options: {
        data: { username: 用户名 }
      }
    });
    if (error) throw new Error(error.message === 'User already registered' ? '用户名已被占用' : error.message);
    
    const user = data.user;
    return {
      user: { id: user.id, username: 用户名 },
      token: data.session?.access_token
    };
  },

  async 登录(用户名, 密码) {
    await 初始化Supabase();
    const email = `${用户名}@scheduler.app`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: 密码 });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? '用户名或密码错误' : error.message);
    
    return {
      user: { id: data.user.id, username: data.user.user_metadata?.username || 用户名 },
      token: data.session.access_token
    };
  },

  async 获取信息() {
    await 初始化Supabase();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw new Error('未登录或token已过期');
    return { user: { id: user.id, username: user.user_metadata?.username || '' } };
  }
};

// ===== 任务管理 =====
const 任务API = {
  async 获取列表(参数 = {}) {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    if (!userId) throw new Error('未登录');
    
    let query = supabase.from('tasks').select('*').eq('user_id', userId);
    
    if (参数.date) {
      const 日期 = 参数.date;
      query = query.gte('due_date', `${日期}T00:00:00`).lt('due_date', `${日期}T23:59:59`);
    }
    if (参数.priority) {
      query = query.eq('priority', 参数.priority);
    }
    
    query = query.order('completed', { ascending: true }).order('due_date', { ascending: true });
    
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    
    // 转换数据格式以兼容前端
    return { tasks: (data || []).map(t => ({
      ...t,
      tags: Array.isArray(t.tags) ? t.tags : (typeof t.tags === 'string' ? JSON.parse(t.tags) : []),
      completed: !!t.completed,
    }))};
  },

  async 创建(任务数据) {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    if (!userId) throw new Error('未登录');
    
    const id = 任务数据.id || 生成ID();
    const { data, error } = await supabase.from('tasks').insert({
      id,
      user_id: userId,
      title: 任务数据.title,
      due_date: 任务数据.due_date || null,
      remind_minutes: 任务数据.remind_minutes || null,
      priority: 任务数据.priority || '普通',
      tags: 任务数据.tags || [],
      repeat: 任务数据.repeat || 'none',
      repeat_days: 任务数据.repeat_days || null,
      note: 任务数据.note || null,
    }).select().single();
    
    if (error) throw new Error(error.message);
    return { task: { id, title: 任务数据.title, priority: 任务数据.priority || '普通', tags: 任务数据.tags || [], completed: false } };
  },

  async 更新(任务ID, 更新数据) {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    
    const 更新字段 = {
      title: 更新数据.title,
      due_date: 更新数据.due_date || null,
      remind_minutes: 更新数据.remind_minutes || null,
      priority: 更新数据.priority || '普通',
      tags: 更新数据.tags || [],
      repeat: 更新数据.repeat || 'none',
      repeat_days: 更新数据.repeat_days || null,
      note: 更新数据.note || null,
      updated_at: new Date().toISOString(),
    };
    
    const { error } = await supabase.from('tasks').update(更新字段).eq('id', 任务ID).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return { message: '已更新' };
  },

  async 删除(任务ID) {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    
    const { error } = await supabase.from('tasks').delete().eq('id', 任务ID).eq('user_id', userId);
    if (error) throw new Error(error.message);
    return { message: '已删除' };
  },

  async 标记完成(任务ID, 是否完成) {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    
    const { error } = await supabase.from('tasks').update({
      completed: 是否完成,
      completed_at: 是否完成 ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }).eq('id', 任务ID).eq('user_id', userId);
    
    if (error) throw new Error(error.message);
    return { message: 是否完成 ? '已完成' : '取消完成' };
  }
};

// ===== 番茄钟记录 =====
const 番茄API = {
  async 记录完成(记录数据) {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    if (!userId) throw new Error('未登录');
    
    const id = 生成ID();
    const { data, error } = await supabase.from('pomodoro_records').insert({
      id,
      user_id: userId,
      duration: 记录数据.duration || 25,
      task_id: 记录数据.task_id || null,
      completed_at: 记录数据.completed_at || new Date().toISOString(),
    }).select().single();
    
    if (error) throw new Error(error.message);
    return { id };
  },

  async 获取统计(日期) {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    if (!userId) throw new Error('未登录');
    
    const { data, error } = await supabase.from('pomodoro_records')
      .select('*')
      .eq('user_id', userId)
      .gte('completed_at', `${日期}T00:00:00`)
      .lt('completed_at', `${日期}T23:59:59`)
      .order('completed_at', { ascending: false });
    
    if (error) throw new Error(error.message);
    return { records: data || [] };
  }
};

// ===== 标签管理 =====
const 标签API = {
  async 获取列表() {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    if (!userId) throw new Error('未登录');
    
    const { data, error } = await supabase.from('tags')
      .select('*')
      .eq('user_id', userId)
      .order('name');
    
    if (error) throw new Error(error.message);
    return { tags: data || [] };
  },

  async 创建(标签名, 颜色) {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    if (!userId) throw new Error('未登录');
    
    const id = 生成ID();
    const { data, error } = await supabase.from('tags').insert({
      id,
      user_id: userId,
      name: 标签名,
      color: 颜色 || '#6366f1',
    }).select().single();
    
    if (error) {
      if (error.code === '23505') return null; // 重复标签
      throw new Error(error.message);
    }
    return { tag: { id, name: 标签名, color: 颜色 || '#6366f1' } };
  }
};
