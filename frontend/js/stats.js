/**
 * 统计模块 - 完成率、周统计图、标签分布、B站数据
 */

// ===== B站数据展示 =====

/** 加载并展示B站数据 */
async function 加载B站数据() {
  const 容器 = document.getElementById('B站数据区');
  if (!容器) return;

  容器.innerHTML = '<div class="加载中">加载B站数据中...</div>';

  try {
    await 初始化Supabase();
    const userId = await 获取用户ID异步();
    if (!userId) {
      容器.innerHTML = '<div class="空状态"><p>请先登录</p></div>';
      return;
    }

    // 从Supabase读取B站数据
    const { data, error } = await supabaseClient
      .from('bilibili_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) {
      // 没有数据，尝试抓取
      容器.innerHTML = '<div class="空状态"><p>暂无B站数据</p><button class="按钮-小" onclick="刷新B站数据()">立即抓取</button></div>';
      return;
    }

    // 展示数据
    渲染B站数据(数据);

    // 检查数据是否过期（超过1小时）
    const 抓取时间 = new Date(data.fetched_at).getTime();
    const 现在 = Date.now();
    if (现在 - 抓取时间 > 60 * 60 * 1000) {
      // 数据过期，后台刷新
      console.log('B站数据已过期，后台刷新...');
      刷新B站数据().catch(e => console.error('后台刷新失败：', e));
    }

  } catch (e) {
    console.error('加载B站数据失败：', e);
    容器.innerHTML = '<div class="空状态"><p>加载失败</p><button class="按钮-小" onclick="刷新B站数据()">重试</button></div>';
  }
}

/** 渲染B站数据到UI */
function 渲染B站数据(数据) {
  const 容器 = document.getElementById('B站数据区');
  if (!容器) return;

  const 视频列表 = 数据.videos || [];
  const 最新视频 = 视频列表.slice(0, 5); // 只显示最新5个

  let HTML = `
    <div class="B站数据卡片">
      <div class="B站数据头部">
        <div class="B站头像">
          <img src="https://api.bilibili.com/x/space/acc/info?mid=${数据.uid}" onerror="this.style.display='none'">
        </div>
        <div class="B站用户信息">
          <h4>${数据.name || '未知'}</h4>
          <p>UID: ${数据.uid}</p>
        </div>
      </div>

      <div class="B站数据统计">
        <div class="B站统计项">
          <span class="B站数字">${格式化数字(数据.follower || 0)}</span>
          <span class="B站标签">粉丝</span>
        </div>
        <div class="B站统计项">
          <span class="B站数字">${格式化数字(数据.total_play || 0)}</span>
          <span class="B站标签">总播放</span>
        </div>
        <div class="B站统计项">
          <span class="B站数字">${数据.video_count || 0}</span>
          <span class="B站标签">视频</span>
        </div>
      </div>

      <div class="最新视频列表">
        <h5>最新视频</h5>
        ${最新视频.map(v => `
          <div class="视频项">
            <div class="视频标题">${v.title || '未知标题'}</div>
            <div class="视频数据">
              <span>▶ ${格式化数字(v.play || 0)}</span>
              <span>💬 ${格式化数字(v.reply || 0)}</span>
              <span>🪁 ${格式化数字(v.danmaku || 0)}</span>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="B站数据底部">
        <span class="更新时间">更新于：${时间格式化(数据.fetched_at)}</span>
        <button class="按钮-小" onclick="刷新B站数据()">刷新</button>
      </div>
    </div>
  `;

  容器.innerHTML = HTML;
}

/** 格式化数字（如：9.3万） */
function 格式化数字(数字) {
  if (数字 >= 10000) {
    return (数字 / 10000).toFixed(1) + '万';
  }
  return 数字.toString();
}

/** 时间格式化 */
function 时间格式化(时间字符串) {
  const 日期 = new Date(时间字符串);
  return 日期.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/** 手动刷新B站数据 */
async function 刷新B站数据() {
  const 容器 = document.getElementById('B站数据区');
  if (容器) 容器.innerHTML = '<div class="加载中">正在抓取B站数据...</div>';

  显示Toast('正在抓取B站数据...');

  try {
    await 抓取用户B站数据();
    // 重新加载展示
    await 加载B站数据();
    显示Toast('B站数据已更新');
  } catch (e) {
    console.error('刷新B站数据失败：', e);
    显示Toast('抓取失败：' + e.message);
    if (容器) 容器.innerHTML = `<div class="空状态"><p>抓取失败</p><p class="错误详情">${e.message}</p><button class="按钮-小" onclick="刷新B站数据()">重试</button></div>`;
  }
}

// ===== 任务完成率统计 =====

/** 渲染统计视图 */
function 渲染统计视图() {
  加载B站数据(); // 加载B站数据
  渲染完成率();
  渲染周统计图();
  渲染标签分布();
}

/** 渲染完成率 */
function 渲染完成率() {
  const { 已完成, 总数, 比率 } = 计算本周完成率();
  document.getElementById('完成率数字').textContent = `${比率}%`;
  document.getElementById('完成率说明').textContent = `本周完成 ${已完成} / ${总数} 个任务`;

  // 数字颜色
  const 数字元素 = document.getElementById('完成率数字');
  if (比率 >= 80) 数字元素.style.color = '#22c55e';    // 绿色
  else if (比率 >= 50) 数字元素.style.color = '#f59e0b'; // 黄色
  else 数字元素.style.color = '#ef4444';                  // 红色
}

/** 渲染周统计图 */
function 渲染周统计图() {
  const 每日统计 = 获取本周每日统计();
  const 最大值 = Math.max(...每日统计.map(d => d.总数), 1);

  const 容器 = document.getElementById('周统计图');
  容器.innerHTML = '';

  每日统计.forEach(天 => {
    const 柱 = document.createElement('div');
    柱.className = '周柱';

    const 柱体容器 = document.createElement('div');
    柱体容器.className = '柱体容器';

    const 柱体 = document.createElement('div');
    柱体.className = `柱体 ${天.总数 === 0 ? '空' : ''}`;

    // 高度：完成比例
    const 完成高度 = 天.总数 > 0 ? Math.max((天.完成 / 最大值) * 100, 4) : 4;
    柱体.style.height = `${完成高度}%`;

    // 今天高亮
    if (天.是今天) {
      柱体.style.background = 'var(--主色浅)';
    }
    if (天.是未来) {
      柱体.style.opacity = '0.3';
    }

    柱体容器.appendChild(柱体);

    const 标签 = document.createElement('div');
    标签.className = '柱标签';
    标签.textContent = 天.天名;
    if (天.是今天) 标签.style.color = 'var(--主色浅)';
    if (天.是今天) 标签.style.fontWeight = '700';

    柱.appendChild(柱体容器);
    柱.appendChild(标签);
    容器.appendChild(柱);
  });
}

/** 渲染标签分布 */
function 渲染标签分布() {
  const 统计 = 获取标签统计();
  const 容器 = document.getElementById('标签统计');

  if (统计.length === 0) {
    容器.innerHTML = '<div class="空状态"><p>暂无标签数据</p></div>';
    return;
  }

  const 最大值 = Math.max(...统计.map(s => s.count), 1);
  const 颜色列表 = ['#6366f1', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185'];

  容器.innerHTML = '';
  统计.forEach((项, i) => {
    const 行 = document.createElement('div');
    行.className = '标签统计行';

    const 名称 = document.createElement('span');
    名称.className = '标签名';
    名称.textContent = 项.name;

    const 进度条 = document.createElement('div');
    进度条.className = '进度条';

    const 填充 = document.createElement('div');
    填充.className = '进度条填充';
    填充.style.width = `${(项.count / 最大值) * 100}%`;
    填充.style.background = 颜色列表[i % 颜色列表.length];

    进度条.appendChild(填充);

    const 数字 = document.createElement('span');
    数字.className = '标签数字';
    数字.textContent = 项.count;

    行.appendChild(名称);
    行.appendChild(进度条);
    行.appendChild(数字);
    容器.appendChild(行);
  });
}
