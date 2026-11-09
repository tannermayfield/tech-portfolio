/* The Edge Function is the only component allowed to resolve username -> email. */
export function createUsernameLogin({origin,rateLimit,lookup,signIn}) {
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 return async function handle(req){
  const cors=req.headers.get('origin')===origin?{'Access-Control-Allow-Origin':origin}:{};
  const reply=(status,body)=>new Response(JSON.stringify(body),{status,headers:{...headers,...cors}});
  if(req.headers.get('origin')!==origin)return reply(403,{error:'Origin not allowed.'});
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,...cors,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'content-type, apikey, authorization'}});
  if(req.method!=='POST')return reply(405,{error:'Use a POST request.'});
  if(!req.headers.get('content-type')?.startsWith('application/json'))return reply(415,{error:'JSON required.'});
  try {
   // Stream-limit the body; never log request data or provider errors containing credentials.
   const reader=req.body?.getReader();if(!reader)return reply(400,{error:'Enter your username and password.'});
   const chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192){await reader.cancel();return reply(413,{error:'Request too large.'})}chunks.push(value)}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
   let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{return reply(400,{error:'Invalid request.'})}
   if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,{error:'Invalid request.'});
   const username=typeof body.username==='string'?body.username.trim().toLowerCase():'';
   if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username)||typeof body.password!=='string'||!body.password||body.password.length>1024)return reply(400,{error:'Enter a valid username and password.'});
   if(!await rateLimit(username,req))return reply(429,{error:'Too many sign-in attempts. Wait 10 minutes and try again.'});
   const email=await lookup(username);
   // Always call Auth, including for unknown usernames, and use the same failure response.
   const result=await signIn(email||'username-not-found@sessiontv.invalid',body.password,body.captchaToken);
   if(!email||!result.ok)return reply(result.status===429?429:401,{error:result.status===429?'Too many sign-in attempts. Try again later.':'Incorrect username or password.'});
   const token=result.session;if(!token?.access_token||!token.refresh_token)return reply(503,{error:'Sign-in is temporarily unavailable.'});
   return reply(200,{access_token:token.access_token,refresh_token:token.refresh_token,token_type:token.token_type||'bearer',expires_in:token.expires_in,expires_at:token.expires_at});
  }catch{return reply(503,{error:'Username sign-in is not available. Check account setup or use email sign-in.'})}
 };
}
