import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {appScripts,source} from './manifest.mjs';
const scripts=appScripts().map(name=>({name,text:source(name)}));
// top-level function declarations (column 0) become shared globals
const declared=new Map();
for(const {name,text} of scripts)for(const [,fn] of text.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)){if(!declared.has(fn))declared.set(fn,[]);declared.get(fn).push(name)}

test('every shared function is defined exactly once across the manifest',()=>{
 const twice=[...declared].filter(([,files])=>files.length>1).map(([fn,files])=>fn+' in '+files.join(', '));
 assert.deepEqual(twice,[]);
});

test('no script reassigns a shared function; extensions go through SessionTV.hooks',()=>{
 const found=[];
 for(const {name,text} of scripts)for(const fn of declared.keys()){
  // skip local declarations that shadow the name: "const x=", "let a=1,x="
  const re=new RegExp('(?<![\\w$.\'"`])(?<!(?:const|let|var|function)\\s+)(?<!,\\s*)'+fn.replace(/\$/g,'\\$')+'\\s*=(?![=>])','g');
  for(const match of text.matchAll(re))found.push(name+': '+text.slice(match.index,match.index+40));
 }
 assert.deepEqual(found,[]);
});

test('hooks compose in load order: later wraps sit outside earlier ones, afters run in order',()=>{
 const context={};vm.createContext(context);vm.runInContext(source('core/hooks.js'),context);
 const {hooks}=context.SessionTV,log=[];
 hooks.after('work:render',()=>log.push('after 1'));
 hooks.wrap('work:render',(next,...args)=>{log.push('wrap 2 in');const result=next(...args);log.push('wrap 2 out');return result});
 hooks.before('work:render',value=>log.push('before 3 '+value));
 hooks.after('work:render',()=>log.push('after 4'));
 const result=hooks.run('work:render',['x'],value=>{log.push('core '+value);return 'done'});
 assert.equal(result,'done');
 assert.deepEqual(log,['before 3 x','wrap 2 in','core x','after 1','wrap 2 out','after 4']);
 hooks.wrap('theme:pick',(next,section)=>section==='class'?'replaced':next(section));
 assert.equal(hooks.run('theme:pick',['class'],()=>'core'),'replaced');
 assert.equal(hooks.run('theme:pick',['skill'],()=>'core'),'core');
 assert.throws(()=>hooks.after('work:rendr',()=>{}),/Unknown SessionTV hook/);
});

test('every preference key the scripts use is listed in the preferences registry',()=>{
 const context={};vm.createContext(context);vm.runInContext(source('core/preferences.js'),context);
 const prefs=context.SessionTV.preferences,missing=new Set();
 for(const {name,text} of scripts)for(const [,key] of text.matchAll(/['"`](sb\.[A-Za-z]+[.:]?)/g))if(!prefs.get(key)&&!prefs.legacy.includes(key)&&name!=='core/preferences.js')missing.add(name+': '+key);
 assert.deepEqual([...missing],[]);
});
