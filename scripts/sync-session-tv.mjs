import {cp,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const source=path.resolve(process.argv[2]||path.join(root,'../Applications/session-tv'));
const dest=path.join(root,'session-tv');
await mkdir(dest,{recursive:true});
for(const name of ['public','companion','supabase','docs','scripts','tests','package.json','package-lock.json','README.md','Start Session TV.cmd','server.mjs','.gitignore','.env.example'])await cp(path.join(source,name),path.join(dest,name),{recursive:true});
console.log('Synced Session TV source; excluded local credentials, backups, and dependencies.');
