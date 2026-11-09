/* Local replacement for the artifact document database. */
(() => {
 const KEY='sessiontv.database.v1', clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
 const collections=new Set(['tasks','sessions','state','settings','projects']);
 function validate(data) {
  if(!data||typeof data!=='object'||Array.isArray(data)) throw new Error('Invalid database.');
  for(const [name,docs] of Object.entries(data)) {
   if(!collections.has(name)||!docs||typeof docs!=='object'||Array.isArray(docs)) throw new Error('Invalid collection.');
   for(const [id,value] of Object.entries(docs))
    if(!/^[\w-]+$/.test(id)||!value||typeof value!=='object'||Array.isArray(value)) throw new Error('Invalid document.');
  }
  return data;
 }
 class LocalDatabase {
  constructor(storage) {
   this.storage=storage; this.listeners=new Set();
   const raw=storage.getItem(KEY); this.data=raw?validate(JSON.parse(raw)):{};
   storage.setItem(KEY,JSON.stringify(this.data));
  }
  snapshot(name,id,sort,count) {
   const docs=this.data[name]||{}, metadata={hasPendingWrites:false,fromCache:false};
   if(id) return {exists:Object.hasOwn(docs,id),data:()=>clone(docs[id]),metadata};
   let entries=Object.entries(docs);
   if(sort) entries.sort((a,b)=>{const x=a[1][sort.field],y=b[1][sort.field];return (x<y?-1:x>y?1:0)*(sort.direction==='desc'?-1:1)});
   if(count!=null) entries=entries.slice(0,count);
   return {docs:entries.map(([id,value])=>({id,data:()=>clone(value)})),metadata};
  }
  watch(name,id,sort,count,callback,onError) {
   const listener={name,deliver:()=>{
    try{callback(this.snapshot(name,id,sort,count))}catch(error){if(onError)onError(error);else console.error(error)}
   }};
   this.listeners.add(listener);
   queueMicrotask(()=>{if(this.listeners.has(listener))listener.deliver()});
   return ()=>this.listeners.delete(listener);
  }
  async write(name,id,value,mode) {
   const next=clone(this.data); next[name]||={};
   if(mode==='update'&&!Object.hasOwn(next[name],id)) throw new Error('This item no longer exists.');
   if(mode==='delete')delete next[name][id];
   else next[name][id]=mode==='update'?{...next[name][id],...clone(value)}:clone(value);
   validate(next);
   this.storage.setItem(KEY,JSON.stringify(next));
   this.data=next;
   for(const listener of this.listeners)if(listener.name===name)queueMicrotask(listener.deliver);
  }
  doc(documentPath) {
   const [name,id,...rest]=documentPath.split('/');
   if(!collections.has(name)||!id||rest.length||!/^[\w-]+$/.test(id))throw new Error('Invalid document path.');
   return {set:v=>this.write(name,id,v,'set'),update:v=>this.write(name,id,v,'update'),
    delete:()=>this.write(name,id,null,'delete'),get:async()=>this.snapshot(name,id),
    onSnapshot:(callback,onError)=>this.watch(name,id,null,null,callback,onError)};
  }
  collection(name) {
   if(!collections.has(name))throw new Error('Invalid collection.');
   const query=(sort=null,count=null)=>({
    orderBy:(field,direction='asc')=>query({field,direction},count),limit:n=>query(sort,n),
    onSnapshot:(callback,onError)=>this.watch(name,null,sort,count,callback,onError),
    add:async value=>{const id=crypto.randomUUID();await this.doc(name+'/'+id).set(value);return {id}}
   });
   return query();
  }
  reload() {
   const text=this.storage.getItem(KEY);this.data=text?validate(JSON.parse(text)):{};
   for(const listener of this.listeners)queueMicrotask(listener.deliver);
  }
 }
 class PreviewDatabase extends LocalDatabase {
  async write(name,id,value,mode) {
   // Channel navigation needs transient playback state; published records stay immutable.
   if(name!=='state'){
    for(const listener of this.listeners)if(listener.name===name)queueMicrotask(listener.deliver);
    throw new Error('This public preview is read-only. Sign in to edit your own workspace.');
   }
   return super.write(name,id,value,mode);
  }
 }
 globalThis.SessionStore={LocalDatabase,PreviewDatabase,validate,KEY};
})();
