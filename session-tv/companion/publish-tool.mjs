const tool={
 name:'publish_sessiontv',
 description:'Publish the current SessionTV changes in the linked portfolio checkout to GitHub Pages. Call after checking your changes, or when the user asks to publish. Returns the actual push and live verification result. This tool uses the configured repository and branch.',
 inputSchema:{type:'object',properties:{},additionalProperties:false}
};

export async function publishToolResponse(request,publish){
 if(request?.jsonrpc!=='2.0'||typeof request.method!=='string')return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}};
 if(!Object.hasOwn(request,'id'))return null;
 const response={jsonrpc:'2.0',id:request.id};
 let result;
 switch(request.method){
  case 'initialize':
   result={protocolVersion:['2025-03-26','2025-06-18','2025-11-25'].includes(request.params?.protocolVersion)?request.params.protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'sessiontv_release',version:'1.0.0'}};
   break;
  case 'ping': result={};break;
  case 'tools/list': result={tools:[tool]};break;
  case 'tools/call': {
   const args=request.params?.arguments;
   if(request.params?.name!==tool.name||(args!==undefined&&(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).length)))return {...response,error:{code:-32602,message:'Choose publish_sessiontv without arguments.'}};
   try{result={content:[{type:'text',text:JSON.stringify(await publish())}]};}
   catch(error){result={isError:true,content:[{type:'text',text:error.message}]};}
   break;
  }
  default:return {...response,error:{code:-32601,message:'Method not found'}};
 }
 return {...response,result};
}
