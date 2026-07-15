/**
 * In-memory HTTP harness: drives the Express app via app.handle() with mock
 * req/res objects. No socket is bound, so this runs under sandboxes that block
 * listen(). Mirrors what a real request would exercise: routing, middleware
 * (json body parse, cors), handlers, and status/JSON responses.
 */
const { Readable, Duplex } = require('stream');

// A no-op duplex that satisfies http's expectations for req.socket (it calls
// socket.destroy() during teardown).
function fakeSocket() {
  const s = new Duplex({ read() {}, write(_c, _e, cb) { cb(); } });
  s.remoteAddress = '127.0.0.1';
  s.encrypted = false;
  s.setTimeout = () => {};
  s.setKeepAlive = () => {};
  s.setNoDelay = () => {};
  return s;
}

function inject(app, { method = 'GET', url = '/', body = null, query = null }) {
  return new Promise((resolve, reject) => {
    let fullUrl = url;
    if (query) {
      const qs = new URLSearchParams(query).toString();
      fullUrl += (url.includes('?') ? '&' : '?') + qs;
    }
    const payload = body != null ? Buffer.from(JSON.stringify(body)) : null;

    // Build a minimal IncomingMessage-like readable.
    const req = new Readable({ read() {} });
    req.method = method;
    req.url = fullUrl;
    req.headers = { host: 'localhost', 'content-type': 'application/json' };
    if (payload) {
      req.headers['content-length'] = String(payload.length);
      req.push(payload);
    }
    req.push(null);
    const sock = fakeSocket();
    req.connection = sock;
    req.socket = sock;

    // Minimal ServerResponse-like writable.
    const chunks = [];
    const res = {
      statusCode: 200,
      _headers: {},
      setHeader(k, v) { this._headers[k.toLowerCase()] = v; },
      getHeader(k) { return this._headers[k.toLowerCase()]; },
      removeHeader(k) { delete this._headers[k.toLowerCase()]; },
      writeHead(code, headers) { this.statusCode = code; if (headers) Object.assign(this._headers, headers); },
      write(c) { if (c) chunks.push(Buffer.from(c)); return true; },
      end(c) {
        if (c) chunks.push(Buffer.from(c));
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch { /* non-json */ }
        resolve({ status: this.statusCode, body: json, text });
      },
      on() {}, once() {}, emit() {}, headersSent: false,
    };

    try { app.handle(req, res); } catch (e) { reject(e); }
  });
}

module.exports = { inject };
