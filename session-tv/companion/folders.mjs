import {spawn} from 'node:child_process';
import {mkdir,readFile,realpath,rename,stat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const failure=(status,message)=>Object.assign(new Error(message),{status});
function run(executable,args) {
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});
  let output='';
  const timer=setTimeout(()=>{
   child.kill();
   reject(failure(408,'Folder selection timed out. Choose a folder again and complete the Windows dialog within two minutes.'));
  },150000);
  child.stdout.on('data',chunk=>{output+=chunk;if(output.length>65536){child.kill();clearTimeout(timer);reject(failure(503,'Windows returned an invalid folder selection.'))}});
  child.stderr.resume();
  child.once('error',()=>{clearTimeout(timer);reject(failure(503,'Windows could not open the folder picker.'))});
  child.once('close',code=>{
   clearTimeout(timer);
   if(code===0){resolve(output.trim());return}
   reject(failure(503,'Windows folder selection failed. Try again.'));
  });
 });
}
export async function pickWindowsFolder() {
 if(process.platform!=='win32')throw failure(503,'Native folder selection is supported on Windows.');
 const script=`$ErrorActionPreference = 'Stop';
Add-Type -TypeDefinition 'using System;
using System.Runtime.InteropServices;
public static class SessionTVFolderPicker {
 [ComImport, Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")]
 private class FileOpenDialog {}
 [ComImport, Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 private interface IFileDialog {
  [PreserveSig] int Show(IntPtr owner);
  void SetFileTypes(uint count, IntPtr types);
  void SetFileTypeIndex(uint index);
  void GetFileTypeIndex(out uint index);
  void Advise(IntPtr events, out uint cookie);
  void Unadvise(uint cookie);
  void SetOptions(uint options);
  void GetOptions(out uint options);
  void SetDefaultFolder(IShellItem folder);
  void SetFolder(IShellItem folder);
  void GetFolder(out IShellItem folder);
  void GetCurrentSelection(out IShellItem selection);
  void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
  void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string name);
  void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
  void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
  void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
  void GetResult(out IShellItem result);
  void AddPlace(IShellItem item, uint location);
  void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
  void Close(int result);
  void SetClientGuid(ref Guid guid);
  void ClearClientData();
  void SetFilter(IntPtr filter);
 }
 [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 private interface IShellItem {
  void BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, out IntPtr result);
  void GetParent(out IShellItem parent);
  void GetDisplayName(uint kind, out IntPtr name);
  void GetAttributes(uint mask, out uint attributes);
  void Compare(IShellItem other, uint hint, out int order);
 }
 public static string Choose() {
  IFileDialog dialog = (IFileDialog)new FileOpenDialog();
  IShellItem result = null;
  IntPtr name = IntPtr.Zero;
  try {
   uint options;
   dialog.GetOptions(out options);
   // Pick an existing filesystem folder with the standard Explorer dialog.
   dialog.SetOptions(options | 0x20u | 0x40u | 0x800u | 0x02000000u);
   dialog.SetTitle("Choose your Session TV project folder");
   dialog.SetOkButtonLabel("Choose folder");
   int status = dialog.Show(IntPtr.Zero);
   if (status == unchecked((int)0x800704C7)) return null;
   Marshal.ThrowExceptionForHR(status);
   dialog.GetResult(out result);
   result.GetDisplayName(0x80058000u, out name);
   return Marshal.PtrToStringUni(name);
  } finally {
   if (name != IntPtr.Zero) Marshal.FreeCoTaskMem(name);
   if (result != null) Marshal.ReleaseComObject(result);
   Marshal.ReleaseComObject(dialog);
  }
 }
}';
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false);
[Console]::Write([SessionTVFolderPicker]::Choose());
`;

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
