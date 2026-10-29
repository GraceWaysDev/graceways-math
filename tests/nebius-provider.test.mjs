import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningAIProvider} from '../src/nebius-provider.mjs';
import {createBoundRequest} from '../src/binding.mjs';
import {verify} from '../src/math.mjs';
import {createWorkflow} from '../src/workflow.mjs';
import {preferredModel,endpoint} from '../src/config.mjs';
const canary='LOCAL_TEST_CREDENTIAL_NOT_A_REAL_KEY';
const report=()=>verify({equation:'x^2=4',solution:'{-2;2}'});
const request=(kind='REVIEW')=>createBoundRequest({id:'local-bound-test',kind,report:report(),input:kind==='TASK'?{subject:'Mathematik',brief:'Lineare Folgeaufgabe'}:{subject:'Mathematik',title:'Quadrat',instruction:'x^2=4',answer:'{-2;2}',teacher_notes:'Nur der Prüfer verifiziert.'}});
function mock(caseName='positive'){
 const calls=[];
 async function transport(url,options){
  calls.push({url,options});assert.equal(options.headers.Authorization,'Bearer '+canary);assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
  if(caseName==='timeout')return new Promise(()=>{});
  if(caseName==='network')throw Error(canary);
  if(url===endpoint('models')){
   if(caseName.startsWith('http'))return new Response(canary,{status:Number(caseName.slice(4))});
   if(caseName==='catalogue_oversize')return new Response('x'.repeat(200001));
   if(caseName==='catalogue_invalid')return new Response('{bad');
   const response=new Response(JSON.stringify({data:[{id:caseName==='missing_model'?'other':preferredModel}]}));
   if(caseName==='redirect')Object.defineProperty(response,'url',{value:'https://unapproved.invalid'});
   return response;
  }
  assert.equal(url,endpoint('chat/completions'));
  const wire=JSON.parse(options.body),payload=JSON.parse(wire.messages[1].content);
  assert.equal(wire.model,preferredModel);assert.equal(wire.max_tokens,2048);assert.equal(wire.chat_template_kwargs.enable_thinking,false);
  const result=payload.kind==='TASK'?{title:'Übung',instruction:'Löse x+1=2.',teacher_notes:'Ungeprüfter Entwurf.'}:{summary:'Ungeprüfte KI-Erklärung',feedback:'Begründe die einzelnen Schritte.',checks:[{quote:payload.input.answer.slice(0,30),comment:'Wortlaut ist belegt, keine neue Verifikation.'}],limitations:['Nur der unabhängige Prüfer bestätigt Mathematik.']};
  const inner={request_id:payload.request_id,input_hash:payload.input_hash,kind:payload.kind,verification_hash:payload.verification.report_hash,checker_verdict:payload.verification.report.verdict,...result};
  if(caseName==='contradiction')inner.checker_verdict='INCORRECT';
  if(caseName==='false_verification')inner.verified=true;
  if(caseName==='wrong_hash')inner.verification_hash='0'.repeat(64);
  if(caseName==='wrong_id')inner.request_id='different';
  if(caseName==='fabricated_quote')inner.checks[0].quote='not in the submitted answer';
  if(caseName==='key_echo'||caseName==='nested_key_echo')inner.feedback=canary;
  const data={id:'synthetic-provider-response',model:caseName==='wrong_model'?'other':preferredModel,choices:[{finish_reason:caseName==='length'?'length':'stop',message:{role:'assistant',content:JSON.stringify(inner),...(caseName==='refusal'?{refusal:'yes'}:{}),...(caseName==='tool'?{tool_calls:[{}]}:{})}}],usage:{prompt_tokens:100,completion_tokens:100,total_tokens:200}};
  if(caseName==='nested_key_echo')data.choices[0].message.content=data.choices[0].message.content.replace(canary,[...canary].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join(''));
  if(caseName==='no_usage')delete data.usage;
  if(caseName==='bad_usage')data.usage.total_tokens=2;
  if(caseName==='completion_limit')data.usage={prompt_tokens:100,completion_tokens:2049,total_tokens:2149};
  if(caseName==='oversize')return new Response('x'.repeat(100001));
  if(caseName==='stream_timeout')return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));}}));
  if(caseName==='malformed')return new Response('{bad');
  if(caseName==='escaped_key_echo')data.extra=canary;
  let raw=JSON.stringify(data);if(caseName==='escaped_key_echo')raw=raw.replace(canary,[...canary].map(c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join(''));
  return new Response(raw);
 }
 return {calls,transport};
}
const setup=(name='positive',extra={})=>{const m=mock(name);return {...m,provider:createLearningAIProvider({enabled:true,transport:m.transport,getCredential:()=>canary,getConfiguredModel:()=>null,...extra})};};
for(const kind of ['TASK','REVIEW'])test('bound '+kind+' through server adapter using local transport mock',async()=>{const {provider,calls}=setup();const r=await provider.generate(request(kind),()=>{});assert.equal(r.provider,'NEBIUS_LIVE');assert.equal(r.model,preferredModel);assert.equal(r.responseId,'synthetic-provider-response');assert.equal(calls.length,2);assert.deepEqual(provider.counts,{catalogue_calls:1,inference_calls:1,simulated_calls:0});assert.equal(provider.diagnostics.output_validated,true);assert.ok(!JSON.stringify(r).includes(canary));await assert.rejects(provider.generate(request(kind),()=>{}),/CALL_LIMIT/);assert.equal(calls.length,2);});
for(const [name,error,count] of [['missing_model','MODEL_NOT_AVAILABLE',1],['network','NETWORK_ERROR',1],['http401','AUTHENTICATION_ERROR',1],['http403','AUTHENTICATION_ERROR',1],['http429','RATE_LIMIT',1],['http500','PROVIDER_UNAVAILABLE',1],['redirect','HOST_BLOCKED',1],['catalogue_invalid','INVALID_RESPONSE',1],['catalogue_oversize','INVALID_RESPONSE',1],['contradiction','INVALID_RESPONSE',2],['false_verification','INVALID_RESPONSE',2],['wrong_hash','INVALID_RESPONSE',2],['wrong_id','INVALID_RESPONSE',2],['wrong_model','INVALID_RESPONSE',2],['fabricated_quote','POLICY_BLOCKED',2],['key_echo','INVALID_RESPONSE',2],['escaped_key_echo','INVALID_RESPONSE',2],['length','INCOMPLETE_OUTPUT',2],['refusal','PROVIDER_REFUSAL',2],['tool','POLICY_BLOCKED',2],['no_usage','BUDGET_BLOCKED',2],['bad_usage','BUDGET_BLOCKED',2],['completion_limit','BUDGET_BLOCKED',2],['oversize','INVALID_RESPONSE',2],['malformed','INVALID_RESPONSE',2]])test('no fallback/retry and safe error: '+name,async()=>{const {provider,calls}=setup(name);await assert.rejects(provider.generate(request(),()=>{}),e=>{assert.equal(e.message,error);assert.ok(!JSON.stringify(e).includes(canary));return true;});assert.equal(calls.length,count);assert.equal(provider.counts.simulated_calls,0);assert.equal(provider.diagnostics.output_validated,false);await assert.rejects(provider.generate(request(),()=>{}),/CALL_LIMIT/);assert.equal(calls.length,count);});
for(const name of ['timeout','stream_timeout'])test('deadline covers transport and streaming body: '+name,async()=>{const {provider}=setup(name,{catalogueTimeoutMs:10,inferenceTimeoutMs:10});await assert.rejects(provider.generate(request(),()=>{}),/TIMEOUT/);});
test('missing key/configured wrong model fail before HTTP; creation/status never read a key',async()=>{let reads=0;const {provider,calls}=setup('positive',{getCredential:()=>{reads++;return '';}});provider.status();assert.equal(reads,0);await assert.rejects(provider.generate(request(),()=>{}),/MISSING_PROVIDER_SECRET/);assert.equal(calls.length,0);const other=setup('positive',{getConfiguredModel:()=>'other'});await assert.rejects(other.provider.generate(request(),()=>{}),/MODEL_CHANGE_REQUIRES_APPROVAL/);assert.equal(other.calls.length,0);});
test('unknown checker status stops before credential and HTTP',async()=>{const {provider,calls}=setup('positive',{getCredential:()=>{throw Error('must not read');}});const r=request();r.verification.report.verdict='UNKNOWN';const rebound=createBoundRequest({...r,report:r.verification.report});await assert.rejects(provider.generate(rebound,()=>{}),/POLICY_BLOCKED/);assert.equal(calls.length,0);});
test('recheck after catalogue prevents inference when binding becomes invalid',async()=>{const {provider,calls}=setup();await assert.rejects(provider.generate(request(),()=>{if(calls.length)throw Error('stale');}),/NETWORK_ERROR/);assert.equal(calls.length,1);});
test('concurrent dispatch shares one-shot allowance',async()=>{const {provider,calls}=setup();const result=await Promise.allSettled([provider.generate(request(),()=>{}),provider.generate(request(),()=>{})]);assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(calls.length,2);});
test('live workflow completes human stage and never uses a simulation after error',async()=>{const {provider}=setup();const f=createWorkflow({mode:'NEBIUS_LIVE',liveProvider:provider});const input={taskId:'quadratic',steps:[],solution:'{-2;2}',scenario:'positive'};const r=await f.run(input);assert.equal(r.status,'HUMAN_REVIEW');assert.equal(r.provider,'NEBIUS_LIVE');const released=f.review({id:r.id,bindingHash:r.bindingHash,decision:'APPROVE',comment:''});assert.equal(released.status,'RELEASED');assert.equal(released.nextTask.id,'quadratic-next');assert.equal(f.proof.human_review,'APPROVED');const second=await f.run(input);assert.equal(second.status,'BLOCKED');assert.equal(second.error,'CALL_LIMIT');assert.equal(second.provider,'NEBIUS_LIVE');assert.equal(f.counts.simulated,0);await assert.rejects(f.taskDraft({id:r.id,bindingHash:r.bindingHash}),/LIVE_TASK_DRAFT_DISABLED/);});
test('UNKNOWN and simulation scenarios cannot trigger live transport',async()=>{const {provider,calls}=setup();const f=createWorkflow({mode:'NEBIUS_LIVE',liveProvider:provider});const input={taskId:'quadratic',steps:[],solution:'unbekannt',scenario:'positive'};assert.equal((await f.run(input)).status,'INPUT_REVIEW');await assert.rejects(f.run({...input,solution:'{2;-2}',scenario:'contradiction'}),/SIMULATION_SCENARIO_IN_LIVE/);assert.equal(calls.length,0);});
test('nested escaped key echo is rejected after inner JSON decoding',async()=>{const {provider}=setup('nested_key_echo');await assert.rejects(provider.generate(request(),()=>{}),/INVALID_RESPONSE/);assert.equal(provider.diagnostics.output_validated,false);});


// Export-only regression checks: an allowance is shared and survives a restart.
import {persistentLiveBudget} from '../src/persistent-live-budget.mjs';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
test('persistent allowance shared by workflows and retained across reconstruction',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'math-live-budget-')), first=setup();
 const shared=persistentLiveBudget(first.provider,dir);
 const a=createWorkflow({mode:'NEBIUS_LIVE',liveProvider:shared}),b=createWorkflow({mode:'NEBIUS_LIVE',liveProvider:shared});
 const input={taskId:'quadratic',steps:[],solution:'{-2;2}',scenario:'positive'};
 assert.equal((await a.run({...input,solution:'unclear'})).status,'INPUT_REVIEW');assert.equal(shared.status().oneShotConsumed,false);assert.equal(first.calls.length,0);
 const result=await a.run(input);assert.equal(result.status,'HUMAN_REVIEW');assert.equal(result.release,null);assert.equal(result.proposalMathVerified,false);
 assert.equal((await b.run(input)).error,'CALL_LIMIT');assert.equal(first.calls.length,2);
 const fresh=setup(),afterRestart=persistentLiveBudget(fresh.provider,dir);
 assert.equal(afterRestart.status().oneShotConsumed,true);assert.equal(afterRestart.counts.inference_calls,1);
 const c=createWorkflow({mode:'NEBIUS_LIVE',liveProvider:afterRestart});assert.equal((await c.run(input)).error,'CALL_LIMIT');assert.equal(fresh.calls.length,0);
 assert.equal(c.proof.one_shot_consumed,true);
});
test('failed mocked transport consumes persistent allowance without simulation fallback',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'math-live-error-')),m=setup('network'),p=persistentLiveBudget(m.provider,dir);
 const f=createWorkflow({mode:'NEBIUS_LIVE',liveProvider:p}),input={taskId:'quadratic',steps:[],solution:'{-2;2}',scenario:'positive'};
 const r=await f.run(input);assert.equal(r.status,'BLOCKED');assert.equal(r.error,'NETWORK_ERROR');assert.equal(r.proposal,null);assert.equal(f.counts.simulated,0);
 assert.equal((await f.run(input)).error,'CALL_LIMIT');assert.equal(m.calls.length,1);
});

import {createHostedApp} from '../server.mjs';
import {request as httpRequest} from 'node:http';
test('hosted optional mode: mock response persisted, separate sessions share allowance, historical evidence unchanged',async t=>{
 const m=setup(),dataDir=mkdtempSync(join(tmpdir(),'math-hosted-mock-'));
 const server=createHostedApp({origin:'https://jury.example',dataDir,accessCode:'synthetic-test-access-code-1234567890',sessionSecret:'synthetic-test-session-secret-1234567890',mode:'NEBIUS_LIVE',acknowledgeLive:true,liveProvider:m.provider});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const call=(path,cookie,body,form=false)=>new Promise((resolve,reject)=>{
  const req=httpRequest({hostname:'127.0.0.1',port:server.address().port,path,method:body?'POST':'GET',headers:{Host:'jury.example',Origin:'https://jury.example',...(cookie?{Cookie:cookie}:{}),'Content-Type':form?'application/x-www-form-urlencoded':'application/json','X-Local-Demo':'1'}},res=>{let raw='';res.on('data',c=>raw+=c);res.on('end',()=>resolve({status:res.statusCode,cookie:res.headers['set-cookie']?.[0]?.split(';')[0],data:raw?JSON.parse(raw):null}));});req.on('error',reject);req.end(body?(form?body:JSON.stringify(body)):undefined);
 });
 const a=(await call('/login',null,'access=synthetic-test-access-code-1234567890',true)).cookie,b=(await call('/login',null,'access=synthetic-test-access-code-1234567890',true)).cookie;
 const historical=(await call('/api/jury-example',a)).data;
 const input={taskId:'quadratic',steps:[],solution:'{-2;2}',scenario:'positive'};
 assert.equal((await call('/api/run',a,{...input,solution:'unclear'})).data.status,'INPUT_REVIEW');assert.equal(m.calls.length,0);
 const result=(await call('/api/run',a,input)).data;assert.equal(result.status,'HUMAN_REVIEW');assert.equal(result.proposalMathVerified,false);
 const shown=(await call('/api/runs/'+result.id,a)).data;assert.deepEqual(shown.run.proposal,result.proposal);assert.ok(shown.displayToken);
 assert.equal((await call('/api/runs/'+result.id,b)).status,400);
 assert.equal((await call('/api/live-status',b)).data.one_shot_consumed,true);
 assert.equal((await call('/api/run',b,input)).data.error,'CALL_LIMIT');assert.equal(m.calls.length,2);
 const approved=(await call('/api/review',a,{id:result.id,bindingHash:result.bindingHash,displayToken:shown.displayToken,decision:'APPROVE',comment:'Synthetic mock test only'})).data;
 assert.equal(approved.status,'RELEASED');assert.ok(approved.nextTask);assert.equal(m.calls.length,2);
 assert.deepEqual((await call('/api/jury-example',a)).data,historical);
});
