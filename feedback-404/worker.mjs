import { site } from '../src/data/site.ts';

const maxBytes = 4096;
const windowMs = 15 * 60 * 1000;

function reportUrl(value) {
  if (typeof value !== 'string' || value.length > 1600) return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol)) return null;
    // Drop credentials, query and fragment. Mask common secrets embedded in path segments.
    const segments = url.pathname.split('/');
    const sensitive = /^(?:token|secret|password|code|session|reset|invite|api[-_]?key)$/i;
    const path = segments.map((segment, index) => {
      const decoded = decodeURIComponent(segment);
      const previous = decodeURIComponent(segments[index - 1] ?? '');
      return /[@=]|^[\w-]{32,}$/.test(decoded) || (decoded && sensitive.test(previous)) ? '[redacted]' : segment;
    }).join('/');
    return url.origin + path;
  } catch { return null; }
}

async function rateKey(secret, address, bucket) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(bucket + ':' + address));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function browserDetails(agent) {
  const match = agent.match(/(?:EdgA?|EdgiOS|OPR|SamsungBrowser|Firefox|FxiOS|Chrome|CriOS|Version)\/\d+/g)?.at(-1);
  const browser = match?.replace(/^Version\//, 'Safari/').replace(/^CriOS\//, 'Chrome/').replace(/^FxiOS\//, 'Firefox/') ?? 'Unknown';
  const device = /iPad|Tablet|Android(?!.*Mobile)/i.test(agent) ? 'tablet' : /Mobile|iPhone/i.test(agent) ? 'mobile' : 'desktop';
  return { browser, device };
}

async function sendNotifications(env, report) {
  const summary = `报告编号：${report.id}\n异常页面：${report.url}\n发生时间：${report.time}`;
  const details = `${summary}\n来源页面：${report.referrer || '无'}\n浏览器与设备：${report.browser} / ${report.device}\n报告详情：HTTP 404，屏幕 ${report.screen}`;
  const send = async (channel, configured, endpoint, headers, body, accepted) => {
    let status = 'unconfigured';
    if (configured) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
        });
        status = response.ok && await accepted(response) ? 'accepted' : 'failed';
      } catch { status = 'failed'; }
    }
    const sql = channel === 'email'
      ? 'UPDATE reports SET email_status = ? WHERE id = ?'
      : 'UPDATE reports SET wechat_status = ? WHERE id = ?';
    await env.REPORTS.prepare(sql).bind(status, report.id).run();
  };
  await Promise.allSettled([
    send('email', env.RESEND_API_KEY && env.RESEND_FROM, 'https://api.resend.com/emails',
      { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Idempotency-Key': report.id },
      { from: env.RESEND_FROM, to: [site.email], subject: '[Keyin.li 404 Alert] 新的页面异常反馈', text: details },
      async response => Boolean((await response.json()).id)),
    send('wechat', env.WXPUSHER_APP_TOKEN && env.WXPUSHER_UID, 'https://wxpusher.zjiecode.com/api/send/message', {},
      { appToken: env.WXPUSHER_APP_TOKEN, uids: [env.WXPUSHER_UID], contentType: 1, content: summary, summary: 'Keyin.li 404 Alert' },
      async response => { const data = await response.json(); return data.code === 1000 && data.data?.some(item => item.code === 1000); }),
  ]);
}

export default {
  async fetch(request, env, context) {
    const origin = request.headers.get('Origin');
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim());
    const headers = { 'Cache-Control': 'no-store', Vary: 'Origin' };
    const json = (status, body, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
    if (new URL(request.url).pathname !== '/report') return json(404, { error: 'not_found' });
    if (!origin || !allowed.includes(origin)) return json(403, { error: 'origin' });
    headers['Access-Control-Allow-Origin'] = origin;
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...headers,
        'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }
    if (request.method !== 'POST') return json(405, { error: 'method' }, { Allow: 'POST, OPTIONS' });
    if (!env.REPORTS || !env.RATE_LIMIT_SECRET) return json(503, { error: 'unavailable' });
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') ?? '')) return json(415, { error: 'content_type' });
    if (Number(request.headers.get('Content-Length')) > maxBytes) return json(413, { error: 'body_size' });
    let input;
    try {
      const reader = request.body.getReader();
      const decoder = new TextDecoder();
      let bytes = 0;
      let text = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > maxBytes) { await reader.cancel(); return json(413, { error: 'body_size' }); }
        text += decoder.decode(value, { stream: true });
      }
      input = JSON.parse(text + decoder.decode());
    } catch { return json(400, { error: 'json' }); }
    const url = reportUrl(input?.url);
    if (!url || new URL(url).origin !== origin || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(input.requestId ?? '')) {
      return json(400, { error: 'input' });
    }
    const now = Date.now();
    const bucket = Math.floor(now / windowMs);
    const signature = await rateKey(env.RATE_LIMIT_SECRET, request.headers.get('CF-Connecting-IP') ?? 'unknown', bucket);
    const { browser, device } = browserDetails(request.headers.get('User-Agent') ?? '');
    const dimensions = input.screen;
    const report = {
      id: '404-' + new Date(now).toISOString().slice(0, 10).replaceAll('-', '') + '-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
      url, referrer: reportUrl(input.referrer),
      time: new Date(now).toISOString(), browser, device,
      screen: Array.isArray(dimensions) && dimensions.length === 2 && dimensions.every(n => Number.isInteger(n) && n > 0 && n <= 16384)
        ? dimensions.join(' × ') : 'Unknown',
    };
    try {
      const [insert] = await env.REPORTS.batch([
        env.REPORTS.prepare(`INSERT INTO reports
          (id, request_id, url, referrer, occurred_at, browser, device, screen)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?
          WHERE (SELECT count FROM rate_limits WHERE signature = ?) IS NULL
             OR (SELECT count FROM rate_limits WHERE signature = ?) < 5
          ON CONFLICT(request_id) DO NOTHING`).bind(
          report.id, input.requestId, report.url, report.referrer, report.time, report.browser, report.device, report.screen, signature, signature),
        env.REPORTS.prepare(`INSERT INTO rate_limits (signature, bucket, count)
          SELECT ?, ?, 1 WHERE changes() = 1
          ON CONFLICT(signature) DO UPDATE SET count = count + 1`).bind(signature, bucket),
        env.REPORTS.prepare('DELETE FROM rate_limits WHERE bucket < ?').bind(bucket - 1),
      ]);
      if (insert.meta.changes === 1) {
        context.waitUntil(sendNotifications(env, report));
        return json(201, { id: report.id });
      }
      const existing = await env.REPORTS.prepare('SELECT id FROM reports WHERE request_id = ? AND url = ?').bind(input.requestId, report.url).first();
      if (existing) return json(200, { id: existing.id });
      return json(429, { error: 'rate_limit' }, { 'Retry-After': String(Math.ceil(((bucket + 1) * windowMs - now) / 1000)) });
    } catch {
      return json(503, { error: 'unavailable' });
    }
  },
};
