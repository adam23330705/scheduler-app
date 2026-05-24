/**
 * App主入口 - 登录/注册、视图路由、初始化
 * 花蕾传媒 · 我的虚拟公司
 * Tab: 公司、任务、消息、朋友圈、我的
 */

// ===== Toast提示 =====

let toast定时器 = null;
function 显示Toast(消息) {
  const 元素 = document.getElementById('toast提示');
  元素.textContent = 消息;
  元素.classList.add('显示');
  clearTimeout(toast定时器);
  toast定时器 = setTimeout(() => {
    元素.classList.remove('显示');
  }, 2500);
}

// ===== 登录/注册 =====

function 切换到注册() {
  document.getElementById('表单-登录').style.display = 'none';
  document.getElementById('表单-注册').style.display = 'flex';
  document.getElementById('登录错误信息').textContent = '';
}

function 切换到登录() {
  document.getElementById('表单-注册').style.display = 'none';
  document.getElementById('表单-登录').style.display = 'flex';
  document.getElementById('登录错误信息').textContent = '';
}

async function 执行登录() {
  const 用户名 = document.getElementById('输入-用户名').value.trim();
  const 密码 = document.getElementById('输入-密码').value;
  const 错误 = document.getElementById('登录错误信息');

  if (!用户名 || !密码) {
    错误.textContent = '请输入用户名和密码';
    return;
  }

  try {
    const 结果 = await 用户API.登录(用户名, 密码);
    保存登录信息(结果);
    进入主界面();
  } catch (e) {
    错误.textContent = e.message || '登录失败';
  }
}

async function 执行注册() {
  const 用户名 = document.getElementById('输入-注册用户名').value.trim();
  const 密码 = document.getElementById('输入-注册密码').value;
  const 确认 = document.getElementById('输入-确认密码').value;
  const 错误 = document.getElementById('登录错误信息');

  if (!用户名 || !密码) {
    错误.textContent = '请输入用户名和密码';
    return;
  }
  if (用户名.length < 3 || 用户名.length > 20) {
    错误.textContent = '用户名需要3-20个字符';
    return;
  }
  if (密码.length < 6) {
    错误.textContent = '密码至少6位';
    return;
  }
  if (密码 !== 确认) {
    错误.textContent = '两次密码不一致';
    return;
  }

  try {
    const 结果 = await 用户API.注册(用户名, 密码);
    保存登录信息(结果);
    进入主界面();
  } catch (e) {
    错误.textContent = e.message || '注册失败';
  }
}

function 保存登录信息(结果) {
  const 用户数据 = {
    id: 结果.user?.id || 结果.id,
    username: 结果.user?.username || 结果.username,
  };
  应用状态.用户 = 用户数据;
  写入存储(存储键.用户信息, 用户数据);
}

async function 执行登出() {
  if (!confirm('确定要退出登录吗？')) return;

  try {
    await supabaseClient?.auth.signOut();
  } catch {}

  应用状态.用户 = null;
  应用状态.任务列表 = [];
  应用状态.标签列表 = [];
  应用状态.番茄记录 = [];

  if (番茄状态.运行中) {
    暂停番茄钟();
  }

  localStorage.removeItem(存储键.用户信息);
  document.getElementById('页面-主').style.display = 'none';
  document.getElementById('页面-登录').style.display = 'flex';
  显示Toast('已退出登录');
}

// ===== 视图路由 =====

async function 进入主界面() {
  document.getElementById('页面-登录').style.display = 'none';
  document.getElementById('页面-主').style.display = 'flex';
  document.getElementById('显示-用户名').textContent = 应用状态.用户?.username || '';

  // 加载数据
  await 刷新所有数据();
  await 刷新番茄记录();
  await 处理离线队列();

  // 加载线上角色配置（后门机制）
  加载线上角色配置();

  // 渲染初始视图 - 默认进入公司页
  切换视图('公司');

  // 初始化history state，确保返回键能正确工作
  // 替换当前history entry（不清空之前的，防止后退到登录页）
  history.replaceState({ view: '公司' }, '');
  // 再push一个，确保有至少2个history entry可供popstate拦截
  history.pushState({ view: '公司' }, '');

  // 启动消息催促
  启动消息催促();

  // 更新消息导航未读
  更新消息导航未读();
}

/** 切换视图 */
function 切换视图(视图名) {
  // 记住上一个视图（用于对话返回）
  if (视图名 !== '对话' && 应用状态.当前视图 !== '对话') {
    应用状态.上一个视图 = 应用状态.当前视图;
  }
  应用状态.当前视图 = 视图名;

  // 对话视图是全屏覆盖，单独处理
  if (视图名 === '对话') {
    document.querySelectorAll('.视图').forEach(v => v.style.display = 'none');
    document.getElementById('视图-对话').style.display = 'flex';
    // push历史状态，让返回键能拦截
    history.pushState({ view: '对话' }, '');
    return;
  }

  // 隐藏所有视图
  document.querySelectorAll('.视图').forEach(v => v.style.display = 'none');
  // 显示目标
  const 目标 = document.getElementById(`视图-${视图名}`);
  if (目标) 目标.style.display = 'block';

  // 显示底部导航
  const 底导 = document.querySelector('.底部导航');
  if (底导) 底导.style.display = 'flex';

  // 更新导航高亮
  document.querySelectorAll('.导航按钮').forEach(b => b.classList.remove('活跃'));
  const 导航按钮 = document.getElementById(`导航-${视图名}`);
  if (导航按钮) 导航按钮.classList.add('活跃');

  // 更新标题
  const 标题映射 = {
    '公司': '花蕾传媒',
    '任务': '任务',
    '消息': '消息',
    '朋友圈': '朋友圈',
    '我的': '我的',
    '番茄钟': '专注',
    '统计': '统计',
  };
  document.getElementById('显示-当前视图标题').textContent = 标题映射[视图名] || '';

  // ★ 关键：每次视图切换都pushState，确保popstate能拦截返回键
  history.pushState({ view: 视图名 }, '');

  // 渲染当前视图内容
  渲染当前视图();
}

/** 渲染当前视图 */
function 渲染当前视图() {
  switch (应用状态.当前视图) {
    case '公司':
      更新角色心情();
      渲染角色列表();
      渲染竞争排行();
      渲染今日动态();
      break;
    case '任务':
      渲染日历();
      渲染任务视图();
      break;
    case '消息':
      渲染消息页();
      break;
    case '朋友圈':
      渲染朋友圈();
      break;
    case '我的':
      渲染我的页面();
      break;
    case '番茄钟':
      初始化番茄钟();
      break;
    case '统计':
      渲染统计视图();
      break;
  }
}

/** 渲染我的页面 */
function 渲染我的页面() {
  const 用户名 = document.getElementById('我的用户名');
  if (用户名) 用户名.textContent = 应用状态.用户?.username || '';

  const 今日 = typeof 获取今日任务 === 'function' ? 获取今日任务() : [];
  const 已完成 = 今日.filter(t => t.completed).length;
  const 总数 = 今日.length;
  const 完成率 = 总数 > 0 ? Math.round(已完成 / 总数 * 100) : 0;

  const 完成率元素 = document.getElementById('我的-完成率');
  if (完成率元素) 完成率元素.textContent = 完成率 + '%';

  const 番茄数元素 = document.getElementById('我的-番茄数');
  if (番茄数元素) 番茄数元素.textContent = 应用状态.番茄记录?.length || 0;
}

// ===== 检查更新 =====
const 当前版本 = '1.0.13';

/** 检查是否有新版本 */
async function 检查更新() {
  const 箭头 = document.getElementById('更新箭头');
  if (箭头) 箭头.textContent = '⟳';

  try {
    // 从GitHub Pages获取线上版本号（加时间戳防止缓存）
    const 响应 = await fetch(`https://adam23330705.github.io/scheduler-app/version.json?t=${Date.now()}`);
    if (!响应.ok) {
      显示Toast('检查更新失败，请检查网络');
      if (箭头) 箭头.textContent = '›';
      return;
    }

    const 数据 = await 响应.json();
    const 线上版本 = 数据.version;
    const 更新说明 = 数据.changelog || '';

    if (线上版本 !== 当前版本) {
      // 有新版本
      显示Toast('发现新版本 v' + 线上版本 + '，正在更新...');
      
      // 清除所有缓存
      try {
        if ('caches' in window) {
          const 缓存列表 = await caches.keys();
          await Promise.all(缓存列表.map(name => caches.delete(name)));
        }
      } catch(e) { console.log('清除缓存失败:', e); }

      // 清除localStorage中的旧资源缓存（如果有）
      try {
        // 删除service worker缓存
        if (navigator.serviceWorker) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (let reg of registrations) {
            await reg.unregister();
          }
        }
      } catch(e) { console.log('清除SW失败:', e); }

      // 强制刷新：用新URL避免缓存
      setTimeout(() => {
        window.location.href = window.location.href.split('?')[0] + '?v=' + 线上版本 + '&t=' + Date.now();
      }, 1500);
    } else {
      显示Toast('当前已是最新版本 v' + 当前版本);
    }
  } catch (e) {
    console.error('检查更新失败:', e);
    显示Toast('检查更新失败');
  }

  if (箭头) 箭头.textContent = '›';
}

// ===== 角色提醒定时器 =====
let 提醒定时器 = null;

function 启动角色提醒() {
  if (提醒定时器) clearInterval(提醒定时器);

  提醒定时器 = setInterval(() => {
    const 角色 = ['小陈', '赵经理', '小周'];
    const 随机角色 = 角色[Math.floor(Math.random() * 角色.length)];
    const 提醒 = 生成主动提醒(随机角色);
    if (提醒) {
      // 发到消息页而不是Toast
      添加新消息(随机角色, '催促', 提醒);
    }

    // 可能生成朋友圈动态
    if (Math.random() < 0.3) {
      自动生成动态();
    }
  }, 15 * 60 * 1000);
}

/** 渲染任务视图（合并日历+任务+KPI） */
function 渲染任务视图() {
  // 更新KPI
  const 今日 = typeof 获取今日任务 === 'function' ? 获取今日任务() : [];
  const 月任务 = 获取本月任务();
  const 月完成 = 月任务.filter(t => t.completed).length;
  const 月未完 = 月任务.filter(t => !t.completed).length;
  const 月完成率 = 月任务.length > 0 ? Math.round(月完成 / 月任务.length * 100) : 0;

  const KPI完成 = document.getElementById('KPI-月度完成');
  const KPI未完 = document.getElementById('KPI-月度未完');
  const KPI完成率 = document.getElementById('KPI-月度完成率');

  if (KPI完成) KPI完成.textContent = 月完成;
  if (KPI未完) KPI未完.textContent = 月未完;
  if (KPI完成率) KPI完成率.textContent = 月完成率 + '%';

  // 更新今日任务标题
  const 今天 = new Date();
  const 星期名 = ['日', '一', '二', '三', '四', '五', '六'];
  const 标题 = document.getElementById('今日任务标题');
  if (标题) 标题.textContent = `${今天.getMonth() + 1}月${今天.getDate()}日 星期${星期名[今天.getDay()]}`;

  const 未完成 = 今日.filter(t => !t.completed);
  const 计数 = document.getElementById('今日任务计数');
  if (计数) 计数.textContent = `${未完成.length}个待办`;

  // 渲染任务列表
  渲染总览视图();
}

/** 获取本月任务 */
function 获取本月任务() {
  const 现在 = new Date();
  const 年 = 现在.getFullYear();
  const 月 = 现在.getMonth();
  return 应用状态.任务列表.filter(t => {
    if (!t.due_date) return false;
    const d = new Date(t.due_date);
    return d.getFullYear() === 年 && d.getMonth() === 月;
  });
}

// ===== Android返回键处理 =====
// 核心思路：用popstate作为主要拦截机制（浏览器原生，不依赖Capacitor bridge）
// Capacitor backButton作为备用

/** 处理返回逻辑（所有返回方式统一调用此函数） */
function 处理返回键() {
  const 当前 = 应用状态.当前视图;

  // 在对话视图 → 返回上一个Tab
  if (当前 === '对话') {
    返回主界面();
    return true;
  }

  // 在子视图（番茄钟/统计）→ 回到"我的"
  if (当前 === '番茄钟' || 当前 === '统计') {
    切换视图('我的');
    return true;
  }

  // 在主Tab页 → 双击退出
  if (['公司', '任务', '消息', '朋友圈', '我的'].includes(当前)) {
    if (应用状态.最近按了返回) {
      // 第二次按返回 → 退出APP
      const { App } = window.Capacitor?.Plugins || {};
      if (App?.exitApp) {
        App.exitApp();
      }
      return true;
    }
    应用状态.最近按了返回 = true;
    显示Toast('再按一次退出应用');
    setTimeout(() => { 应用状态.最近按了返回 = false; }, 2000);
    return true;
  }

  return false;
}

// ===== 主机制：popstate监听（浏览器原生，最可靠） =====
// 当Android返回键/手势触发时，WebView会先触发popstate（如果有history）
// 我们在popstate中把state推回去，阻止浏览器默认的后退行为，然后自行处理导航
window.addEventListener('popstate', function(e) {
  console.log('[返回键] popstate触发, 当前视图:', 应用状态.当前视图);

  // 核心：把history state推回去，阻止浏览器继续后退
  // 这样WebView永远不会真正"后退"，所有导航由我们自己控制
  history.pushState({ view: 应用状态.当前视图 }, '');

  // 自行处理返回逻辑
  处理返回键();
});

// ===== 备用机制：Capacitor backButton监听 =====
// 如果Capacitor bridge正常工作，backButton事件会先于popstate触发
document.addEventListener('DOMContentLoaded', function() {
  const 注册返回键 = () => {
    const { App } = window.Capacitor?.Plugins || {};
    if (App?.addListener) {
      App.addListener('backButton', () => {
        console.log('[返回键] Capacitor backButton触发');
        处理返回键();
      });
      console.log('[返回键] @capacitor/app backButton 监听已注册');
    } else {
      // 插件未就绪，延迟重试（但popstate已经兜底，不影响功能）
      console.warn('[返回键] Capacitor App插件未就绪，1秒后重试（popstate已兜底）');
      setTimeout(注册返回键, 1000);
    }
  };
  注册返回键();
});

// ===== 初始化 =====

async function 应用初始化() {
  try {
    await 初始化Supabase();
  } catch (e) {
    console.error('Supabase初始化失败:', e);
    const 错误 = document.getElementById('登录错误信息');
    if (错误) 错误.textContent = e.message || '服务加载失败，请检查网络后刷新页面';
    return;
  }

  从缓存恢复();
  初始化重复方式监听();

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      const userId = session.user.id;
      const username = session.user.user_metadata?.username || '';
      应用状态.用户 = { id: userId, username };
      写入存储(存储键.用户信息, 应用状态.用户);
      进入主界面();
    }
  } catch (e) {
    console.warn('Session检查失败:', e);
    if (应用状态.用户) {
      try {
        await 用户API.获取信息();
        进入主界面();
      } catch {
        应用状态.用户 = null;
      }
    }
  }

  window.addEventListener('online', async () => {
    显示Toast('网络已恢复，正在同步...');
    await 处理离线队列();
    await 刷新所有数据();
    渲染当前视图();
  });

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
    } catch (e) {
      console.warn('Service Worker注册失败:', e);
    }
  }
}

应用初始化();
