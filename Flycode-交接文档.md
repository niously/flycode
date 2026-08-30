# Flycode 项目交接文档

> 用途：在新对话中直接恢复 Flycode 项目上下文。
> 更新时间：2026-08-30
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

线上地址：

```text
https://flycode-305260-9-1465609042.sh.run.tcloudbase.com
```

健康检查：

```text
https://flycode-305260-9-1465609042.sh.run.tcloudbase.com/api/health
```

2026-08-30 已实际验证：

```text
首页正常
/api/health: HTTP 200
/api/state: HTTP 200
新版 voting 字段存在
新版 candidateProposals 字段存在
PostgreSQL 持久化已启用
```

当前活动数据：

```text
当前阶段：voting（投票中）
公开提案：1
候选提案：水印去除
候选提案 ID：proposal-mtfgm3f1-c88189
成长记录：1
```

当前访客可以为“水印去除”投票；发起人可以在管理工作台选择该候选并公布决定。

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
- 管理工作台手动刷新按钮
- 投票阶段撤回并回到重新审核：候选提案退回待审核，历史票数清零，可重新开启投票
- 独立 Flycode SVG 图标，已接入浏览器标签、手机收藏图标和页首品牌标记
- 中文请求体 UTF-8 安全处理，避免网络分块导致乱码
- 基本安全响应头
- 生产环境禁止默认管理员密钥
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

当前最新提交：

```text
79c8f35 Connect Flycode backend to CloudBase PostgreSQL
```

最近关键提交：

```text
79c8f35 Connect Flycode backend to CloudBase PostgreSQL
05165f5 Support CloudBase PostgreSQL connection fields
3b9638a Fix voting flow and prepare PostgreSQL migration
```

主要文件：

```text
server.js                              Node.js 后端和 API
public/index.html                      页面结构
public/styles.css                      页面样式
public/app.js                          前端逻辑
package.json                           npm 配置
package-lock.json                      固定依赖版本
Dockerfile                             CloudBase Run 构建配置
.dockerignore                          发布排除规则
db-schema.sql                          PostgreSQL 表结构
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
FLYCODE_ADMIN_KEY=（生产管理员密钥）
FLYCODE_CLOUDBASE_API_KEY=（CloudBase PostgreSQL 服务端 API Key）
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

### 普通功能或页面更新

以后大多数更新只需要：

```text
提出需求
-> 助手修改和测试
-> 助手推送 Gitee
-> 用户在 CloudBase Run 点一次“部署”
-> 助手验证线上结果
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

---

## 9. 重要已知限制和风险

- 当前 PostgreSQL 后端用 `flycode_state` JSONB 快照保存完整活动状态，优先保证低成本和兼容现有 API。
- 后续流量增长后，应逐步把高频写入拆到 `proposals`、`votes`、`phases` 等关系表，使用更细粒度事务和唯一约束。
- `flycode_state` 当前在服务进程内使用写入队列，单实例适合小范围测试；多实例正式扩容前应完成数据库原子更新/行锁改造。
- 访客身份当前是浏览器生成的 `visitorId`，不是正式账号系统；重复投票拦截主要针对同一浏览器。
- 管理入口仍是共享管理员密钥，不是正式登录系统。
- 默认 CloudBase 域名适合测试；中国大陆长期正式公开应准备备案域名。
- 当前 CloudBase 测试域名已出现风险提醒和访问量上限中间页，正式域名应在公开传播前绑定并验证。
- 不要大规模宣传前再开启多实例或复杂社交功能。

---

## 10. 下一步建议

当前在线阶段已经是投票中，优先顺序：

1. 先决定正式域名，并在腾讯云完成备案/解析准备；不要先停用当前 CloudBase 地址。
2. 在 CloudBase Run 为服务绑定自定义域名，验证 HTTPS、首页、`/api/health` 和管理入口。
3. 在手机和不同浏览器实际测试“水印去除”投票；发现候选或说明有误时使用“撤回投票，重新审核”。
4. 通过管理工作台查看票数，选择候选并公布决定。
5. 发布一条执行进展，保留完整成长记录；完成本轮后归档并创建下一轮问题。
6. 若开始有陌生网友持续参与，优先补管理员登录、备份、限流和更可靠的投票身份。
7. 再把 PostgreSQL 快照存储逐步升级为关系表的细粒度读写。

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
线上地址：
https://flycode-305260-9-1465609042.sh.run.tcloudbase.com

当前阶段是 voting，候选提案是“水印去除”。
不要重新创建项目、不要删除 PostgreSQL 表、不要覆盖 flycode_state，也不要重复实现已有 MVP 功能。

本机目录：C:\Users\l2104\flycode
Gitee：https://gitee.com/nious101/flycode
当前分支：master

普通改动流程：修改 -> npm test -> 推送 Gitee -> CloudBase Run 手动点部署 -> 验证线上。
任何 CloudBase API Key、管理员密钥或数据库密码都不能写入代码、Git、文档或聊天回复。
```
