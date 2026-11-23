// All privileged credentials stay in the Supabase Edge runtime, never the site bundle.
Deno.serve(async request => {
 const allowed = new Set(['https://tannermayfield.dev', ...(Deno.env.get('SESSIONTV_ALLOWED_ORIGINS') || '').split(',').map(value => value.trim()).filter(Boolean)]);
 const origin = request.headers.get('origin');
 const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Vary': 'Origin', ...(origin && allowed.has(origin) ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {}) };
 const reply = (status, message) => new Response(JSON.stringify(typeof message === 'string' ? { message } : message), { status, headers });
 if (origin && !allowed.has(origin)) return reply(403, 'This origin is not allowed.');
 if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
 if (request.method !== 'POST') return reply(405, 'Use POST.');
 const endpoint = Deno.env.get('SUPABASE_URL');
 const publicKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
 const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if (!endpoint || !publicKey || !serviceKey) return reply(503, 'Account deletion is not configured.');
 const authorization = request.headers.get('authorization');
 if (!authorization || !/^Bearer [^\s]+$/i.test(authorization)) return reply(401, 'Sign in before deleting your account.');
 try {
  const userResponse = await fetch(endpoint + '/auth/v1/user', { headers: { apikey: publicKey, Authorization: authorization }, signal: AbortSignal.timeout(15000) });
  if (!userResponse.ok) return reply(401, 'Your sign-in could not be verified. Sign in again.');
  const user = await userResponse.json();
  if (typeof user.id !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(user.id) || !user.email) return reply(401, 'Your account could not be verified.');
  const signedIn = Date.parse(user.last_sign_in_at || '');
  if (!Number.isFinite(signedIn) || Date.now() - signedIn > 10 * 60000 || signedIn > Date.now() + 60000) return reply(403, 'Sign out and sign in again before permanently deleting your account.');
  if (Number(request.headers.get('content-length')) > 2048) return reply(413, 'Request is too large.');
  let text = '', size = 0; const decoder = new TextDecoder();
  if (request.body) for await (const chunk of request.body) { size += chunk.length; if (size > 2048) return reply(413, 'Request is too large.'); text += decoder.decode(chunk, { stream: true }); }
  text += decoder.decode();
  let body; try { body = JSON.parse(text); } catch { return reply(400, 'Confirm your account email.'); }
  if (!body || Object.keys(body).some(key => key !== 'confirmationEmail') || typeof body.confirmationEmail !== 'string' || body.confirmationEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) return reply(400, 'Type your account email to confirm permanent deletion.');
  // Revoke renewable sessions before hard deletion. Existing JWTs expire normally;
  // requests requiring a live account (including this function) verify getUser.
  const revoked = await fetch(endpoint + '/auth/v1/logout?scope=global', { method: 'POST', headers: { apikey: serviceKey, Authorization: authorization }, signal: AbortSignal.timeout(15000) });
  if (!revoked.ok) return reply(503, 'Could not revoke your sessions. Your account was not deleted. Try again.');
  const deleted = await fetch(endpoint + '/auth/v1/admin/users/' + encodeURIComponent(user.id), { method: 'DELETE', headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ should_soft_delete: false }), signal: AbortSignal.timeout(15000) });
  if (!deleted.ok) return reply(503, 'Your account could not be deleted. Sign in again and retry.');
  return reply(200, { deleted: true });
 } catch { return reply(503, 'Account deletion is temporarily unavailable. Please try again.'); }
});
