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
console.log('Syntax and local asset references passed ('+files.length+' scripts).');
