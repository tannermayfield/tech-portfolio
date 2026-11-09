import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const taskFields=['track','title','course','goal','status','order','due','dueTime','leadDays','level','phase','reps','lastPracticed','doneAt'];
const select=(value,fields)=>Object.fromEntries(fields.filter(k=>Object.hasOwn(value,k)).map(k=>{if(value[k]!==null&&!['string','number','boolean'].includes(typeof value[k]))throw Error('Invalid public field: '+k);return [k,value[k]]}));
export function publicSnapshot(backup){
 if(backup?.format!=='session-tv-backup'||backup.version!==1||typeof backup.values?.['sessiontv.database.v1']!=='string')throw Error('Choose a Session TV JSON backup.');
 const original=JSON.parse(backup.values['sessiontv.database.v1']);
 const database={tasks:{},projects:{},sessions:{},state:{},settings:{main:{portfolioUrl:'https://tannermayfield.dev/',autoOpen:false}}};
 for(const [id,task]of Object.entries(original.tasks||{})){if(!/^[\w-]+$/.test(id)||!task||typeof task!=='object')throw Error('Invalid task.');database.tasks[id]=select(task,taskFields)}
 for(const [id,project]of Object.entries(original.projects||{})){if(!/^[\w-]+$/.test(id)||!project||typeof project!=='object')throw Error('Invalid project.');const record=select(project,['name']);if(Array.isArray(project.skills))record.skills=project.skills.filter(x=>typeof x==='string');if(project.sprint){record.sprint=select(project.sprint,['num','goal','start','end','status','step']);record.sprint.items=(project.sprint.items||[]).map(item=>typeof item==='string'?item:select(item,['id','pts','who']))}database.projects[id]=record;}
 return {version:1,source:'owner',publishedAt:new Date().toISOString(),database};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [, ,input,output]=process.argv;if(!input||!output)throw Error('Usage: node scripts/publish-preview.mjs <backup.json> <output-demo-data.js>. Review the generated public data before deploying.');
 const snapshot=publicSnapshot(JSON.parse(await readFile(input,'utf8')));await writeFile(output,'// Public read-only snapshot. Private chats, settings and drafts are excluded.\nwindow.SessionTVDemo = '+JSON.stringify(snapshot,null,2).replaceAll('<','\\u003c')+';\n');console.log('Public snapshot prepared:',Object.keys(snapshot.database.tasks).length,'tasks,',Object.keys(snapshot.database.projects).length,'projects. Review before deploying. Original backup unchanged.');
}
