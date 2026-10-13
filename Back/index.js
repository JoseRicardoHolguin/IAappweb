import express from 'express';
import Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import dotenv from 'dotenv';
import { installAdmin } from './admin.js';

const root = fileURLToPath(new URL('.', import.meta.url));
dotenv.config({ path: join(root, '.env'), quiet: true });
export function createApp(directory = process.env.DATA_DIR || join(root, 'data'), options = {}) {
  if ((options.production ?? process.env.NODE_ENV === 'production') && !process.env.DATA_DIR && !options.allowTemporaryData) throw new Error('Configura DATA_DIR con la ruta del disco persistente.');
  mkdirSync(join(directory, 'posters'), { recursive: true });
  const db = new Database(join(directory, 'entregas.sqlite'));
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS entregas (
    id TEXT PRIMARY KEY, participante TEXT NOT NULL, tema TEXT NOT NULL,
    inicio TEXT NOT NULL, entrega TEXT NOT NULL, duracion_segundos INTEGER NOT NULL,
    archivo TEXT NOT NULL
  )`);
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : false);
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'same-origin', 'X-Frame-Options': 'DENY' });
    next();
  });
  app.use(express.json({ limit: '12mb' }));
  const requireAdmin = installAdmin(app, db, options);
  app.get('/api/salud', (req, res) => res.json({ ok: true }));
  app.post('/api/entregas', (req, res) => {
    const { id, participante, tema, inicio, png } = req.body || {};
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id) || typeof participante !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(participante) || typeof tema !== 'string' || !tema.trim() || tema.length > 150 || typeof inicio !== 'string' || !Number.isFinite(Date.parse(inicio)) || Date.parse(inicio) > Date.now() || Date.now() - Date.parse(inicio) > 30 * 86400000) return res.status(400).json({ error: 'Revisa el código de participante, tema y fecha de inicio (máximo 30 días).' });
    if (typeof png !== 'string' || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(png)) return res.status(400).json({ error: 'Se requiere una imagen PNG válida.' });
    const buffer = Buffer.from(png.slice(22), 'base64');
    try { validatePng(buffer); } catch { return res.status(400).json({ error: 'El PNG está dañado, es demasiado grande o tiene dimensiones incorrectas.' }); }
    const existing = db.prepare('SELECT * FROM entregas WHERE id = ?').get(id);
    if (existing) {
      if (existing.participante !== participante || existing.tema !== tema || existing.inicio !== new Date(inicio).toISOString()) return res.status(409).json({ error: 'Esta actividad ya fue entregada con otros datos.' });
      return res.json(publicEntry(existing));
    }
    const entrega = new Date().toISOString();
    const archivo = `${randomUUID()}.png`;
    const row = { id, participante, tema: tema.trim(), inicio: new Date(inicio).toISOString(), entrega, duracion_segundos: Math.max(0, Math.round((Date.parse(entrega) - Date.parse(inicio)) / 1000)), archivo };
    const path = join(directory, 'posters', archivo);
    try {
      writeFileSync(path, buffer, { flag: 'wx' });
      db.prepare('INSERT INTO entregas VALUES (@id, @participante, @tema, @inicio, @entrega, @duracion_segundos, @archivo)').run(row);
    } catch (error) { try { unlinkSync(path); } catch { /* No file to clean up. */ } throw error; }
    res.status(201).json(publicEntry(row));
  });
  app.get('/api/entregas', requireAdmin, (req, res) => res.json(db.prepare('SELECT * FROM entregas ORDER BY entrega DESC').all().map(publicEntry)));
  app.get('/api/entregas/:id/png', requireAdmin, (req, res) => {
    const row = db.prepare('SELECT * FROM entregas WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Entrega no encontrada.' });
    res.download(resolve(directory, 'posters', row.archivo), `poster-${row.participante}.png`);
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  const frontend = resolve(root, '../Front/dist');
  app.use(express.static(frontend));
  app.get('/{*path}', (req, res) => res.sendFile(join(frontend, 'index.html')));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : 500;
    res.status(status).json({ error: status === 413 ? 'El PNG supera el límite permitido.' : status === 400 ? 'Solicitud inválida.' : 'No se pudo guardar o recuperar la entrega. Intenta nuevamente.' });
  });
  return { app, db };
}
function publicEntry({ archivo, ...row }) { return { ...row, pngUrl: `/api/entregas/${row.id}/png` }; }
export function validatePng(buffer) {
  if (buffer.length > 8 * 1024 * 1024 || buffer.length < 57 || buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG');
  let offset = 8; let header; let ended = false; const chunks = [];
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset); const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (offset + length + 12 > buffer.length || ended) throw new Error('Chunk');
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (crc32(buffer.subarray(offset + 4, offset + 8 + length)) !== buffer.readUInt32BE(offset + 8 + length)) throw new Error('CRC');
    if (offset === 8 && (type !== 'IHDR' || length !== 13)) throw new Error('Header');
    if (type === 'IHDR') { if (header) throw new Error('Header'); header = body; }
    if (type === 'IDAT') chunks.push(body);
    if (type === 'IEND') { if (length !== 0) throw new Error('End'); ended = true; }
    offset += length + 12;
  }
  if (!ended || offset !== buffer.length || !chunks.length || header.readUInt32BE(0) !== 1440 || header.readUInt32BE(4) !== 1920 || header[8] !== 8 || ![2,6].includes(header[9]) || header[10] !== 0 || header[11] !== 0 || header[12] !== 0) throw new Error('Dimensions');
  const rowBytes = 1440 * (header[9] === 6 ? 4 : 3) + 1;
  const raw = inflateSync(Buffer.concat(chunks), { maxOutputLength: rowBytes * 1920 });
  if (raw.length !== rowBytes * 1920) throw new Error('Pixels');
  for (let y = 0; y < 1920; y++) if (raw[y * rowBytes] > 4) throw new Error('Filter');
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { app } = createApp();
  const port = Number(process.env.PORT || 3000);
  const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
  app.listen(port, host, () => console.log(`Servidor en puerto ${port}`));
}
