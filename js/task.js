/**
 * 任务模块 - 任务卡片渲染、增删改查、弹窗交互
 */

// ===== 任务卡片 =====

/** 创建任务卡片DOM元素 */
function 创建任务卡片(任务) {
  const 卡片 = document.createElement('div');
  const 优先级 = 任务.priority || '普通';
  卡片.className = `任务卡片 ${优先级}边框 ${任务.completed ? '已完成' : ''}`;

  // 完成复选框
  const 复选框 = document.createElement('button');
  复选框.className = `完成复选框 ${任务.completed ? '已勾选' : ''}`;
  复选框.onclick = (e) => {
    e.stopPropagation();
    切换任务完成(任务);
  };

  // 内容区
  const 内容 = document.createElement('div');
  内容.className = '任务内容';

  const 标题 = document.createElement('div');
  标题.className = '任务标题文字';
  标题.textContent = 任务.title;

  const 时间行 = document.createElement('div');
  时间行.className = '任务时间标签';

  // 优先级标签
  const 优先级图标 = { '紧急': '⚡', '重要': '⭐', '普通': '📝' };
  时间行.innerHTML = `<span class="优先级标签 ${优先级}">${优先级图标[优先级] || '📝'} ${优先级}</span>`;

  if (任务.due_date) {
    时间行.innerHTML += `<span>${友好时间(任务.due_date)}</span>`;
  }

  // 标签
  if (任务.tags && 任务.tags.length > 0) {
    任务.tags.forEach(tag => {
      时间行.innerHTML += `<span class="标签徽章">${tag}</span>`;
    });
  }

  // 重复标识
  if (任务.repeat && 任务.repeat !== 'none') {
    const 重复名 = { daily: '每日', weekly: '每周', custom: '自定义' };
    时间行.innerHTML += `<span>🔄 ${重复名[任务.repeat] || '重复'}</span>`;
  }

  内容.appendChild(标题);
  内容.appendChild(时间行);

  // 操作按钮
  const 操作区 = document.createElement('div');
  操作区.className = '任务操作';

  const 编辑按钮 = document.createElement('button');
  编辑按钮.className = '操作按钮';
  编辑按钮.textContent = '✎';
  编辑按钮.onclick = (e) => {
    e.stopPropagation();
    打开编辑任务(任务);
  };

  const 删除按钮 = document.createElement('button');
  删除按钮.className = '操作按钮 删除';
  删除按钮.textContent = '🗑';
  删除按钮.onclick = (e) => {
    e.stopPropagation();
    确认删除任务(任务);
  };

  操作区.appendChild(编辑按钮);
  操作区.appendChild(删除按钮);

  卡片.appendChild(复选框);
  卡片.appendChild(内容);
  卡片.appendChild(操作区);

  return 卡片;
}

// ===== 任务CRUD =====

/** 切换任务完成状态 */
async function 切换任务完成(任务) {
  const 新状态 = !任务.completed;
  任务.completed = 新状态;

  // 先更新本地
  写入存储(存储键.任务列表, 应用状态.任务列表);
  渲染当前视图();

  // 再同步服务器
  try {
    await 任务API.标记完成(任务.id, 新状态);
  } catch {
    添加离线操作('标记完成', { id: 任务.id, completed: 新状态 });
  }

  显示Toast(新状态 ? '已完成 ✓' : '取消完成');
}

/** 确认删除任务 */
function 确认删除任务(任务) {
  if (confirm(`确定删除「${任务.title}」吗？`)) {
    执行删除任务(任务);
  }
}

/** 执行删除 */
async function 执行删除任务(任务) {
  // 本地先删
  应用状态.任务列表 = 应用状态.任务列表.filter(t => t.id !== 任务.id);
  写入存储(存储键.任务列表, 应用状态.任务列表);
  渲染当前视图();

  // 同步服务器
  try {
    await 任务API.删除(任务.id);
  } catch {
    添加离线操作('删除任务', { id: 任务.id });
  }

  显示Toast('已删除');
}

// ===== 添加/编辑任务弹窗 =====

/** 弹窗当前选择的优先级 */
let 当前优先级 = '普通';
/** 弹窗当前选择的标签 */
let 当前标签列表 = [];

/** 显示添加任务弹窗 */
function 显示添加任务弹窗() {
  document.getElementById('弹窗-添加任务').style.display = 'flex';
  document.getElementById('弹窗标题文字').textContent = '添加任务';
  document.getElementById('编辑任务ID').value = '';
  document.getElementById('任务标题').value = '';
  document.getElementById('任务时间').value = '';
  document.getElementById('提醒时间').value = '';
  document.getElementById('重复方式').value = 'none';
  document.getElementById('自定义重复区').style.display = 'none';
  document.getElementById('任务备注').value = '';
  当前优先级 = '普通';
  当前标签列表 = [];
  更新优先级UI();
  渲染标签选择区();
}

/** 打开编辑已有任务 */
function 打开编辑任务(任务) {
  document.getElementById('弹窗-添加任务').style.display = 'flex';
  document.getElementById('弹窗标题文字').textContent = '编辑任务';
  document.getElementById('编辑任务ID').value = 任务.id;
  document.getElementById('任务标题').value = 任务.title;

  // 时间
  if (任务.due_date) {
    const d = new Date(任务.due_date);
    // datetime-local格式：YYYY-MM-DDTHH:mm
    document.getElementById('任务时间').value =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } else {
    document.getElementById('任务时间').value = '';
  }

  document.getElementById('提醒时间').value = 任务.remind_minutes?.toString() || '';
  document.getElementById('重复方式').value = 任务.repeat || 'none';
  document.getElementById('自定义重复区').style.display = 任务.repeat === 'custom' ? 'block' : 'none';
  document.getElementById('任务备注').value = 任务.note || '';

  当前优先级 = 任务.priority || '普通';
  当前标签列表 = [...(任务.tags || [])];
  更新优先级UI();
  渲染标签选择区();
}

/** 关闭弹窗 */
function 关闭添加任务弹窗() {
  document.getElementById('弹窗-添加任务').style.display = 'none';
}

/** 点击遮罩关闭 */
function 点击遮罩关闭(event) {
  if (event.target.id === '弹窗-添加任务') {
    关闭添加任务弹窗();
  }
}

/** 选择优先级 */
function 选择优先级(级别) {
  当前优先级 = 级别;
  更新优先级UI();
}

/** 更新优先级按钮UI */
function 更新优先级UI() {
  ['紧急', '重要', '普通'].forEach(p => {
    const 按钮 = document.getElementById(`优先级-${p}`);
    按钮.classList.toggle('活跃', p === 当前优先级);
  });
}

/** 渲染标签选择区 */
function 渲染标签选择区() {
  // 已选标签
  const 已选容器 = document.getElementById('已选标签');
  已选容器.innerHTML = '';
  当前标签列表.forEach(tag => {
    const 项 = document.createElement('span');
    项.className = '已选标签-项';
    项.innerHTML = `${tag} <button onclick="移除标签('${tag}')">×</button>`;
    已选容器.appendChild(项);
  });

  // 预设标签
  const 预设容器 = document.getElementById('预设标签');
  预设容器.innerHTML = '';
  const 预设标签名 = ['工作', '学习', '生活', '运动', '阅读', '创作'];
  预设标签名.forEach(name => {
    if (当前标签列表.includes(name)) return; // 已选的不显示
    const 项 = document.createElement('span');
    项.className = '预设标签-项';
    项.textContent = name;
    项.onclick = () => {
      当前标签列表.push(name);
      渲染标签选择区();
    };
    预设容器.appendChild(项);
  });

  // 用户自定义标签也加入预设
  应用状态.标签列表.forEach(tag => {
    if (当前标签列表.includes(tag.name)) return;
    if (预设标签名.includes(tag.name)) return;
    const 项 = document.createElement('span');
    项.className = '预设标签-项';
    项.textContent = tag.name;
    项.onclick = () => {
      当前标签列表.push(tag.name);
      渲染标签选择区();
    };
    预设容器.appendChild(项);
  });
}

/** 移除已选标签 */
function 移除标签(标签名) {
  当前标签列表 = 当前标签列表.filter(t => t !== 标签名);
  渲染标签选择区();
}

/** 提交任务（新增或编辑） */
async function 提交任务() {
  const 标题 = document.getElementById('任务标题').value.trim();
  if (!标题) {
    显示Toast('请输入任务标题');
    return;
  }

  const 时间值 = document.getElementById('任务时间').value;
  const 提醒 = document.getElementById('提醒时间').value;
  const 重复 = document.getElementById('重复方式').value;
  const 备注 = document.getElementById('任务备注').value;

  // 自定义重复 - 收集星期几
  let 重复星期 = [];
  if (重复 === 'custom') {
    document.querySelectorAll('.星期选择 input:checked').forEach(cb => {
      重复星期.push(parseInt(cb.value));
    });
    if (重复星期.length === 0) {
      显示Toast('请选择重复的星期');
      return;
    }
  }

  const 任务数据 = {
    title: 标题,
    due_date: 时间值 ? new Date(时间值).toISOString() : null,
    remind_minutes: 提醒 !== '' ? parseInt(提醒) : null,
    priority: 当前优先级,
    tags: 当前标签列表,
    repeat: 重复,
    repeat_days: 重复 === 'custom' ? 重复星期 : null,
    note: 备注 || null,
  };

  const 编辑ID = document.getElementById('编辑任务ID').value;

  try {
    if (编辑ID) {
      // 编辑
      任务数据.id = 编辑ID;
      const 索引 = 应用状态.任务列表.findIndex(t => t.id === 编辑ID);
      if (索引 !== -1) {
        应用状态.任务列表[索引] = { ...应用状态.任务列表[索引], ...任务数据 };
      }
      try {
        await 任务API.更新(编辑ID, 任务数据);
      } catch {
        添加离线操作('更新任务', 任务数据);
      }
      显示Toast('已更新');
    } else {
      // 新增
      任务数据.id = 生成ID();
      任务数据.completed = false;
      任务数据.created_at = new Date().toISOString();
      应用状态.任务列表.unshift(任务数据);
      try {
        const 结果 = await 任务API.创建(任务数据);
        // 用服务器返回的ID替换本地ID
        if (结果.task?.id) 任务数据.id = 结果.task.id;
      } catch {
        添加离线操作('创建任务', 任务数据);
      }
      显示Toast('已添加');
    }

    写入存储(存储键.任务列表, 应用状态.任务列表);
    关闭添加任务弹窗();
    渲染当前视图();
  } catch (e) {
    显示Toast('保存失败: ' + e.message);
  }
}

// ===== 重复方式切换 =====

/** 监听重复选择变化 - 在app.js中初始化 */
function 初始化重复方式监听() {
  document.getElementById('重复方式').addEventListener('change', function() {
    document.getElementById('自定义重复区').style.display =
      this.value === 'custom' ? 'block' : 'none';
  });

  // 新标签输入回车添加
  document.getElementById('新标签输入').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const 值 = this.value.trim();
      if (值 && !当前标签列表.includes(值)) {
        当前标签列表.push(值);
        this.value = '';
        渲染标签选择区();
      }
    }
  });
}

// ===== 今日视图渲染 =====

/** 渲染今日视图 */
function 渲染今日视图() {
  const 今日 = 获取今日任务();
  const 未完成 = 今日.filter(t => !t.completed);

  // 日期显示
  const 今天 = new Date();
  const 星期名 = ['日', '一', '二', '三', '四', '五', '六'];
  document.getElementById('今日日期显示').textContent =
    `${今天.getMonth() + 1}月${今天.getDate()}日 星期${星期名[今天.getDay()]}`;
  document.getElementById('今日任务计数').textContent = `${未完成.length}个任务`;

  // 任务列表
  const 容器 = document.getElementById('今日任务列表');
  if (今日.length === 0) {
    容器.innerHTML = `
      <div class="空状态">
        <div class="空状态-图标">🎉</div>
        <p>今天没有待办事项，享受自由吧！</p>
      </div>`;
    return;
  }

  容器.innerHTML = '';
  // 未完成排前面
  const 排序后 = [...未完成, ...今日.filter(t => t.completed)];
  排序后.forEach(t => 容器.appendChild(创建任务卡片(t)));
}

// ===== 总览视图渲染 =====

/** 渲染总览视图 */
function 渲染总览视图() {
  const 筛选 = 应用状态.筛选条件 || '全部';
  const 任务列表 = 按优先级筛选(筛选);
  const 未完成 = 任务列表.filter(t => !t.completed);

  // 更新筛选按钮
  ['全部', '紧急', '重要', '普通'].forEach(name => {
    const 按钮 = document.getElementById(`筛选-${name}`);
    按钮.classList.toggle('活跃', name === 筛选);
  });

  // 任务列表
  const 容器 = document.getElementById('总览任务列表');
  if (未完成.length === 0) {
    容器.innerHTML = `
      <div class="空状态">
        <div class="空状态-图标">✨</div>
        <p>${筛选 === '全部' ? '所有任务都已完成！' : `没有${筛选}任务`}</p>
      </div>`;
    return;
  }

  容器.innerHTML = '';
  未完成.forEach(t => 容器.appendChild(创建任务卡片(t)));
}

/** 筛选总览 */
function 筛选总览(类型) {
  应用状态.筛选条件 = 类型;
  渲染总览视图();
}
