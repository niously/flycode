# Flycode 项目交接文档

> 用途：在新对话中直接恢复 Flycode 项目上下文。
> 更新时间：2026-08-31
> 项目负责人：用户本人（发起人、初期维护者和最终决策者）

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

CloudBase 原始地址（保留为后端和故障排查入口，不作为对外主入口）：

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

2026-08-31 已从外部实际验证：

```text
https://flycode.online/: HTTP 200，返回 Flycode 首页
https://flycode.online/__health: HTTP 200，返回 flycode-edge
https://flycode.online/api/health: HTTP 200，返回 flycode
https://flycode.online/api/state: HTTP 200，返回当前 PostgreSQL 数据
新版 voting 字段存在
新版 candidateProposals 字段存在
PostgreSQL 持久化已启用
```

当前访问链路：

```text
flycode.online
-> Cloudflare DNS（venkat.ns.cloudflare.com / becky.ns.cloudflare.com）
-> Cloudflare Worker（flycode，路由 flycode.online/*）
-> CloudBase 云托管
-> CloudBase PostgreSQL
```

Cloudflare 免费套餐已启用。域名由 Spaceship 注册；DNS 已委托给 Cloudflare，因此后续 DNS 记录和路由在 Cloudflare 管理，不要在 Spaceship 将名称服务器改回去。

当前活动数据以线上 `/api/state` 实时返回为准。最近已验证保留：

```text
当前阶段：submitting（提案收集中）
公开提案：1
公开提案：水印去除
成长记录：1
```

“水印去除”目前保留为已公开提案；管理者可继续审核、重新开启投票，或在投票阶段撤回后重新审核。

---

## 3. 已完成的功能

当前 MVP 已实现：

- Flycode 公开首页和手机优先布局
- 当前阶段、项目统计和成长时间线
- 网友提交文字提案和可选参考链接
- 字数统计、草稿本地保存、提交加载状态
- 发起人管理员入口
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
- 独立 Flycode SVG 图标，已接入浏览器标签、手机收藏图标和页首品牌标记
- Cloudflare Worker 代理适配层和独立 `/__health` 诊断接口
- 中文请求体 UTF-8 安全处理，避免网络分块导致乱码
- 基本安全响应头
- 生产环境禁止默认管理员密钥
- `/api/health` 返回非敏感的部署标识 `release`，可核验 CloudBase 实际构建版本
- SIGTERM 优雅退出
- CloudBase Run Dockerfile
- JSON 本机回退模式
- CloudBase PostgreSQL 持久化模式
- 隔离式自动冒烟测试

明确暂未实现：

- 正式用户注册和登录
- 微信登录 / 手机号登录
- 多管理员账号和角色系统
- 图片、视频上传
- 评论、私信、关注
- 完整反刷和风控系统
- 自动部署（当前仍需控制台手动点部署）
- ICP 备案和以 CloudBase 自定义域名直连的正式大陆合规入口

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

最近关键提交：

```text
ef25815 [verified] Revert spoofable admin lockout
26804db [verified] Add submission and privacy guidance
a6fbdcc [verified] Add admin backup download
2ebe06a Update Flycode branding assets
9be2be7 Add edge health probe for Worker diagnostics
052db48 Add Cloudflare Worker proxy deployment
79c8f35 Connect Flycode backend to CloudBase PostgreSQL
```

`a7697e4` 曾尝试按请求来源对管理员连续输错进行锁定；其不可靠部分已由 `ef25815` 撤回，不能重新部署该中间版本。

主要文件：

```text
server.js                              Node.js 后端和 API
public/index.html                      页面结构
public/styles.css                      页面样式
public/app.js                          前端逻辑
public/icons/flycode-icon-light.png    浅色背景图标
public/icons/flycode-icon-dark.png     深色背景图标
worker.mjs                             Cloudflare Worker 代理入口，仅作访问链路实验
wrangler.toml                           Cloudflare Worker 配置
tests/worker-proxy.js                   Worker 转发行为测试
tests/edge-health.js                    Worker 本地健康探针测试
package.json                           npm 配置
package-lock.json                      固定依赖版本
Dockerfile                             CloudBase Run 构建配置
.dockerignore                          发布排除规则
db-schema.sql                           PostgreSQL 表结构
scripts/migrate-json-to-postgres.js    JSON 到 PostgreSQL 导入工具
data/db.json                           本机 JSON 回退数据，仅本机测试
tests/smoke.js                         隔离式自动测试
flycode-cloudbase-run.zip              当前发布包
```

注意：`data/db.json` 已被 Git 排除，不应提交到 Gitee 或上传为线上数据源。

---

## 5. 数据持久化现状

### 线上：CloudBase PostgreSQL 已启用

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

已创建的 Flycode 主要表：

```text
flycode_state
projects
phases
proposals
phase_candidates
votes
decisions
updates
audit_logs
schema_migrations
```

当前线上服务使用 `flycode_state` 作为完整活动状态快照：

```text
id = main
payload = 当前完整 Flycode JSON 状态
```

这样保留现有 API 和前端逻辑，同时避免 CloudBase Run 容器本地文件在重启或重新部署后丢失数据。

已经从本机保存的真实线上缓存恢复并验证：

```text
项目：Flycode
阶段：1
提案：1
提案：水印去除
成长记录：1
```

### 本机：JSON 回退模式

未配置 CloudBase API Key 时，`server.js` 自动继续使用：

```text
data/db.json
```

因此本机测试不需要数据库凭证。

---

## 6. 线上环境变量

CloudBase Run 当前应保留：

```text
NODE_ENV=production
PORT=8080
FLYCODE_DATA_DIR=/data
FLYCODE_STORAGE=cloudbase
FLYCODE_ADMIN_KEY=（生产管理员密钥）
FLYCODE_CLOUDBASE_API_KEY=（CloudBase PostgreSQL 服务端 API Key）
FLYCODE_RELEASE_ID=（本次部署前执行 git rev-parse HEAD 得到的完整 SHA）
```

可选但推荐显式配置：

```text
FLYCODE_CLOUDBASE_ENV_ID=flycode-d9gd8dv0xc55f8e85
```

安全规则：

- 不把管理员密钥或 CloudBase API Key 写入 Git、代码、README、截图或交接文档。
- 不把 Key 放进前端 JavaScript。
- 后端使用 `FLYCODE_CLOUDBASE_API_KEY` 调用 CloudBase PostgreSQL 管理 SQL 接口。
- 管理员 API 仍使用：

```text
X-Admin-Key: <生产管理员密钥>
```

- 如果重新生成 CloudBase API Key，只需在 CloudBase Run 环境变量中替换 `FLYCODE_CLOUDBASE_API_KEY` 后重新部署，不需要改代码。
- 每次准备部署代码时，执行 `git rev-parse HEAD`，把完整输出填入 `FLYCODE_RELEASE_ID`。部署完成后访问 `/api/health`，返回的 `release` 必须与该 SHA 一致；若为 `unknown` 或不一致，说明线上运行的不是已确认的构建版本。该值只用于版本核验，不是密钥。

---

## 7. 本机运行和测试

Git Bash / bash：

```bash
cd C:/Users/l2104/flycode
npm start
```

本机访问：

```text
http://localhost:4173
```

自动测试：

```bash
cd C:/Users/l2104/flycode
npm test
```

已验证结果：

```text
PASS: isolated Flycode smoke checks
```

自动测试使用随机端口和临时数据目录，不会修改真实本机数据或线上 PostgreSQL。

本机默认管理员密钥仅用于本机体验：

```text
flycode-local
```

不要在公网服务使用该默认值。

---

## 8. 发布与日常维护

### 备选后端准备（尚未切换）

#### Supabase PostgreSQL（已准备表结构）

已在仓库增加 `supabase/migrations/20260901000000_initial_flycode.sql`，内容是 Flycode PostgreSQL 表结构和默认 RLS 保护。它只描述数据库结构，不包含当前 CloudBase 的任何真实数据。

截图中的 Supabase GitHub 集成只负责读取仓库中的 `supabase/` 目录并执行迁移，不会自动部署 Flycode 的 `server.js`。当前线上链路仍是 Cloudflare Worker -> CloudBase Run -> CloudBase PostgreSQL。未完成备份、Supabase 连接、数据导入、后端改用 Supabase 和全流程回归前，不要删除 CloudBase 数据或把 Supabase 称为生产后端。

#### Cloudflare D1（已部署并可在 d1.flycode.online 验证）

已部署 Cloudflare D1 版本：

```text
https://d1.flycode.online
```

D1 Worker 名称：

```text
flycode-d1
```

D1 数据库：

```text
flycode-d1
```

当前访问链路：

```text
d1.flycode.online
-> Cloudflare DNS
-> Cloudflare Worker (flycode-d1, 路由 d1.flycode.online/*)
-> Cloudflare D1 (flycode-d1)
```

D1 版本已验证功能：

- ✅ 健康检查：`https://d1.flycode.online/__health` 返回 `"storage":"d1"`
- ✅ 投稿接口：`POST /api/proposals` 成功写入并返回完整状态
- ✅ 状态读取：`GET /api/state` 返回项目、阶段、提案和成长记录
- ✅ 首页加载：`HTTP 200`

D1 版本文件：

```text
worker-d1.mjs                   D1 Worker 入口，完整后端逻辑
wrangler-d1.toml                D1 Worker 配置
scripts/prepare-d1-import.js    从 CloudBase 导入数据到 D1 的准备工具
```

当前状态：

- **flycode.online**（主域名）：继续指向 CloudBase 云托管 + CloudBase PostgreSQL
- **d1.flycode.online**（测试域名）：已指向 Cloudflare D1 版本

何时切换：用户决定后，修改 `wrangler-d1.toml` 增加 `flycode.online` 自定义域名并重新部署，即可让主域名指向 D1 版本。

#### 存储模式总结

Flycode 后端支持四种存储模式：

1. `FLYCODE_STORAGE=json`（本机 JSON，仅本机测试）
2. `FLYCODE_STORAGE=cloudbase`（当前线上 CloudBase REST + CloudBase PostgreSQL）
3. `FLYCODE_STORAGE=postgres`（Supabase 或标准 PostgreSQL 直连）
4. Cloudflare D1（独立 Worker + D1 数据库，当前在 d1.flycode.online 可用）

切换 Supabase 必须显式设置 `FLYCODE_STORAGE=postgres` 和 `FLYCODE_DATABASE_URL`；切换 D1 只需修改 Worker 配置并重新部署；连接串和密钥不得写入 Git 或聊天。

启用截图中的 `Enable integration` 不需要升级 Pro；保持仓库 `niously/flycode`、工作目录 `.`、生产分支 `master` 即可。自动分支属于 Pro 预览功能，目前不需要开启。

以后大多数更新只需要：

```text
提出需求
-> 助手修改和测试
-> 助手推送 Gitee
-> 助手读取 `git rev-parse HEAD`，把输出作为本次 `FLYCODE_RELEASE_ID`
-> 用户在 CloudBase Run 点一次“部署”
-> 助手确认 `/api/health` 的 `release` 与该 SHA 一致，并验证线上功能
```

通常不需要重新填写环境变量；CloudBase Run 会保留现有变量。

当前发布包位置：

```text
C:\Users\l2104\flycode\flycode-cloudbase-run.zip
```

部署页面通常保留：

```text
Git 仓库：https://gitee.com/nious101/flycode.git
分支：master
服务名称：flycode
访问端口：80
服务端口：8080
部署类型：容器型服务
```

如果服务页面使用 Git 平台部署，优先保持 Gitee 仓库和 `master` 分支，不必每次上传 ZIP。

### 哪些情况会多一步

- 改数据库表结构：需要增加并执行一次 PostgreSQL migration。
- 更换 API Key 或管理员密钥：在环境变量页面替换对应值后重新部署。
- 改 Dockerfile、Node 依赖：重新部署时平台会重新构建镜像。
- 改域名、网络或权限：需要控制台额外配置。

### 后续可优化

可以研究 Gitee Webhook 或 CloudBase 自动构建，实现：

```text
推送 Gitee -> CloudBase 自动部署
```

当前尚未配置自动部署。

### Cloudflare Worker 和 flycode.online：已部署并可用

Cloudflare Worker 名称：

```text
flycode
```

Worker 将请求代理到现有 CloudBase 云托管服务：

```text
flycode.online -> Cloudflare Worker -> CloudBase 云托管 -> CloudBase PostgreSQL
```

当前 Worker 路由：

```text
flycode.online/*
```

不要误配为 `*.flycode.online/*`：该模式用于更深一层的子域名，不能替代主入口 `flycode.online/*`。

Worker 诊断接口：

```text
https://flycode.online/__health
```

已验证事实：新域名的首页、Worker 健康检查、CloudBase 后端健康检查和状态 API 均为 HTTP 200。此前 `https://flycode.ccgo.workers.dev` 在中国大陆手机网络及当前外部检查中超时，不能再作为公开地址；新域名已实际通过外部检查，但仍需用户用中国大陆手机 Wi-Fi 和手机流量分别打开 `https://flycode.online`，作为目标网络验收证据。

### GitHub 镜像仓库

为支持外部托管平台部署，项目已同步到：

```text
https://github.com/niously/flycode
```

GitHub 镜像仓库与 Gitee 仓库是否同步，须按本节的实时 Git 命令核验。两个远程和本机 SHA 一致，仅说明代码仓库同步；它本身不代表 CloudBase 已部署该提交。

GitHub 与 Gitee 均不得提交 `.env`、CloudBase API Key、管理员密钥、本机 `data/db.json` 或发布压缩包。

---

## 9. 重要已知限制和风险

- 当前 PostgreSQL 后端用 `flycode_state` JSONB 快照保存完整活动状态，优先保证低成本和兼容现有 API。
- 后续流量增长后，应逐步把高频写入拆到 `proposals`、`votes`、`phases` 等关系表，使用更细粒度事务和唯一约束。
- `flycode_state` 当前在服务进程内使用写入队列，单实例适合小范围测试；多实例正式扩容前应完成数据库原子更新/行锁改造。
- 访客身份当前是浏览器生成的 `visitorId`，不是正式账号系统；重复投票拦截主要针对同一浏览器。
- 管理入口仍是共享管理员密钥，不是正式登录系统。
- 曾评估按网络来源连续输错后锁定管理员入口，但由于代理请求头可能被伪造，该方案未部署并已撤回；后续如需限流，应使用 Cloudflare/平台可信来源或独立的登录系统。
- 默认 CloudBase 域名适合测试，仍可能出现风险提醒和访问量限制；它已保留为后端与排查入口，不应作为对外主入口。
- `flycode.online` 已接入 Cloudflare 并通过外部 HTTP 验证，但尚缺少中国大陆手机 Wi-Fi 与手机流量的人工验收；不能在这两项实测前承诺所有大陆网络稳定。
- `flycode.ccgo.workers.dev` 在中国大陆手机网络和当前外部探测中均不稳定，不能重新作为公开入口。
- Flycode 是动态网站：投稿、审核、投票、管理员接口依赖 `server.js` 和 PostgreSQL；静态托管只能承载页面，不能单独替代当前后端。
- 当前 Worker 流程不是后端迁移，只是 Cloudflare 到 CloudBase 云托管的代理。CloudBase 后端是云托管容器服务，不是普通云函数。
- 不要大规模宣传前再开启多实例或复杂社交功能。

---

## 10. 下一步建议

当前优先顺序：

1. 保留 CloudBase 云托管和 PostgreSQL 作为真实后端与数据源；不要删除、覆盖 `flycode_state` 或迁移前清空数据。
2. 用户用中国大陆手机 Wi-Fi 和手机流量分别打开 `https://flycode.online`，确认首页能加载、投稿能提交；同时观察是否有超时或风险提示。该步骤决定是否可将新域名作为稳定公开入口。
3. 发布版本核验已加入代码：下次 CloudBase 部署前，将 `FLYCODE_RELEASE_ID` 填为将要部署的 Git 提交完整 SHA；部署后 `/api/health` 的 `release` 必须完全一致。当前线上服务尚未部署这项能力，因此此刻接口不含该字段，不能把这次代码推送误报为已上线。
4. 在新入口完整验收首页、`/__health`、`/api/health`、投稿、管理员登录、审核、投票、撤回投票、重新投票和 PostgreSQL 数据持久化。
5. 若新域名在目标网络仍不稳定，再将 Render 或腾讯 EdgeOne Makers 作为对照路线；不要在尚未定位失败环节时盲目更换后端或购买更多服务。
6. 若最终面向中国大陆长期公开，确认 CloudBase 环境的「备案管理」是否可直接备案。以控制台实际可见入口为准，不要未经确认购买 CVM。
7. 有陌生网友持续参与后，再补管理员账号、自动备份、限流/防刷、隐私与投稿规则和更可靠的投票身份。
8. 最后逐步把 PostgreSQL JSONB 快照升级为关系表细粒度读写。

暂时不要优先做：

- 自建代码托管
- 在线 IDE
- 实时多人编辑
- 视频上传
- 积分商城
- 大型社交功能

---

## 11. 新对话开场提示词

新对话直接发送：

```text
请先读取 C:\Users\l2104\flycode\Flycode-交接文档.md，然后继续推进 Flycode。

项目已上线并已切换到 CloudBase PostgreSQL。
当前公开入口：https://flycode.online
CloudBase 原始地址（后端与排查入口）：
https://flycode-305260-9-1465609042.sh.run.tcloudbase.com

访问链路：flycode.online -> Cloudflare Worker（flycode，路由 flycode.online/*）-> CloudBase 云托管 -> CloudBase PostgreSQL。
Cloudflare DNS 名称服务器：venkat.ns.cloudflare.com / becky.ns.cloudflare.com；不要在 Spaceship 改回去。
先通过 https://flycode.online/api/state 确认线上状态；同时区分外部 HTTP 成功与用户中国大陆手机 Wi-Fi/流量实测，后者尚需确认。

当前活动状态必须先通过线上 `/api/state` 确认；2026-08-31 最近实测状态是 submitting（提案收集中），提案数为 1，标题为“水印去除”，成长记录数为 1。
不要重新创建项目、不要删除 PostgreSQL 表、不要覆盖 flycode_state，也不要重复实现已有 MVP 功能。

本机目录：C:\Users\l2104\flycode
Gitee：https://gitee.com/nious101/flycode
当前分支：master
提交前先实时核对本机、Gitee、GitHub 的 SHA 一致；后续每次 CloudBase 部署都应把 `FLYCODE_RELEASE_ID` 填为目标提交 SHA，并核验 `/api/health` 的 `release`。当前线上尚未部署这项版本核验能力。

普通改动流程：修改 -> npm test -> 推送 Gitee -> CloudBase Run 手动点部署 -> 验证线上。

Supabase 真正切换流程（尚未执行）：备份 CloudBase -> 在 Supabase 核对表结构 -> 导入数据并读回核对 -> 配置 `FLYCODE_STORAGE=postgres` 和连接串 -> 先在临时环境运行全流程测试 -> 再安排停机窗口切换 -> 验证 `/api/health`、`/api/state`、投稿和管理功能。
任何 CloudBase API Key、管理员密钥或数据库密码都不能写入代码、Git、文档或聊天回复。
```
