/* SessionTV extension points.
   Core functions are defined once. A feature file that needs to add to one of them registers a
   handler here instead of reassigning the global function. See "Extending SessionTV" in AGENTS.md.

   SessionTV.hooks.after(name, fn)   fn(...args) runs after the core function returns.
   SessionTV.hooks.before(name, fn)  fn(...args) runs before the core function.
   SessionTV.hooks.wrap(name, fn)    fn(next, ...args) runs around it; call next(...args) to continue,
                                     or return without calling next to replace the core behavior.
   SessionTV.hooks.run(name, args, core)  used by the core function that owns the point.

   Order: handlers compose in registration (script load) order, and a handler registered later sits
   outside the earlier ones. So for a call, later wraps/befores run first, and afters run in
   registration order once the inner layers have returned. */
(() => {
 const points={
  'settings:render':'renderSettings(): the Settings home or the open My Database view was drawn.',
  'settings:open':'openSettings(): the Settings sheet is about to open.',
  'dbView:render':'renderDbView(view): a My Database view (classes, skills, projects…) was drawn into #set-body.',
  'guide:open':'openGuide(): the channel menu is about to open.',
  'guide:render':'renderGuide(): the channel menu was drawn.',
  'work:render':'renderWork(): the TV work screen (chat header, editor, project panel) was drawn.',
  'coach:render':'renderCoachLog(): the chat log for the active channel is drawn. Wrap it to draw a different chat.',
  'coach:send':'sendCoach(text, show, options): a chat message is sent. Wrap it to route it to another chat provider; resolve to the result.',
  'subs:list':'subsOf(kind): the sub-channels of a section (class courses, skill categories, projects) are listed.',
  'theme:pick':'pickTheme(section): the cutscene theme for a section is chosen. Wrap it to return a different theme.',
  'song:render':'renderSong(): the song plate beside the speaker is drawn.',
  'project:panel':'projectPanel(task, name, mode): the project side panel body was drawn for plan, apply or work mode.'
 };
 const layers=new Map(Object.keys(points).map(name=>[name,[]]));
 function list(name){const found=layers.get(name);if(!found)throw new Error('Unknown SessionTV hook "'+name+'". Add it to core/hooks.js first.');return found}
 function check(fn){if(typeof fn!=='function')throw new TypeError('SessionTV hook handlers must be functions.');return fn}
 function wrap(name,fn){list(name).push(check(fn))}
 function before(name,fn){check(fn);wrap(name,(next,...args)=>{fn(...args);return next(...args)})}
 function after(name,fn){check(fn);wrap(name,(next,...args)=>{const result=next(...args);fn(...args);return result})}
 function run(name,args,core){
  let call=core;
  for(const layer of list(name)){const inner=call;call=(...values)=>layer(inner,...values)}
  return call(...Array.from(args||[]));
 }
 globalThis.SessionTV=Object.assign(globalThis.SessionTV||{},{hooks:Object.freeze({points:Object.freeze({...points}),wrap,before,after,run})});
})();
