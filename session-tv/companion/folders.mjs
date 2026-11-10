import {spawn} from 'node:child_process';
import {mkdir,readFile,realpath,rename,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const failure=(status,message)=>Object.assign(new Error(message),{status});
function run(executable,args) {
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{windowsHide:false,stdio:['ignore','pipe','pipe'],shell:false});
  let output='';
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>65536)child.kill()});
  child.on('error',()=>reject(failure(503,'Windows could not open the folder picker.')));
  child.on('exit',code=>code===0?resolve(output.trim()):reject(failure(503,'Windows folder selection failed. Try again.')));
 });
}
export async function pickWindowsFolder() {
 if(process.platform!=='win32')throw failure(503,'Native folder selection is supported on Windows.');
 const script=`Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Choose the computer folder for your Session TV project'; $dialog.ShowNewFolderButton = $true; $owner = New-Object System.Windows.Forms.Form; $owner.TopMost = $true; $owner.ShowInTaskbar = $false; $owner.Opacity = 0; $owner.Show(); try { if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false); [Console]::Write($dialog.SelectedPath) } } finally { $dialog.Dispose(); $owner.Dispose() }`;
 const folder=await run('powershell.exe',['-NoProfile','-STA','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')]);
 if(!folder)throw failure(409,'Folder selection was cancelled.');
 return folder;
}
export async function openWindowsFolder(folder) {
 if(process.platform!=='win32')throw failure(503,'Opening a computer folder is supported on Windows.');
 await new Promise((resolve,reject)=>{
  const child=spawn('explorer.exe',[folder],{windowsHide:false,detached:true,stdio:'ignore',shell:false});
  child.once('error',()=>reject(failure(503,'Windows could not open this folder.')));
  child.once('spawn',()=>{child.unref();resolve()});
 });
}
export async function validateFolder(value,home,protectedDirectories=[]) {
 if(typeof value!=='string'||!value.trim())throw failure(400,'Choose a computer folder.');
 let folder;
 try { folder=await realpath(value); if(!(await stat(folder)).isDirectory())throw new Error(); }
 catch { throw failure(400,'That folder is unavailable. Choose an existing project folder.'); }
 if(path.parse(folder).root===folder)throw failure(400,'Choose a project folder within a drive.');
 const contains=(parent,child)=>{const relative=path.relative(parent,child);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))};
 for(const protectedPath of [home,...protectedDirectories]) {
  if(contains(folder,protectedPath)||contains(protectedPath,folder))throw failure(403,'Choose a project folder outside the companion and Codex credential profiles.');
 }
 return folder;
}
export function folderStore({configPath,initialWorkspaces,home,pickFolder=pickWindowsFolder,openFolder=openWindowsFolder}) {
 let workspaces=[...initialWorkspaces],queue=Promise.resolve();
 const threadsPath=configPath?path.join(path.dirname(configPath),'project-threads.json'):null;
 let memoryThreads={};
 function serialized(action) {const next=queue.then(action);queue=next.catch(()=>{});return next;}
 async function readJSON(file,fallback) {
  try{return JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''))}
  catch(error){if(error.code==='ENOENT')return fallback;throw failure(503,'Saved companion settings could not be read. Repair the settings before continuing.');}
 }
 async function atomicJSON(file,value) {
  await mkdir(path.dirname(file),{recursive:true});
  const temp=file+'.'+randomUUID()+'.tmp';
  await writeFile(temp,JSON.stringify(value,null,2),'utf8');await rename(temp,file);
 }
 return {
  get workspaces(){return [...workspaces]},
  async choose() {
   const selected=await pickFolder(),folder=await validateFolder(selected,home,configPath?[path.dirname(configPath)]:[]);
   return serialized(async()=>{
    if(!workspaces.includes(folder)) {
     if(configPath){const settings=await readJSON(configPath,{});await atomicJSON(configPath,{...settings,folders:[...new Set([...(settings.folders||[]),...workspaces,folder])]});}
     workspaces=[...new Set([...workspaces,folder])];
    }
    return {folder};
   });
  },
  async authorized(value) {const folder=await validateFolder(value,home,configPath?[path.dirname(configPath)]:[]);if(!workspaces.includes(folder))throw failure(403,'Choose this folder with the computer folder picker first.');return folder;},
  async open(value){const folder=await this.authorized(value);await openFolder(folder);return {opened:true};},
  async prepare(value,bridge,projectId) {
   const folder=await this.authorized(value);
   return serialized(async()=>{
    const records=threadsPath?await readJSON(threadsPath,{}):memoryThreads;
    const key=JSON.stringify([projectId||folder,folder]);
    const chats=records[key]||(!projectId?records[folder]:null)||{};
    for(const mode of ['plan','apply','work']) {
     chats[mode]=await bridge.prepare(folder,mode,chats[mode]);
     records[key]=chats;
     if(threadsPath)await atomicJSON(threadsPath,records);else memoryThreads=records;
    }
    return {folder,chats:Object.entries(chats).filter(([mode])=>['plan','apply','work'].includes(mode)).map(([mode,threadId])=>({mode,threadId}))};
   });
  }
 };
}
