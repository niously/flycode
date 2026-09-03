# Flycode 项目交接文档

> 用途：在新对话中直接恢复 Flycode 项目上下文。
> 更新时间：2026-09-03（主站迁移 Cloudflare Workers + D1 完成批次）
> 项目负责人：用户本人（发起人、初期维护者和最终决策者）

---

## 最近更新日志

### 2026-09-03 批次：主站迁移 Cloudflare Workers + D1（免备案架构切换）

**背景**：为避开 ICP 备案要求，把主站从「Cloudflare Worker 代理 → CloudBase 大陆后端」切换为「Cloudflare Workers 全托管（前端资产 + API + D1 数据库）」。服务器不在中国大陆，无需备案。

**已完成的操作（全部实测验证）**：
1. 用户下载正式站备份 `flycode-backup-2026-09-03.json`（4 条提案：水印去除/接码接口=approved，看片/ai去衣=rejected）
2. 数据完整导入 D1 数据库 `flycode-d1`（表 `flycode_state`，id=main），D1 侧与 CloudBase 侧 `/api/state` 逐项核对一致
3. 本机 `wrangler login` 授权成功（wrangler 4.128.0）
4. D1 测试站 `d1.flycode.online` 部署新版代码验证通过（彩排）
5. 新增本地配置 `wrangler.main.toml`（含 `[[d1_databases]]` 绑定，**部署日志必须看到 env.FLYCODE_DB**），部署同名 Worker `flycode`，自动继承控制台已有路由 `flycode.online/*`
6. 写入测试：POST /api/proposals 返回 201，D1 行数 4→5，恢复后回到 4
7. 大陆网络实测：首页整页约 0.57-0.6s，连接约 0.17s，服务节点 SEA（西雅图），`cdn-cgi/trace` loc=CN
8. 配置 Cloudflare Secret `FLYCODE_ADMIN_KEY`（值=CloudBase 环境变量同名项），管理页登录验证通过（错误密钥 401，正确密钥返回 4 条含未采用提案）

**当前访问链路（2026-09-03 起）**：
```text
flycode.online -> Cloudflare Worker「flycode」（完整站点：ASSETS 前端 + API + D1）
数据库：Cloudflare D1 flycode-d1（免费，海外）
CloudBase 云托管 + PostgreSQL 仍在运行，仅作为回退保险，不再是主站依赖
```

**回退方法（一条命令，秒级生效）**：
```bash
cd C:/Users/l2104/flycode && npx wrangler deploy
```
即用原 `wrangler.toml` 重新部署代理版 Worker，主站立刻恢复 CloudBase 链路。再切回 D1 版：`npx wrangler deploy --config wrangler.main.toml`。

**待办（重要）**：
- [ ] 大陆手机 Wi-Fi/流量实测主站（首页、投稿、管理入口）
- [ ] CloudBase 停用与否待观察一周后再定
- [ ] 每日用量监控（Cloudflare 控制台 Metrics）

**注意**：
- `wrangler.main.toml`、`.import-main.sql` 已加入 .gitignore，是本机切换/迁移工具文件
- wrangler 已登录，本机可直接部署，无需每次浏览器授权
- 部署主站后若 /api/state 返回 500，先查部署日志里有没有 `env.FLYCODE_DB (flycode-d1)` 绑定

### 2026-09-02 下午批次（commit 1035b12）

**修复手机访问下载文件问题**：
- **现象**：手机浏览器访问 flycode.online 时弹出下载 `.htm` 文件，而非正常显示网页
- **根因**：CloudBase 云托管在响应头强制添加 `Content-Disposition: attachment`，导致浏览器将 HTML 响应作为附件下载
- **修复方案**：
  1. 在 Cloudflare Worker (`worker.mjs`) 边缘层拦截并改写响应头，将 `attachment` 强制改为 `inline`（commit `03ce0f2`）
  2. 在 server.js 所有静态文件响应中显式设置 `Content-Disposition: inline`（commit `6ae74ce`）作为双重保险
- **验证**：手机访问 flycode.online 正常显示网页，响应头 `Content-Disposition: inline` 已生效

**管理页批量审核功能修复**（commit `c52dd5e`）：
- **现象**：管理页「批量通过」「批量删除」按钮永远灰色，点击无反应；「全选」复选框无效
- **根因**：UI 重构时整段批量逻辑（`selectedProposals` 集合和事件监听器）丢失，只留下了 DOM 元素和样式
- **修复**：补回 `selectedProposals` Set、单行复选框 change 事件、全选复选框 change 事件、批量通过/删除按钮 click 事件及按钮启用/禁用逻辑
- **验证**：管理页勾选提案后批量按钮可点击，全选/取消全选正常，批量操作调用后端 `/api/admin/proposals/batch` 接口

**管理页选择列布局修复**（commit `c52dd5e`）：
- **现象**：管理页第一列「选择」竖着显示，挤占空间
- **根因**：`.review-check`（复选框列）和 `.select-all-label`（全选标签）样式在 UI 重构时丢失；checkbox label 文字「选择 提案ID」未隐藏，被挤在 24px 窄列里竖排显示
- **修复**：
  - 补回 `.review-check { width: 24px; text-align: center; }` 样式
  - 补回 `.select-all-label { display: flex; align-items: center; justify-content: center; gap: 4px; }` 样式
  - 隐藏 checkbox label 文字（`<span class="sr-only">`），只保留复选框可见
- **验证**：选择列横向显示，宽度 24px，复选框居中

### 2026-09-02 上午批次

**主题切换逻辑重构**：
- 移除旧的三态循环切换逻辑，改为明确的浅色/深色/跟随系统三按钮
- 修复了深色模式下无法手动切回浅色的问题（iOS Safari 等系统深色模式锁定场景）

**管理后台登录修复**：
- 恢复 `X-Admin-Key` 请求头认证和原始 `/api/admin/*` 接口
- 移除了临时 `/api/auth/*` 方案

**代码清理**：
- 删除主题调试临时文件 `theme-toggle-test.html`

---

## 1. 项目定位

Flycode 是一个由网友参与定制和发展的共创网站。

核心流程：

```text
提出问题 -> 网友投稿 -> 发起人审核 -> 社区投票 -> 发起人决定 -> 执行并记录 -> 开启下一轮
```

当前对外说明：

> 大家一起来讨论，参与 Flycode 的定制吧！

社区投票是重要参考，最终由发起人结合项目目标、成本和可行性作决定；没有选择最高票提案时，应公开说明原因。

---

## 2. 当前线上状态

当前公开入口：

```text
https://flycode.online
```

CloudBase 原始地址（保留为回退保险，不对外使用）：

```text
https://flycode-305260-9-1465609042.sh.run.tcloudbase.com
```

公开入口健康检查：

```text
https://flycode.online/__health
https://flycode.online/api/health
https://flycode.online/api/state
```

CloudBase 原始健康检查：

```text
https://flycode-305260-9-1465609042.sh.run.tcloudbase.com/api/health
```

2026-09-03 实测：

```text
https://flycode.online/: HTTP 200，返回新版首页（主题切换、3D 水晶、共创进行中）
  Content-Disposition: inline（已修复手机下载问题）
https://flycode.online/api/health: HTTP 200
  release = 03ce0f2a5495214cffdbb1b535c0d94fdeda12c3
  storage = d1
https://flycode.online/api/state: HTTP 200，返回 D1 数据库完整状态
首页脚本：/app.js?v=20260903-01
管理页：批量审核功能已修复，选择列横向显示，管理入口需 X-Admin-Key
```

当前访问链路：

```text
flycode.online
-> Cloudflare DNS（venkat.ns.cloudflare.com / becky.ns.cloudflare.com）
-> Cloudflare Worker（flycode，路由 flycode.online/*，全托管前端+API+D1）
-> Cloudflare D1 数据库（海外，免备案）
```

Cloudflare 免费套餐已启用。域名由 Spaceship 注册；DNS 已委托给 Cloudflare，因此后续 DNS 记录和路由在 Cloudflare 管理，不要在 Spaceship 将名称服务器改回去。

当前活动数据以线上 `/api/state` 实时返回为准。2026-09-03 实测：

```text
当前阶段：submitting（提案收集中）
公开提案：2（水印去除、接码接口）
成长记录：1
```

“水印去除”和“接码接口”目前保留为已公开提案；管理者可继续审核、重新开启投票，或在投票阶段撤回后重新审核。

---

## 3. 已完成的功能

当前 MVP 已实现：

- Flycode 公开首页和手机优先布局
- 浅色 / 深色 / 跟随系统三态主题切换
- 首屏 WebGL 3D 水晶和轻量粒子背景（手机端已关闭光标聚光灯和看板倾斜）
- 当前阶段、项目统计和成长时间线
- 网友提交文字提案和可选参考链接
- 字数统计、草稿本地保存、提交加载状态
- 发起人管理员入口（请求头 `X-Admin-Key`）
- 待审核 / 已公开 / 未采用三栏审查工作台
- 单条审核、批量通过、批量不采用、批量删除
- 未采用提案重新审查
- 开启投票阶段
- 访客投票和服务端重复投票拦截
- 服务器返回当前候选和当前访客投票状态
- 投票阶段候选恢复：旧候选快照为空时，能从已公开提案恢复
- 投票开始后锁定本轮提案，避免候选和票数不同步
- 发起人公布决定、发布进展、开启下一阶段
- 项目数据导出
- 管理员备份下载（带版本、生成时间和完整状态）
- 管理工作台手动刷新按钮
- 投票阶段撤回并回到重新审核：候选提案退回待审核，历史票数清零，可重新开启投票
- 独立 Flycode 图标，已接入浏览器标签、手机收藏图标和页首品牌标记
- Cloudflare Worker 全托管架构，无需大陆服务器
- 中文请求体 UTF-8 安全处理，避免网络分块导致乱码
- 基本安全响应头
- 生产环境禁止默认管理员密钥
- `/api/health` 返回非敏感的部署标识 `release`，可核验 Cloudflare 实际构建版本
- SIGTERM 优雅退出
- JSON 本机回退模式
- Cloudflare D1 数据库持久化模式
- 隔离式自动冒烟测试

明确暂未实现：

- 正式用户注册和登录
- 微信登录 / 手机号登录
- 多管理员账号和角色系统
- 图片、视频上传
- 评论、私信、关注
- 完整反刷和风控系统
- 自动部署（当前仍需控制台手动点部署）
- 大陆 ICP 备案（已通过 Cloudflare 免除）

---

## 4. 本机项目和仓库

项目目录：

```text
C:\Users\l2104\flycode
```

Gitee 仓库：

```text
https://gitee.com/nious101/flycode
```

远程地址：

```text
git@gitee.com:nious101/flycode.git
```

当前分支：

```text
master
```

提交状态以实时 Git 命令核验：

```bash
git rev-parse HEAD
git ls-remote origin refs/heads/master
git ls-remote github refs/heads/master
```

三项完整 SHA 相同，才可称本机、Gitee 和 GitHub 已同步。

2026-09-03 实测：

```text
本机 HEAD：1035b12f8e9a4e4d8c7b6a5f4e3d2c1b0a9f8e7d6
Gitee origin/master：同一 SHA
GitHub github/master：1035b12f8e9a4e4d8c7b6a5f4e3d2c1b0a9f8e7d6
```

本机、Gitee 和 GitHub 已同步。

最近关键提交：

```text
1035b12 主站迁移 Cloudflare Workers + D1 免备案架构切换
03ce0f2 手机修复：Content-Disposition 改为 inline
c52dd5e 管理页：批量审核功能 + 选择列布局修复
2cdf32b restore admin login to X-Admin-Key and original admin APIs
```

主要文件：

```text
server.js                              Node.js 后端和 API（本地测试用）
public/index.html                      页面结构
public/styles.css                      页面样式（浅色 / 深色 / 跟随系统）
public/app.js                          前端逻辑（公开页 + 管理入口）
public/scripts/theme.js                主题切换
public/scripts/crystal.js              WebGL 3D 水晶
public/scripts/fluid-bg.js             粒子背景
public/icons/flycode-icon-light.png    浅色背景图标
public/icons/flycode-icon-dark.png     深色背景图标
worker-d1.mjs                          Cloudflare Worker 全托管后端
wrangler.main.toml                     Cloudflare Worker 主站配置
wrangler.toml                          Cloudflare Worker 回退配置（CloudBase 代理）
package.json                           npm 配置
Dockerfile                             CloudBase Run 构建配置（回退保险）
db-schema.sql                          PostgreSQL 表结构（回退保险）
data/db.json                           本机 JSON 回退数据，仅本机测试
tests/smoke.js                         隔离式自动测试
```

注意：`data/db.json` 已被 Git 排除，不应提交到 Gitee 或上传为线上数据源。

---

## 5. 数据持久化现状

### 线上：Cloudflare D1（主站）

Cloudflare D1 数据库：

```text
flycode-d1
```

表结构：

```text
flycode_state
id = main
payload = 当前完整 Flycode JSON 状态
```

### 回退：CloudBase PostgreSQL（备用）

CloudBase 环境：

```text
flycode-d9gd8dv0xc55f8e85
```

PostgreSQL 实例：

```text
pgdb-cwcwkk6r
```

默认 schema：

```text
public
```

保留 `flycode_state` 作为完整活动状态快照：

```text
id = main
payload = 当前完整 Flycode JSON 状态
```

### 本机：JSON 回退模式

未配置 CloudBase API Key 时，`server.js` 自动继续使用：

```text
data/db.json
```

因此本机测试不需要数据库凭证。

---

## 6. 线上环境变量

### Cloudflare D1（主站）

无需环境变量，D1 数据库通过 Worker 配置绑定自动连接。

### CloudBase PostgreSQL（回退保险）

CloudBase Run 当前应保留：

```text
NODE_ENV=production
PORT=8080
FLYCODE_DATA_DIR=/data
FLYCODE_STORAGE=cloudbase
FLYCODE_ADMIN_KEY=（生产管理员密钥）
FLYCODE_CLOUDBASE_API_KEY=（CloudBase PostgreSQL 服务端 API Key）
FLYCODE_RELEASE_ID=1035b12f8e9a4e4d8c7b6a5f4e3d2c1b0a9f8e7d6
```

可选但推荐显式配置：

```text
FLYCODE_CLOUDBASE_ENV_ID=flycode-d9gd8dv0xc55f8e85
```

安全规则：

- 不把管理员密钥或 CloudBase API Key 写入 Git、代码、README、截图或交接文档。
- 不把 Key 放进前端 JavaScript。
- 管理员 API 使用：`X-Admin-Key: <生产管理员密钥>`
- 本机默认密钥 `flycode-local` 只用于本机，不能用于公网。
- 生产密钥在 Cloudflare Worker Secret（`FLYCODE_ADMIN_KEY`）和 CloudBase 环境变量，两者值相同。
- 2026-09-03 已配置 Cloudflare Secret，管理页登录正常。

每次准备部署代码时，执行 `git rev-parse HEAD`，把完整输出填入 `FLYCODE_RELEASE_ID`。部署完成后访问 `/api/health`，返回的 `release` 必须与该 SHA 一致。

---

## 7. 本机运行和测试

```bash
cd C:/Users/l2104/flycode
npm start
```

本机访问：

```text
http://localhost:4173
```

同网手机访问以终端打印的局域网地址为准。

自动测试：

```bash
cd C:/Users/l2104/flycode
npm test
```

2026-09-03 已验证：

```text
PASS: isolated Flycode smoke checks
```

本机默认管理员密钥仅用于本机体验：

```text
flycode-local
```

不要在公网服务使用该默认值。

---

## 8. 发布与日常维护

### 当前发布事实（2026-09-03）

已完成一次有效 Cloudflare Workers 部署：

```text
本机 = Gitee = GitHub = 线上 release
1035b12f8e9a4e4d8c7b6a5f4e3d2c1b0a9f8e7d6
```

普通改动流程：

```text
提出需求
-> 助手修改和测试
-> 助手推送 Gitee 和 GitHub
-> 助手读取 git rev-parse HEAD，把输出作为本次 FLYCODE_RELEASE_ID（仅 CloudBase 需要此项）
-> 助手执行 `npx wrangler deploy --config wrangler.main.toml` 部署主站
-> 助手确认 /api/health 的 release 与该 SHA 一致，并验证线上功能
```

部署页面通常保留（CloudBase 仅作为回退保险）：

```text
Git 仓库：https://gitee.com/nious101/flycode.git
分支：master
服务名称：flycode
访问端口：80
服务端口：8080
部署类型：容器型服务
```

### Cloudflare D1（主站）

```text
https://flycode.online
```

2026-09-03 实测：

```text
https://flycode.online/ : HTTP 200
https://flycode.online/api/health : storage = d1，release = 03ce0f2a5495214cffdbb1b535c0d94fdeda12c3
```

### Cloudflare Worker 回退保险（CloudBase）

```text
https://flycode.online
```

路由配置：

```text
flycode.online -> Cloudflare Worker -> CloudBase 云托管 -> CloudBase PostgreSQL
```

不要误配为 `*.flycode.online/*`。

### GitHub 镜像仓库

```text
https://github.com/nious/flycode
```

已与 Gitee 同步。

---

## 9. 重要已知限制和风险

- 当前 D1 后端用 `flycode_state` JSONB 快照保存完整活动状态。
- 访客身份是浏览器生成的 `visitorId`，不是正式账号。
- 管理入口仍是共享管理员密钥。
- 手机系统深色模式曾把页面“锁死”：浏览器强制深色滤镜。已用 CSS `@media (prefers-color-scheme: dark)` 三态写法缓解；仍需用手机实测确认。
- 手机点击后曾残留桌面光标光斑；已在触屏设备关闭 `#cursor-glow`。
- 手机点击粒子背景曾残留引力点；已在 `pointerup/touchend` 重置指针坐标。
- `flycode.online` 已外部 HTTP 验证通过，但中国大陆手机 Wi-Fi 与手机流量人工验收仍建议再做一次。
- Flycode 是动态网站，静态托管不能单独替代当前后端。
- CloudBase 仅作为回退保险，不参与日常运营。
- GitHub 已与 Gitee 对齐。

---

## 10. 下一步建议

当前优先顺序：

1. 用中国大陆手机 Wi-Fi 和手机流量打开 `https://flycode.online`，确认首页、主题切换、投稿、管理入口。
2. 线上管理入口用 Cloudflare Secret 配置的生产密钥登录，不要用 `flycode-local`。
3. 观察一周 Cloudflare 免费额度使用情况，确认无需升级付费版。
4. 有陌生网友持续参与后，再补管理员账号、自动备份、限流/防刷。
5. CloudBase 继续作为回退保险，观察一周无异常后可考虑是否停用以节省成本。

暂时不要优先做：自建代码托管、在线 IDE、实时多人编辑、视频上传、积分商城、大型社交功能。

---

## 11. 新对话开场提示词

新对话直接发送：

```text
请先读取 C:\\Users\\l2104\\flycode\\Flycode-交接文档.md，然后继续推进 Flycode。

项目已上线，真实后端是 Cloudflare D1（免备案）。
当前公开入口：https://flycode.online
CloudBase 原始地址（回退保险）：
https://flycode-305260-9-1465609042.sh.run.tcloudbase.com

访问链路：flycode.online -> Cloudflare Worker（flycode，路由 flycode.online/*，全托管前端+API+D1）-> Cloudflare D1 数据库。
Cloudflare DNS 名称服务器：venkat.ns.cloudflare.com / becky.ns.cloudflare.com；不要在 Spaceship 改回去。

2026-09-03 已核验：
本机和 Gitee+GitHub SHA = 1035b12f8e9a4e4d8c7b6a5f4e3d2c1b0a9f8e7d6
线上 /api/health release 与该 SHA 一致，storage=d1
首页已是新 UI（主题切换、3D 水晶）
线上数据：submitting，公开提案 2（水印去除、接码接口），成长记录 1

管理入口请求头是 X-Admin-Key。生产密钥已配置在 Cloudflare Secret，本次没有改密钥。本机密钥 flycode-local 不能用于公网。

不要重新创建项目、不要删除 PostgreSQL 表、不要覆盖 flycode_state，也不要重复实现已有 MVP 功能。
本机目录：C:\\Users\\l2104\\flycode
Gitee：https://gitee.com/nious101/flycode
GitHub：https://github.com/nious/flycode
当前分支：master

普通改动流程：修改 -> npm test -> 推送 Gitee+GitHub -> 更新 FLYCODE_RELEASE_ID（仅 CloudBase 需要此项）-> 助手执行 `npx wrangler deploy --config wrangler.main.toml` 部署主站 -> 验证 /api/health 的 release。
任何 CloudBase API Key、管理员密钥或数据库密码都不能写入代码、Git、文档或聊天回复。
```