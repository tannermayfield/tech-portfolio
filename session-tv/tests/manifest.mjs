// Reads public/js/manifest.js, the single ordered script list the app loads after boot.
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const publicDir=new URL('../public/',import.meta.url);
export function appScripts(){
 const context={};vm.createContext(context);context.globalThis=context;
 vm.runInContext(readFileSync(new URL('js/manifest.js',publicDir),'utf8'),context);
 return Array.from(context.SessionTVManifest);
}
export function appSources(){return appScripts().map(name=>readFileSync(new URL('js/'+name,publicDir),'utf8'))}
export function source(name){return readFileSync(new URL('js/'+name,publicDir),'utf8')}
