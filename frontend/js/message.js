/**
 * 消息系统 - 接收催促消息和聊天消息
 */

// ===== 消息数据 =====
let 消息列表 = []; // { id, 角色, 类型, 内容, 时间, 已读 }
let 消息未读数 = 0;

/** 从本地存储恢复 */
function 恢复消息() {
  try {
    const 存储 = localStorage.getItem('messages_data');
    if (存储) {
      const 数据 = JSON.parse(存储);
      消息列表 = 数据.消息 || [];
      消息未读数 = 数据.未读数 || 0;
    }
  } catch {}

  if (消息列表.length === 0) {
    生成初始消息();
  }
}

/** 保存到本地 */
function 保存消息() {
  try {
    localStorage.setItem('messages_data', JSON.stringify({
      消息: 消息列表.slice(-200),
      未读数: 消息未读数,
    }));
  } catch {}
}

/** 生成初始消息 */
function 生成初始消息() {
  消息列表 = [
    { id: 'msg_1', 角色: '小陈', 类型: '提醒', 内容: '郭哥！欢迎来到花蕾传媒！今天也要加油哦~', 时间: new Date().toISOString(), 已读: false },
    { id: 'msg_2', 角色: '赵经理', 类型: '催促', 内容: '郭哥，本月KPI已经下发了，请查看任务页面。', 时间: new Date(Date.now() - 3600000).toISOString(), 已读: false },
    { id: 'msg_3', 角色: '于总', 类型: '通知', 内容: '花蕾传媒新季度开始了，希望各位拿出干劲来。', 时间: new Date(Date.now() - 7200000).toISOString(), 已读: false },
  ];
  消息未读数 = 3;
  保存消息();
}

/** 生成唯一ID */
function 生成消息ID() {
  return 'msg_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
}

/** 添加新消息 */
function 添加新消息(角色名, 类型, 内容) {
  消息列表.unshift({
    id: 生成消息ID(),
    角色: 角色名,
    类型: 类型,
    内容: 内容,
    时间: new Date().toISOString(),
    已读: false,
  });
  消息未读数++;
  保存消息();

  // 更新底部导航未读标记
  更新消息导航未读();

  // 显示Toast
  const 角色 = 角色数据[角色名];
  if (角色) {
    显示Toast(`${角色.头像emoji} ${角色名}: ${内容}`);
  }
}

/** 标记消息已读 */
function 标记已读(消息id) {
  const 消息 = 消息列表.find(m => m.id === 消息id);
  if (消息 && !消息.已读) {
    消息.已读 = true;
    消息未读数 = Math.max(0, 消息未读数 - 1);
    保存消息();
    更新消息导航未读();
  }
}

/** 全部标记已读 */
function 全部已读() {
  消息列表.forEach(m => m.已读 = true);
  消息未读数 = 0;
  保存消息();
  更新消息导航未读();
  渲染消息页();
}

/** 更新消息导航未读标记 */
function 更新消息导航未读() {
  const 导航按钮 = document.getElementById('导航-消息');
  if (!导航按钮) return;

  let 未读标记 = 导航按钮.querySelector('.未读标记');
  if (消息未读数 > 0) {
    if (!未读标记) {
      未读标记 = document.createElement('span');
      未读标记.className = '未读标记';
      导航按钮.appendChild(未读标记);
    }
    未读标记.textContent = 消息未读数 > 99 ? '99+' : 消息未读数;
  } else {
    if (未读标记) 未读标记.remove();
  }
}

/** 更新消息未读（对话后调用） */
function 更新消息未读() {
  // 对话后不做特殊处理
}

/** 渲染消息页 */
function 渲染消息页() {
  const 容器 = document.getElementById('消息列表');
  if (!容器) return;

  // 按角色分组，显示最新的消息
  const 角色分组 = {};
  消息列表.forEach(消息 => {
    if (!角色分组[消息.角色]) {
      角色分组[消息.角色] = { 最新消息: 消息, 未读数: 0 };
    }
    if (!消息.已读) 角色分组[消息.角色].未读数++;
    // 更新为最新消息
    if (new Date(消息.时间) > new Date(角色分组[消息.角色].最新消息.时间)) {
      角色分组[消息.角色].最新消息 = 消息;
    }
  });

  // 也显示有对话历史的角色
  for (const [角色名, 历史] of Object.entries(对话历史)) {
    if (!角色分组[角色名] && 历史.length > 0) {
      const 最后一条 = 历史[历史.length - 1];
      角色分组[角色名] = {
        最新消息: { 角色: 角色名, 内容: 最后一条.内容, 时间: 最后一条.时间, 已读: true },
        未读数: 0,
      };
    }
  }

  let html = '';

  // 顶部全部已读按钮
  if (消息未读数 > 0) {
    html += `<div class="消息全部已读" onclick="全部已读()">全部标为已读</div>`;
  }

  for (const [角色名, 分组] of Object.entries(角色分组)) {
    const 角色 = 角色数据[角色名];
    if (!角色) continue;

    const 类型图标 = {
      '催促': '⚡',
      '提醒': '🔔',
      '通知': '📢',
      '聊天': '💬',
    };

    html += `
      <div class="消息项 ${分组.未读数 > 0 ? '未读' : ''}" onclick="打开角色对话('${角色名}')">
        <div class="消息头像" style="background:${角色.颜色}" onclick="event.stopPropagation();打开角色对话('${角色名}')">${角色.头像emoji}</div>
        <div class="消息内容区">
          <div class="消息头部">
            <span class="消息角色名">${角色名}</span>
            <span class="消息时间">${格式化动态时间(分组.最新消息.时间)}</span>
          </div>
          <div class="消息预览">
            ${分组.最新消息.类型 ? `<span class="消息类型图标">${类型图标[分组.最新消息.类型] || ''}</span>` : ''}
            ${分组.最新消息.内容}
          </div>
        </div>
        ${分组.未读数 > 0 ? `<span class="消息未读点">${分组.未读数}</span>` : ''}
      </div>
    `;
  }

  容器.innerHTML = html || '<div class="空状态"><div class="空状态-图标">💬</div><p>暂无消息</p></div>';
}

/** 格式化时间 */
function 格式化动态时间(时间字符串) {
  const 现在 = new Date();
  const 时间 = new Date(时间字符串);
  const 差 = 现在 - 时间;

  if (差 < 60000) return '刚刚';
  if (差 < 3600000) return Math.floor(差 / 60000) + '分钟前';
  if (差 < 86400000) return Math.floor(差 / 3600000) + '小时前';
  if (差 < 172800000) return '昨天';
  return `${时间.getMonth() + 1}月${时间.getDate()}日`;
}

// ===== 定时生成催促消息 =====

/** 启动定时催促 */
function 启动消息催促() {
  // 每10分钟检查一次，是否需要催
  setInterval(() => {
    const 今日 = typeof 获取今日任务 === 'function' ? 获取今日任务() : [];
    const 未完成 = 今日.filter(t => !t.completed);

    // 随机选择一个角色催
    if (Math.random() < 0.5 && 未完成.length > 0) {
      const 角色 = ['小陈', '赵经理', '小周'];
      const 随机角色 = 角色[Math.floor(Math.random() * 角色.length)];
      const 提醒 = 生成主动提醒(随机角色);
      if (提醒) {
        添加新消息(随机角色, '催促', 提醒);
      }
    }

    // 小概率其他类型消息
    if (Math.random() < 0.2) {
      const 消息池 = [
        { 角色: '李老师', 类型: '提醒', 内容: '郭哥，已经坐了一个小时了，站起来活动一下~' },
        { 角色: '小陈', 类型: '提醒', 内容: '郭哥！该喝水了！💧' },
        { 角色: '于总', 类型: '通知', 内容: '下周公司开会，准备一下数据。' },
      ];
      const 随机消息 = 消息池[Math.floor(Math.random() * 消息池.length)];
      添加新消息(随机消息.角色, 随机消息.类型, 随机消息.内容);
    }
  }, 10 * 60 * 1000);
}

// 初始化
恢复消息();
