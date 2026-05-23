/**
 * 对话系统 - 角色聊天UI + 消息管理
 */

// ===== 对话状态 =====
let 当前对话角色 = null;
let 对话历史 = {}; // { 角色名: [ {角色, 内容, 时间}, ... ] }

/** 从本地存储恢复对话历史 */
function 恢复对话历史() {
  try {
    const 存储 = localStorage.getItem('chat_history');
    if (存储) 对话历史 = JSON.parse(存储);
  } catch {}
}

/** 保存对话历史到本地 */
function 保存对话历史() {
  try {
    // 每个角色只保留最近50条
    const 精简 = {};
    for (const [名字, 消息们] of Object.entries(对话历史)) {
      精简[名字] = 消息们.slice(-50);
    }
    localStorage.setItem('chat_history', JSON.stringify(精简));
  } catch {}
}

/** 打开角色对话 */
function 打开角色对话(角色名) {
  当前对话角色 = 角色名;
  const 角色 = 角色数据[角色名];

  // 更新对话头部
  document.getElementById('对话对象头像').textContent = 角色.头像emoji;
  document.getElementById('对话对象头像').style.background = 角色.颜色;
  document.getElementById('对话对象名字').textContent = 角色.名字;
  const 心情文字 = 角色.心情 === '开心' ? '心情不错~' : 角色.心情 === '不爽' ? '心情不好' : '在线';
  document.getElementById('对话对象状态').textContent = 心情文字;

  // 渲染消息
  渲染对话消息();

  // 切换视图
  document.querySelectorAll('.视图').forEach(v => v.style.display = 'none');
  document.getElementById('视图-对话').style.display = 'flex';
  document.getElementById('显示-当前视图标题').textContent = 角色.名字;

  // 隐藏底部导航（对话时全屏）
  document.querySelector('.底部导航').style.display = 'none';

  // 如果没有历史，角色先打招呼
  if (!对话历史[角色名] || 对话历史[角色名].length === 0) {
    const 问候 = 对话模板[角色名]?.问候;
    if (问候) {
      添加消息(角色名, 问候[Math.floor(Math.random() * 问候.length)]);
    }
  }

  // 滚动到底部
  setTimeout(() => {
    const 列表 = document.getElementById('对话消息列表');
    列表.scrollTop = 列表.scrollHeight;
  }, 100);
}

/** 渲染对话消息 */
function 渲染对话消息() {
  const 容器 = document.getElementById('对话消息列表');
  if (!容器) return;

  const 消息们 = 对话历史[当前对话角色] || [];
  const 角色 = 角色数据[当前对话角色];

  let html = '';
  消息们.forEach(消息 => {
    if (消息.角色 === '我') {
      html += `
        <div class="消息 消息-我">
          <div class="消息气泡 气泡-我">${消息.内容}</div>
        </div>
      `;
    } else {
      html += `
        <div class="消息 消息-对方">
          <div class="消息头像" style="background:${角色.颜色}">${角色.头像emoji}</div>
          <div class="消息气泡 气泡-对方">${消息.内容}</div>
        </div>
      `;
    }
  });
  容器.innerHTML = html;

  // 滚动到底部
  setTimeout(() => 容器.scrollTop = 容器.scrollHeight, 50);
}

/** 添加消息到历史 */
function 添加消息(发送者, 内容) {
  if (!当前对话角色) return;
  const 角色 = 当前对话角色;

  if (!对话历史[角色]) 对话历史[角色] = [];
  对话历史[角色].push({
    角色: 发送者,
    内容: 内容,
    时间: new Date().toISOString(),
  });
  保存对话历史();
  渲染对话消息();
}

/** 发送用户消息 */
function 发送对话消息() {
  const 输入框 = document.getElementById('对话输入框');
  const 内容 = 输入框.value.trim();
  if (!内容 || !当前对话角色) return;

  // 添加用户消息
  if (!对话历史[当前对话角色]) 对话历史[当前对话角色] = [];
  对话历史[当前对话角色].push({
    角色: '我',
    内容: 内容,
    时间: new Date().toISOString(),
  });

  输入框.value = '';
  渲染对话消息();

  // 生成本地回复
  setTimeout(() => {
    const 回复 = 生成本地回复(当前对话角色, 内容);
    对话历史[当前对话角色].push({
      角色: 当前对话角色,
      内容: 回复,
      时间: new Date().toISOString(),
    });
    保存对话历史();
    渲染对话消息();
  }, 600 + Math.random() * 800); // 模拟打字延迟
}

/** 从对话返回公司页 */
function 返回公司页() {
  当前对话角色 = null;
  document.querySelector('.底部导航').style.display = 'flex';
  切换视图('公司');
}

// 初始化时恢复对话
恢复对话历史();
