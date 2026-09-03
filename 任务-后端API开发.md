# Flycode 后端 API 开发任务

## 项目背景

Flycode 是一个共创网站，当前已部署在 Cloudflare Workers + D1 数据库。你需要为三个新功能开发后端 API。

**技术栈：**
- 运行环境：Cloudflare Workers
- 数据库：Cloudflare D1（SQLite）
- 后端文件：`worker-d1.mjs`（已有完整代码）
- 数据结构：JSON 存储在 `flycode_state` 表（id='main', payload=完整状态）

**当前数据结构（重要）：**
```javascript
{
  project: {...},
  phases: [...],
  proposals: [
    {
      id: 'proposal-xxx',
      title: '提案标题',
      description: '提案描述',
      author: '作者昵称',
      link: '参考链接',
      phaseId: 'phase-1',
      status: 'pending/approved/rejected',
      createdAt: '2026-09-03T...',
      reviewedAt: '...',
      voteCount: 0  // 已有字段
    }
  ],
  updates: [...],
  votes: {
    // 当前投票结构：votes[visitorId][phaseId] = {proposalId, timestamp}
  }
}
```

---

## 任务一：提案点赞功能

**需求：**
访客可以给提案点赞（不是正式投票），一个人可以给多个提案点赞，但同一提案只能点一次。

**数据结构设计：**

在 `state` 根节点新增字段：
```javascript
{
  ...现有字段,
  likes: {
    // likes[visitorId] = ['proposal-id-1', 'proposal-id-2', ...]
    'visitor-abc123': ['proposal-mtkq6t4l-5c983a', 'proposal-mtfgm3f1-c88189'],
    'visitor-xyz789': ['proposal-mtkq6t4l-5c983a']
  }
}
```

每个 `proposal` 需要计算 `likeCount`（从 likes 里统计）。

**API 接口：**

### 1. POST `/api/likes`
**请求：**
```json
{
  "proposalId": "proposal-mtkq6t4l-5c983a"
}
```
**请求头：**
```
X-Visitor-Id: visitor-abc123
```
**响应：**
```json
{
  "ok": true,
  "action": "liked",  // 或 "unliked"
  "likeCount": 15
}
```
**逻辑：**
- 如果 `likes[visitorId]` 不存在，创建空数组
- 如果 `proposalId` 已在数组中，移除（取消点赞）
- 如果 `proposalId` 不在数组中，添加（点赞）
- 返回该提案的总点赞数

### 2. GET `/api/state` 修改
在返回的 `proposals` 数组中，每个提案新增 `likeCount` 字段和 `liked`（当前访客是否点赞）：
```javascript
{
  ...proposal,
  likeCount: 15,
  liked: true  // 当前 visitorId 是否点赞了这个提案
}
```

**实现要点：**
- 使用 `cleanText(request.headers.get('x-visitor-id'), 120)` 获取访客 ID
- 校验 `proposalId` 是否存在
- 计算 `likeCount`：遍历 `state.likes` 对象，统计包含该 `proposalId` 的数组数量
- 使用现有的 `mutateState` 函数写入数据库

---

## 任务二：提案评论功能

**需求：**
访客可以给提案留言评论，支持匿名或自定义昵称。

**数据结构设计：**

在 `state` 根节点新增字段：
```javascript
{
  ...现有字段,
  comments: [
    {
      id: 'comment-xxx',
      proposalId: 'proposal-mtkq6t4l-5c983a',
      visitorId: 'visitor-abc123',
      author: '热心网友',  // 可选昵称，默认"匿名参与者"
      content: '评论内容',
      createdAt: '2026-09-03T12:34:56.789Z'
    }
  ]
}
```

**API 接口：**

### 1. POST `/api/comments`
**请求：**
```json
{
  "proposalId": "proposal-mtkq6t4l-5c983a",
  "content": "这个提案不错，但建议增加...",
  "author": "热心网友"  // 可选，不传则为"匿名参与者"
}
```
**请求头：**
```
X-Visitor-Id: visitor-abc123
```
**响应：**
```json
{
  "ok": true,
  "comment": {
    "id": "comment-xxx",
    "proposalId": "proposal-mtkq6t4l-5c983a",
    "author": "热心网友",
    "content": "这个提案不错...",
    "createdAt": "2026-09-03T12:34:56.789Z"
  }
}
```
**逻辑：**
- 校验 `proposalId` 存在
- 校验 `content` 长度：1-500 字符
- `author` 长度：1-20 字符，默认"匿名参与者"
- 生成 `comment.id` 使用现有的 `makeId('comment')` 函数
- 不返回 `visitorId`（隐私保护）

### 2. GET `/api/comments?proposalId=xxx`
**响应：**
```json
{
  "ok": true,
  "comments": [
    {
      "id": "comment-xxx",
      "author": "热心网友",
      "content": "这个提案不错...",
      "createdAt": "2026-09-03T12:34:56.789Z"
    }
  ]
}
```
**逻辑：**
- 按 `createdAt` 倒序排列（最新在前）
- 不返回 `visitorId` 和 `proposalId`

### 3. GET `/api/state` 修改
在返回的每个 `proposal` 中新增 `commentCount` 字段：
```javascript
{
  ...proposal,
  commentCount: 5
}
```

---

## 任务三：提案分类标签

**需求：**
管理员审核提案时可以打标签，访客可以按标签筛选提案。

**数据结构设计：**

修改 `proposal` 结构：
```javascript
{
  ...现有字段,
  tags: ['功能', '设计']  // 标签数组，最多 3 个
}
```

**预设标签列表：**
```javascript
const PROPOSAL_TAGS = [
  '功能', '内容', '设计', '体验', '技术', '运营', '其他'
];
```

**API 接口：**

### 1. PATCH `/api/admin/proposals/:id/tags`
**请求：**
```json
{
  "tags": ["功能", "设计"]
}
```
**请求头：**
```
X-Admin-Key: (生产密钥)
```
**响应：**
```json
{
  "ok": true,
  "proposal": {
    ...提案完整信息,
    "tags": ["功能", "设计"]
  }
}
```
**逻辑：**
- 需要管理员权限：`isAdmin(request, env)`
- 校验 `tags` 是数组，每项在 `PROPOSAL_TAGS` 中
- 最多 3 个标签
- 使用 `mutateState` 更新提案

### 2. GET `/api/proposals/tags`
**响应：**
```json
{
  "ok": true,
  "tags": [
    {"name": "功能", "count": 5},
    {"name": "设计", "count": 3},
    {"name": "内容", "count": 2}
  ]
}
```
**逻辑：**
- 统计每个标签在所有 `approved` 提案中的使用次数
- 按 `count` 降序排列

### 3. GET `/api/state` 修改
每个 `proposal` 返回 `tags` 字段（已有则返回，无则返回空数组 `[]`）

---

## 实现要点

### 1. 错误处理
```javascript
// 缺少 visitorId
if (!visitorId) return json({ error: '缺少访客标识。' }, 400);

// 提案不存在
const proposal = state.proposals.find(p => p.id === proposalId);
if (!proposal) return json({ error: '提案不存在。' }, 404);

// 评论内容为空
if (!content || content.length < 1) return json({ error: '评论内容不能为空。' }, 400);
if (content.length > 500) return json({ error: '评论内容不能超过 500 字。' }, 400);
```

### 2. 辅助函数模式参考
参考现有代码中的 `voteCount` 函数：
```javascript
function likeCount(state, proposalId) {
  return Object.values(state.likes || {}).reduce(
    (total, likedIds) => total + (likedIds.includes(proposalId) ? 1 : 0),
    0
  );
}

function commentCount(state, proposalId) {
  return (state.comments || []).filter(c => c.proposalId === proposalId).length;
}
```

### 3. 兼容性处理
```javascript
function normalizeState(state) {
  state.project ||= {};
  state.phases = Array.isArray(state.phases) ? state.phases : [];
  state.proposals = Array.isArray(state.proposals) ? state.proposals : [];
  state.updates = Array.isArray(state.updates) ? state.updates : [];
  state.votes ||= {};
  // 新增
  state.likes ||= {};
  state.comments = Array.isArray(state.comments) ? state.comments : [];
  for (const phase of state.phases) phase.candidates = Array.isArray(phase.candidates) ? phase.candidates : [];
  // 提案标签默认值
  for (const proposal of state.proposals) proposal.tags = Array.isArray(proposal.tags) ? proposal.tags : [];
  return state;
}
```

---

## 测试建议

完成后用以下命令测试：

```bash
# 1. 点赞
curl -X POST https://flycode.online/api/likes \
  -H "Content-Type: application/json" \
  -H "X-Visitor-Id: test-visitor-1" \
  -d '{"proposalId":"proposal-mtkq6t4l-5c983a"}'

# 2. 评论
curl -X POST https://flycode.online/api/comments \
  -H "Content-Type: application/json" \
  -H "X-Visitor-Id: test-visitor-1" \
  -d '{"proposalId":"proposal-mtkq6t4l-5c983a","content":"测试评论","author":"测试用户"}'

# 3. 获取评论
curl "https://flycode.online/api/comments?proposalId=proposal-mtkq6t4l-5c983a"

# 4. 管理员打标签
curl -X PATCH https://flycode.online/api/admin/proposals/proposal-mtkq6t4l-5c983a/tags \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: (密钥)" \
  -d '{"tags":["功能","设计"]}'
```

---

## 注意事项

1. **不要破坏现有功能**：所有新字段都要有默认值，兼容旧数据
2. **保持现有风格**：参考 `worker-d1.mjs` 中的代码风格和错误处理
3. **性能考虑**：D1 是 SQLite，数据都在一个 JSON 对象里，读写要经过 `readState` 和 `mutateState`
4. **安全性**：
   - 所有用户输入用 `cleanText()` 清理
   - 链接用 `validHttpUrl()` 校验
   - 管理员接口用 `isAdmin()` 鉴权
5. **部署前测试**：本地用 `npm start` 测试，确保不会破坏现有数据结构

---

## 交付内容

修改后的完整 `worker-d1.mjs` 文件，包含：
- ✅ 三个新功能的所有 API 接口
- ✅ 修改后的 `normalizeState` 函数
- ✅ 新增的辅助函数（likeCount, commentCount 等）
- ✅ 修改后的 `publicState` 和 `adminState` 函数

请直接提供完整的可运行代码。
