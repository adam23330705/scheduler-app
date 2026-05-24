/**
 * 对话系统 - DeepSeek智能对话 + 角色聊天UI
 */

// ===== 对话状态 =====
let 当前对话角色 = null;
let 对话历史 = {}; // { 角色名: [ {角色, 内容, 时间}, ... ] }
let AI正在回复 = false;

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
    const 精简 = {};
    for (const [名字, 消息们] of Object.entries(对话历史)) {
      精简[名字] = 消息们.slice(-50);
    }
    localStorage.setItem('chat_history', JSON.stringify(精简));
  } catch {}
}

/** 打开角色对话 */
function 打开角色对话(角色名) {
  // 如果点击的是竞争对手，不打开对话
  if (!角色数据[角色名]) return;

  当前对话角色 = 角色名;
  const 角色 = 角色数据[角色名];

  // 更新对话头部
  const 头像容器 = document.getElementById('对话对象头像');
  if (角色.头像svg) {
    头像容器.innerHTML = `<img src="${角色.头像svg}" alt="${角色名}">`;
    头像容器.style.background = 'transparent';
  } else {
    头像容器.textContent = 角色.头像emoji;
    头像容器.style.background = 角色.颜色;
  }
  document.getElementById('对话对象名字').textContent = 角色.名字;
  const 心情文字 = 角色.心情 === '开心' ? '心情不错~' : 角色.心情 === '不爽' ? '心情不好' : '在线';
  document.getElementById('对话对象状态').textContent = 心情文字;

  // 渲染消息
  渲染对话消息();

  // 切换视图
  document.querySelectorAll('.视图').forEach(v => v.style.display = 'none');
  document.getElementById('视图-对话').style.display = 'flex';
  document.getElementById('显示-当前视图标题').textContent = 角色.名字;

  // 隐藏底部导航
  document.querySelector('.底部导航').style.display = 'none';

  // 如果没有历史，角色先打招呼
  if (!对话历史[角色名] || 对话历史[角色名].length === 0) {
    const 问候 = 对话模板[角色名]?.问候;
    if (问候) {
      添加消息到历史(角色名, 问候[Math.floor(Math.random() * 问候.length)]);
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
  if (!容器 || !当前对话角色) return;

  const 消息们 = 对话历史[当前对话角色] || [];
  const 角色 = 角色数据[当前对话角色];

  let html = '';
  const 角色头像HTML = 角色.头像svg ? `<div class="消息头像"><img src="${角色.头像svg}" alt="${当前对话角色}"></div>` : `<div class="消息头像" style="background:${角色.颜色}">${角色.头像emoji}</div>`;
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
          ${角色头像HTML}
          <div class="消息气泡 气泡-对方">${消息.内容}</div>
        </div>
      `;
    }
  });

  // AI正在输入指示
  if (AI正在回复) {
    html += `
      <div class="消息 消息-对方">
        ${角色头像HTML}
        <div class="消息气泡 气泡-对方 输入中">对方正在输入...</div>
      </div>
    `;
  }

  容器.innerHTML = html;
  setTimeout(() => 容器.scrollTop = 容器.scrollHeight, 50);
}

/** 添加消息到历史 */
function 添加消息到历史(发送者, 内容) {
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
async function 发送对话消息() {
  const 输入框 = document.getElementById('对话输入框');
  const 内容 = 输入框.value.trim();
  if (!内容 || !当前对话角色 || AI正在回复) return;

  // 添加用户消息
  if (!对话历史[当前对话角色]) 对话历史[当前对话角色] = [];
  对话历史[当前对话角色].push({
    角色: '我',
    内容: 内容,
    时间: new Date().toISOString(),
  });

  输入框.value = '';
  渲染对话消息();

  // 显示"正在输入"
  AI正在回复 = true;
  渲染对话消息();

  try {
    // 调用DeepSeek API
    const 上下文 = 对话历史[当前对话角色].slice(-10);
    const 回复 = await 获取AI回复(当前对话角色, 内容, 上下文);

    AI正在回复 = false;
    对话历史[当前对话角色].push({
      角色: 当前对话角色,
      内容: 回复,
      时间: new Date().toISOString(),
    });
    保存对话历史();
    渲染对话消息();
  } catch (error) {
    AI正在回复 = false;
    保存对话历史();
    渲染对话消息();
    console.error('对话发送失败:', error);
  }

  // 更新消息页面的未读计数
  更新消息未读();
}

/** 从对话返回主界面 */
function 返回主界面() {
  当前对话角色 = null;
  AI正在回复 = false;
  document.querySelector('.底部导航').style.display = 'flex';

  // 回到之前的tab
  const 上一个视图 = 应用状态.上一个视图 || '公司';
  切换视图(上一个视图);
}

// 初始化时恢复对话
恢复对话历史();
