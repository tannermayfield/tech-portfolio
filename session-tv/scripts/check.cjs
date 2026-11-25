const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)])}
const files=[...walk(path.join(root,'public/js')),path.join(root,'server.mjs')].filter(f=>/\.(js|mjs)$/.test(f));
for(const file of files){const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});if(r.status){process.stderr.write(r.stderr);process.exit(1)}}
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
for(const [,file]of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
 if(/^(?:https?:|data:)/.test(file))continue;
 if(!fs.existsSync(path.join(root,'public',file)))throw new Error('Missing asset: '+file);
}
// every script in the manifest boot.js loads must exist
const vm=require('node:vm'),context={};vm.createContext(context);context.globalThis=context;
vm.runInContext(fs.readFileSync(path.join(root,'public/js/manifest.js'),'utf8'),context);
for(const name of context.SessionTVManifest)if(!fs.existsSync(path.join(root,'public/js',name)))throw new Error('Missing manifest script: '+name);
console.log('Syntax, local asset and manifest references passed ('+files.length+' scripts, '+context.SessionTVManifest.length+' in the manifest).');
