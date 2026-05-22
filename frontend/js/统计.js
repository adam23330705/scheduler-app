/**
 * 统计模块 - 完成率、周统计图、标签分布
 */

// ===== 统计渲染 =====

/** 渲染统计视图 */
function 渲染统计视图() {
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
