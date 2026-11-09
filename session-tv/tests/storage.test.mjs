import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
const context=vm.createContext({queueMicrotask,crypto:webcrypto,console});
vm.runInContext(readFileSync(new URL('../public/js/storage.js',import.meta.url),'utf8'),context);
const {LocalDatabase,KEY}=context.SessionStore;
function memory(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}}
test('documents persist, update, delete and publish ordered snapshots',async()=>{
 const storage=memory(),db=new LocalDatabase(storage);let result;
 db.collection('tasks').orderBy('order','asc').limit(1).onSnapshot(s=>result=s);
 const one=await db.collection('tasks').add({title:'First',order:2});
 await db.doc('tasks/second').set({title:'Second',order:1});
 await Promise.resolve();
 assert.equal(result.docs[0].id,'second');
 const copy=result.docs[0].data();copy.title='not persisted';
 assert.equal((await db.doc('tasks/second').get()).data().title,'Second');
 await db.doc('tasks/second').update({status:'done'});
 assert.equal((await new LocalDatabase(storage).doc('tasks/second').get()).data().status,'done');
 await db.doc('tasks/'+one.id).delete();
 assert.equal((await db.doc('tasks/'+one.id).get()).exists,false);
 await assert.rejects(db.doc('tasks/missing').update({status:'done'}));
});
test('bad saved data and failed writes are never silently erased',async()=>{
 const storage=memory();storage.setItem(KEY,'broken');
 assert.throws(()=>new LocalDatabase(storage));assert.equal(storage.getItem(KEY),'broken');
 const good=memory(),db=new LocalDatabase(good);
 good.setItem=()=>{throw new Error('Storage full')};
 await assert.rejects(db.doc('tasks/one').set({title:'Unsaved'}),/Storage full/);
 assert.equal((await db.doc('tasks/one').get()).exists,false);
});
