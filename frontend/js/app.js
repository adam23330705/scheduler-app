/**
 * App主入口 - 登录/注册、视图路由、初始化
 * Supabase直连版 - 不需要Express后端
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

/** 切换到注册表单 */
function 切换到注册() {
  document.getElementById('表单-登录').style.display = 'none';
  document.getElementById('表单-注册').style.display = 'flex';
  document.getElementById('登录错误信息').textContent = '';
}

/** 切换到登录表单 */
function 切换到登录() {
  document.getElementById('表单-注册').style.display = 'none';
  document.getElementById('表单-登录').style.display = 'flex';
  document.getElementById('登录错误信息').textContent = '';
}

/** 执行登录 */
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

/** 执行注册 */
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

/** 保存登录信息到本地 */
function 保存登录信息(结果) {
  const 用户数据 = {
    id: 结果.user?.id || 结果.id,
    username: 结果.user?.username || 结果.username,
  };
  应用状态.用户 = 用户数据;
  写入存储(存储键.用户信息, 用户数据);
}

/** 执行登出 */
async function 执行登出() {
  if (!confirm('确定要退出登录吗？')) return;
  
  try {
    await supabase?.auth.signOut();
  } catch {}
  
  应用状态.用户 = null;
  应用状态.任务列表 = [];
  应用状态.标签列表 = [];
  应用状态.番茄记录 = [];

  // 停止番茄钟
  if (番茄状态.运行中) {
    暂停番茄钟();
  }

  localStorage.removeItem(存储键.用户信息);
  document.getElementById('页面-主').style.display = 'none';
  document.getElementById('页面-登录').style.display = 'flex';
  显示Toast('已退出登录');
}

// ===== 视图路由 =====

/** 进入主界面 */
async function 进入主界面() {
  document.getElementById('页面-登录').style.display = 'none';
  document.getElementById('页面-主').style.display = 'flex';
  document.getElementById('显示-用户名').textContent = 应用状态.用户?.username || '';

  // 加载数据
  await 刷新所有数据();
  await 刷新番茄记录();

  // 处理离线队列
  await 处理离线队列();

  // 渲染初始视图
  切换视图('日历');
}

/** 切换视图 */
function 切换视图(视图名) {
  应用状态.当前视图 = 视图名;

  // 隐藏所有视图
  document.querySelectorAll('.视图').forEach(v => v.style.display = 'none');
  // 显示目标
  const 目标 = document.getElementById(`视图-${视图名}`);
  if (目标) 目标.style.display = 'block';

  // 更新导航高亮
  document.querySelectorAll('.导航按钮').forEach(b => b.classList.remove('活跃'));
  const 导航按钮 = document.getElementById(`导航-${视图名}`);
  if (导航按钮) 导航按钮.classList.add('活跃');

  // 更新标题
  const 标题映射 = { '日历': '日历', '今日': '今日', '总览': '总览', '番茄钟': '专注', '统计': '统计' };
  document.getElementById('显示-当前视图标题').textContent = 标题映射[视图名] || '';

  // 渲染当前视图内容
  渲染当前视图();
}

/** 渲染当前视图 */
function 渲染当前视图() {
  switch (应用状态.当前视图) {
    case '日历':
      渲染日历();
      break;
    case '今日':
      渲染今日视图();
      break;
    case '总览':
      渲染总览视图();
      break;
    case '番茄钟':
      初始化番茄钟();
      break;
    case '统计':
      渲染统计视图();
      break;
  }
}

// ===== 初始化 =====

/** 应用启动 */
async function 应用初始化() {
  // 初始化Supabase
  try {
    await 初始化Supabase();
  } catch (e) {
    console.error('Supabase初始化失败:', e);
    const 错误 = document.getElementById('登录错误信息');
    if (错误) 错误.textContent = e.message || '服务加载失败，请检查网络后刷新页面';
    return; // 初始化失败就不继续
  }

  // 从缓存恢复
  从缓存恢复();

  // 初始化表单监听
  初始化重复方式监听();

  // 检查登录状态 - 通过Supabase session
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const userId = session.user.id;
      const username = session.user.user_metadata?.username || '';
      应用状态.用户 = { id: userId, username };
      写入存储(存储键.用户信息, 应用状态.用户);
      进入主界面();
    }
  } catch (e) {
    console.warn('Session检查失败:', e);
    // 尝试用缓存恢复
    if (应用状态.用户) {
      try {
        await 用户API.获取信息();
        进入主界面();
      } catch {
        应用状态.用户 = null;
      }
    }
  }

  // 监听网络恢复
  window.addEventListener('online', async () => {
    显示Toast('网络已恢复，正在同步...');
    await 处理离线队列();
    await 刷新所有数据();
    渲染当前视图();
  });

  // 注册Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./service-worker.js');
    } catch (e) {
      console.warn('Service Worker注册失败:', e);
    }
  }
}

// 启动
应用初始化();
