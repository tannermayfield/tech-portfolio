import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,mkdir,realpath,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {sessionTVPublisher} from '../companion/publish.mjs';

test('publish preview isolates SessionTV source, leaves Git index untouched, and rejects stale reviews',async()=>{
 const root=await realpath(await mkdtemp(path.join(tmpdir(),'sessiontv-publish-test-')));
 const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 const source=path.join(root,'session-tv','public');
 try{
  git('init','-b','main');git('config','user.email','fixture@example.com');git('config','user.name','Fixture');git('remote','add','origin','https://github.com/tannermayfield/tech-portfolio.git');
  await mkdir(source,{recursive:true});await writeFile(path.join(source,'index.html'),'before');await writeFile(path.join(root,'unrelated.txt'),'before');git('add','.');git('commit','-m','Initial');
  const publisher=await sessionTVPublisher(path.dirname(source));assert.equal((await publisher.snapshot()).tree,null);
  await writeFile(path.join(source,'index.html'),'after');await writeFile(path.join(source,'new.js'),'new');await writeFile(path.join(root,'unrelated.txt'),'after');
  const review=await publisher.snapshot();assert.deepEqual(review.files.sort(),['session-tv/public/index.html','session-tv/public/new.js']);assert.equal(git('diff','--cached','--name-only'),'');
  await writeFile(path.join(source,'new.js'),'changed');await assert.rejects(publisher.publish(review),/changed after review/);
  await writeFile(path.join(source,'.env'),'fixture');await assert.rejects(publisher.snapshot(),/allowlist/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('push publishes the reviewed tree and leaves unrelated working changes local',async()=>{
 const root=await realpath(await mkdtemp(path.join(tmpdir(),'sessiontv-push-test-')));
 const work=path.join(root,'work'),remote=path.join(root,'remote.git');
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  await mkdir(work);git(root,'init','--bare',remote);git(work,'init','-b','main');git(work,'config','user.email','fixture@example.com');git(work,'config','user.name','Fixture');git(work,'remote','add','origin',remote);
  const source=path.join(work,'session-tv','public');await mkdir(source,{recursive:true});await writeFile(path.join(source,'index.html'),'before');await writeFile(path.join(work,'unrelated.txt'),'original');git(work,'add','.');git(work,'commit','-m','Initial');git(work,'push','origin','main');
  await writeFile(path.join(source,'index.html'),'live');await writeFile(path.join(work,'unrelated.txt'),'do not publish');
  const publisher=await sessionTVPublisher(path.dirname(source),{remote});const review=await publisher.snapshot();const result=await publisher.publish(review);
  assert.equal(git(remote,'rev-parse','main'),result.commit);assert.equal(git(remote,'show','main:session-tv/public/index.html'),'live');assert.equal(git(remote,'show','main:unrelated.txt'),'original');assert.match(git(work,'status','--short'),/unrelated.txt/);assert.equal((await publisher.snapshot()).tree,null);
 }finally{await rm(root,{recursive:true,force:true});}
});
