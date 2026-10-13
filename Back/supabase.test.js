import test from 'node:test';
import assert from 'node:assert/strict';
import { createSupabaseStore } from './supabase.js';
test('Supabase: PNG privado, metadatos, sesión y colisión de reintento', async () => {
  const files=new Map();const rows=new Map();const sessions=new Map();let conflict=false;
  const request=async (input, options)=> {
    const url=new URL(input);const path=url.pathname;const method=options.method || 'GET';
    assert.equal(options.headers.apikey,'sb_secret_test');assert.equal(options.headers.Authorization,undefined);
    if(path.startsWith('/storage/v1/object/authenticated/posters/'))return new Response(files.get(path.split('/').at(-1)));
    if(path.startsWith('/storage/v1/object/posters/')) {assert.equal(options.headers['x-upsert'],'false');files.set(path.split('/').at(-1),options.body);return Response.json({});}
    if(path==='/storage/v1/object/posters' && method==='DELETE') {for(const name of JSON.parse(options.body).prefixes)files.delete(name);return Response.json({});}
    if(path==='/rest/v1/entregas') {
      if(method==='POST') {const row=JSON.parse(options.body);if(conflict || rows.has(row.id))return Response.json({}, {status:409});rows.set(row.id,row);return new Response(null,{status:201});}
      const id=url.searchParams.get('id')?.slice(3);return Response.json(id ? [...rows.values()].filter(row=>row.id===id) : [...rows.values()]);
    }
    if(path==='/rest/v1/sesiones_admin') {
      if(method==='POST') {const row=JSON.parse(options.body);sessions.set(row.token,row);return new Response(null,{status:201});}
      const token=url.searchParams.get('token')?.slice(3);
      if(method==='DELETE') {if(token)sessions.delete(token);return new Response(null,{status:204});}
      return Response.json([...sessions.values()].filter(row=>row.token===token && row.credencial===url.searchParams.get('credencial')?.slice(3)));
    }
    throw new Error(`Unexpected mock endpoint: ${path}`);
  };
  const store=createSupabaseStore({url:'https://test.supabase.co',key:'sb_secret_test',request});
  const row={id:'activity-1',participante:'P001',tema:'Agua',inicio:'2026-10-13T10:00:00.000Z',entrega:'2026-10-13T10:01:00.000Z',duracion_segundos:60};
  const saved=await store.save({...row},Buffer.from('png-fixture'));assert.equal(saved.created,true);
  assert.equal((await store.list()).length,1);assert.equal((await store.get(row.id)).participante,'P001');assert.equal((await store.png(saved.row)).toString(),'png-fixture');
  conflict=true;const retry=await store.save({...row},Buffer.from('other-fixture'));assert.equal(retry.created,false);assert.equal(files.size,1);assert.equal(retry.row.archivo,saved.row.archivo);
  await store.sessionSave('token',123,'credential');assert.equal((await store.sessionGet('token','credential')).vence,123);await store.sessionDelete('token');assert.equal(await store.sessionGet('token','credential'),undefined);
});
test('fallos remotos no confirman entregas ni eliminan un PNG con inserción incierta', async()=>{
  let deletes=0;
  const store=createSupabaseStore({url:'https://test.supabase.co',key:'sb_secret_test',request:async(path,options)=>{
    if(options.method==='DELETE')deletes++;
    if(path.includes('/storage/'))return Response.json({});
    throw new Error('connection lost');
  }});
  await assert.rejects(store.save({id:'1'},Buffer.from('fixture')));assert.equal(deletes,0);
  assert.throws(()=>createSupabaseStore({url:'http://insecure.example',key:'x'}));
});
