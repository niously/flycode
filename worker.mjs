const DEFAULT_BACKEND_ORIGIN = 'https://flycode-305260-9-1465609042.sh.run.tcloudbase.com';

function jsonError(message, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    const origin = String(env.BACKEND_ORIGIN || DEFAULT_BACKEND_ORIGIN).replace(/\/$/, '');
    let incomingUrl;
    try {
      incomingUrl = new URL(request.url);
    } catch {
      return jsonError('请求地址无效。', 400);
    }

    if (incomingUrl.pathname === '/__health') {
      return new Response(JSON.stringify({ ok: true, service: 'flycode-edge' }), {
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
      });
    }

    const targetUrl = `${origin}${incomingUrl.pathname}${incomingUrl.search}`;
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('sec-fetch-mode');
    headers.delete('sec-fetch-dest');
    headers.delete('sec-fetch-site');
    headers.delete('sec-fetch-user');
    headers.set('x-forwarded-host', incomingUrl.host);

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual'
      });
      const responseHeaders = new Headers(response.headers);
      responseHeaders.set('cache-control', 'no-store');
      // 覆盖 CloudBase 添加的 Content-Disposition: attachment
      if (responseHeaders.has('content-disposition')) {
        const disposition = responseHeaders.get('content-disposition');
        if (disposition === 'attachment') {
          responseHeaders.set('content-disposition', 'inline');
        }
      }
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });
    } catch {
      return jsonError('后端服务暂时不可用，请稍后再试。', 502);
    }
  }
};
