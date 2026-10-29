// Server-only transport. No third-party SDK, fallback, automatic retry or key logging.
import {preferredModel,endpoint,assertURL,selectModel} from './config.mjs';
import {wireRequest,parseResponse} from './learning-ai-provider.mjs';
import {BoundaryError,need,fail} from './errors.mjs';
const nativeFetch=globalThis.fetch?.bind(globalThis);
export const liveLimits=Object.freeze({catalogueCalls:1,inferenceCalls:1,catalogueTimeoutMs:15000,inferenceTimeoutMs:25000,catalogueBytes:200000,responseBytes:100000,maxCompletionTokens:2048,maxWireCharacters:45000,maxReservedTokens:30000,retries:0});
async function boundedBody(response,maximum,signal){
 need(response.body&&typeof response.body.getReader==='function','INVALID_RESPONSE');
 const reader=response.body.getReader(),chunks=[];let size=0;
 const cancel=()=>{reader.cancel().catch(()=>{});};signal.addEventListener('abort',cancel,{once:true});
 try{while(true){if(signal.aborted)fail('TIMEOUT');const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maximum){await reader.cancel();fail('INVALID_RESPONSE');}chunks.push(value);}}
 finally{signal.removeEventListener('abort',cancel);reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('INVALID_RESPONSE');}
}
function httpError(status){if(status===401||status===403)fail('AUTHENTICATION_ERROR');if(status===429)fail('RATE_LIMIT');if(status===404)fail('MODEL_NOT_AVAILABLE');if(status>=500)fail('PROVIDER_UNAVAILABLE');fail('INVALID_RESPONSE');}
// Optional ports are for trusted local tests only. HTTP clients cannot supply them.
export function createLearningAIProvider({enabled=false,transport=nativeFetch,getCredential=()=>process.env.NEBIUS_API_KEY,getConfiguredModel=()=>process.env.NEBIUS_MODEL_ID,catalogueTimeoutMs=15000,inferenceTimeoutMs=25000}={}){
 need(enabled===true,'POLICY_BLOCKED');
 need(typeof transport==='function'&&typeof getCredential==='function'&&typeof getConfiguredModel==='function','POLICY_BLOCKED');
 need(Number.isInteger(catalogueTimeoutMs)&&catalogueTimeoutMs>0&&catalogueTimeoutMs<=15000&&Number.isInteger(inferenceTimeoutMs)&&inferenceTimeoutMs>0&&inferenceTimeoutMs<=25000,'POLICY_BLOCKED');
 let used=false,catalogueCalls=0,inferenceCalls=0;const diagnostic={catalogue_http_status:null,inference_http_status:null,model_available:null,output_validated:false};
 async function request(operation,credential,body){
  const url=assertURL(endpoint(operation)),catalogue=operation==='models',controller=new AbortController();let timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new BoundaryError('TIMEOUT'));},catalogue?catalogueTimeoutMs:inferenceTimeoutMs);});
  try{return await Promise.race([timeout,(async()=>{
   const response=await transport(url,{method:catalogue?'GET':'POST',headers:{Authorization:'Bearer '+credential,'Content-Type':'application/json'},redirect:'error',credentials:'omit',signal:controller.signal,...(body?{body}:{})});
   need(!response.url||response.url===url,'HOST_BLOCKED');
   diagnostic[catalogue?'catalogue_http_status':'inference_http_status']=Number.isInteger(response.status)?response.status:null;
   if(!response.ok){await response.body?.cancel().catch(()=>{});httpError(response.status);}
   const raw=await boundedBody(response,catalogue?liveLimits.catalogueBytes:liveLimits.responseBytes,controller.signal);
   need(!raw.includes(credential),'INVALID_RESPONSE');
   let decoded;try{decoded=JSON.parse(raw);}catch{fail('INVALID_RESPONSE');}
   // Also reject escaped/decoded key echoes, not only literal response bytes.
   need(!JSON.stringify(decoded).includes(credential),'INVALID_RESPONSE');
   return raw;
  })()]);}catch(e){if(e instanceof BoundaryError)throw e;fail(controller.signal.aborted?'TIMEOUT':'NETWORK_ERROR');}finally{clearTimeout(timer);}
 }
 return Object.freeze({
  status:()=>({configuration:'NEBIUS_LIVE',oneShotConsumed:used}),
  get counts(){return {catalogue_calls:catalogueCalls,inference_calls:inferenceCalls,simulated_calls:0};},
  get diagnostics(){return structuredClone(diagnostic);},
  async generate(raw,recheck){
   need(typeof recheck==='function','POLICY_BLOCKED');
   const requestCopy=structuredClone(raw),wire=wireRequest(requestCopy);
   need(requestCopy.verification.report.verification_source==='DETERMINISTIC_CHECKER'&&['CORRECT','INCORRECT'].includes(requestCopy.verification.report.verdict),'POLICY_BLOCKED');
   recheck();need(!used,'CALL_LIMIT');used=true;
   let credential;
   try{credential=getCredential();need(typeof credential==='string'&&credential.trim().length>0,'MISSING_PROVIDER_SECRET');
    const configured=getConfiguredModel()||null;need(!configured||configured===preferredModel,'MODEL_CHANGE_REQUIRES_APPROVAL');
    recheck();catalogueCalls++;
    const catalogue=JSON.parse(await request('models',credential));
    need(Array.isArray(catalogue?.data),'INVALID_RESPONSE');
    diagnostic.model_available=catalogue.data.some(x=>x?.id===preferredModel);
    selectModel(configured,catalogue.data.map(x=>x?.id));
    recheck();inferenceCalls++;
    const response=await request('chat/completions',credential,wire.serialized);
    recheck();const result=parseResponse(response,requestCopy,wire.reserved);
    need(!JSON.stringify(result).includes(credential),'INVALID_RESPONSE');
    const envelope=JSON.parse(response);
    diagnostic.actual_model=preferredModel;diagnostic.finish_reason='stop';diagnostic.usage=Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].map(k=>[k,envelope.usage[k]]));diagnostic.output_validated=true;
    return {provider:'NEBIUS_LIVE',model:preferredModel,responseId:envelope.id,result};
   }catch(e){if(e instanceof BoundaryError)throw e;fail('NETWORK_ERROR');}finally{credential=undefined;}
  }
 });
}
