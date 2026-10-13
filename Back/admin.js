import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export function isAllowedOrigin(requestOrigin, configuredOrigin, production) {
  if (!requestOrigin || requestOrigin === 'null') return false;
  if (requestOrigin === configuredOrigin) return true;
  if (production) return false;
  try {
    const url = new URL(requestOrigin);
    const port = Number(url.port);
    return url.origin === requestOrigin && url.protocol === 'http:' &&
      ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) &&
      (port === 3000 || (port >= 5173 && port <= 5190));
  } catch { return false; }
}
export function installAdmin(app, store, { password = process.env.ADMIN_PASSWORD, origin = process.env.APP_ORIGIN, production = process.env.NODE_ENV === 'production' } = {}) {
  if (password && (password.length < 12 || password.length > 200)) throw new Error('ADMIN_PASSWORD debe tener entre 12 y 200 caracteres.');
  if (production && (!password || !origin || !origin.startsWith('https://'))) throw new Error('Configura ADMIN_PASSWORD y APP_ORIGIN con HTTPS antes de publicar.');
  const salt = randomBytes(16);
  const hash = password ? scryptSync(password, salt, 64) : null;
  const credentialId = password ? scryptSync(password, 'poster-admin-session-version', 64).toString('hex') : '';
  const attempts = new Map();
  const digest = token => createHash('sha256').update(token).digest('hex');
  const token = req => (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith('poster_admin='))?.slice(13) || '';
  const cookie = { httpOnly: true, sameSite: 'strict', secure: production, path: '/api', maxAge: 8 * 3600000 };
  function sameOrigin(req, res, next) {
    if (!isAllowedOrigin(req.headers.origin, origin, production)) return res.status(403).json({ error: 'Origen de solicitud no permitido.' });
    next();
  }
  async function requireAdmin(req, res, next) {
    res.set('Cache-Control', 'no-store');
    if (!hash || !token(req)) return res.status(401).json({ error: 'Inicia sesión como administrador.' });
    const row = await store.sessionGet(digest(token(req)), credentialId);
    if (!hash || !row || row.vence <= Date.now()) return res.status(401).json({ error: 'Inicia sesión como administrador.' });
    next();
  }
  app.post('/api/admin/login', sameOrigin, async (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!hash) return res.status(503).json({ error: 'Configura ADMIN_PASSWORD en Back/.env para activar el acceso de administrador.' });
    const now = Date.now(); const key = req.ip;
    for (const [address, value] of attempts) if (value.reset <= now) attempts.delete(address);
    const record = attempts.get(key) || { count: 0, reset: now + 15 * 60000 };
    if (record.count >= 10) return res.status(429).json({ error: 'Demasiados intentos. Espera 15 minutos.' });
    const input = req.body?.password;
    if (typeof input !== 'string' || input.length > 200 || !timingSafeEqual(scryptSync(input, salt, 64), hash)) {
      record.count++; attempts.set(key, record); return res.status(401).json({ error: 'Contraseña incorrecta.' });
    }
    attempts.delete(key);
    await store.sessionClean(now, credentialId);
    const session = randomBytes(32).toString('hex');
    await store.sessionSave(digest(session), now + cookie.maxAge, credentialId);
    res.cookie('poster_admin', session, cookie).json({ ok: true });
  });
  app.get('/api/admin/session', requireAdmin, (req, res) => res.json({ ok: true }));
  app.post('/api/admin/logout', sameOrigin, async (req, res) => {
    await store.sessionDelete(digest(token(req)));
    res.clearCookie('poster_admin', { ...cookie, maxAge: undefined }).json({ ok: true });
  });
  return requireAdmin;
}

