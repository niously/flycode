function now() {
  return new Date().toISOString();
}

function makeId(prefix) {
  const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(16);
  return `${prefix}-${Date.now().toString(36)}-${random}`;
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
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

const phaseStatuses = new Set(['submitting', 'voting', 'execution', 'archived']);
const proposalStatuses = new Set(['pending', 'approved', 'rejected']);

function seedState() {
  return {
    schemaVersion: 1,
    project: {
      name: 'Flycode',
      tagline: '大家一起来讨论，参与 Flycode 的定制吧！',
      description: '这是一个从零开始、由参与者逐步共同塑造的网站。功能、内容和方向，会在每一轮讨论与实践中慢慢长出来。',
      currentPhaseId: 'phase-1',
      createdAt: now()
    },
    phases: [{
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
    }],
    proposals: [],
    updates: [{
      id: 'update-1',
      title: 'Flycode 从一个问题开始',
      body: '网站还没有被完全定义。现在，第一轮决定权交给参与者：你希望 Flycode 先变成什么？',
      createdAt: now()
    }],
    votes: {}
  };
}

function normalizeState(state) {
  state.project ||= {};
  state.phases = Array.isArray(state.phases) ? state.phases : [];
  state.proposals = Array.isArray(state.proposals) ? state.proposals : [];
  state.updates = Array.isArray(state.updates) ? state.updates : [];
  state.votes ||= {};
  for (const phase of state.phases) phase.candidates = Array.isArray(phase.candidates) ? phase.candidates : [];
  return state;
}

function currentPhase(state) {
  return state.phases.find((phase) => phase.id === state.project.currentPhaseId) || state.phases.at(-1);
}

function candidateProposals(state, phase) {
  if (!phase || phase.status !== 'voting') return [];
  const approved = state.proposals.filter((proposal) => proposal.phaseId === phase.id && proposal.status === 'approved');
  const ids = [...new Set((phase.candidates || []).filter(Boolean))];
  if (!ids.length) return approved;
  const byId = new Map(approved.map((proposal) => [proposal.id, proposal]));
  const candidates = ids.map((id) => byId.get(id)).filter(Boolean);
  return candidates.length ? candidates : approved;
}

function voteCount(state, proposalId) {
  return Object.values(state.votes).reduce((total, votes) => total + Object.values(votes || {}).filter((vote) => vote.proposalId === proposalId).length, 0);
}

function withVoteCount(state, proposal) {
  return { ...proposal, voteCount: voteCount(state, proposal.id) };
}

function publicState(state, visitorId = '') {
  const phase = currentPhase(state);
  const candidates = candidateProposals(state, phase).map((proposal) => withVoteCount(state, proposal));
  const candidateIds = candidates.map((proposal) => proposal.id);
  const responsePhase = phase ? { ...phase, candidates: candidateIds } : null;
  return {
    project: state.project,
    phases: state.phases.map((item) => item.id === responsePhase?.id ? responsePhase : item),
    currentPhase: responsePhase,
    proposals: state.proposals
      .filter((proposal) => proposal.status === 'approved' && proposal.phaseId === phase?.id)
      .map((proposal) => withVoteCount(state, proposal))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    candidateProposals: candidates,
    voting: {
      isOpen: phase?.status === 'voting',
      candidateIds,
      hasVoted: Boolean(phase && visitorId && state.votes?.[phase.id]?.[visitorId])
    },
    updates: [...state.updates].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    stats: {
      proposalCount: state.proposals.filter((proposal) => proposal.status !== 'rejected').length,
      participantCount: new Set(Object.values(state.votes).flatMap((votes) => Object.keys(votes || {}))).size,
      completedRounds: state.phases.filter((item) => ['archived', 'execution'].includes(item.status)).length
    }
  };
}

function adminState(state) {
  const phase = currentPhase(state);
  const candidates = candidateProposals(state, phase);
  return {
    ...publicState(state),
    allProposals: state.proposals
      .map((proposal) => withVoteCount(state, proposal))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    decisionCandidates: candidates.map((proposal) => withVoteCount(state, proposal)),
    votes: state.votes,
    currentPhase: phase ? { ...phase, candidates: candidates.map((proposal) => proposal.id) } : null
  };
}

function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'same-origin',
      ...headers
    }
  });
}

function isAdmin(request, env) {
  const candidate = request.headers.get('x-admin-key') || '';
  const expected = env.FLYCODE_ADMIN_KEY || '';
  return candidate.length > 0 && expected.length > 0 && candidate === expected;
}

function assertProposalMutable(state, proposals) {
  const locked = proposals.find((proposal) => ['voting', 'execution'].includes(state.phases.find((phase) => phase.id === proposal.phaseId)?.status));
  if (locked) throw new Error('本轮投票或执行已经开始，不能再修改提案。');
}

function validPhaseTransition(currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return true;
  return (currentStatus === 'submitting' && nextStatus === 'voting')
    || (currentStatus === 'execution' && nextStatus === 'archived');
}

async function readState(env) {
  const row = await env.FLYCODE_DB.prepare('SELECT payload FROM flycode_state WHERE id = ?').bind('main').first();
  if (row?.payload) return normalizeState(JSON.parse(row.payload));
  const state = seedState();
  await env.FLYCODE_DB.prepare('INSERT INTO flycode_state (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING')
    .bind('main', JSON.stringify(state), now()).run();
  return state;
}

async function mutateState(env, mutator) {
  const state = await readState(env);
  const result = await mutator(state);
  await env.FLYCODE_DB.prepare('INSERT INTO flycode_state (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at')
    .bind('main', JSON.stringify(state), now()).run();
  return result;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    throw new Error('请求格式不是有效 JSON。');
  }
}

async function api(request, env, url) {
  if (request.method === 'GET' && url.pathname === '/api/health') {
    return json({ ok: true, service: 'flycode', storage: 'd1', release: env.FLYCODE_RELEASE_ID || 'unknown' });
  }

  if (request.method === 'GET' && url.pathname === '/api/state') {
    return json(publicState(await readState(env), cleanText(request.headers.get('x-visitor-id'), 120)));
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/state') {
    if (!isAdmin(request, env)) return json({ error: '需要管理员权限。' }, 401);
    return json(adminState(await readState(env)));
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/export') {
    if (!isAdmin(request, env)) return json({ error: '需要管理员权限。' }, 401);
    return json(await readState(env));
  }

  if (request.method === 'GET' && url.pathname === '/api/admin/backup') {
    if (!isAdmin(request, env)) return json({ error: '需要管理员权限。' }, 401);
    const exportedAt = now();
    return json({ format: 'flycode-backup', version: 1, exportedAt, data: await readState(env) }, 200, {
      'content-disposition': `attachment; filename="flycode-backup-${exportedAt.slice(0, 10)}.json"`
    });
  }

  if (request.method !== 'POST') return json({ error: '找不到接口。' }, 404);

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return json({ error: error.message }, 400);
  }

  if (url.pathname === '/api/proposals') {
    const title = cleanText(body.title, 80);
    const description = cleanText(body.description, 1200);
    const author = cleanText(body.author, 30) || '匿名参与者';
    const link = validHttpUrl(cleanText(body.link, 500));
    if (body.website) return json({ error: '提交未通过校验。' }, 400);
    if (title.length < 2) return json({ error: '请给提案写一个标题。' }, 400);
    if (description.length < 10) return json({ error: '请多说明一点你的想法，至少 10 个字。' }, 400);
    if (body.link && !link) return json({ error: '参考链接需要以 http:// 或 https:// 开头。' }, 400);
    try {
      const state = await mutateState(env, (db) => {
        const phase = currentPhase(db);
        if (!phase || phase.status !== 'submitting') throw new Error('当前阶段暂未开放提案。');
        db.proposals.push({ id: makeId('proposal'), phaseId: phase.id, title, description, author, link, status: 'pending', createdAt: now(), reviewedAt: null });
        return publicState(db, cleanText(request.headers.get('x-visitor-id'), 120));
      });
      return json(state, 201);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (!isAdmin(request, env) && url.pathname.startsWith('/api/admin/')) return json({ error: '需要管理员权限。' }, 401);

  if (url.pathname === '/api/votes') {
    const proposalId = cleanText(body.proposalId, 100);
    const visitorId = cleanText(body.visitorId, 120);
    if (!proposalId || !visitorId) return json({ error: '缺少投票信息。' }, 400);
    try {
      const state = await mutateState(env, (db) => {
        const phase = currentPhase(db);
        if (!phase || phase.status !== 'voting') throw new Error('当前还没有开放投票。');
        const proposal = db.proposals.find((item) => item.id === proposalId);
        if (!proposal || !candidateProposals(db, phase).some((item) => item.id === proposalId)) throw new Error('这个提案不在本轮候选中。');
        db.votes[phase.id] ||= {};
        if (db.votes[phase.id][visitorId]) throw new Error('你已经在本轮投过票了。');
        db.votes[phase.id][visitorId] = { proposalId, createdAt: now() };
        return publicState(db, visitorId);
      });
      return json(state, 201);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (url.pathname === '/api/admin/proposals/batch') {
    const ids = Array.isArray(body.ids) ? body.ids.map((id) => cleanText(id, 100)).filter(Boolean) : [];
    const action = cleanText(body.action, 20);
    const allowedActions = new Set(['approve', 'reject', 'rereview', 'delete']);
    if (!ids.length || !allowedActions.has(action)) return json({ error: '批量操作参数无效。' }, 400);
    try {
      const state = await mutateState(env, (db) => {
        const selected = db.proposals.filter((proposal) => ids.includes(proposal.id));
        if (selected.length !== ids.length) throw new Error('部分提案不存在，请刷新后重试。');
        assertProposalMutable(db, selected);
        if (action === 'delete') {
          if (!selected.every((proposal) => proposal.status === 'pending' || proposal.status === 'rejected')) throw new Error('只能删除待审核或未采用的提案。');
          db.proposals = db.proposals.filter((proposal) => !ids.includes(proposal.id));
          for (const phase of db.phases) phase.candidates = phase.candidates.filter((id) => !ids.includes(id));
        } else {
          const expectedStatus = action === 'approve' ? 'pending' : action === 'reject' ? 'pending' : 'rejected';
          if (selected.some((proposal) => proposal.status !== expectedStatus)) throw new Error(action === 'rereview' ? '只能重新审查未采用的提案。' : '所选提案中包含状态已变化的项目，请刷新后重试。');
          const nextStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending';
          for (const proposal of selected) {
            proposal.status = nextStatus;
            proposal.reviewedAt = now();
          }
        }
        return adminState(db);
      });
      return json(state);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (url.pathname === '/api/admin/proposals/review') {
    const proposalId = cleanText(body.proposalId, 100);
    const status = cleanText(body.status, 20);
    if (!proposalStatuses.has(status)) return json({ error: '无效的提案状态。' }, 400);
    try {
      const state = await mutateState(env, (db) => {
        const proposal = db.proposals.find((item) => item.id === proposalId);
        if (!proposal) throw new Error('找不到这个提案。');
        assertProposalMutable(db, [proposal]);
        proposal.status = status;
        proposal.reviewedAt = now();
        for (const phase of db.phases) phase.candidates = phase.candidates.filter((id) => id !== proposalId);
        return adminState(db);
      });
      return json(state);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (url.pathname === '/api/admin/phase/withdraw-voting') {
    try {
      const state = await mutateState(env, (db) => {
        const phase = currentPhase(db);
        if (!phase || phase.status !== 'voting') throw new Error('只有投票进行中时才能撤回投票。');
        for (const proposal of candidateProposals(db, phase)) {
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
      return json(state);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (url.pathname === '/api/admin/phase/status') {
    const status = cleanText(body.status, 20);
    if (!phaseStatuses.has(status)) return json({ error: '无效的阶段状态。' }, 400);
    try {
      const state = await mutateState(env, (db) => {
        const phase = currentPhase(db);
        if (!phase) throw new Error('找不到当前阶段。');
        if (!validPhaseTransition(phase.status, status)) throw new Error('不能从当前阶段状态直接切换到该状态，请刷新后重试。');
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
      return json(state);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (url.pathname === '/api/admin/decision') {
    const proposalId = cleanText(body.proposalId, 100);
    const note = cleanText(body.note, 800);
    try {
      const state = await mutateState(env, (db) => {
        const phase = currentPhase(db);
        const proposal = db.proposals.find((item) => item.id === proposalId);
        if (!phase || phase.status !== 'voting') throw new Error('只有投票阶段才能公布决定。');
        if (!proposal || !candidateProposals(db, phase).some((item) => item.id === proposalId)) throw new Error('请选择本轮候选提案。');
        phase.status = 'execution';
        phase.chosenProposalId = proposalId;
        phase.decisionNote = note;
        phase.decidedAt = now();
        db.updates.push({ id: makeId('update'), title: `第 ${phase.number} 轮决定：${proposal.title}`, body: note || `本轮选择了「${proposal.title}」，接下来进入执行阶段。`, createdAt: now() });
        return adminState(db);
      });
      return json(state);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (url.pathname === '/api/admin/updates') {
    const title = cleanText(body.title, 100);
    const content = cleanText(body.body, 1200);
    if (title.length < 2 || content.length < 5) return json({ error: '请填写更新标题和内容。' }, 400);
    try {
      const state = await mutateState(env, (db) => {
        db.updates.push({ id: makeId('update'), title, body: content, createdAt: now() });
        return adminState(db);
      });
      return json(state, 201);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  if (url.pathname === '/api/admin/phases') {
    const title = cleanText(body.title, 100);
    const question = cleanText(body.question, 500);
    const deadline = cleanText(body.deadline, 30) || null;
    if (title.length < 2 || question.length < 5) return json({ error: '请填写新阶段标题和问题。' }, 400);
    try {
      const state = await mutateState(env, (db) => {
        const oldPhase = currentPhase(db);
        if (oldPhase && oldPhase.status !== 'archived') oldPhase.status = 'archived';
        const nextNumber = Math.max(0, ...db.phases.map((phase) => phase.number)) + 1;
        const phase = { id: makeId('phase'), number: nextNumber, title, question, status: 'submitting', deadline, candidates: [], chosenProposalId: null, decisionNote: '', createdAt: now(), decidedAt: null };
        db.phases.push(phase);
        db.project.currentPhaseId = phase.id;
        db.updates.push({ id: makeId('update'), title: `第 ${nextNumber} 轮开始`, body: question, createdAt: now() });
        return adminState(db);
      });
      return json(state, 201);
    } catch (error) {
      return json({ error: error.message }, 400);
    }
  }

  return json({ error: '找不到接口。' }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return api(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
