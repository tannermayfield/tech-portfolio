import {createUsernameLogin} from './handler.mjs';
const url=Deno.env.get('SUPABASE_URL');
const admin=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const anon=Deno.env.get('SUPABASE_ANON_KEY');
const origin=Deno.env.get('SESSIONTV_ALLOWED_ORIGIN')||'https://tannermayfield.dev';
if(!url||!admin||!anon)throw new Error('Supabase-managed function credentials are required.');
const key=await crypto.subtle.importKey('raw',new TextEncoder().encode('sessiontv-login:'+admin),{name:'HMAC',hash:'SHA-256'},false,['sign']);
async function hash(value){return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
async function rpc(name,body){const response=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:admin,Authorization:'Bearer '+admin,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error('Account service unavailable.');return response.json()}
Deno.serve(createUsernameLogin({origin,
 rateLimit:async(username,req)=>rpc('sessiontv_allow_password_attempt',{username_key:await hash('username:'+username),ip_key:await hash('ip:'+(req.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown'))}),
 lookup:username=>rpc('sessiontv_lookup_login_email',{login_username:username}),
 signIn:async(email,password,captchaToken)=>{
  const response=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email,password,...(captchaToken?{gotrue_meta_security:{captcha_token:captchaToken}}:{})}),signal:AbortSignal.timeout(15000)});
  return {ok:response.ok,status:response.status,session:response.ok?await response.json():null};
 }
}));
