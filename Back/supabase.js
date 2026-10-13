import { randomUUID } from 'node:crypto';
export function createSupabaseStore({ url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SECRET_KEY, bucket = process.env.SUPABASE_BUCKET || 'posters', request = fetch } = {}) {
  if (!url || !key) throw new Error('Configura SUPABASE_URL y SUPABASE_SECRET_KEY en el servidor.');
  if (key.startsWith('sb_publishable_')) throw new Error('Usa la clave secreta de Supabase, no la publishable.');
  const base = new URL(url);
  if (base.protocol !== 'https:') throw new Error('SUPABASE_URL debe usar HTTPS.');
  const headers = { apikey: key };
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  async function api(path, options = {}, binary = false) {
    const response = await request(`${base.origin}${path}`, { ...options, signal: AbortSignal.timeout(20000), headers: { ...headers, ...options.headers } });
    if (!response.ok) { const error = new Error('No se pudo acceder al almacenamiento de Supabase.'); error.status = response.status; throw error; }
    if (binary) return Buffer.from(await response.arrayBuffer());
    if (response.status === 204) return null;
    const text = await response.text(); return text ? JSON.parse(text) : null;
  }
  const filter = value => encodeURIComponent(value);
  const table = name => `/rest/v1/${name}`;
  const get = async id => (await api(`${table('entregas')}?id=eq.${filter(id)}&limit=1`))[0];
  return {
    async get(id) { return get(id); },
    async list() {
      const rows = [];
      for (let offset = 0; ; offset += 1000) {
        const page = await api(`${table('entregas')}?order=entrega.desc,id.asc&limit=1000&offset=${offset}`);
        rows.push(...page);
        if (page.length < 1000) return rows;
      }
    },
    async save(row, buffer) {
      row.archivo = `${randomUUID()}.png`;
      await api(`/storage/v1/object/${filter(bucket)}/${row.archivo}`, { method: 'POST', headers: { 'Content-Type': 'image/png', 'x-upsert': 'false' }, body: buffer });
      try {
        await api(table('entregas'), { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify(row) });
        return { row, created: true };
      } catch (error) {
        // A lost response may follow a committed insert. Keep the PNG until the outcome is known.
        if (error.status === 409) {
          const existing = await get(row.id);
          if (existing) {
            await api(`/storage/v1/object/${filter(bucket)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [row.archivo] }) }).catch(() => {});
            return { row: existing, created: false };
          }
        }
        throw error;
      }
    },
    async png(row) { return api(`/storage/v1/object/authenticated/${filter(bucket)}/${row.archivo}`, {}, true); },
    async sessionGet(token, credential) { return (await api(`${table('sesiones_admin')}?token=eq.${filter(token)}&credencial=eq.${filter(credential)}&limit=1`))[0]; },
    async sessionSave(token, expires, credential) { await api(table('sesiones_admin'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, vence: expires, credencial: credential }) }); },
    async sessionDelete(token) { await api(`${table('sesiones_admin')}?token=eq.${filter(token)}`, { method: 'DELETE' }); },
    async sessionClean(now, credential) { await api(`${table('sesiones_admin')}?or=(vence.lt.${now},credencial.neq.${filter(credential)})`, { method: 'DELETE' }); },
  };
}
