/**
 * 番茄钟模块 - 专注计时、休息切换、记录统计
 */

// ===== 番茄钟状态 =====
const 番茄状态 = {
  模式: '专注',         // '专注' | '休息'
  运行中: false,
  剩余秒数: 25 * 60,   // 默认25分钟
  总秒数: 25 * 60,
  定时器: null,
  关联任务ID: null,
  今日番茄数: 0,
  今日专注分钟: 0,
};

// ===== 番茄钟控制 =====

/** 切换番茄模式（专注/休息） */
function 切换番茄模式(模式) {
  if (番茄状态.运行中) {
    显示Toast('请先停止当前计时');
    return;
  }
  番茄状态.模式 = 模式;
  if (模式 === '专注') {
    番茄状态.总秒数 = 25 * 60;
    番茄状态.剩余秒数 = 25 * 60;
  } else {
    番茄状态.总秒数 = 5 * 60;
    番茄状态.剩余秒数 = 5 * 60;
  }

  // 更新UI
  document.getElementById('模式-专注').classList.toggle('活跃', 模式 === '专注');
  document.getElementById('模式-休息').classList.toggle('活跃', 模式 === '休息');
  更新番茄显示();
}

/** 开始/暂停番茄钟 */
function 切换番茄钟() {
  if (番茄状态.运行中) {
    暂停番茄钟();
  } else {
    启动番茄钟();
  }
}

/** 启动番茄钟 */
function 启动番茄钟() {
  番茄状态.运行中 = true;
  const 按钮 = document.getElementById('番茄开始按钮');
  按钮.textContent = '⏸ 暂停';

  番茄状态.定时器 = setInterval(() => {
    番茄状态.剩余秒数--;

    if (番茄状态.剩余秒数 <= 0) {
      番茄钟完成();
      return;
    }

    更新番茄显示();
  }, 1000);
}

/** 暂停番茄钟 */
function 暂停番茄钟() {
  番茄状态.运行中 = false;
  clearInterval(番茄状态.定时器);
  const 按钮 = document.getElementById('番茄开始按钮');
  按钮.textContent = '▶ 继续';
}

/** 重置番茄钟 */
function 重置番茄钟() {
  番茄状态.运行中 = false;
  clearInterval(番茄状态.定时器);
  if (番茄状态.模式 === '专注') {
    番茄状态.剩余秒数 = 25 * 60;
    番茄状态.总秒数 = 25 * 60;
  } else {
    番茄状态.剩余秒数 = 5 * 60;
    番茄状态.总秒数 = 5 * 60;
  }
  const 按钮 = document.getElementById('番茄开始按钮');
  按钮.textContent = '▶ 开始';
  更新番茄显示();
}

/** 番茄钟完成 */
async function 番茄钟完成() {
  番茄状态.运行中 = false;
  clearInterval(番茄状态.定时器);

  // 记录
  if (番茄状态.模式 === '专注') {
    番茄状态.今日番茄数++;
    番茄状态.今日专注分钟 += 25;

    const 记录 = {
      duration: 25,
      task_id: 番茄状态.关联任务ID,
      completed_at: new Date().toISOString(),
    };

    try {
      await 番茄API.记录完成(记录);
    } catch {
      添加离线操作('记录番茄', 记录);
    }

    // 发送通知
    发送番茄通知('专注完成！休息一下吧 🍅');

    // 自动切到休息
    切换番茄模式('休息');
  } else {
    发送番茄通知('休息结束，继续加油！💪');
    切换番茄模式('专注');
  }

  更新番茄统计();
  更新番茄显示();
}

// ===== UI更新 =====

/** 更新番茄钟显示 */
function 更新番茄显示() {
  const 分钟 = Math.floor(番茄状态.剩余秒数 / 60);
  const 秒 = 番茄状态.剩余秒数 % 60;
  document.getElementById('番茄时间显示').textContent =
    `${String(分钟).padStart(2, '0')}:${String(秒).padStart(2, '0')}`;

  // 更新圆环进度
  const 进度弧线 = document.getElementById('进度弧线');
  const 周长 = 2 * Math.PI * 90; // r=90
  const 比例 = 番茄状态.剩余秒数 / 番茄状态.总秒数;
  进度弧线.style.strokeDashoffset = 周长 * (1 - 比例);

  // 专注模式用主色，休息用绿色
  进度弧线.style.stroke = 番茄状态.模式 === '专注' ? '#6366f1' : '#22c55e';
}

/** 更新番茄统计数字 */
function 更新番茄统计() {
  document.getElementById('今日番茄数').textContent = 番茄状态.今日番茄数;
  document.getElementById('今日专注分钟').textContent = 番茄状态.今日专注分钟;
}

/** 更新关联任务选择器 */
function 更新关联任务选择() {
  const 选择器 = document.getElementById('关联任务选择');
  选择器.innerHTML = '<option value="">-- 选择任务 --</option>';
  获取未完成任务().forEach(t => {
    const option = document.createElement('option');
    option.value = t.id;
    option.textContent = t.title;
    选择器.appendChild(option);
  });

  选择器.onchange = () => {
    番茄状态.关联任务ID = 选择器.value || null;
  };
}

// ===== 通知 =====

/** 发送番茄通知 */
function 发送番茄通知(消息) {
  // 先尝试浏览器通知
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🍅 番茄钟', {
      body: 消息,
      icon: '/icons/icon-192.png',
      tag: 'pomodoro',
    });
  }

  // 也显示toast
  显示Toast(消息);

  // 震动（移动端）
  if ('vibrate' in navigator) {
    navigator.vibrate([200, 100, 200]);
  }
}

/** 初始化番茄钟视图 */
function 初始化番茄钟() {
  更新番茄显示();
  更新番茄统计();
  更新关联任务选择();

  // 请求通知权限
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}
