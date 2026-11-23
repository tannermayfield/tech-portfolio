import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const cloudSource=readFileSync(new URL('../public/js/cloud.js',import.meta.url),'utf8');
const storeSource=readFileSync(new URL('../public/js/storage.js',import.meta.url),'utf8');
const session={access_token:'owner-access',refresh_token:'owner-refresh',expires_at:Math.floor(Date.now()/1000)+3600,user:{id:'owner'}};
function boot({signedIn=true,handler=()=>({})}={}){
 const values=new Map(signedIn?[['sessiontv.auth.v1',JSON.stringify(session)]]:[]),calls=[];
 const context=vm.createContext({crypto:globalThis.crypto,AbortSignal,setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},queueMicrotask,location:{reload(){}},document:{visibilityState:'visible'},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},dispatchEvent(){},addEventListener(){},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)},SessionWorkspace:{setPrivate(id){this.id=id;},hydratePrivate(value){this.preferences=value;},onPrivateChange(fn){this.changed=fn;return()=>{};}},SessionTVConfig:{supabaseUrl:'https://example.supabase.co',supabasePublishableKey:'public'},async fetch(url,options){calls.push({url,...options});const result=url.endsWith('/auth/v1/user')?{id:'owner'}:await handler(url,options);return {ok:!result?.status||result.status<400,status:result?.status||200,text:async()=>JSON.stringify(result?.body??result)};}});
 vm.runInContext(storeSource,context);vm.runInContext(cloudSource,context);return {cloud:context.SessionCloud,context,calls};
}
test('class rename uses one owner-scoped RPC and one snapshot regardless of assignment count',async()=>{
 let renamed=false;const tasks=Object.fromEntries(Array.from({length:200},(_,i)=>['task-'+i,{title:'Assignment '+i,course:'Old Class'}]));
 const app=boot({handler:url=>url.endsWith('/sessiontv_manage_class')?(renamed=true,{updated:200}):url.endsWith('/sessiontv_snapshot')?{database:{tasks:Object.fromEntries(Object.entries(tasks).map(([id,task])=>[id,{...task,course:renamed?'New Class':task.course}]))},preferences:{'sb.classes':JSON.stringify(renamed?['New Class']:['Old Class'])}}:{}});
 const db=await app.cloud.open();app.calls.length=0;
 const result=await app.cloud.manageClass({oldCourse:'Old Class',newCourse:'New Class',classValue:{name:'New Class',color:'#ffffff'}});
 assert.equal(result.updated,200);assert.equal(app.calls.length,2);assert(app.calls[0].url.endsWith('/sessiontv_manage_class'));assert.equal(app.calls[0].headers.Authorization,'Bearer owner-access');assert.deepEqual(JSON.parse(app.calls[0].body),{old_course:'Old Class',new_course:'New Class',delete_class:false,class_value:{name:'New Class',color:'#ffffff'}});assert(app.calls[1].url.endsWith('/sessiontv_snapshot'));assert(!app.calls.some(call=>call.url.endsWith('/sessiontv_write')));assert.equal(db.snapshot('tasks','task-199').data().course,'New Class');assert.deepEqual(JSON.parse(app.context.SessionWorkspace.preferences['sb.classes']),['New Class']);
});
test('class deletion sends one atomic operation then hydrates server-updated preferences',async()=>{
 let deleted=false;const app=boot({handler:url=>url.endsWith('/sessiontv_manage_class')?(deleted=true,{deleted:3}):{database:{},preferences:{'sb.classes':JSON.stringify(deleted?[]:['Class']),'sb.canvasCourses':JSON.stringify(deleted?{}:{10:'Class'}),'sb.canvasExcludedCourses':JSON.stringify(deleted?['10']:[])}}});await app.cloud.open();app.calls.length=0;
 const result=await app.cloud.manageClass({oldCourse:'Class',deleteClass:true});assert.equal(result.deleted,3);assert.equal(app.calls.length,2);assert.deepEqual(JSON.parse(app.calls[0].body),{old_course:'Class',new_course:null,delete_class:true,class_value:null});assert.deepEqual(JSON.parse(app.context.SessionWorkspace.preferences['sb.canvasExcludedCourses']),['10']);
});
test('private authentication and class argument validation fail before any mutation RPC',async()=>{
 const guest=boot({signedIn:false});await assert.rejects(guest.cloud.manageClass({oldCourse:'Class',deleteClass:true}),/Sign in/);assert.equal(guest.calls.length,0);
 const app=boot();await app.cloud.ready;app.calls.length=0;
 for(const args of [{oldCourse:''},{oldCourse:'Class',newCourse:''},{oldCourse:'Class',deleteClass:'yes'},{oldCourse:'Class',classValue:[]}])await assert.rejects(app.cloud.manageClass(args));assert.equal(app.calls.length,0);
});
test('failed class RPC preserves loaded assignments and does not request a replacement snapshot',async()=>{
 const app=boot({handler:url=>url.endsWith('/sessiontv_manage_class')?{status:403,body:{message:'Only the owner can change this class'}}:{database:{tasks:{one:{title:'Keep',course:'Class'}}},preferences:{}}});const db=await app.cloud.open();app.calls.length=0;await assert.rejects(app.cloud.manageClass({oldCourse:'Class',deleteClass:true}),/Only the owner/);assert.equal(app.calls.length,1);assert.equal(db.snapshot('tasks','one').data().title,'Keep');
});
test('class mutation waits for previous document and preference writes before its one transaction',async()=>{
 let release;const app=boot({handler:async url=>{if(url.endsWith('/sessiontv_write'))await new Promise(resolve=>release=resolve);return url.endsWith('/sessiontv_snapshot')?{database:{},preferences:{}}:{updated:true};}});const db=await app.cloud.open();app.calls.length=0;
 const writing=db.doc('tasks/one').set({title:'Earlier'});while(!release)await Promise.resolve();app.context.SessionWorkspace.changed('sb.classes','["Class"]');const managing=app.cloud.manageClass({oldCourse:'Class',newCourse:'Renamed'});await Promise.resolve();assert(!app.calls.some(call=>call.url.endsWith('/sessiontv_manage_class')));release();await writing;await managing;
 const classIndex=app.calls.findIndex(call=>call.url.endsWith('/sessiontv_manage_class')),preferenceIndex=app.calls.findIndex(call=>call.url.endsWith('/sessiontv_preference'));assert(classIndex>preferenceIndex);assert.equal(app.calls.filter(call=>call.url.endsWith('/sessiontv_manage_class')).length,1);assert(app.calls.at(-1).url.endsWith('/sessiontv_snapshot'));
});
