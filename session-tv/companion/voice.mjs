/* Voicebox REST adapter. Requests stay on the explicitly selected local service. */
const error = (status, message) => Object.assign(new Error(message), {status});
export function voiceboxOrigin(value = 'http://127.0.0.1:17493') {
 const url = new URL(value);
 if(url.protocol !== 'http:' || !['127.0.0.1','localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)throw error(400,'Use a local Voicebox URL such as http://127.0.0.1:17493.');
 return url.origin;
}
export function voiceService({fetcher = fetch, pause = ms => new Promise(resolve => setTimeout(resolve, ms))} = {}) {
 async function request(base, route, options = {}, signal) {
  let response;
  try { response = await fetcher(base + route, {...options, redirect:'error', signal}); }
  catch(cause) { if(signal?.aborted)throw cause;throw error(503,'Voicebox is unavailable. Open Voicebox and check its local server address.'); }
  if(!response.ok)throw error(502,'Voicebox request failed ('+response.status+'). Check the selected voice and loaded model.');
  return response;
 }
 async function read(response, limit) {
  const chunks=[];let size=0;
  for await(const chunk of response.body) {size+=chunk.length;if(size>limit){await response.body.cancel?.().catch(()=>{});throw error(502,'Voicebox response is too large.');}chunks.push(Buffer.from(chunk));}
  return Buffer.concat(chunks);
 }
 async function json(base,route,options,signal){const response=await request(base,route,options,signal);return JSON.parse((await read(response,1024*1024)).toString('utf8'));}
 return {
  async voices({baseUrl},signal) {
   const result=await json(voiceboxOrigin(baseUrl),'/profiles',{},signal);
   if(!Array.isArray(result))throw error(502,'Voicebox returned an invalid voice list.');
   return {voices:result.slice(0,500).map(profile=>({id:String(profile.id),name:String(profile.name),language:String(profile.language||'en')}))};
  },
  async speak({baseUrl,voiceId,text},signal) {
   const base=voiceboxOrigin(baseUrl);
   if(typeof voiceId!=='string'||!voiceId.trim()||voiceId.length>200)throw error(400,'Select a Voicebox voice.');
   if(typeof text!=='string'||!text.trim()||text.length>10000)throw error(400,'Speech must contain 1–10,000 characters.');
   let generation;
   try {
    generation=await json(base,'/speak',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({profile:voiceId,text,personality:false})},signal);
    if(typeof generation.id!=='string'||!generation.id||generation.id.length>200)throw error(502,'Voicebox returned an invalid generation.');
    const id=encodeURIComponent(generation.id),deadline=Date.now()+180000;
    while(generation.status!=='completed') {
     if(['failed','error','cancelled','canceled'].includes(generation.status))throw error(502,'Voicebox could not generate this speech. Check its model status.');
     if(Date.now()>deadline)throw error(504,'Voicebox speech generation timed out. Try a shorter response.');
     signal?.throwIfAborted();await pause(600);
     generation=await json(base,'/history/'+id,{},signal);
    }
    const response=await request(base,'/audio/'+id,{},signal),type=response.headers.get('content-type')||'';
    if(!/^audio\//i.test(type))throw error(502,'Voicebox did not return playable audio.');
    return {type,body:await read(response,50*1024*1024)};
   } catch(cause) {
    if(generation?.id && generation.status!=='completed')request(base,'/generate/'+encodeURIComponent(generation.id)+'/cancel',{method:'POST'},AbortSignal.timeout(3000)).catch(()=>{});
    throw cause;
   }
  }
 };
}
