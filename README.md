# 日程规划 PWA App

> 让每一天都有条不紊 - 日历、任务、番茄钟、统计

## 技术栈

- **前端**: PWA (HTML/CSS/JS 原生，零依赖)
- **后端**: Express + better-sqlite3（支持 JSON 文件回退）
- **部署**: Zeabur（国内优先）/ Cloudflare / 本地运行

## 项目结构

```
scheduler-app/
├── server.js           # 生产服务器（Express + SQLite/JSON）
├── local-server.js     # 轻量本地服务器（纯Node，零依赖）
├── package.json        # 依赖配置
├── frontend/           # PWA前端
│   ├── index.html
│   ├── manifest.json
│   ├── service-worker.js
│   ├── css/style.css
│   ├── js/             # api/store/日历/任务/番茄钟/统计/app
│   └── icons/
├── worker/             # Cloudflare Worker版后端（备选）
│   ├── wrangler.toml
│   └── src/index.js
└── data/               # SQLite/JSON数据（运行时自动创建）
```

## 快速开始（本地运行）

```bash
# 方式1：完整版（Express + SQLite）
npm install
npm start
# 访问 http://localhost:8787

# 方式2：轻量版（零依赖，JSON存储）
node local-server.js
# 访问 http://localhost:8787
```

## 部署到 Zeabur（推荐，国内访问快）

### 前置条件
- 注册 [Zeabur](https://zeabur.com) 账号（支持 GitHub 登录）

### 步骤
1. 将项目推送到 GitHub 仓库
2. 登录 Zeabur 控制台 → 创建项目
3. 添加服务 → 从 GitHub 导入仓库
4. Zeabur 自动识别 Node.js 项目，执行 `npm install && npm start`
5. 设置环境变量：`JWT_SECRET` = 你的密钥
6. 分配域名 → 获得访问地址
7. 手机浏览器打开 → 添加到主屏幕

**免费额度**：静态站点免费，Serverless 有免费额度，足够个人使用。

## 部署到 Cloudflare（备选，国外访问快）

```bash
cd worker
npm install
wrangler login
wrangler d1 create scheduler-db   # 将返回的 database_id 填入 wrangler.toml
wrangler deploy
```

## 功能特性

- ✅ 月历视图 + 日程展示
- ✅ 任务增删改查 + 优先级（紧急/重要/普通）
- ✅ 分类标签 + 重复任务
- ✅ 番茄钟（25分钟专注 + 5分钟休息）
- ✅ 本周完成率 + 标签分布统计
- ✅ 用户注册/登录（JWT认证）
- ✅ 离线缓存 + 离线操作队列
- ✅ 系统级推送通知
- ✅ PWA安装到桌面
- ✅ 深色主题
- ✅ 双数据库引擎（SQLite / JSON文件自动切换）

## 后续扩展方向

- 日程拖拽排序
- 周视图/日视图
- AI智能建议
- 数据导入导出
- 多语言支持
