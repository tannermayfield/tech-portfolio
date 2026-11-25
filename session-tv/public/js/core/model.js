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
/* The coach profile (Preferences → Coach, kept in sb.coachProfile) says who the AI coach is tutoring.
   Prompt templates are written with he/him; coachVoice rewrites them to the profile's pronouns. */
const COACH_PRONOUNS={'he/him':['he','him','his','himself'],'she/her':['she','her','her','herself'],'they/them':['they','them','their','themselves']};
function coachProfile(){
  const base=SessionTV.preferences.defaultFor('sb.coachProfile'),saved=recall('sb.coachProfile'),out={...base};
  if(saved&&typeof saved==='object'&&!Array.isArray(saved)){
    for(const key of ['name','pronouns','school','goal','focus'])if(typeof saved[key]==='string')out[key]=saved[key].trim();
    if(Array.isArray(saved.buildProjects))out.buildProjects=saved.buildProjects;
  }
  out.buildProjects=[...new Set((out.buildProjects||[]).map(name=>String(name??'').trim()).filter(Boolean))];
  if(!COACH_PRONOUNS[out.pronouns])out.pronouns=base.pronouns;
  return out;
}
// "they" takes plural verbs: "he has tried" becomes "they have tried", "he learns" becomes "they learn"
const COACH_VERBS={is:'are',has:'have',was:'were',does:'do',goes:'go'};
const COACH_ADVERBS='still|also|actually|really|already|just|only|now|then|often|usually|never|always|sometimes';
function coachVerb(word){
  const lower=word.toLowerCase();if(COACH_VERBS[lower])return COACH_VERBS[lower];
  if(/^(always|perhaps|sometimes|thus|this|plus|less|across|us|yes|its)$/.test(lower)||!/[a-z][^s]s$/.test(lower))return word;
  return /(ch|sh|x|z|ss|o)es$/.test(lower)?word.slice(0,-2):/[^aeiou]ies$/.test(lower)?word.slice(0,-3)+'y':word.slice(0,-1);
}
const COACH_SUBJECT_RE=new RegExp(`\\b(he)\\b((?:\\s+(?:${COACH_ADVERBS}))*)(\\s+)([A-Za-z]+)`,'gi');
function coachVoice(text,profile=coachProfile()){
  const forms=COACH_PRONOUNS[profile.pronouns]||COACH_PRONOUNS['he/him'];
  let out=String(text);
  if(profile.pronouns==='they/them')out=out.replace(COACH_SUBJECT_RE,(match,he,adverbs,gap,verb)=>he+adverbs+gap+coachVerb(verb));
  return out.replace(/\b(he|him|his|himself)\b/gi,pronoun=>{
    const form=forms[['he','him','his','himself'].indexOf(pronoun.toLowerCase())];
    return pronoun[0]===pronoun[0].toUpperCase()?form[0].toUpperCase()+form.slice(1):form;
  });
}
// a template tag: the literal text is rewritten to the profile's pronouns; ${values} stay exactly as they are
function coachSay(parts,...values){const profile=coachProfile();return parts.reduce((out,part,i)=>out+coachVoice(part,profile)+(i<values.length?values[i]:''),'')}
// e.g. "Sam, an Information Systems student preparing for a data analyst internship"
function coachLearner(profile=coachProfile()){
  const school=profile.school?`, ${/^[aeiou]/i.test(profile.school)?'an':'a'} ${profile.school} student`:'';
  return (profile.name||'the learner')+school+(profile.goal?(school?' ':', ')+'preparing for '+profile.goal:'');
}
// rules per chat kind, built from the coach profile each time they are read (core/projects.js adds the proj_* modes)
const COACH_RULES={
  get class(){return coachSay`This is graded coursework. Teach concepts, quiz him, and check his understanding. Do not write answers he would submit for a grade. If the task is a proctored quiz or says no AI, tell him to close this chat and do it on his own.`},
  get skill(){
    const p=coachProfile(),projects=p.buildProjects.join(', ');
    return coachSay`This is a skill he is building${p.goal?' for '+p.goal:''}. Match his stage: at New or Learned, teach it step by step with a concrete example (the airline sample data when natural) and check understanding after each step; at Experienced or Mastered, give realistic practice problems with a small schema or sample data and no solution, then check correctness and edge cases (NULLs, ties, duplicates) and ask him to explain his choices. When it fits, show how the skill applies to his classes${projects?coachSay` or his ${projects} project`+(p.buildProjects.length>1?'s':''):''}. Reveal a full solution only if he explicitly asks.`;
  },
  get project(){return coachSay`This is a personal project where AI may write the code. Help freely, but always explain what the code does and why it was built that way, and check that he understands it.`},
  get pipeline(){return coachSay`This is a portfolio project he must build himself so he can explain every decision in an interview. Teach concepts, ask what he has tried, and give the smallest useful hint. Tiny generic syntax examples are fine, but never write his actual code, config, queries, or policies for it. Push him to explain trade-offs.`}
};
/* skill stages: New, Learned, Experienced, Mastered (stored as level 1 to 4, shown only by name) */
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
// a project the coach profile lists under "build it myself": the coach teaches and hints but never writes it
const isPipe=t=>{const name=String(t.course||'').trim().toLowerCase();return !!name&&coachProfile().buildProjects.some(project=>project.toLowerCase()===name)};
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
const SKILL_TAGS={Data:['SQL','Databases','Python (Data)','Data engineering','Visualization','BI'],AI:['Machine learning','Deep learning','Generative AI','Responsible AI'],Software:['Python (Software)','JavaScript','Node.js','HTML/CSS'],Cloud:['AWS'],PM:['Scrum','Project management'],'Soft Skills':['Interview','Communication']};
// a skill's category: its own "cat" field when set, else the first category that lists its skill.
// A tool still named plain "Python" (from before the Python (Data) / Python (Software) split) belongs to Data.
const catOf=t=>t.cat&&SKILL_TAGS[t.cat]?t.cat:(Object.keys(SKILL_TAGS).find(k=>SKILL_TAGS[k].includes(t.course||''))||(t.course==='Python'?'Data':'Soft Skills'));
// the id of a skill's channel: its menu entry, chat, level, practice stamps and code editor choice
const skillChannelId=(category,skill)=>'skill:'+encodeURIComponent(category)+':'+encodeURIComponent(skill);
