import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const exec=promisify(execFile);
const productionRemote='https://github.com/tannermayfield/tech-portfolio.git';
const live='https://tannermayfield.dev/session-tv/';
const branch='refs/heads/main';
const fail=message=>Object.assign(new Error(message),{status:409});
const list=value=>value.split('\0').filter(Boolean);
const isSource=file=>/^session-tv\/(public|companion|tests|scripts|docs|supabase)\//.test(file)||/^session-tv\/(AGENTS\.md|README\.md|package(-lock)?\.json|server\.mjs|Start Session TV\.cmd)$/.test(file);

export async function sessionTVPublisher(folder,{remote=productionRemote}={}){
 const env={...process.env,GIT_TERMINAL_PROMPT:'0'};
 for(const key of Object.keys(env))if(key.startsWith('GIT_')&&key!=='GIT_TERMINAL_PROMPT')delete env[key];
 const git=async(args,{cwd=folder,index}={})=>{
  try{return (await exec('git',['-c','core.hooksPath=/dev/null','-c','commit.gpgsign=false',...args],{cwd,env:{...env,...(index?{GIT_INDEX_FILE:index}:{})},windowsHide:true,timeout:60000,maxBuffer:8*1024*1024})).stdout}
  catch(error){throw fail('Git '+args[0]+' failed. '+(args[0]==='push'||args[0]==='ls-remote'?'Check GitHub credentials and repository access.':String(error.stderr||'Check Git setup.').trim().slice(0,300)))}
 };
 const root=await realpath((await git(['rev-parse','--show-toplevel'])).trim());
 if(folder!==root&&folder!==path.join(root,'session-tv'))throw fail('Link the portfolio root or its SessionTV folder to publish.');
 const repo=(args,options={})=>git(args,{cwd:root,...options});
 async function snapshot(){
  if((await repo(['symbolic-ref','HEAD'])).trim()!==branch)throw fail('Publishing requires the main branch.');
  if((await repo(['remote','get-url','--push','--all','origin'])).trim()!==remote)throw fail('This project is not linked to the configured SessionTV publishing repository.');
  if(await repo(['diff','--cached','--name-only']))throw fail('The repository has staged changes. Review them before publishing.');
  const base=(await repo(['rev-parse','HEAD'])).trim();
  const files=[...new Set(list(await repo(['diff','--name-only','--no-renames','-z','HEAD','--','session-tv'])).concat(list(await repo(['ls-files','--others','--exclude-standard','-z','--','session-tv']))))];
  if(files.some(file=>!isSource(file)||/(^|\/)(\.env[^/]*|node_modules|credentials|backups)(\/|$)/i.test(file)))throw fail('Review files outside the SessionTV source allowlist before publishing.');
  if(!files.length)return {base,tree:null,files};
  const temporary=await mkdtemp(path.join(tmpdir(),'sessiontv-git-'));
  try{
   const index=path.join(temporary,'index');
   await repo(['read-tree',base],{index});
   await repo(['--literal-pathspecs','add','-A','--',...files],{index});
   const tree=(await repo(['write-tree'],{index})).trim();
   return {base,tree,files};
  }finally{await rm(temporary,{recursive:true,force:true})}
 }
 async function publish(review){
  const current=await snapshot();
  if(!current.tree||current.tree!==review.tree||current.base!==review.base)throw fail('The files changed after review. Reopen the publish preview.');
  const upstream=(await repo(['ls-remote',remote,branch])).trim().split(/\s+/)[0];
  if(upstream!==current.base)throw fail('Local main differs from GitHub. Sync the repository before publishing.');
  // Commit the reviewed tree exactly. Push uses an explicit ref and never forces updates.
  const commit=(await repo(['commit-tree',current.tree,'-p',current.base,'-m','Update SessionTV'])).trim();
  await repo(['push',remote,commit+':'+branch]);
  await repo(['update-ref',branch,commit,current.base]);
  await repo(['--literal-pathspecs','reset',commit,'--',...current.files]);
  return {commit,url:live};
 }
 return {snapshot,publish};
}

export async function liveSessionTVCommit(commit){
 if(!/^[a-f0-9]{40}$/.test(commit))return false;
 const response=await fetch(live+'release.json?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});
 return response.ok&&(await response.json()).commit===commit;
}
