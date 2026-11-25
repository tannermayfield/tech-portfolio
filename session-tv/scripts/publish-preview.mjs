import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import demoSnapshot from '../public/js/demo-snapshot.js';
// The allowlist lives in public/js/demo-snapshot.js so the browser, this script and the companion share it.
export const {publicSnapshot,validateSnapshot,renderDemoFile}=demoSnapshot;
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [, ,input,output]=process.argv;if(!input||!output)throw Error('Usage: node scripts/publish-preview.mjs <backup.json> <output-demo-data.js>. Review the generated public data before deploying.');
 const snapshot=publicSnapshot(JSON.parse(await readFile(input,'utf8')));await writeFile(output,renderDemoFile(snapshot));console.log('Public snapshot prepared:',Object.keys(snapshot.database.tasks).length,'tasks,',Object.keys(snapshot.database.projects).length,'projects,',Object.keys(snapshot.preferences).length,'preference records. Review before deploying. Original backup unchanged.');
}
