import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, utimes } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { chatGPTService } from '../companion/chatgpt.mjs';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test', alg: 'RS256', use: 'sig' };
function jwt(claims) { const head = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test' })).toString('base64url'); const body = Buffer.from(JSON.stringify(claims)).toString('base64url'); return `${head}.${body}.${sign('sha256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url')}`; }
async function fixture(t, options = {}) {
 const home = await mkdtemp(join(tmpdir(), 'sessiontv-chatgpt-')); const requests = []; let auth, refreshes = 0;
 const fetchImpl = async (address, init = {}) => {
  const url = String(address); requests.push({ url, init });
  if (url.endsWith('/jwks.json')) return Response.json({ keys: [jwk] });
  if (url.endsWith('/openid-configuration')) return Response.json({ revocation_endpoint: 'https://auth.openai.com/revoke' });
  if (url.endsWith('/revoke')) return new Response('', { status: 200 });
  if (url.endsWith('/oauth/token')) {
   const body = new URLSearchParams(init.body);
   if (body.get('grant_type') === 'refresh_token') { refreshes++; if (options.refreshFailure) return Response.json({ error: options.refreshFailure }, { status: 400 }); return Response.json({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'Bearer', expires_in: 3600, scope: 'chatgpt.tokens.use.direct' }); }
   assert.equal(body.get('client_id'), 'oaiapp_test'); assert.equal(body.get('redirect_uri'), auth.searchParams.get('redirect_uri'));
   assert.equal(createHash('sha256').update(body.get('code_verifier')).digest('base64url'), auth.searchParams.get('code_challenge'));
   const now = Math.floor(Date.now()/1000);
   const claims = { iss: 'https://auth.openai.com', aud: 'oaiapp_test', sub: 'test-user', email: 'test@example.com', iat: now, exp: now + 3600, nonce: auth.searchParams.get('nonce'), ...options.claims };
   return Response.json({ access_token: 'secret-access', refresh_token: 'secret-refresh', id_token: options.invalidSignature ? jwt(claims).replace(/.(.)$/, (pair, last) => (pair[0] === 'A' ? 'B' : 'A') + last) : jwt(claims), token_type: 'Bearer', expires_in: 3600, scope: options.scope ?? 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct' });
  }
  if (url.endsWith('/models')) return Response.json({ models: [{ slug: 'current', display_name: 'Current model', visibility: 'list' }, { slug: 'hidden', visibility: 'hidden' }] });
  if (url.endsWith('/responses')) { if (options.httpFailure) return Response.json({ error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'secret-access' } }, { status: 429 }); const events = options.events || [{ type: 'response.output_text.delta', delta: '**Hello**' }, { type: 'response.completed' }]; return new Response(events.map(e => `data: ${JSON.stringify(e)}\r\n\r\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } }); }
  throw new Error('Unexpected mock request');
 };
 const service = chatGPTService({ home, fetchImpl });
 t.after(async () => { await service.disconnect(); await rm(home, { recursive: true, force: true }); });
 async function begin() { auth = new URL((await service.begin()).authorizationUrl); return auth; }
 async function connect(modify) { await begin(); const callback = new URL(auth.searchParams.get('redirect_uri')); callback.search = new URLSearchParams({ state: auth.searchParams.get('state'), code: 'mock-code', client_id: 'oaiapp_test' }); if (modify) modify(callback); return fetch(callback); }
 return { home, service, requests, begin, connect, refreshes: () => refreshes };
}
test('lazy disconnected status does not write and loopback OAuth protects PKCE and issued client', async t => {
 const f = await fixture(t); assert.equal((await f.service.status()).connected, false);
 const callback = await f.connect(); assert.equal(callback.status, 200);
 const state = await f.service.status(); assert.equal(state.connected, true); assert.equal(state.account.email, 'test@example.com'); assert(!JSON.stringify(state).includes('secret-'));
 const record = JSON.parse(await readFile(join(f.home, 'chatgpt/connection.json'), 'utf8')); assert.match(record.ext_agent_host_id, /^urn:uuid:/); assert.equal(record.client_id, 'oaiapp_test');
 const auth = await f.begin(); assert.equal(auth.searchParams.get('client_id'), 'oaiapp_test'); assert.equal(auth.searchParams.has('id_token_hint'), false); assert.equal(auth.searchParams.has('agent_name_hint'), false); assert.equal(auth.searchParams.get('ext_agent_host_id'), record.ext_agent_host_id);
});
test('invalid OAuth state and issued client cannot exchange code', async t => {
 const f = await fixture(t); assert.equal((await f.connect(url => url.searchParams.set('state', 'wrong'))).status, 400); assert(!f.requests.some(r => r.url.endsWith('/oauth/token')));
 assert.equal((await f.connect(url => url.searchParams.set('client_id', 'dynamic_agent_client'))).status, 400); assert.equal((await f.service.status()).connected, false);
});
for (const [name, claims] of [['issuer', { iss: 'https://evil.example' }], ['audience', { aud: 'oaiapp_other' }], ['expiry', { exp: 1 }], ['nonce', { nonce: 'wrong' }]]) test(`verified ID token rejects incorrect ${name}`, async t => {
 const f = await fixture(t, { claims }); assert.equal((await f.connect()).status, 400); assert.equal((await f.service.status()).connected, false);
});
test('identity-only grant stays signed in but cannot infer', async t => {
 const f = await fixture(t, { scope: 'openid email' }); await f.connect(); const status = await f.service.status(); assert.equal(status.planUsageEnabled, false); assert.equal(status.account.email, 'test@example.com'); await assert.rejects(f.service.models(), /allow ChatGPT plan/);
});
test('catalog respects visibility and SSE uses public no-store streamed text-only inference', async t => {
 const f = await fixture(t); await f.connect(); assert.deepEqual(await f.service.models(), [{ id: 'current', displayName: 'Current model' }]); const events = [];
 assert.deepEqual(await f.service.run({ model: 'current', effort: 'low', messages: [{ role: 'system', content: 'Be helpful' }, { role: 'user', content: 'Hi' }], onEvent: event => events.push(event) }), { text: '**Hello**', model: 'current' });
 const request = f.requests.find(r => r.url.endsWith('/responses')); const body = JSON.parse(request.init.body); assert.equal(body.store, false); assert.equal(body.stream, true); assert.equal(body.input[0].role, 'developer'); assert.equal(body.reasoning.effort, 'low'); assert.equal(events.length, 2);
});
test('stream failures, incomplete streams and admission failures never look successful or expose secrets', async t => {
 for (const options of [{ events: [{ type: 'response.output_text.delta', delta: 'partial' }] }, { events: [{ type: 'response.failed', response: { error: { code: 'subscription_sharing_usage_limit_exceeded', message: 'secret-access' } } }] }, { httpFailure: true }]) {
  const f = await fixture(t, options); await f.connect(); await assert.rejects(f.service.run({ model: 'current', messages: [{ role: 'user', content: 'Hi' }] }), error => !error.message.includes('secret-access'));
 }
});
test('refresh rotates atomically and simultaneous requests use one renewal', async t => {
 const f = await fixture(t); await f.connect(); const path = join(f.home, 'chatgpt/connection.json'); const record = JSON.parse(await readFile(path, 'utf8')); record.expires_at = 1; await writeFile(path, JSON.stringify(record));
 await Promise.all([f.service.models(), f.service.models()]); assert.equal(f.refreshes(), 1); const renewed = JSON.parse(await readFile(path, 'utf8')); assert.equal(renewed.refresh_token, 'new-refresh'); assert.equal(renewed.access_token, 'new-access');
 const disconnected = await f.service.disconnect(); assert.equal(disconnected.revoked, true); const retained = JSON.parse(await readFile(path, 'utf8')); assert.equal(retained.client_id, 'oaiapp_test'); assert.equal(retained.refresh_token, undefined);
});
test('terminal refresh clears unusable tokens and preserves registration', async t => {
 const f = await fixture(t, { refreshFailure: 'invalid_grant' }); await f.connect(); const path = join(f.home, 'chatgpt/connection.json'); const record = JSON.parse(await readFile(path, 'utf8')); record.expires_at = 1; await writeFile(path, JSON.stringify(record)); await assert.rejects(f.service.models(), /invalid_grant/); const saved = JSON.parse(await readFile(path, 'utf8')); assert.equal(saved.client_id, 'oaiapp_test'); assert.equal(saved.access_token, undefined);
});

test('tampered ID token signature is rejected', async t => {
 const f = await fixture(t, { invalidSignature: true }); assert.equal((await f.connect()).status, 400); assert.equal((await f.service.status()).connected, false);
});
test('abandoned refresh lock recovers after a dead owner', async t => {
 const f = await fixture(t); await f.connect(); const path = join(f.home, 'chatgpt/connection.json'); const record = JSON.parse(await readFile(path, 'utf8')); record.expires_at = 1; await writeFile(path, JSON.stringify(record));
 const lock = join(f.home, 'chatgpt/refresh.lock'); await writeFile(lock, '999999999'); const old = new Date(Date.now() - 300000); await utimes(lock, old, old); await f.service.models(); assert.equal(f.refreshes(), 1);
});

test('usage limits preserve authentication and recover without reconnecting',async t=>{const options={httpFailure:true};const f=await fixture(t,options);await f.connect();await assert.rejects(f.service.run({model:'current',messages:[{role:'user',content:'Hi'}]}),error=>error.status===429&&/remains connected/.test(error.message));assert.equal((await f.service.status()).connected,true);options.httpFailure=false;assert.equal((await f.service.run({model:'current',messages:[{role:'user',content:'Retry'}]})).text,'**Hello**');});
