# Flycode 0.1

Flycode 是一个从零开始、由参与者逐步共同塑造的网站。这个版本是可以在本机运行的 MVP，包含：

- 公开项目首页
- 当前阶段与成长时间线
- 网友提交提案
- 主持人审核提案
- 主持人开启投票
- 网友投票（同一浏览器每轮一次）
- 主持人公布决定
- 主持人发布进展、开启下一轮
- 提案审查工作台：待审核、已公开、未采用分栏
- 提案列表独立滚动，支持批量通过、批量不采用、批量删除
- 未采用提案可批量重新审查，恢复为待审核
- 导出项目数据

## 运行方式

需要安装 Node.js 18 或更高版本。

```bash
cd C:/Users/l2104/flycode
npm start
```

然后用浏览器打开 <http://localhost:4173>。

当前版本适合本机或局域网测试。正式公开部署使用 CloudBase Run 和 CloudBase PostgreSQL；具体线上链路与维护步骤见 `Flycode-交接文档.md`。

## Supabase 数据库准备

仓库中的 `supabase/migrations/` 已加入 Flycode 的 PostgreSQL 建表迁移。Supabase GitHub 集成启用后，只会识别并执行这里的数据库迁移；它不会自动部署 `server.js`，也不会自动复制 CloudBase PostgreSQL 的现有数据。

当前后端仍然运行在 CloudBase Run，线上真实数据仍在 CloudBase PostgreSQL。完成数据备份、连接配置、数据导入和接口回归测试前，不要把 Supabase 当作生产后端，也不要删除或覆盖 CloudBase 数据。

Flycode 后端现在支持三种存储模式：

```text
FLYCODE_STORAGE=json       本机 JSON 回退
FLYCODE_STORAGE=cloudbase  当前线上 CloudBase PostgreSQL REST 模式
FLYCODE_STORAGE=postgres   Supabase 或标准 PostgreSQL 直连模式
```

切到 Supabase 时必须显式设置 `FLYCODE_STORAGE=postgres`，并设置 `FLYCODE_DATABASE_URL` 或 `DATABASE_URL`。连接串属于密钥，不要写入代码、README、截图或聊天。

截图中的设置保持：仓库 `niously/flycode`、工作目录 `.`、生产分支 `master`。不需要升级 Pro；自动分支是预览功能，当前不影响生产迁移。

## Cloudflare D1 准备（尚未上线）

`worker-d1.mjs` 和 `wrangler-d1.toml` 是 Flycode 的 Cloudflare Workers + D1 版本，已在本地完成完整工作流测试。它使用 Cloudflare D1 SQLite 作为数据库，Worker 作为后端运行环境，Workers Assets 作为静态资源服务。

D1 数据库 `flycode-d1` 已创建（ID `7b10156b-7153-4a70-8887-ede50a4caa41`），但尚未执行迁移或导入数据。当前线上仍使用 CloudBase，不受影响。

## 部署版本核验

部署到 CloudBase Run 时，为服务添加一个非敏感环境变量。先在项目目录执行 `git rev-parse HEAD`，再将完整输出填入：

```text
FLYCODE_RELEASE_ID=<git rev-parse HEAD 的完整输出>
```

部署完成后访问 `/api/health`。返回 JSON 中的 `release` 应与该 SHA 完全一致；返回 `unknown` 表示这次服务未设置该变量。该值只用于确认线上实际运行的代码版本，不能代替管理员密钥或数据库密钥。

## 自动测试

```bash
npm test
```

测试会在临时端口和临时数据目录运行，结束后自动清理，不会修改真实活动数据。

## 管理入口

点击网站右上角的“管理入口”。本机默认管理密钥是：

```text
flycode-local
```

正式部署必须通过环境变量设置新的管理密钥：

```bash
FLYCODE_ADMIN_KEY="换成一段长而随机的密钥" npm start
```

## 数据

本机数据默认保存在 `data/db.json`，该文件已被 `.gitignore` 排除。当前 MVP 不适合直接作为长期公网多实例服务，正式部署时应使用持久化数据库。

## 第一轮

第一轮问题是：**Flycode 0.1 上线后，下一步最值得优先完成什么？**

社区投票作为参考，最终由发起人结合目标、可行性和成本作决定，并公开记录结果。
