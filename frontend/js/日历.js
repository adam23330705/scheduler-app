/**
 * 日历模块 - 月历渲染、日期选择、日程展示
 */

// ===== 日历渲染 =====

/** 渲染日历格子 */
function 渲染日历() {
  const 年 = 应用状态.当前月份.getFullYear();
  const 月 = 应用状态.当前月份.getMonth();

  // 更新月份标题
  document.getElementById('当前月份显示').textContent = `${年}年${月 + 1}月`;

  // 计算日历数据
  const 本月第一天 = new Date(年, 月, 1);
  const 本月最后一天 = new Date(年, 月 + 1, 0);
  const 起始星期 = 本月第一天.getDay(); // 0=周日
  const 总天数 = 本月最后一天.getDate();

  // 上月补位
  const 上月最后一天 = new Date(年, 月, 0).getDate();

  // 获取本月任务映射
  const 任务映射 = 获取月份任务映射(年, 月);

  const 格子容器 = document.getElementById('日历格子');
  格子容器.innerHTML = '';

  const 今天Str = 格式化日期(new Date());

  // 默认选中今天（如果当前月是本月）
  if (!应用状态.选中日期) {
    const 今天 = new Date();
    if (今天.getFullYear() === 年 && 今天.getMonth() === 月) {
      应用状态.选中日期 = 今天Str;
    }
  }

  // 上月补位格
  for (let i = 起始星期 - 1; i >= 0; i--) {
    const 日 = 上月最后一天 - i;
    const 格 = 创建日期格(日, true, false, null);
    格子容器.appendChild(格);
  }

  // 本月日期
  for (let 日 = 1; 日 <= 总天数; 日++) {
    const 日期Str = `${年}-${String(月 + 1).padStart(2, '0')}-${String(日).padStart(2, '0')}`;
    const 是今天 = 日期Str === 今天Str;
    const 是选中 = 日期Str === 应用状态.选中日期;
    const 当日任务 = 任务映射[日期Str] || [];
    const 格 = 创建日期格(日, false, 是今天, 当日任务, 是选中, 日期Str);
    格子容器.appendChild(格);
  }

  // 下月补位（补满6行42格）
  const 已填 = 起始星期 + 总天数;
  const 剩余 = (已填 <= 35 ? 35 : 42) - 已填;
  for (let i = 1; i <= 剩余; i++) {
    const 格 = 创建日期格(i, true, false, null);
    格子容器.appendChild(格);
  }

  // 渲染选中日期的日程
  渲染日程详情();
}

/** 创建单个日期格元素 */
function 创建日期格(日, 是月外, 是今天, 任务列表, 是选中, 日期Str) {
  const 格 = document.createElement('div');
  格.className = '日期格';
  if (是月外) 格.classList.add('本月外');
  if (是今天) 格.classList.add('今天');
  if (是选中) 格.classList.add('选中');

  // 日期数字
  const 日期数 = document.createElement('span');
  日期数.className = '日期数';
  日期数.textContent = 日;
  格.appendChild(日期数);

  // 任务指示点
  if (任务列表 && 任务列表.length > 0) {
    const 点容器 = document.createElement('div');
    点容器.className = '任务点';
    const 显示任务 = 任务列表.slice(0, 3); // 最多3个点
    显示任务.forEach(t => {
      const 点 = document.createElement('span');
      const 优先级 = t.priority || '普通';
      点.className = `${优先级}点`;
      点容器.appendChild(点);
    });
    格.appendChild(点容器);
  }

  // 点击选中
  if (!是月外 && 日期Str) {
    格.onclick = () => {
      应用状态.选中日期 = 日期Str;
      渲染日历(); // 重新渲染以更新选中状态
    };
  }

  return 格;
}

/** 切换月份 */
function 切换月份(偏移) {
  const 当前 = 应用状态.当前月份;
  当前.setMonth(当前.getMonth() + 偏移);
  // 切换月份时清空选中日期
  应用状态.选中日期 = null;
  渲染日历();
}

/** 渲染选中日期的日程详情 */
function 渲染日程详情() {
  const 日期Str = 应用状态.选中日期 || 格式化日期(new Date());
  const 任务列表 = 获取某日任务(日期Str);

  // 标题
  const 标题 = document.getElementById('日程详情标题');
  const 今天Str = 格式化日期(new Date());
  if (日期Str === 今天Str) {
    标题.textContent = '今日日程';
  } else {
    const d = new Date(日期Str);
    标题.textContent = `${d.getMonth() + 1}月${d.getDate()}日日程`;
  }

  // 列表
  const 容器 = document.getElementById('日程列表');
  if (任务列表.length === 0) {
    容器.innerHTML = `
      <div class="空状态">
        <div class="空状态-图标">📭</div>
        <p>这天还没有日程安排</p>
      </div>`;
    return;
  }

  容器.innerHTML = '';
  任务列表.forEach(t => 容器.appendChild(创建任务卡片(t)));
}
