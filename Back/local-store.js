import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
export function createLocalStore(directory) {
  mkdirSync(join(directory, 'posters'), { recursive: true });
  const db = new Database(join(directory, 'entregas.sqlite'));
  db.pragma('journal_mode = WAL');
  db.exec(`CREATE TABLE IF NOT EXISTS entregas (id TEXT PRIMARY KEY, participante TEXT NOT NULL, tema TEXT NOT NULL, inicio TEXT NOT NULL, entrega TEXT NOT NULL, duracion_segundos INTEGER NOT NULL, archivo TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sesiones_admin (token TEXT PRIMARY KEY, vence INTEGER NOT NULL, credencial TEXT NOT NULL)`);
  return { db,
    get: id => db.prepare('SELECT * FROM entregas WHERE id = ?').get(id),
    list: () => db.prepare('SELECT * FROM entregas ORDER BY entrega DESC').all(),
    save(row, buffer) {
      const path = join(directory, 'posters', row.archivo);
      writeFileSync(path, buffer, { flag: 'wx' });
      try { db.prepare('INSERT INTO entregas VALUES (@id, @participante, @tema, @inicio, @entrega, @duracion_segundos, @archivo)').run(row); }
      catch(error) { unlinkSync(path); throw error; }
      return { row, created: true };
    },
    png: row => readFileSync(join(directory, 'posters', row.archivo)),
    sessionGet: (token, credential) => db.prepare('SELECT vence FROM sesiones_admin WHERE token = ? AND credencial = ?').get(token, credential),
    sessionSave: (token, expires, credential) => db.prepare('INSERT INTO sesiones_admin VALUES (?, ?, ?)').run(token, expires, credential),
    sessionDelete: token => db.prepare('DELETE FROM sesiones_admin WHERE token = ?').run(token),
    sessionClean: (now, credential) => db.prepare('DELETE FROM sesiones_admin WHERE vence < ? OR credencial != ?').run(now, credential),
  };
}
