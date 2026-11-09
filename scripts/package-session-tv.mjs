import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const source = new URL('session-tv/public/', root);
const output = new URL('out/session-tv/', root);

// The app is plain static HTML/CSS/JS. Ship only its public directory; never its
// local companion, .env files, backups, tests, or node_modules.
await readFile(new URL('index.html', source));
await mkdir(output, { recursive: true });
await cp(fileURLToPath(source), fileURLToPath(output), { recursive: true });

const defaults = JSON.parse((await readFile(new URL('js/config.js', source), 'utf8')).match(/window\.SessionTVConfig\s*=\s*(\{[^;]+\})/)[1]);
const config = {
  supabaseUrl: process.env.SESSION_TV_SUPABASE_URL || defaults.supabaseUrl || '',
  supabasePublishableKey: process.env.SESSION_TV_SUPABASE_PUBLISHABLE_KEY || defaults.supabasePublishableKey || '',
  companionUrl: 'http://127.0.0.1:4319',
};
if (config.supabaseUrl && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(config.supabaseUrl)) {
  throw new Error('SESSION_TV_SUPABASE_URL must be the public HTTPS Supabase project URL.');
}
if (config.supabasePublishableKey) {
  const key = config.supabasePublishableKey;
  let role;
  try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch {}
  if (!(key.startsWith('sb_publishable_') || role === 'anon')) {
    throw new Error('Only a Supabase publishable or legacy anon key may enter the static build.');
  }
}
await writeFile(new URL('js/config.js', output), `window.SessionTVConfig = ${JSON.stringify(config)};\n`);
await writeFile(new URL('out/.nojekyll', root), '');
console.log('Packaged Session TV at out/session-tv/; portfolio custom domain preserved.');
