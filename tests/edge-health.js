const assert = require('assert/strict');

async function run() {
  const worker = await import('../worker.mjs');
  const originalFetch = global.fetch;
  global.fetch = async () => {
    throw new Error('backend should not be called for local health');
  };

  try {
    const response = await worker.default.fetch(
      new Request('https://flycode.ccgo.workers.dev/__health'),
      { BACKEND_ORIGIN: 'https://backend.example.com' }
    );
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true, service: 'flycode-edge' });
    console.log('PASS: edge health checks');
  } finally {
    global.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
