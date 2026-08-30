# Flycode 项目交接文档

> 用途：在新对话中直接恢复 Flycode 项目上下文。
> 更新时间：2026-08-30
> 项目负责人：用户本人（发起人、初期开发者、维护者和最终决策者）

---

## 1. 项目定位

Flycode 是一个从零开始、由网友参与定制和发展的成长型网站。

核心机制：

```text
提出问题 → 网友投稿 → 发起人审核 → 社区投票 → 发起人决定 → 执行并记录 → 开启下一轮
```

当前宣传方向：

> 大家一起来讨论，参与 Flycode 的定制吧！

第一轮问题：

> Flycode 0.1 上线后，下一步最值得优先完成什么？

社区投票是参考意见，最终由发起人结合项目目标、可行性和成本决定。若不采用最高票提案，应公开说明原因。

---

## 2. 当前已经完成的功能

当前 MVP 已实现：

- Flycode 公开首页
- 当前阶段展示
- 成长时间线
- 网友提交文字提案
- 可选参考链接
- 发起人管理员入口
- 待审核 / 已公开 / 未采用三栏提案审查工作台
- 审核通过
- 批量通过
- 批量不采用
- 批量删除待审核提案
- 批量删除未采用提案
- 未采用提案重新审查，恢复为待审核
- 开启投票阶段
- 网友投票
- 同一浏览器同一阶段重复投票拦截
- 发起人公布决定
- 发布项目进展
- 开启下一阶段
- 项目数据导出
- 手机优先的页面布局
- 投稿表单字数统计
- 未提交草稿保存在浏览器 localStorage
- 提交加载状态和成功提示
- 基本安全响应头
- 生产环境禁止使用默认管理员密钥
- 容器 SIGTERM 优雅退出
- CloudBase Run Dockerfile
- 隔离式自动冒烟测试

明确暂未实现：

- 正式用户注册和登录
- 微信登录 / 手机号登录
- 多管理员账号和角色系统
- 图片、视频上传
- 评论、私信、关注
- 实时协作
- 完整反作弊系统
- PostgreSQL 数据库接入

---

## 3. 本机项目位置

项目目录：

```text
C:\Users\l2104\flycode
```

Git 仓库：

```text
git@gitee.com:nious101/flycode.git
```

网页仓库地址：

```text
https://gitee.com/nious101/flycode
```

当前分支：

```text
master
```

当前最新提交：

```text
5ed284a Merge Gitee repository metadata
```

主要文件：

```text
server.js                    Node.js 后端和 API
public/index.html            页面结构
public/styles.css            页面样式
public/app.js                前端逻辑
package.json                npm 配置
Dockerfile                   CloudBase Run 容器配置
.dockerignore                容器构建排除项
data/db.json                 本机 JSON 数据，仅用于本地测试
 tests/smoke.js              隔离式自动测试
公开测试部署路线.md          部署路线和限制说明
使用指南.md                  用户操作说明
```

注意：`data/db.json` 已被 `.gitignore` 排除，不应提交到 Gitee 或打包上传。

---

## 4. 本机运行和测试

在 Git Bash / bash 终端执行：

```bash
cd C:/Users/l2104/flycode
npm start
```

本机访问：

```text
http://localhost:4173
```

同一 Wi-Fi 下手机访问地址通常为：

```text
http://192.168.x.x:4173
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

自动测试使用随机端口和临时数据目录，不会修改真实的 `data/db.json`。

本机默认管理员密钥仅用于本机体验：

```text
flycode-local
```

不要把这个默认密钥用于公网服务。

---

## 5. 当前线上部署

CloudBase Run 线上地址：

```text
https://flycode-305260-9-1465609042.sh.run.tcloudbase.com
```

健康检查地址：

```text
https://flycode-305260-9-1465609042.sh.run.tcloudbase.com/api/health
```

已验证健康返回：

```json
{"ok":true,"service":"flycode"}
```

已验证线上状态：

```text
首页：HTTP 200
HTTPS：正常
安全响应头：正常
/api/health：正常
/api/state：正常
未带管理员密钥访问 /api/admin/state：HTTP 401
当前阶段：submitting（投稿中）
当前公开提案：0
成长记录：1
```

CloudBase Run 配置重点：

```text
服务名称：flycode
服务端口：8080
访问端口：80
Dockerfile：Dockerfile
运行模式：始终自动扩缩容
最小实例数：0
最大实例数：1
```

当前线上服务是小范围测试版，不应立即进行大规模宣传。

---

## 6. 线上环境变量和密钥

当前生产环境必须配置：

```text
NODE_ENV=production
PORT=8080
FLYCODE_DATA_DIR=/data
FLYCODE_ADMIN_KEY=（腾讯云 CloudBase Run 中已配置的生产管理员密钥）
```

安全说明：

- 实际生产管理员密钥没有写入本交接文档。
- 当前对话也没有保存实际密钥原文，不能凭空恢复或猜测。
- 新对话如果需要调用管理员 API，应让用户从腾讯云 CloudBase Run 服务的环境变量中查看，或由用户重新提供。
- 不要把管理员密钥写入 Git、README、前端 JavaScript、截图或公开聊天。
- 不要把腾讯云 API Key、SecretId、SecretKey、PostgreSQL 密码写进代码仓库。

管理员 API 使用请求头：

```text
X-Admin-Key: <生产管理员密钥>
```

本地默认值和线上生产值必须区分。

---

## 7. 最重要的已知限制

当前后端仍然通过本地 JSON 文件保存数据：

```text
data/db.json
```

线上容器默认使用：

```text
/data
```

但 CloudBase Run 容器本地文件不适合作为长期可靠数据库。服务重启、重新部署、实例迁移或以后增加多实例时，JSON 数据可能丢失或出现并发写入问题。

因此当前线上版本只适合：

- 自己测试
- 少量熟人测试
- 验证投稿和投票机制
- 验证手机访问体验

当前不适合：

- 长期正式运营
- 大规模视频宣传后直接收集数据
- 多实例运行
- 把重要活动数据只保存在容器文件里

---

## 8. 新对话的第一件事

新对话应先读取本文件：

```text
C:\Users\l2104\flycode\Flycode-交接文档.md
```

然后不要重复创建项目，也不要重复推送 Gitee。先确认：

1. 项目目录仍然存在
2. Gitee 仓库仍是 `nious101/flycode`
3. CloudBase Run 地址仍可访问
4. `npm test` 通过
5. 当前线上 PostgreSQL 是否已经接入（目前尚未接入）

---

## 9. 推荐的下一条主线：迁移 PostgreSQL

用户已经创建了 PostgreSQL 类型的 CloudBase 环境。下一步不是继续增加页面小功能，而是先把数据层迁移到 PostgreSQL。

推荐顺序：

```text
读取 PostgreSQL 连接信息
→ 设计数据表
→ 创建表和索引
→ 修改 server.js 数据访问层
→ 导入初始 Flycode 数据
→ 本机使用测试数据库回归
→ 配置 CloudBase Run 数据库环境变量
→ 重新部署
→ 验证投稿、审核、投票、决定和导出
```

建议的数据表：

```text
projects
phases
proposals
votes
decisions
updates
audit_logs
```

建议保留现有 API 路径，尽量不重写前端：

```text
GET  /api/health
GET  /api/state
GET  /api/admin/state
POST /api/proposals
POST /api/votes
POST /api/admin/proposals/review
POST /api/admin/proposals/batch
POST /api/admin/phase/status
POST /api/admin/decision
POST /api/admin/updates
POST /api/admin/phases
```

迁移时必须注意：

- 先备份现有 `data/db.json`
- 不把数据库密码提交到 Git
- 后端连接信息放 CloudBase Run 环境变量或密钥管理
- 使用参数化 SQL
- 投票写入必须有唯一约束，避免并发重复投票
- 管理员权限仍需保留
- 先用测试数据库验证，再改线上环境
- 迁移完成前不要删除当前 CloudBase Run 服务

---

## 10. 产品后续方向

低成本优先级：

### P0：先保证活动可用

- PostgreSQL 持久化
- 管理员正式登录或更安全的管理认证
- 数据备份和恢复
- 基本限流和防刷
- 手机端真实测试
- 错误提示和服务日志

### P1：提升参与体验

- 提案状态公开说明
- 投票结束倒计时
- 分享卡片和更好的视频引流文案
- 提案搜索和筛选
- 参与者昵称显示
- 结果页和历史轮次页

### P2：为成长做准备

- 用户账号
- owner / moderator / contributor / participant 角色
- 多项目支持
- GitHub / Gitee 代码协作入口
- Issues / PR 关联
- 图片上传
- 更完整的审计日志

暂时不要优先开发：

- 自建代码托管
- 在线 IDE
- 实时多人编辑
- 视频上传平台
- 复杂积分商城
- 大量社交功能

---

## 11. 成本策略

用户预算目标：尽量控制在每月 0–30 元。

现阶段策略：

- 使用 CloudBase 免费体验或最低个人版
- CloudBase Run 最小实例配置
- 自动缩容到 0
- 最大实例数先设为 1
- 不开自动续费
- 不开超限不停服/按量付费，除非明确确认
- 不上传视频
- 图片后续做前端压缩
- 先使用 CloudBase 默认域名
- 有真实参与者后再考虑域名、备案和正式数据库配置

腾讯云官方资料参考：

```text
https://tcb.cloud.tencent.com/dev
https://docs.cloudbase.net/quick-start/create-env
https://cloud.tencent.com/document/product/876/46901
https://docs.cloudbase.net/run/deploy/deploy/introduce
https://cloud.tencent.com/document/product/876/75213
```

---

## 12. 新对话开场提示词

可以把下面这段直接发给新对话：

```text
请先读取 C:\Users\l2104\flycode\Flycode-交接文档.md，然后继续推进 Flycode。
不要重新创建项目、不要重新推送 Gitee、不要重复做已经完成的 MVP 功能。
当前线上地址是：https://flycode-305260-9-1465609042.sh.run.tcloudbase.com
当前线上服务已验证首页、健康接口和管理员 401 正常。
下一条主线是把当前 data/db.json 数据层迁移到已经创建的 CloudBase PostgreSQL，要求保留现有 API 和前端功能，先做备份、表设计、本机测试，再配置线上环境变量和重新部署。
如果需要管理员密钥或数据库凭证，先明确告诉我需要哪一种，我会从腾讯云控制台提供；不要猜测或生成假的凭证。
``` 
