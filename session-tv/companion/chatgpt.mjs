import { mkdir, readFile, writeFile, rename, unlink, chmod, open, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { randomUUID, randomBytes, createHash, createPublicKey, verify, timingSafeEqual } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const ISSUER = 'https://auth.openai.com';
const RESOURCE = 'https://api.openai.com/v1';
const TOKEN = `${ISSUER}/api/accounts/oauth/token`;
const SCOPE = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const TERMINAL_REFRESH = new Set(['invalid_grant', 'invalid_refresh_token', 'token_expired', 'refresh_token_expired', 'refresh_token_invalidated', 'refresh_token_reused']);
const SAFE_CODES = new Set([...TERMINAL_REFRESH, 'invalid_client', 'subscription_sharing_user_not_eligible', 'subscription_sharing_usage_limit_exceeded', 'subscription_sharing_usage_unavailable', 'subscription_sharing_unsupported_capability', 'subscription_sharing_route_not_supported', 'subscription_sharing_invalid_user', 'subscription_sharing_user_unavailable', 'chatpass_v2_scope_not_authorized', 'chatpass_v2_invalid_authorization_context']);
const random = () => randomBytes(32).toString('base64url');
const same = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const failure = (message, status = 503, code) => Object.assign(new Error(message), { status, ...(code ? { code } : {}) });

// OAuth credentials never leave this local, owner-protected companion directory.
export function chatGPTService({ home, fetchImpl = globalThis.fetch, openBrowser } = {}) {
  if (!home) throw new Error('A local ChatGPT storage directory is required.');
  const directory = join(home, 'chatgpt');
  const filename = join(directory, 'connection.json');
  let pending, refreshing, generation = 0, lastError = null, saves = Promise.resolve();
  let jwks, jwksAt = 0;
  async function secure(path, directoryMode = false) {
    if (process.platform === 'win32') {
      const { stdout } = await exec('whoami.exe', [], { windowsHide: true, timeout: 10000 });
      const owner = stdout.trim();
      if (!owner || /[\r\n]/.test(owner)) throw failure('Could not protect local ChatGPT credentials.');
      await exec('icacls.exe', [path, '/inheritance:r', '/grant:r', `${owner}:${directoryMode ? '(OI)(CI)' : ''}F`], { windowsHide: true, timeout: 10000 });
    } else await chmod(path, directoryMode ? 0o700 : 0o600);
  }
  async function read() {
    try { return JSON.parse(await readFile(filename, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return {}; throw failure('Local ChatGPT settings could not be read.'); }
  }
  function save(record, expectedGeneration) {
    const task = saves.catch(() => {}).then(() => writeRecord(record, expectedGeneration));
    saves = task; return task;
  }
  async function writeRecord(record, expectedGeneration) {
    let temporary;
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await secure(directory, true);
      temporary = join(directory, `.${randomUUID()}.tmp`);
      await writeFile(temporary, JSON.stringify(record), { mode: 0o600, flag: 'wx' });
      await secure(temporary);
      if (expectedGeneration !== undefined && expectedGeneration !== generation) throw new Error('Canceled');
      await rename(temporary, filename);
    } catch { throw failure('Could not securely save local ChatGPT settings.'); }
    finally { if (temporary) await unlink(temporary).catch(() => {}); }
  }
  async function request(url, init = {}) {
    try { return await fetchImpl(url, { ...init, signal: init.signal || AbortSignal.timeout(30000) }); }
    catch (error) { if (init.signal?.aborted) throw failure('ChatGPT request canceled.', 499); throw failure('ChatGPT could not be reached. Try again.'); }
  }
  async function json(response) { try { return await response.json(); } catch { throw failure('ChatGPT returned an invalid response.'); } }
  async function httpError(response, context) {
    let body; try { body = await response.json(); } catch {}
    const code = SAFE_CODES.has(body?.error?.code || body?.error) ? (body?.error?.code || body.error) : undefined;
    const limited=response.status===429||code==='subscription_sharing_usage_limit_exceeded';
    const error = failure(limited?'ChatGPT usage limit reached. Your account remains connected. Try again when your allowance resets.':`${context}${code ? ` (${code})` : ''}.`, response.status, code);
    const id = response.headers.get('x-request-id') || response.headers.get('openai-request-id');
    if (id && /^[\w-]{1,160}$/.test(id)) error.requestId = id;
    return error;
  }
  async function identity(token, client, nonce) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3 || token.length > 50000) throw new Error();
      const header = JSON.parse(Buffer.from(parts[0], 'base64url'));
      if (!['RS256', 'ES256'].includes(header.alg) || typeof header.kid !== 'string' || header.crit) throw new Error();
      async function keys() {
        const response = await request(`${ISSUER}/.well-known/jwks.json`);
        if (!response.ok) throw new Error();
        jwks = (await response.json()).keys; jwksAt = Date.now();
      }
      if (!jwks || Date.now() - jwksAt > 3600000) await keys();
      let key = jwks.find(k => k.kid === header.kid);
      if (!key) { await keys(); key = jwks.find(k => k.kid === header.kid); }
      if (!key || (key.alg && key.alg !== header.alg) || (key.use && key.use !== 'sig') || (header.alg === 'RS256' && key.kty !== 'RSA') || (header.alg === 'ES256' && (key.kty !== 'EC' || key.crv !== 'P-256'))) throw new Error();
      const publicKey = createPublicKey({ key, format: 'jwk' });
      if (!verify('sha256', Buffer.from(`${parts[0]}.${parts[1]}`), { key: publicKey, ...(header.alg === 'ES256' ? { dsaEncoding: 'ieee-p1363' } : {}) }, Buffer.from(parts[2], 'base64url'))) throw new Error();
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url'));
      const now = Date.now() / 1000;
      const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
      if (claims.iss !== ISSUER || !audiences.includes(client) || ((audiences.length > 1 || claims.azp !== undefined) && claims.azp !== client) || !Number.isFinite(claims.exp) || claims.exp <= now - 5 || !Number.isFinite(claims.iat) || claims.iat > now + 5 || (claims.nbf !== undefined && (!Number.isFinite(claims.nbf) || claims.nbf > now + 5)) || typeof claims.sub !== 'string' || !claims.sub || (nonce !== undefined && !same(claims.nonce, nonce))) throw new Error();
      if (claims.sid !== undefined && (typeof claims.sid !== 'string' || !claims.sid.trim())) throw new Error();
      return claims;
    } catch { throw failure('ChatGPT sign-in identity could not be verified.', 401); }
  }
  function mergeTokens(record, tokens) {
    if (typeof tokens.access_token !== 'string' || !tokens.access_token || typeof tokens.refresh_token !== 'string' || !tokens.refresh_token || tokens.token_type?.toLowerCase() !== 'bearer' || !Number.isFinite(tokens.expires_in) || tokens.expires_in <= 0 || typeof tokens.scope !== 'string') throw failure('ChatGPT returned incomplete credentials.', 401);
    return { ...record, access_token: tokens.access_token, refresh_token: tokens.refresh_token, ...(tokens.id_token ? { id_token: tokens.id_token } : {}), scopes: tokens.scope.split(/\s+/).filter(Boolean), expires_at: Date.now() + tokens.expires_in * 1000 };
  }
  function withoutTokens(record) {
    const { access_token, refresh_token, id_token, expires_at, scopes, ...registration } = record;
    return registration;
  }
  function stopPending() { if (pending) { clearTimeout(pending.timer); pending.server.close(); pending = undefined; } }
  async function status() {
    const record = await read();
    return { connected: !!record.access_token && record.scopes?.includes('chatgpt.tokens.use.direct') === true, planUsageEnabled: !!record.access_token && record.scopes?.includes('chatgpt.tokens.use.direct') === true, account: record.subject ? { email: record.email || null, name: record.name || null, subject: record.subject, client_id: record.client_id } : null, pending: !!pending, error: lastError };
  }
  async function begin() {
    if (pending) return { authorizationUrl: pending.authorizationUrl };
    let record = await read();
    if (!record.ext_agent_host_id) { record.ext_agent_host_id = `urn:uuid:${randomUUID()}`; await save(record); }
    const attemptGeneration = ++generation;
    const state = random(), nonce = random(), verifier = random();
    const client = record.client_id || 'dynamic_agent_client';
    const server = createServer(async (req, res) => {
      res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'"); res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Referrer-Policy', 'no-referrer');
      if (!pending || pending.server !== server || req.method !== 'GET' || req.headers.host !== `127.0.0.1:${server.address()?.port}`) { res.writeHead(400).end('Invalid sign-in callback.'); return; }
      const url = new URL(req.url, pending.redirectUri);
      if (url.pathname !== '/auth/callback') { res.writeHead(404).end('Not found.'); return; }
      const attempt = pending; stopPending();
      try {
        if (!same(url.searchParams.get('state'), state)) throw failure('ChatGPT sign-in could not be verified.', 400);
        if (url.searchParams.has('error')) throw failure('ChatGPT authorization was canceled or declined.', 400);
        const issued = url.searchParams.get('client_id') || (client !== 'dynamic_agent_client' ? client : '');
        if (!/^oaiapp_[A-Za-z0-9_-]+$/.test(issued) || (client !== 'dynamic_agent_client' && issued !== client)) throw failure('ChatGPT registration could not be verified.', 401);
        const code = url.searchParams.get('code'); if (!code || code.length > 10000) throw failure('ChatGPT did not return a valid authorization code.', 400);
        const response = await request(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', client_id: issued, code, code_verifier: verifier, redirect_uri: attempt.redirectUri, resource: RESOURCE }) });
        if (!response.ok) throw await httpError(response, 'ChatGPT sign-in failed');
        const tokens = await json(response);
        const claims = await identity(tokens.id_token, issued, nonce);
        if (record.subject && claims.sub !== record.subject) throw failure('Please sign in with the previously connected ChatGPT account.', 401);
        if (generation !== attemptGeneration) throw failure('ChatGPT sign-in was canceled.', 400);
        record = mergeTokens({ ...record, client_id: issued, subject: claims.sub, email: typeof claims.email === 'string' ? claims.email : null, name: typeof claims.name === 'string' ? claims.name : null }, tokens);
        await save(record, attemptGeneration);
        const enabled = record.scopes.includes('chatgpt.tokens.use.direct');
        lastError = enabled ? null : 'ChatGPT plan usage was not authorized. Continue with ChatGPT again and allow plan usage.';
        res.end(enabled ? 'ChatGPT connected. You can close this window and return to SessionTV.' : lastError);
      } catch (error) { lastError = error.status ? error.message : 'ChatGPT sign-in could not be completed.'; res.writeHead(400).end(lastError); }
    });
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const redirectUri = `http://127.0.0.1:${server.address().port}/auth/callback`;
    const url = new URL(`${ISSUER}/api/accounts/authorize`);
    url.search = new URLSearchParams({ client_id: client, ext_agent_host_id: record.ext_agent_host_id, response_type: 'code', redirect_uri: redirectUri, scope: SCOPE, resource: RESOURCE, state, nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') }).toString();
    if (client === 'dynamic_agent_client') url.searchParams.set('agent_name_hint', 'SessionTV');
    else { if (record.email) url.searchParams.set('login_hint', record.email); if (!record.scopes?.includes('chatgpt.tokens.use.direct')) url.searchParams.set('prompt', 'consent'); }
    const timer = setTimeout(() => { lastError = 'ChatGPT sign-in expired. Please try again.'; stopPending(); }, 5 * 60000); timer.unref(); server.unref();
    pending = { server, timer, redirectUri, authorizationUrl: url.toString() }; lastError = null;
    if (openBrowser) await openBrowser(pending.authorizationUrl);
    return { authorizationUrl: pending.authorizationUrl };
  }
  async function access() {
    let record = await read();
    if (!record.access_token || !record.scopes?.includes('chatgpt.tokens.use.direct')) throw failure('Continue with ChatGPT and allow ChatGPT plan usage first.', 401);
    if (record.expires_at > Date.now() + 60000) return record.access_token;
    if (!refreshing) refreshing = (async () => {
      // A cross-process lock protects rotating refresh tokens if another companion starts.
      let lock;
      try {
        const lockPath = join(directory, 'refresh.lock');
        try {
          const info = await stat(lockPath);
          if (Date.now() - info.mtimeMs > 120000) {
            const owner = Number(await readFile(lockPath, 'utf8'));
            let alive = Number.isInteger(owner) && owner > 0;
            if (alive) { try { process.kill(owner, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; } }
            if (!alive) await unlink(lockPath).catch(() => {});
          }
        } catch (error) { if (error.code !== 'ENOENT') throw error; }
        lock = await open(lockPath, 'wx', 0o600);
        await lock.writeFile(String(process.pid));
        record = await read();
        if (record.expires_at > Date.now() + 60000) return record.access_token;
        const version = generation;
        const response = await request(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: record.client_id, refresh_token: record.refresh_token, resource: RESOURCE }) });
        if (!response.ok) {
          const error = await httpError(response, 'ChatGPT session could not be renewed');
          if (TERMINAL_REFRESH.has(error.code)) { await save(withoutTokens(record)); lastError = 'ChatGPT session expired. Continue with ChatGPT again.'; }
          throw error;
        }
        const tokens = await json(response);
        if (tokens.id_token) { const claims = await identity(tokens.id_token, record.client_id); if (claims.sub !== record.subject) throw failure('ChatGPT session identity changed. Sign in again.', 401); }
        if (version !== generation) throw failure('ChatGPT session changed. Please try again.', 409);
        record = mergeTokens(record, tokens); await save(record, version); return record.access_token;
      } catch (error) { if (error.code === 'EEXIST') throw failure('ChatGPT session is being renewed. Try again shortly.', 409); throw error; }
      finally { if (lock) { await lock.close(); await unlink(join(directory, 'refresh.lock')).catch(() => {}); } }
    })().finally(() => { refreshing = undefined; });
    return refreshing;
  }
  async function disconnect() {
    ++generation; stopPending(); if (refreshing) await refreshing.catch(() => {});
    await saves.catch(() => {});
    const record = await read(); let revoked = !record.refresh_token;
    try {
      if (record.refresh_token) {
        const discovery = await request(`${ISSUER}/.well-known/openid-configuration`);
        const config = discovery.ok ? await discovery.json() : {};
        const endpoint = new URL(config.revocation_endpoint);
        if (endpoint.protocol !== 'https:' || endpoint.origin !== ISSUER) throw new Error();
        const response = await request(endpoint.href, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: record.refresh_token, token_type_hint: 'refresh_token', client_id: record.client_id }) });
        revoked = response.status === 200;
      }
    } catch {}
    if (Object.keys(record).length) await save(withoutTokens(record));
    lastError = revoked ? null : 'Disconnected locally. Remote revocation was not confirmed; disconnect SessionTV in ChatGPT Settings.';
    return { disconnected: true, revoked };
  }
  async function models() {
    const token = await access(); const response = await request(`${RESOURCE}/models`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw await httpError(response, 'ChatGPT models could not be loaded');
    const body = await json(response); if (!Array.isArray(body.models)) throw failure('ChatGPT returned an invalid model catalog.');
    return body.models.filter(m => m.visibility === 'list' && typeof m.slug === 'string').map(m => ({ id: m.slug, displayName: typeof m.display_name === 'string' ? m.display_name : m.slug }));
  }
  async function run({ model, effort, messages, onEvent = () => {}, signal } = {}) {
    if (typeof model !== 'string' || !model || !Array.isArray(messages) || !messages.length || messages.some(m => !['user', 'assistant', 'developer', 'system'].includes(m.role) || typeof m.content !== 'string') || (effort && !['low', 'medium', 'high', 'xhigh'].includes(effort))) throw failure('Choose a ChatGPT model and enter a message.', 400);
    if (!(await models()).some(m => m.id === model)) throw failure('That ChatGPT model is unavailable for this account.', 400);
    const token = await access();
    const response = await request(`${RESOURCE}/responses`, { method: 'POST', signal: signal || AbortSignal.timeout(600000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, input: messages.map(m => ({ role: m.role === 'system' ? 'developer' : m.role, content: m.content })), stream: true, store: false, ...(effort ? { reasoning: { effort } } : {}) }) });
    if (!response.ok) throw await httpError(response, 'ChatGPT request failed');
    if (!response.body) throw failure('ChatGPT returned an empty stream.');
    const decoder = new TextDecoder(); let buffer = '', text = '', completed = false;
    function consume(frame) {
      const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') return;
      let event; try { event = JSON.parse(data); } catch { throw failure('ChatGPT returned an invalid stream.'); }
      if (['response.failed', 'response.incomplete', 'error'].includes(event.type)) { const code = event.response?.error?.code || event.error?.code || event.code; throw failure(code?.includes('limit_exceeded')?'ChatGPT usage limit reached. Your account remains connected. Try again when your allowance resets.':`ChatGPT response did not complete${SAFE_CODES.has(code) ? ` (${code})` : ''}.`, code?.includes('limit_exceeded') ? 429 : 503, SAFE_CODES.has(code) ? code : undefined); }
      if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') { text += event.delta; onEvent({ type: event.type, delta: event.delta }); }
      else if (event.type === 'response.completed') { completed = true; onEvent({ type: event.type }); }
    }
    try {
      for await (const chunk of response.body) { buffer += decoder.decode(chunk, { stream: true }); buffer = buffer.replace(/\r\n/g, '\n'); if (buffer.length > 8000000) throw failure('ChatGPT stream exceeded the supported event size.'); let end; while ((end = buffer.indexOf('\n\n')) !== -1) { consume(buffer.slice(0, end)); buffer = buffer.slice(end + 2); } }
      buffer += decoder.decode(); if (buffer.trim()) consume(buffer);
    } catch (error) { if (error.status) throw error; throw failure(signal?.aborted ? 'ChatGPT request canceled.' : 'ChatGPT connection interrupted. Please try again.', signal?.aborted ? 499 : 503); }
    if (!completed) throw failure('ChatGPT connection ended before the response completed.');
    return { text, model };
  }
  function close() { ++generation; stopPending(); }
  return { status, begin, disconnect, models, run, close };
}
