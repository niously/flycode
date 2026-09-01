const assert = require('assert/strict');

const releaseId = '0123456789abcdef0123456789abcdef01234567';
const adminKey = 'worker-d1-test-admin';

class MemoryD1Statement {
  constructor(database, query) {
    this.database = database;
    this.query = query;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    if (/^SELECT payload FROM flycode_state/i.test(this.query)) {
      return this.database.row ? { payload: this.database.row.payload } : null;
    }
    throw new Error(`Unsupported D1 first query: ${this.query}`);
  }

  async run() {
    if (/^INSERT INTO flycode_state/i.test(this.query)) {
      this.database.row = { id: this.values[0], payload: this.values[1], updatedAt: this.values[2] };
      return { success: true, meta: { rows_written: 1 } };
    }
    throw new Error(`Unsupported D1 run query: ${this.query}`);
  }
}

class MemoryD1 {
  constructor() {
    this.row = null;
  }

  prepare(query) {
    return new MemoryD1Statement(this, query);
  }
}

async function run() {
  const worker = await import('../worker-d1.mjs');
  const database = new MemoryD1();
  const env = {
    FLYCODE_DB: database,
    FLYCODE_ADMIN_KEY: adminKey,
    FLYCODE_RELEASE_ID: releaseId,
    ASSETS: {
      fetch: async () => new Response('<title>Flycode</title>', {
        headers: { 'content-type': 'text/html; charset=utf-8' }
      })
    }
  };

  const health = await worker.default.fetch(new Request('https://flycode.test/api/health'), env);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), {
    ok: true,
    service: 'flycode',
    storage: 'd1',
    release: releaseId
  });

  const initial = await worker.default.fetch(new Request('https://flycode.test/api/state'), env);
  assert.equal(initial.status, 200);
  const initialState = await initial.json();
  assert.equal(initialState.currentPhase.status, 'submitting');
  assert.equal(initialState.proposals.length, 0);

  const unauthorized = await worker.default.fetch(new Request('https://flycode.test/api/admin/state'), env);
  assert.equal(unauthorized.status, 401);

  const submitted = await worker.default.fetch(new Request('https://flycode.test/api/proposals', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'D1 测试提案', description: '这是用于验证 Cloudflare D1 状态写入的测试内容。' })
  }), env);
  assert.equal(submitted.status, 201);

  const admin = await worker.default.fetch(new Request('https://flycode.test/api/admin/state', {
    headers: { 'x-admin-key': adminKey }
  }), env);
  assert.equal(admin.status, 200);
  const adminState = await admin.json();
  assert.equal(adminState.allProposals.length, 1);
  assert.equal(adminState.allProposals[0].title, 'D1 测试提案');

  const proposalId = adminState.allProposals[0].id;
  const approved = await worker.default.fetch(new Request('https://flycode.test/api/admin/proposals/review', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({ proposalId, status: 'approved' })
  }), env);
  assert.equal(approved.status, 200);

  const voting = await worker.default.fetch(new Request('https://flycode.test/api/admin/phase/status', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({ status: 'voting' })
  }), env);
  assert.equal(voting.status, 200);
  assert.deepEqual((await voting.json()).currentPhase.candidates, [proposalId]);

  const vote = await worker.default.fetch(new Request('https://flycode.test/api/votes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ proposalId, visitorId: 'd1-test-visitor' })
  }), env);
  assert.equal(vote.status, 201);
  assert.equal((await vote.json()).proposals[0].voteCount, 1);

  const duplicateVote = await worker.default.fetch(new Request('https://flycode.test/api/votes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ proposalId, visitorId: 'd1-test-visitor' })
  }), env);
  assert.equal(duplicateVote.status, 400);

  const decision = await worker.default.fetch(new Request('https://flycode.test/api/admin/decision', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({ proposalId, note: 'D1 测试决定。' })
  }), env);
  assert.equal(decision.status, 200);
  assert.equal((await decision.json()).currentPhase.status, 'execution');

  const backup = await worker.default.fetch(new Request('https://flycode.test/api/admin/backup', {
    headers: { 'x-admin-key': adminKey }
  }), env);
  assert.equal(backup.status, 200);
  assert.equal((await backup.json()).format, 'flycode-backup');
  assert.match(backup.headers.get('content-disposition') || '', /flycode-backup-20\d\d-\d\d-\d\d\.json/);

  const archived = await worker.default.fetch(new Request('https://flycode.test/api/admin/phase/status', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({ status: 'archived' })
  }), env);
  assert.equal(archived.status, 200);

  const nextPhase = await worker.default.fetch(new Request('https://flycode.test/api/admin/phases', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-admin-key': adminKey },
    body: JSON.stringify({ title: 'D1 第二轮', question: '下一轮测试问题？' })
  }), env);
  assert.equal(nextPhase.status, 201);
  assert.equal((await nextPhase.json()).currentPhase.status, 'submitting');

  const exported = await worker.default.fetch(new Request('https://flycode.test/api/admin/export', {
    headers: { 'x-admin-key': adminKey }
  }), env);
  assert.equal(exported.status, 200);
  assert.equal((await exported.json()).proposals.length, 1);

  const staticPage = await worker.default.fetch(new Request('https://flycode.test/'), env);
  assert.equal(staticPage.status, 200);
  assert.match(await staticPage.text(), /Flycode/);

  console.log('PASS: Cloudflare Worker D1 checks');
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
