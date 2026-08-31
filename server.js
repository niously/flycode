const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = process.env.FLYCODE_DATA_DIR ? path.resolve(process.env.FLYCODE_DATA_DIR) : path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 4173);
const ADMIN_KEY = process.env.FLYCODE_ADMIN_KEY || 'flycode-local';
const CLOUDBASE_ENV_ID = process.env.FLYCODE_CLOUDBASE_ENV_ID || 'flycode-d9gd8dv0xc55f8e85';
const CLOUDBASE_API_KEY = process.env.FLYCODE_CLOUDBASE_API_KEY || '';
const RELEASE_ID = cleanReleaseId(process.env.FLYCODE_RELEASE_ID);
const CLOUDBASE_SQL_URL = `https://${CLOUDBASE_ENV_ID}.api.tcloudbasegateway.com/v1/rdb/exec-pgsql`;

if (process.env.NODE_ENV === 'production' && !process.env.FLYCODE_ADMIN_KEY) {
  throw new Error('生产环境必须设置 FLYCODE_ADMIN_KEY，不能使用默认管理密钥。');
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

const phaseStatuses = new Set(['submitting', 'voting', 'execution', 'archived']);
const proposalStatuses = new Set(['pending', 'approved', 'rejected']);
let writeQueue = Promise.resolve();
const proposalAttempts = new Map();

function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
}

function ensureDataFile() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    const seed = {
      schemaVersion: 1,
      project: {
        name: 'Flycode',
        tagline: '大家一起来讨论，参与 Flycode 的定制吧！',
        description: '这是一个从零开始、由参与者逐步共同塑造的网站。功能、内容和方向，会在每一轮讨论与实践中慢慢长出来。',
        currentPhaseId: 'phase-1',
        createdAt: now()
      },
      phases: [
        {
          id: 'phase-1',
          number: 1,
          title: 'Flycode 0.1',
          question: '你希望它先做什么？',
          status: 'submitting',
          deadline: null,
          candidates: [],
          chosenProposalId: null,
          decisionNote: '',
          createdAt: now(),
          decidedAt: null
        }
      ],
      proposals: [],
      updates: [
        {
          id: 'update-1',
          title: 'Flycode 从一个问题开始',
          body: '网站还没有被完全定义。现在，第一轮决定权交给参与者：你希望 Flycode 先变成什么？',
          createdAt: now()
        }
      ],
      votes: {}
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(seed, null, 2));
  }
}

function readDb() {
  ensureDataFile();
  const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  db.project ||= {};
  db.phases = Array.isArray(db.phases) ? db.phases : [];
  db.proposals = Array.isArray(db.proposals) ? db.proposals : [];
  db.updates = Array.isArray(db.updates) ? db.updates : [];
  db.votes ||= {};
  for (const phase of db.phases) {
    phase.candidates = Array.isArray(phase.candidates) ? phase.candidates : [];
  }
  return db;
}

function writeDb(db) {
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(db, null, 2));
  fs.renameSync(tempFile, DATA_FILE);
}

function parseCloudBaseSqlRows(payload) {
  if (!Array.isArray(payload)) return [];
  return payload;
}

async function queryCloudBaseSql(sql) {
  if (!CLOUDBASE_API_KEY) throw new Error('CloudBase PostgreSQL 未配置服务端 API Key。');
  const response = await fetch(CLOUDBASE_SQL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CLOUDBASE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sql, role: 'cloudbase_postgres' })
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : [];
  } catch {
    payload = { message: text };
  }
  if (!response.ok) throw new Error(payload.message || payload.code || 'CloudBase PostgreSQL 请求失败。');
  return parseCloudBaseSqlRows(payload);
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function readPgDb() {
  const rows = await queryCloudBaseSql("SELECT payload FROM public.flycode_state WHERE id = 'main'");
  const payload = rows[0]?.payload;
  if (!payload || typeof payload !== 'object') throw new Error('CloudBase PostgreSQL 中找不到 Flycode 状态。');
  return normalizeDb(payload);
}

async function writePgDb(db) {
  const payload = JSON.stringify(db);
  await queryCloudBaseSql(
    `INSERT INTO public.flycode_state(id,payload,updated_at) VALUES ('main',${sqlLiteral(payload)}::jsonb,CURRENT_TIMESTAMP) `
    + 'ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=CURRENT_TIMESTAMP'
  );
}

function normalizeDb(db) {
  db.project ||= {};
  db.phases = Array.isArray(db.phases) ? db.phases : [];
  db.proposals = Array.isArray(db.proposals) ? db.proposals : [];
  db.updates = Array.isArray(db.updates) ? db.updates : [];
  db.votes ||= {};
  for (const phase of db.phases) {
    phase.candidates = Array.isArray(phase.candidates) ? phase.candidates : [];
  }
  return db;
}

async function readStore() {
  return CLOUDBASE_API_KEY ? readPgDb() : readDb();
}

async function mutateStore(mutator) {
  if (!CLOUDBASE_API_KEY) return mutateDb(mutator);
  const operation = writeQueue.then(async () => {
    const db = await readPgDb();
    const result = mutator(db);
    await writePgDb(db);
    return result;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}

function mutateDb(mutator) {
  const operation = writeQueue.then(() => {
    const db = readDb();
    const result = mutator(db);
    writeDb(db);
    return result;
  });
  writeQueue = operation.catch(() => undefined);
  return operation;
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, maxLength);
}

function cleanReleaseId(value) {
  const releaseId = typeof value === 'string' ? value.trim() : '';
  return /^[a-f0-9]{7,40}$/i.test(releaseId) ? releaseId.toLowerCase() : 'unknown';
}

function validHttpUrl(value) {
  if (!value) return '';
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
}

function currentPhase(db) {
  return db.phases.find((phase) => phase.id === db.project.currentPhaseId) || db.phases[db.phases.length - 1];
}

function candidateIdsFor(phase) {
  return Array.isArray(phase?.candidates) ? [...new Set(phase.candidates.filter((id) => typeof id === 'string' && id))] : [];
}

function effectiveCandidateProposals(db, phase) {
  if (!phase || phase.status !== 'voting') return [];
  const approved = db.proposals.filter((proposal) => proposal.phaseId === phase.id && proposal.status === 'approved');
  const configuredIds = candidateIdsFor(phase);
  if (!configuredIds.length) return approved;
  const approvedById = new Map(approved.map((proposal) => [proposal.id, proposal]));
  const configured = configuredIds.map((id) => approvedById.get(id)).filter(Boolean);
  return configured.length ? configured : approved;
}

function phaseForProposal(db, proposal) {
  return db.phases.find((phase) => phase.id === proposal?.phaseId);
}

function assertProposalMutable(db, proposals) {
  const locked = proposals.find((proposal) => ['voting', 'execution'].includes(phaseForProposal(db, proposal)?.status));
  if (locked) throw new Error('本轮投票或执行已经开始，不能再修改提案。');
}

function validPhaseTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  return (currentStatus === 'submitting' && nextStatus === 'voting')
    || (currentStatus === 'execution' && nextStatus === 'archived');
}

function voteCountFor(db, proposalId) {
  return Object.values(db.votes || {}).reduce((total, phaseVotes) => {
    if (!phaseVotes || typeof phaseVotes !== 'object') return total;
    return total + Object.values(phaseVotes).filter((vote) => vote.proposalId === proposalId).length;
  }, 0);
}

function withVoteCount(db, proposal) {
  return { ...proposal, voteCount: voteCountFor(db, proposal.id) };
}

function publicState(db, visitorId = '') {
  const phase = currentPhase(db);
  const proposals = db.proposals
    .filter((proposal) => proposal.status === 'approved' && (!phase || proposal.phaseId === phase.id))
    .map((proposal) => withVoteCount(db, proposal))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const candidateProposals = effectiveCandidateProposals(db, phase).map((proposal) => withVoteCount(db, proposal));
  const effectiveCandidateIds = candidateProposals.map((proposal) => proposal.id);
  const responsePhase = phase
    ? { ...phase, candidates: effectiveCandidateIds }
    : phase;
  const responsePhases = db.phases.map((item) => item.id === responsePhase?.id ? responsePhase : item);
  const hasVoted = Boolean(phase && visitorId && db.votes?.[phase.id]?.[visitorId]);
  return {
    project: db.project,
    phases: responsePhases,
    currentPhase: responsePhase,
    proposals,
    candidateProposals,
    voting: {
      isOpen: phase?.status === 'voting',
      candidateIds: effectiveCandidateIds,
      hasVoted
    },
    updates: [...db.updates].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    stats: {
      proposalCount: db.proposals.filter((proposal) => proposal.status !== 'rejected').length,
      participantCount: new Set(Object.values(db.votes || {}).flatMap((phaseVotes) => Object.keys(phaseVotes || {}))).size,
      completedRounds: db.phases.filter((item) => item.status === 'archived' || item.status === 'execution').length
    }
  };
}

function adminState(db) {
  const phase = currentPhase(db);
  const allProposals = db.proposals
    .map((proposal) => withVoteCount(db, proposal))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const decisionCandidates = effectiveCandidateProposals(db, phase).map((proposal) => withVoteCount(db, proposal));
  return {
    ...publicState(db),
    allProposals,
    decisionCandidates,
    votes: db.votes,
    currentPhase: phase ? { ...phase, candidates: decisionCandidates.map((proposal) => proposal.id) } : phase
  };
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin',
    ...extraHeaders
  });
  response.end(body);
}

function sendText(response, statusCode, body, contentType = 'text/plain; charset=utf-8') {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin'
  });
  response.end(body);
}

function sendBackup(response, backup) {
  const body = JSON.stringify(backup, null, 2);
  const date = backup.exportedAt.slice(0, 10);
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Disposition': `attachment; filename=\"flycode-backup-${date}.json\"`,
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'same-origin'
  });
  response.end(body);
}

function getClientIp(request) {
  return request.headers['x-forwarded-for']?.split(',')[0].trim() || request.socket.remoteAddress || 'local';
}

function isAdmin(request) {
  const candidate = request.headers['x-admin-key'];
  if (typeof candidate !== 'string') return false;
  const expectedBuffer = Buffer.from(ADMIN_KEY);
  const candidateBuffer = Buffer.from(candidate);
  return candidateBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(candidateBuffer, expectedBuffer);
}

function requireAdmin(request, response) {
  if (isAdmin(request)) return true;
  sendJson(response, 401, { error: '需要管理员权限。' });
  return false;
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;
    let settled = false;
    request.on('data', (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      byteLength += buffer.length;
      if (byteLength > 1024 * 1024) {
        settled = true;
        reject(new Error('请求内容过大。'));
        request.destroy();
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => {
      if (settled) return;
      settled = true;
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('请求格式不是有效 JSON。'));
      }
    });
    request.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}

async function handleApi(request, response, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(response, 200, { ok: true, service: 'flycode', release: RELEASE_ID, time: now() });
  }

  if (request.method === 'GET' && url.pathname === '/api/state') {
    const visitorId = cleanText(request.headers['x-visitor-id'], 120);
    return sendJson(response, 200, publicState(await readStore(), visitorId));
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/state') {
    if (!requireAdmin(request, response)) return;
    return sendJson(response, 200, adminState(await readStore()));
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/export') {
    if (!requireAdmin(request, response)) return;
    return sendJson(response, 200, await readStore());
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/backup') {
    if (!requireAdmin(request, response)) return;
    return sendBackup(response, {
      format: 'flycode-backup',
      version: 1,
      exportedAt: now(),
      data: await readStore()
    });
  }

  let body;
  if (request.method === 'POST') {
    try {
      body = await parseBody(request);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/proposals') {
    const ip = getClientIp(request);
    const attempts = proposalAttempts.get(ip) || [];
    const recentAttempts = attempts.filter((timestamp) => Date.now() - timestamp < 10 * 60 * 1000);
    if (recentAttempts.length >= 8) {
      return sendJson(response, 429, { error: '提交太频繁，请稍后再试。' });
    }
    recentAttempts.push(Date.now());
    proposalAttempts.set(ip, recentAttempts);

    const title = cleanText(body.title, 80);
    const description = cleanText(body.description, 1200);
    const author = cleanText(body.author, 30) || '匿名参与者';
    const link = validHttpUrl(cleanText(body.link, 500));
    if (body.website) return sendJson(response, 400, { error: '提交未通过校验。' });
    if (title.length < 2) return sendJson(response, 400, { error: '请给提案写一个标题。' });
    if (description.length < 10) return sendJson(response, 400, { error: '请多说明一点你的想法，至少 10 个字。' });
    if (body.link && !link) return sendJson(response, 400, { error: '参考链接需要以 http:// 或 https:// 开头。' });

    try {
      const state = await mutateStore((db) => {
        const phase = currentPhase(db);
        if (!phase || phase.status !== 'submitting') throw new Error('当前阶段暂未开放提案。');
        const proposal = {
          id: makeId('proposal'),
          phaseId: phase.id,
          title,
          description,
          author,
          link,
          status: 'pending',
          createdAt: now(),
          reviewedAt: null
        };
        db.proposals.push(proposal);
        return publicState(db, cleanText(request.headers['x-visitor-id'], 120));
      });
      return sendJson(response, 201, state);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/votes') {
    const proposalId = cleanText(body.proposalId, 100);
    const visitorId = cleanText(body.visitorId, 120);
    if (!proposalId || !visitorId) return sendJson(response, 400, { error: '缺少投票信息。' });
    try {
      const state = await mutateStore((db) => {
        const phase = currentPhase(db);
        if (!phase || phase.status !== 'voting') throw new Error('当前还没有开放投票。');
        const proposal = db.proposals.find((item) => item.id === proposalId);
        const candidates = effectiveCandidateProposals(db, phase);
        if (!proposal || !candidates.some((item) => item.id === proposalId)) throw new Error('这个提案不在本轮候选中。');
        db.votes[phase.id] ||= {};
        if (db.votes[phase.id][visitorId]) throw new Error('你已经在本轮投过票了。');
        db.votes[phase.id][visitorId] = { proposalId, createdAt: now() };
        return publicState(db, visitorId);
      });
      return sendJson(response, 201, state);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/proposals/batch') {
    if (!requireAdmin(request, response)) return;
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => cleanText(id, 100)).filter(Boolean) : [];
    const action = cleanText(body.action, 20);
    const allowedActions = new Set(['approve', 'reject', 'rereview', 'delete']);
    if (!ids.length || !allowedActions.has(action)) {
      return sendJson(response, 400, { error: '批量操作参数无效。' });
    }
    try {
      const state = await mutateStore((db) => {
        const selected = db.proposals.filter((proposal) => ids.includes(proposal.id));
        if (selected.length !== ids.length) throw new Error('部分提案不存在，请刷新后重试。');
        if (action === 'delete') {
          assertProposalMutable(db, selected);
          const deletable = selected.every((proposal) => proposal.status === 'pending' || proposal.status === 'rejected');
          if (!deletable) throw new Error('只能删除待审核或未采用的提案。');
          db.proposals = db.proposals.filter((proposal) => !ids.includes(proposal.id));
          for (const phase of db.phases) {
            phase.candidates = phase.candidates.filter((id) => !ids.includes(id));
          }
        } else {
          assertProposalMutable(db, selected);
          const expectedStatus = action === 'approve' ? 'pending' : action === 'reject' ? 'pending' : 'rejected';
          if (selected.some((proposal) => proposal.status !== expectedStatus)) {
            throw new Error(action === 'rereview' ? '只能重新审查未采用的提案。' : '所选提案中包含状态已变化的项目，请刷新后重试。');
          }
          const nextStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
          for (const proposal of selected) {
            proposal.status = nextStatus;
            proposal.reviewedAt = now();
          }
        }
        return adminState(db);
      });
      return sendJson(response, 200, state);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/proposals/review') {
    if (!requireAdmin(request, response)) return;
    const proposalId = cleanText(body.proposalId, 100);
    const status = cleanText(body.status, 20);
    if (!proposalStatuses.has(status)) return sendJson(response, 400, { error: '无效的提案状态。' });
    try {
      const state = await mutateStore((db) => {
        const proposal = db.proposals.find((item) => item.id === proposalId);
        if (!proposal) throw new Error('找不到这个提案。');
        assertProposalMutable(db, [proposal]);
        proposal.status = status;
        proposal.reviewedAt = now();
        for (const phase of db.phases) {
          phase.candidates = phase.candidates.filter((id) => id !== proposalId);
        }
        return adminState(db);
      });
      return sendJson(response, 200, state);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/phase/withdraw-voting') {
    if (!requireAdmin(request, response)) return;
    try {
      const state = await mutateStore((db) => {
        const phase = currentPhase(db);
        if (!phase || phase.status !== 'voting') throw new Error('只有投票进行中时才能撤回投票。');
        const candidates = effectiveCandidateProposals(db, phase);
        for (const proposal of candidates) {
          if (proposal.status === 'approved') {
            proposal.status = 'pending';
            proposal.reviewedAt = null;
          }
        }
        phase.status = 'submitting';
        phase.candidates = [];
        phase.chosenProposalId = null;
        phase.decisionNote = '';
        phase.decidedAt = null;
        db.votes[phase.id] = {};
        return adminState(db);
      });
      return sendJson(response, 200, state);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/phase/status') {
    if (!requireAdmin(request, response)) return;
    const status = cleanText(body.status, 20);
    if (!phaseStatuses.has(status)) return sendJson(response, 400, { error: '无效的阶段状态。' });
    try {
      const state = await mutateStore((db) => {
        const phase = currentPhase(db);
        if (!phase) throw new Error('找不到当前阶段。');
        if (!validPhaseTransition(phase.status, status)) {
          throw new Error(`不能从当前阶段状态直接切换到该状态，请刷新后重试。`);
        }
        if (status === 'voting') {
          const approved = db.proposals.filter((proposal) => proposal.phaseId === phase.id && proposal.status === 'approved');
          if (!approved.length) throw new Error('至少审核通过一个提案后才能开启投票。');
          phase.candidates = approved.map((proposal) => proposal.id);
          db.votes[phase.id] ||= {};
        }
        phase.status = status;
        if (status === 'submitting') phase.candidates = [];
        return adminState(db);
      });
      return sendJson(response, 200, state);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/decision') {
    if (!requireAdmin(request, response)) return;
    const proposalId = cleanText(body.proposalId, 100);
    const note = cleanText(body.note, 800);
    try {
      const state = await mutateStore((db) => {
        const phase = currentPhase(db);
        const proposal = db.proposals.find((item) => item.id === proposalId);
        if (!phase || phase.status !== 'voting') throw new Error('只有投票阶段才能公布决定。');
        const candidates = effectiveCandidateProposals(db, phase);
        if (!proposal || !candidates.some((item) => item.id === proposalId)) throw new Error('请选择本轮候选提案。');
        phase.status = 'execution';
        phase.chosenProposalId = proposalId;
        phase.decisionNote = note;
        phase.decidedAt = now();
        db.updates.push({
          id: makeId('update'),
          title: `第 ${phase.number} 轮决定：${proposal.title}`,
          body: note || `本轮选择了「${proposal.title}」，接下来进入执行阶段。`,
          createdAt: now()
        });
        return adminState(db);
      });
      return sendJson(response, 200, state);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/updates') {
    if (!requireAdmin(request, response)) return;
    const title = cleanText(body.title, 100);
    const content = cleanText(body.body, 1200);
    if (title.length < 2 || content.length < 5) return sendJson(response, 400, { error: '请填写更新标题和内容。' });
    try {
      const state = await mutateStore((db) => {
        db.updates.push({ id: makeId('update'), title, body: content, createdAt: now() });
        return adminState(db);
      });
      return sendJson(response, 201, state);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/admin/phases') {
    if (!requireAdmin(request, response)) return;
    const title = cleanText(body.title, 100);
    const question = cleanText(body.question, 500);
    const deadline = cleanText(body.deadline, 30) || null;
    if (title.length < 2 || question.length < 5) return sendJson(response, 400, { error: '请填写新阶段标题和问题。' });
    try {
      const state = await mutateStore((db) => {
        const oldPhase = currentPhase(db);
        if (oldPhase && oldPhase.status !== 'archived') oldPhase.status = 'archived';
        const nextNumber = Math.max(0, ...db.phases.map((phase) => phase.number)) + 1;
        const phase = {
          id: makeId('phase'),
          number: nextNumber,
          title,
          question,
          status: 'submitting',
          deadline,
          candidates: [],
          chosenProposalId: null,
          decisionNote: '',
          createdAt: now(),
          decidedAt: null
        };
        db.phases.push(phase);
        db.project.currentPhaseId = phase.id;
        db.updates.push({
          id: makeId('update'),
          title: `第 ${nextNumber} 轮开始`,
          body: question,
          createdAt: now()
        });
        return adminState(db);
      });
      return sendJson(response, 201, state);
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  return sendJson(response, 404, { error: '找不到接口。' });
}

function serveStatic(request, response, url) {
  let requestedPath = decodeURIComponent(url.pathname);
  if (requestedPath === '/') requestedPath = '/index.html';
  const resolved = path.resolve(PUBLIC_DIR, `.${requestedPath}`);
  if (!resolved.startsWith(PUBLIC_DIR)) return sendText(response, 403, 'Forbidden');

  fs.stat(resolved, (error, stats) => {
    if (!error && stats.isFile()) {
      const extension = path.extname(resolved).toLowerCase();
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
        'Cache-Control': ['.html', '.js', '.css'].includes(extension) ? 'no-cache, no-store, must-revalidate' : 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin'
      });
      return fs.createReadStream(resolved).pipe(response);
    }
    const indexFile = path.join(PUBLIC_DIR, 'index.html');
    response.writeHead(200, {
      'Content-Type': MIME_TYPES['.html'],
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin'
    });
    fs.createReadStream(indexFile).pipe(response);
  });
}

ensureDataFile();
const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(request, response, url);
    } else {
      serveStatic(request, response, url);
    }
  } catch (error) {
    console.error(error);
    if (!response.headersSent) sendJson(response, 500, { error: '服务器出现意外错误。' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const interfaces = require('os').networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    // 跳过虚拟网卡和回环接口
    if (name.includes('Loopback') || name.includes('VMware') || name.includes('VirtualBox') || name.includes('Npcap')) continue;
    for (const iface of interfaces[name]) {
      // 只要真实的 IPv4 地址，跳过 169.254 开头的自动分配地址
      if (iface.family === 'IPv4' && !iface.internal && !iface.address.startsWith('169.254')) {
        addresses.push(iface.address);
      }
    }
  }
  console.log(`Flycode is running at http://localhost:${PORT}`);
  if (addresses.length > 0) {
    console.log(`On your network: http://${addresses[0]}:${PORT}`);
    console.log(`手机访问这个地址: http://${addresses[0]}:${PORT}`);
  } else {
    console.log('未检测到有效的 Wi-Fi 地址，确保电脑已连接 Wi-Fi');
  }
  console.log(`Local admin key: ${ADMIN_KEY === 'flycode-local' ? 'flycode-local' : '(from FLYCODE_ADMIN_KEY)'}`);
});

function shutdown(signal) {
  console.log(`${signal} received, shutting down Flycode`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
