/**
 * Store 模块 - 本地状态管理与缓存
 * 负责任务数据缓存、用户信息、离线队列、标签管理
 */

// ===== 存储键名 =====
const 存储键 = {
  用户信息: 'user_info',
  任务列表: 'tasks_cache',
  标签列表: 'tags_cache',
  番茄记录: 'pomodoro_cache',
  离线队列: 'offline_queue',
  选中日期: 'selected_date',
  当前月份: 'current_month',
};

// ===== 全局状态 =====
const 应用状态 = {
  用户: null,
  任务列表: [],
  标签列表: [],
  番茄记录: [],
  离线队列: [],
  当前视图: '公司',
  上一个视图: '公司',
  选中日期: null,
  当前月份: new Date(),
  筛选条件: '全部',
  已初始化: false,
  最近按了返回: false,
};

// ===== 工具函数 =====

/** 读取 localStorage */
function 读取存储(键) {
  try {
    const 数据 = localStorage.getItem(键);
    return 数据 ? JSON.parse(数据) : null;
  } catch {
    return null;
  }
}

/** 写入 localStorage */
function 写入存储(键, 数据) {
  try {
    localStorage.setItem(键, JSON.stringify(数据));
  } catch (e) {
    console.warn('存储写入失败:', e);
  }
}

/** 日期格式化 YYYY-MM-DD */
function 格式化日期(date) {
  const d = new Date(date);
  const 年 = d.getFullYear();
  const 月 = String(d.getMonth() + 1).padStart(2, '0');
  const 日 = String(d.getDate()).padStart(2, '0');
  return `${年}-${月}-${日}`;
}

/** 时间格式化 HH:mm */
function 格式化时间(date) {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** 友好时间显示 */
function 友好时间(日期字符串) {
  if (!日期字符串) return '';
  const d = new Date(日期字符串);
  const 今天 = new Date();
  const 今天Str = 格式化日期(今天);
  const 日期Str = 格式化日期(d);

  if (日期Str === 今天Str) return `今天 ${格式化时间(d)}`;
  const 明天 = new Date(今天);
  明天.setDate(明天.getDate() + 1);
  if (日期Str === 格式化日期(明天)) return `明天 ${格式化时间(d)}`;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${格式化时间(d)}`;
}

/** 生成唯一ID */
function 生成ID() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ===== 离线队列 =====

/** 添加离线操作到队列 */
function 添加离线操作(操作类型, 数据) {
  const 队列 = 读取存储(存储键.离线队列) || [];
  队列.push({
    id: 生成ID(),
    type: 操作类型,
    data: 数据,
    timestamp: Date.now(),
  });
  写入存储(存储键.离线队列, 队列);
  应用状态.离线队列 = 队列;
}

/** 处理离线队列（网络恢复后执行） */
async function 处理离线队列() {
  const 队列 = 读取存储(存储键.离线队列) || [];
  if (队列.length === 0) return;

  const 成功ID = [];
  for (const 操作 of 队列) {
    try {
      switch (操作.type) {
        case '创建任务':
          await 任务API.创建(操作.data);
          break;
        case '更新任务':
          await 任务API.更新(操作.data.id, 操作.data);
          break;
        case '删除任务':
          await 任务API.删除(操作.data.id);
          break;
        case '标记完成':
          await 任务API.标记完成(操作.data.id, 操作.data.completed);
          break;
        case '记录番茄':
          await 番茄API.记录完成(操作.data);
          break;
      }
      成功ID.push(操作.id);
    } catch (e) {
      console.warn('离线操作同步失败:', 操作.type, e);
      break; // 一个失败就停止，等下次再试
    }
  }

  if (成功ID.length > 0) {
    const 剩余 = 队列.filter(op => !成功ID.includes(op.id));
    写入存储(存储键.离线队列, 剩余);
    应用状态.离线队列 = 剩余;
  }
}

// ===== 数据加载 =====

/** 从服务器拉取全部数据并缓存 */
async function 刷新所有数据() {
  try {
    const [任务数据, 标签数据] = await Promise.all([
      任务API.获取列表(),
      标签API.获取列表(),
    ]);
    应用状态.任务列表 = 任务数据.tasks || [];
    应用状态.标签列表 = 标签数据.tags || [];
    写入存储(存储键.任务列表, 应用状态.任务列表);
    写入存储(存储键.标签列表, 应用状态.标签列表);
  } catch (e) {
    // 网络失败则使用缓存
    console.warn('数据刷新失败，使用本地缓存:', e);
    应用状态.任务列表 = 读取存储(存储键.任务列表) || [];
    应用状态.标签列表 = 读取存储(存储键.标签列表) || [];
  }
}

/** 加载番茄记录 */
async function 刷新番茄记录() {
  try {
    const 今日 = 格式化日期(new Date());
    const 数据 = await 番茄API.获取统计(今日);
    应用状态.番茄记录 = 数据.records || [];
    写入存储(存储键.番茄记录, 应用状态.番茄记录);
  } catch {
    应用状态.番茄记录 = 读取存储(存储键.番茄记录) || [];
  }
}

// ===== 任务查询 =====

/** 获取某日的任务 */
function 获取某日任务(日期字符串) {
  return 应用状态.任务列表.filter(t => {
    if (!t.due_date) return false;
    return 格式化日期(new Date(t.due_date)) === 日期字符串;
  });
}

/** 获取今日任务 */
function 获取今日任务() {
  return 获取某日任务(格式化日期(new Date()));
}

/** 按优先级筛选 */
function 按优先级筛选(优先级) {
  if (优先级 === '全部') return 应用状态.任务列表;
  return 应用状态.任务列表.filter(t => t.priority === 优先级);
}

/** 获取未完成任务 */
function 获取未完成任务() {
  return 应用状态.任务列表.filter(t => !t.completed);
}

/** 获取某月的任务日期映射 { 'YYYY-MM-DD': [task, ...] } */
function 获取月份任务映射(年, 月) {
  const 映射 = {};
  应用状态.任务列表.forEach(t => {
    if (!t.due_date) return;
    const d = new Date(t.due_date);
    if (d.getFullYear() === 年 && d.getMonth() === 月) {
      const key = 格式化日期(d);
      if (!映射[key]) 映射[key] = [];
      映射[key].push(t);
    }
  });
  return 映射;
}

/** 计算本周完成率 */
function 计算本周完成率() {
  const 今天 = new Date();
  const 星期几 = 今天.getDay() || 7; // 周日为7
  const 周一 = new Date(今天);
  周一.setDate(今天.getDate() - 星期几 + 1);
  周一.setHours(0, 0, 0, 0);

  const 本周任务 = 应用状态.任务列表.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d >= 周一 && d <= 今天;
  });

  const 已完成 = 本周任务.filter(t => t.completed).length;
  const 总数 = 本周任务.length;
  return { 已完成, 总数, 比率: 总数 > 0 ? Math.round((已完成 / 总数) * 100) : 0 };
}

/** 获取本周每日完成数 */
function 获取本周每日统计() {
  const 今天 = new Date();
  const 星期几 = 今天.getDay() || 7;
  const 周一 = new Date(今天);
  周一.setDate(今天.getDate() - 星期几 + 1);

  const 天名 = ['一', '二', '三', '四', '五', '六', '日'];
  const 结果 = [];

  for (let i = 0; i < 7; i++) {
    const 日期 = new Date(周一);
    日期.setDate(周一.getDate() + i);
    const 日期Str = 格式化日期(日期);

    const 当日任务 = 应用状态.任务列表.filter(t => {
      if (!t.due_date) return false;
      return 格式化日期(new Date(t.due_date)) === 日期Str;
    });
    const 完成 = 当日任务.filter(t => t.completed).length;

    结果.push({
      天名: 天名[i],
      日期: 日期Str,
      完成,
      总数: 当日任务.length,
      是今天: 日期Str === 格式化日期(今天),
      是未来: 日期 > 今天,
    });
  }
  return 结果;
}

/** 获取标签分布统计 */
function 获取标签统计() {
  const 统计 = {};
  应用状态.任务列表.forEach(t => {
    const 标签s = t.tags || [];
    标签s.forEach(tag => {
      if (!统计[tag]) 统计[tag] = 0;
      统计[tag]++;
    });
  });
  return Object.entries(统计)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// ===== 初始化 =====

/** 从本地缓存恢复状态 */
function 从缓存恢复() {
  应用状态.用户 = 读取存储(存储键.用户信息);
  应用状态.任务列表 = 读取存储(存储键.任务列表) || [];
  应用状态.标签列表 = 读取存储(存储键.标签列表) || [];
  应用状态.番茄记录 = 读取存储(存储键.番茄记录) || [];
  应用状态.离线队列 = 读取存储(存储键.离线队列) || [];
}
