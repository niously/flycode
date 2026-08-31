const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const root = path.resolve(__dirname, '..');
const serverPath = path.join(root, 'server.js');
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flycode-test-'));
const port = Number(process.env.FLYCODE_TEST_PORT || 43000 + Math.floor(Math.random() * 1000));
const baseUrl = `http://127.0.0.1:${port}`;
const adminKey = `test-admin-${Date.now().toString(36)}`;
const releaseId = '0123456789abcdef0123456789abcdef01234567';
const adminHeaders = { 'X-Admin-Key': adminKey };
let serverProcess;
let serverOutput = '';

async function request(pathname, options = {}) {
  const response = await fetch(`${baseUrl}${pathname}`, options);
  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    // 首页等非 JSON 响应保留在 text 中。
  }
  return { status: response.status, headers: response.headers, body, text };
}

async function splitUtf8Proposal(payload) {
  const net = require('net');
  const body = Buffer.from(JSON.stringify(payload), 'utf8');
  const requestHead = Buffer.from(
    `POST /api/proposals HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nContent-Type: application/json\r\nContent-Length: ${body.length}\r\nConnection: close\r\n\r\n`,
    'ascii'
  );
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const responseChunks = [];
    socket.on('data', (chunk) => responseChunks.push(chunk));
    socket.on('error', reject);
    socket.on('close', () => {
      try {
        const raw = Buffer.concat(responseChunks).toString('utf8');
        const separator = raw.indexOf('\r\n\r\n');
        const status = Number(raw.match(/^HTTP\/1\.1 (\d+)/)?.[1]);
        resolve({ status, body: JSON.parse(raw.slice(separator + 4)) });
      } catch (error) {
        reject(error);
      }
    });
    socket.on('connect', () => {
      socket.write(requestHead);
      for (const byte of body) socket.write(Buffer.from([byte]));
      socket.end();
    });
  });
}

function post(pathname, payload, headers = {}) {
  return request(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(payload)
  });
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForHealth(timeout = 12000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    if (serverProcess.exitCode !== null) {
      throw new Error(`测试服务提前退出（${serverProcess.exitCode}）：${serverOutput}`);
    }
    try {
      const health = await request('/api/health');
      if (health.status === 200 && health.body.ok === true) return;
    } catch {
      // 服务还没有监听，继续等待。
    }
    await sleep(100);
  }
  throw new Error(`测试服务启动超时：${serverOutput}`);
}

function startServer() {
  serverProcess = spawn(process.execPath, [serverPath], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      PORT: String(port),
      FLYCODE_ADMIN_KEY: adminKey,
      FLYCODE_RELEASE_ID: releaseId,
      FLYCODE_DATA_DIR: dataDir
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', (chunk) => { serverOutput += chunk.toString(); });
  serverProcess.stderr.on('data', (chunk) => { serverOutput += chunk.toString(); });
}

async function stopServer() {
  if (!serverProcess || serverProcess.exitCode !== null) return;
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 1500);
    serverProcess.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
    serverProcess.kill();
  });
}

async function run() {
  startServer();
  await waitForHealth();

  const health = await request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.ok, true);
  assert.equal(health.body.service, 'flycode');
  assert.equal(health.body.release, releaseId);

  const home = await request('/');
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type') || '', /^text\/html/);
  assert.match(home.text, /<title>Flycode/);
  assert.match(home.text, /投稿须知/);
  assert.match(home.text, /隐私说明/);
  assert.equal(home.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(home.headers.get('x-frame-options'), 'DENY');

  const initial = await request('/api/state');
  assert.equal(initial.status, 200);
  assert.equal(initial.body.proposals.length, 0);
  assert.equal(initial.body.currentPhase.status, 'submitting');

  const unauthorized = await request('/api/admin/state');
  assert.equal(unauthorized.status, 401);

  const createdIds = [];
  for (let index = 1; index <= 3; index += 1) {
    const payload = {
      title: `自动测试提案 ${index}`,
      description: '这是一条用于验证提案审查、重新审查和删除流程的临时测试内容。'
    };
    const submitted = index === 1
      ? await splitUtf8Proposal({ title: '自动测试提案 1', description: '这是一条用于验证中文编码和投票流程的测试内容。' })
      : await post('/api/proposals', payload, { 'X-Forwarded-For': `10.88.0.${index}` });
    assert.equal(submitted.status, 201);
  }

  const afterSubmit = await request('/api/admin/state', { headers: adminHeaders });
  const created = afterSubmit.body.allProposals.filter((proposal) => proposal.title.startsWith('自动测试提案 '));
  const proposalIds = new Map(created.map((proposal) => [proposal.title, proposal.id]));
  assert.equal(proposalIds.size, 3);
  assert.ok(created.every((proposal) => proposal.status === 'pending'));
  assert.equal((await request('/api/state')).body.proposals.length, 0);

  const rejectedIds = [proposalIds.get('自动测试提案 1'), proposalIds.get('自动测试提案 2')];
  const approvedId = proposalIds.get('自动测试提案 3');
  const rejected = await post('/api/admin/proposals/batch', {
    ids: rejectedIds,
    action: 'reject'
  }, adminHeaders);
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.allProposals.filter((proposal) => rejectedIds.includes(proposal.id) && proposal.status === 'rejected').length, 2);

  const rereviewed = await post('/api/admin/proposals/batch', {
    ids: rejectedIds,
    action: 'rereview'
  }, adminHeaders);
  assert.equal(rereviewed.status, 200);
  assert.equal(rereviewed.body.allProposals.filter((proposal) => rejectedIds.includes(proposal.id) && proposal.status === 'pending').length, 2);

  const rejectedAgain = await post('/api/admin/proposals/batch', {
    ids: rejectedIds,
    action: 'reject'
  }, adminHeaders);
  assert.equal(rejectedAgain.status, 200);

  const deletedRejected = await post('/api/admin/proposals/batch', {
    ids: rejectedIds,
    action: 'delete'
  }, adminHeaders);
  assert.equal(deletedRejected.status, 200);
  assert.equal(deletedRejected.body.allProposals.some((proposal) => rejectedIds.includes(proposal.id)), false);

  const approved = await post('/api/admin/proposals/review', {
    proposalId: approvedId,
    status: 'approved'
  }, adminHeaders);
  assert.equal(approved.status, 200);
  assert.equal((await request('/api/state')).body.proposals.length, 1);

  const voting = await post('/api/admin/phase/status', { status: 'voting' }, adminHeaders);
  assert.equal(voting.status, 200);
  assert.deepEqual(voting.body.currentPhase.candidates, [approvedId]);
  assert.equal(voting.body.decisionCandidates.length, 1);
  assert.equal(voting.body.decisionCandidates[0].id, approvedId);

  const databasePath = path.join(dataDir, 'db.json');
  const snapshot = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
  snapshot.phases[0].candidates = [];
  fs.writeFileSync(databasePath, JSON.stringify(snapshot, null, 2));
  const recoveredCandidates = await request('/api/admin/state', { headers: adminHeaders });
  assert.equal(recoveredCandidates.status, 200);
  assert.deepEqual(recoveredCandidates.body.currentPhase.candidates, [approvedId]);
  assert.equal(recoveredCandidates.body.decisionCandidates[0].id, approvedId);

  const vote = await post('/api/votes', { proposalId: approvedId, visitorId: 'test-visitor-1' });
  assert.equal(vote.status, 201);
  assert.equal(vote.body.proposals[0].voteCount, 1);
  assert.equal(vote.body.voting.hasVoted, true);

  const withdrawn = await post('/api/admin/phase/withdraw-voting', {}, adminHeaders);
  assert.equal(withdrawn.status, 200);
  assert.equal(withdrawn.body.currentPhase.status, 'submitting');
  assert.deepEqual(withdrawn.body.currentPhase.candidates, []);
  assert.equal(withdrawn.body.allProposals.find((proposal) => proposal.id === approvedId).status, 'pending');
  assert.equal(withdrawn.body.allProposals.find((proposal) => proposal.id === approvedId).voteCount, 0);
  assert.deepEqual(withdrawn.body.votes[withdrawn.body.currentPhase.id], {});

  const reopened = await post('/api/admin/proposals/review', {
    proposalId: approvedId,
    status: 'approved'
  }, adminHeaders);
  assert.equal(reopened.status, 200);
  const votingAgain = await post('/api/admin/phase/status', { status: 'voting' }, adminHeaders);
  assert.equal(votingAgain.status, 200);
  assert.deepEqual(votingAgain.body.currentPhase.candidates, [approvedId]);

  const votedState = await request('/api/state', { headers: { 'X-Visitor-Id': 'test-visitor-1' } });
  assert.equal(votedState.status, 200);
  assert.equal(votedState.body.voting.hasVoted, false);

  const secondVote = await post('/api/votes', { proposalId: approvedId, visitorId: 'test-visitor-1' });
  assert.equal(secondVote.status, 201);
  assert.equal(secondVote.body.proposals[0].voteCount, 1);

  const lockedReview = await post('/api/admin/proposals/review', {
    proposalId: approvedId,
    status: 'rejected'
  }, adminHeaders);
  assert.equal(lockedReview.status, 400);

  const duplicateVote = await post('/api/votes', { proposalId: approvedId, visitorId: 'test-visitor-1' });
  assert.equal(duplicateVote.status, 400);

  const decision = await post('/api/admin/decision', {
    proposalId: approvedId,
    note: '测试决定：进入执行阶段。'
  }, adminHeaders);
  assert.equal(decision.status, 200);
  assert.equal(decision.body.currentPhase.status, 'execution');
  assert.ok(decision.body.updates.some((update) => update.title.includes('自动测试提案 3')));

  const exported = await request('/api/admin/export', { headers: adminHeaders });
  assert.equal(exported.status, 200);
  assert.equal(exported.body.proposals.length, 1);

  const unauthorizedBackup = await request('/api/admin/backup');
  assert.equal(unauthorizedBackup.status, 401);

  const backup = await request('/api/admin/backup', { headers: adminHeaders });
  assert.equal(backup.status, 200);
  assert.match(backup.headers.get('content-disposition') || '', /^attachment; filename="flycode-backup-20\d\d-\d\d-\d\d\.json"$/);
  assert.equal(backup.body.format, 'flycode-backup');
  assert.equal(backup.body.version, 1);
  assert.ok(Number.isFinite(Date.parse(backup.body.exportedAt)));
  assert.equal(backup.body.exportedAt.endsWith('Z'), true);
  assert.equal(backup.body.data.proposals.length, 1);

  console.log('PASS: isolated Flycode smoke checks');
}

run()
  .catch((error) => {
    console.error(`FAIL: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopServer();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });
