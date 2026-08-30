const assert = require('assert/strict');

async function run() {
  const worker = await import('../worker.mjs');
  const calls = [];
  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    calls.push({ input: String(input), init });
    return new Response('proxied', { status: 200, headers: { 'content-type': 'text/plain' } });
  };

  try {
    const request = new Request('https://flycode.example.workers.dev/api/admin/state?x=1', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-admin-key': 'test-admin'
      },
      body: '{"ok":true}'
    });
    const response = await worker.default.fetch(request, {
      BACKEND_ORIGIN: 'https://backend.example.com'
    });

    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'proxied');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].input, 'https://backend.example.com/api/admin/state?x=1');
    assert.equal(calls[0].init.method, 'POST');
    assert.equal(await new Response(calls[0].init.body).text(), '{"ok":true}');
    assert.equal(calls[0].init.headers.get('x-admin-key'), 'test-admin');
    assert.equal(calls[0].init.headers.get('content-type'), 'application/json');
    assert.equal(calls[0].init.headers.get('sec-fetch-mode'), null);
    assert.equal(calls[0].init.headers.get('sec-fetch-dest'), null);

    console.log('PASS: Cloudflare Worker proxy checks');
  } finally {
    global.fetch = originalFetch;
  }
}

run().catch((error) => {
  console.error(`FAIL: ${error.message}`);
  process.exitCode = 1;
});
