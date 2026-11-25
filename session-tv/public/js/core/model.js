/* ---------- model: record types, shared state and lookups ---------- */
const TYPES={
  class:{label:'Classwork',tag:'Class',short:'Class',page:'Class',mood:'class',level:2.6,
    rule:'You do the work. AI coach explains concepts and checks your understanding, but never produces graded answers.'},
  skill:{label:'Skill Development',tag:'Skills',short:'Skill',page:'Skills',mood:'skill',level:3.8,
    rule:'Learn it, practice it, then apply it. Try it cold first; AI coach teaches what you don\'t know yet and checks your work.'},
  project:{label:'Personal Projects',tag:'Projects',short:'Project',page:'Projects',mood:'project',level:3.2,
    rule:'AI coach can do the heavy lifting. Your job is to explain what it built and why.'}
};
const CATS=['class','skill','project'];
const PIPE_RULE='You build it. AI coach teaches and hints, never writes your code or config.';
const COLOR={class:'var(--class)',skill:'var(--pipeline)',project:'var(--personal)'};
const MOODS={class:{label:'Class'},skill:{label:'Skills'},project:{label:'Projects'}};
const COACH_RULES={
  class:'This is graded coursework. Teach concepts, quiz him, and check his understanding. Do not write answers he would submit for a grade. If the task is a proctored quiz or says no AI, tell him to close this chat and do it on his own.',
  skill:'This is a skill he is building for a data analyst co-op interview at Delta Air Lines. Match his stage: at New or Learned, teach it step by step with a concrete example (airline data when natural) and check understanding after each step; at Experienced or Mastered, give realistic practice problems with a small schema or sample data and no solution, then check correctness and edge cases (NULLs, ties, duplicates) and ask him to explain his choices. When it fits, show how the skill applies to his IS classes or his airline pipeline project. Reveal a full solution only if he explicitly asks.',
  project:'This is a personal project where AI may write the code. Help freely, but always explain what the code does and why it was built that way, and check that he understands it.',
  pipeline:'This is a portfolio project he must build himself so he can explain every decision in an interview. Teach concepts, ask what he has tried, and give the smallest useful hint. Tiny generic syntax examples are fine, but never write his actual Lambda code, Glue config, SQL, or IAM policy. Push him to explain trade-offs.'
};
/* skill stages: 1 NEW · 2 LEARNED · 3 EXPERIENCED · 4 MASTERED */
const skillLevel=t=>{const n=+t.level;return n>=1?Math.min(4,Math.round(n)):(t.track==='practice'?2:1)};
// old sessions and drafts used four categories; practice + develop are now one Skills category
const mapOldCat=k=>k==='practice'||k==='develop'?'skill':k==='grind'?'class':k==='creative'?'project':k;

let db=null,sample=null;
let tasks=[],archived=[],sessions=[],current=null,settings={};
const loaded={tasks:false,sessions:false,state:false};
let view='work'; // 'work', or 'log' while the learning log is open on top
let coachTurns={},coachCtl=null,confidence=0,wrapping=false;

const T=id=>tasks.find(t=>t.id===id)||archived.find(t=>t.id===id)||globalThis.SessionProjectChats?.channel(id)||globalThis.SessionSkills?.channel(id);
// one main skill per area (SQL, AWS, Python for Data…). Older sub-skills were archived and point at their main skill.
const mainSkillName=t=>{if(!t||!isSkill(t))return null;if(t.mainId){const m=T(t.mainId);return m?m.title:(t.course||t.title)}return t.title};
const mainSkillTask=n=>tasks.find(t=>isSkill(t)&&t.title===n);
const typeOf=t=>t.track==='practice'||t.track==='develop'?'skill':TYPES[t.track]?t.track:'project';
const isSkill=t=>t.track==='practice'||t.track==='develop';
const isPipe=t=>String(t.course||'').toLowerCase()==='airline pipeline';
const ruleOf=t=>isPipe(t)?PIPE_RULE:TYPES[typeOf(t)].rule;
const openTasks=()=>tasks.filter(t=>t.status!=='done');
const leadOf=t=>t.leadDays!=null&&t.leadDays!==''&&Number.isFinite(+t.leadDays)?+t.leadDays:1;
const isUrgent=t=>{if(t.track!=='class'||t.status==='done')return false;if(!t.due)return true;const n=daysUntil(t.due),L=leadOf(t);return n<=L||(n===L+1&&!!t.dueTime&&t.dueTime<'13:00')};

/* ---------- candidates per type ---------- */
function candidates(type){
  const open=openTasks().filter(t=>typeOf(t)===type);
  if(type==='class')return [...open.filter(isUrgent).sort(byDue),...open.filter(t=>!isUrgent(t)).sort(byDue)];
  if(type==='skill')return open.sort((a,b)=>{const x=a.lastPracticed||'',y=b.lastPracticed||'';return x<y?-1:x>y?1:(skillLevel(b)-skillLevel(a))||byOrder(a,b)});
  return open.sort((a,b)=>(isPipe(b)-isPipe(a))||byOrder(a,b));
}

/* skill stages and categories */
const LVL_COLORS=['','#F2706B','#EDCB45','#9AD657','#3FD18B'];
const LVL_NAMES=['','New','Learned','Experienced','Mastered'];
const LVL_TAG=n=>(LVL_NAMES[n]||'New').toUpperCase();
const SKILL_TAGS={Data:['SQL','Databases','Python','Data engineering','Visualization','BI'],AI:['Machine learning','Deep learning','Generative AI','Responsible AI','AI'],Software:['Python','JavaScript','Node.js','HTML/CSS'],Cloud:['AWS'],PM:['Scrum','Project management'],'Soft Skills':['Interview','Communication']};
// a skill's category: its own "cat" field when set (Python lives in both Data and Software), else the first category that lists its subcategory
const catOf=t=>t.cat&&SKILL_TAGS[t.cat]?t.cat:(Object.keys(SKILL_TAGS).find(k=>SKILL_TAGS[k].includes(t.course||''))||'Soft Skills');
