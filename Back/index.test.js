import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createApp } from './index.js';
import { isAllowedOrigin } from './admin.js';
test('orígenes locales de Vite y origen exacto en producción', () => {
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5174', 'http://[::1]:5173']) {
    assert.equal(isAllowedOrigin(origin, 'http://127.0.0.1:5173', false), true);
    assert.equal(isAllowedOrigin(origin, 'https://poster.example', true), false);
  }
  for (const origin of [undefined, 'null', 'https://evil.example', 'http://localhost.evil.example:5173', 'http://localhost:5173/evil', 'http://192.168.1.5:5173']) {
    assert.equal(isAllowedOrigin(origin, 'http://127.0.0.1:5173', false), false);
  }
  assert.equal(isAllowedOrigin('https://poster.example', 'https://poster.example', true), true);
  assert.equal(isAllowedOrigin('https://poster.example.evil.example', 'https://poster.example', true), false);
});
function crc(bytes) { let value = 0xffffffff; for (const byte of bytes) { value ^= byte; for (let i=0;i<8;i++) value=(value>>>1)^(0xedb88320 & -(value&1)); } return (value^0xffffffff)>>>0; }
function chunk(type, body) { const bytes = Buffer.concat([Buffer.from(type), body]); const header=Buffer.alloc(4); header.writeUInt32BE(body.length); const end=Buffer.alloc(4);end.writeUInt32BE(crc(bytes)); return Buffer.concat([header,bytes,end]); }
function image() { const header=Buffer.alloc(13); header.writeUInt32BE(1440);header.writeUInt32BE(1920,4);header[8]=8;header[9]=6;return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.alloc((1440*4+1)*1920))),chunk('IEND',Buffer.alloc(0))]); }
test('entrega, reintento, validación, descarga y persistencia', async () => {
  const directory=mkdtempSync(join(tmpdir(),'poster-test-'));
  const relativePath = relative(resolve(tmpdir()), resolve(directory));
  assert.ok(!isAbsolute(relativePath) && !relativePath.startsWith('..') && relativePath.startsWith('poster-test-'));
  let db; let server;
  try {
    let service=createApp(directory, { password: 'test-only-password-1234', origin: 'http://127.0.0.1:5173', production: false }); db=service.db;
    server=service.app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
    let base=`http://127.0.0.1:${server.address().port}`;
    const png=image(); const payload={id:'d9dd3acb-7ff0-4a8d-9650-005b494ac27a',participante:'P001',tema:'Agua',inicio:new Date(Date.now()-60000).toISOString(),png:`data:image/png;base64,${png.toString('base64')}`};
    const post=body=>fetch(`${base}/api/entregas`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    let response=await post(payload);assert.equal(response.status,201);const receipt=await response.json(); assert.ok(receipt.duracion_segundos>=60);
    response=await post(payload);assert.equal(response.status,200);assert.equal((await response.json()).entrega,receipt.entrega);
    assert.equal((await post({...payload,participante:'P002'})).status,409);
    assert.equal((await post({...payload,participante:'../bad'})).status,400);
    assert.equal((await post({...payload,inicio:'bad'})).status,400);
    assert.equal((await post({...payload,inicio:new Date(Date.now()+3600000).toISOString()})).status,400);
    assert.equal((await post({...payload,png:'data:image/png;base64,YmFk'})).status,400);
    const corrupt=Buffer.from(png);corrupt[20]^=1;assert.equal((await post({...payload,png:`data:image/png;base64,${corrupt.toString('base64')}`})).status,400);
    assert.equal((await fetch(`${base}/api/entregas`)).status,401);
    assert.equal((await fetch(`${base}${receipt.pngUrl}`)).status,401);
    const login = (password, origin='http://127.0.0.1:5173') => fetch(`${base}/api/admin/login`, {method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({password})});
    assert.equal((await login('wrong')).status,401);
    assert.equal((await login('test-only-password-1234','https://evil.example')).status,403);
    response=await login('test-only-password-1234');assert.equal(response.status,200);
    const cookie=response.headers.get('set-cookie').split(';')[0];
    assert.match(response.headers.get('set-cookie'),/HttpOnly/i);assert.match(response.headers.get('set-cookie'),/SameSite=Strict/i);
    const adminGet=path=>fetch(`${base}${path}`,{headers:{Cookie:cookie}});
    response=await adminGet(receipt.pngUrl);assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),png);
    assert.equal((await adminGet('/api/entregas/missing/png')).status,404);
    assert.equal((await (await adminGet('/api/entregas')).json()).length,1);
    assert.equal((await fetch(`${base}/api/admin/logout`,{method:'POST',headers:{Cookie:cookie,Origin:'https://evil.example'}})).status,403);
    assert.equal((await adminGet('/api/admin/session')).status,200);
    response=await fetch(`${base}/api/admin/logout`,{method:'POST',headers:{Cookie:cookie,Origin:'http://127.0.0.1:5173'}});assert.equal(response.status,200);
    assert.equal((await adminGet('/api/entregas')).status,401);
    for(let i=0;i<10;i++) assert.equal((await login('wrong')).status,401);
    assert.equal((await login('test-only-password-1234')).status,429);
    assert.equal((await fetch(`${base}/api/not-real`)).status,404);
    const page=await fetch(base);assert.equal(page.status,200);assert.match(await page.text(),/Póster Lab/);
    await new Promise(resolve=>server.close(resolve));server=null;db.close();db=null;
    service=createApp(directory, { password: 'test-only-password-1234', origin: 'http://127.0.0.1:5173', production: false });db=service.db;assert.equal(db.prepare('SELECT COUNT(*) AS count FROM entregas').get().count,1);
  } finally { if(server) await new Promise(resolve=>server.close(resolve));if(db)db.close();rmSync(directory,{recursive:true,force:true}); }
});


test('sesiones sobreviven reinicios, expiran y se invalidan al cambiar contraseña', async () => {
  const directory=mkdtempSync(join(tmpdir(),'poster-test-'));
  const relativePath=relative(resolve(tmpdir()),resolve(directory));
  assert.ok(!isAbsolute(relativePath) && !relativePath.startsWith('..') && relativePath.startsWith('poster-test-'));
  let db;let server;
  const origin='http://127.0.0.1:5173';
  async function start(password) {
    const service=createApp(directory,{password,origin,production:false});db=service.db;
    server=service.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    return `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() {await new Promise(resolve=>server.close(resolve));server=null;db.close();db=null;}
  try {
    let base=await start('another-test-password');
    let response=await fetch(`${base}/api/admin/login`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({password:'another-test-password'})});
    assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
    await stop();base=await start('another-test-password');
    assert.equal((await fetch(`${base}/api/admin/session`,{headers:{Cookie:cookie}})).status,200);
    db.prepare('UPDATE sesiones_admin SET vence = 0').run();
    assert.equal((await fetch(`${base}/api/entregas`,{headers:{Cookie:cookie}})).status,401);
    await stop();base=await start('new-test-password-123');
    assert.equal((await fetch(`${base}/api/admin/session`,{headers:{Cookie:cookie}})).status,401);
    await stop();base=await start('');
    assert.equal((await fetch(`${base}/api/entregas`)).status,401);
    assert.equal((await fetch(`${base}/api/admin/login`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{"password":"anything"}'})).status,503);
  } finally {if(server)await new Promise(resolve=>server.close(resolve));if(db)db.close();rmSync(directory,{recursive:true,force:true});}
});
