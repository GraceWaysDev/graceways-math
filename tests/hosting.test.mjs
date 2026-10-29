import {request as httpRequest} from 'node:http';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createHostedApp} from '../server.mjs';import {createWorkflow} from '../src/workflow.mjs';
const accessCode='synthetic-test-access-code-only-0123456789',sessionSecret='synthetic-test-session-key-only-0123456789';
const input={taskId:'quadratic',steps:['(x-2)(x+2)=0'],solution:'{-2;2}',scenario:'positive'};
test('hosting requires explicit live acknowledgement and insecure production origins',()=>{
 assert.throws(()=>createHostedApp({origin:'https://jury.example',dataDir:tmpdir(),accessCode,sessionSecret,mode:'NEBIUS_LIVE'}));
 assert.throws(()=>createHostedApp({origin:'http://jury.example',dataDir:tmpdir(),accessCode,sessionSecret}));
});
test('global login throttling and local-only HTTP configuration',async t=>{
 const dataDir=mkdtempSync(join(tmpdir(),'gwmath-limit-test-'));
 assert.throws(()=>createHostedApp({origin:'http://0.0.0.0:4197',local:true,dataDir,accessCode,sessionSecret}));
 const server=createHostedApp({origin:'http://127.0.0.1:4197',local:true,dataDir,accessCode,sessionSecret});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const post=()=>new Promise((resolve,reject)=>{const req=httpRequest({hostname:'127.0.0.1',port:server.address().port,path:'/login',method:'POST',headers:{Host:'127.0.0.1:4197',Origin:'http://127.0.0.1:4197','Content-Type':'application/x-www-form-urlencoded'}},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});req.on('error',reject);req.end('access=incorrect');});
 for(let i=0;i<20;i++)assert.equal(await post(),401);assert.equal(await post(),429);
});
test('authenticated isolation, read-only historical evidence, review binding, persistence, revocation and HTTPS headers',async t=>{
 const dataDir=mkdtempSync(join(tmpdir(),'gwmath-host-test-'));let now=Date.now();
 const origin='https://jury.example';const config={origin,dataDir,accessCode,sessionSecret,clock:()=>now};let server,base;
 async function start(){server=createHostedApp(config);await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;}
 const stop=()=>new Promise(r=>server.close(r));await start();t.after(async()=>{await stop();});
 async function call(path,{cookie,body,originOverride=origin,host='jury.example',method=body?'POST':'GET',form=false}={}){
  const options={method,headers:{Host:host,...(cookie?{Cookie:cookie}:{}),...(method==='POST'?{Origin:originOverride,'Content-Type':form?'application/x-www-form-urlencoded':'application/json','X-Local-Demo':'1'}:{})},}; const payload=body?(form?body:JSON.stringify(body)):undefined;return new Promise((resolve,reject)=>{const req=httpRequest(base+path,options,res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:{get:key=>Array.isArray(res.headers[key])?res.headers[key][0]:res.headers[key]},json:async()=>JSON.parse(text)}));});req.on('error',reject);req.end(payload);});
 }
 async function login(){const r=await call('/login',{body:new URLSearchParams({access:accessCode}).toString(),form:true});assert.equal(r.status,303);const c=r.headers.get('set-cookie');assert.match(c,/Secure/);assert.match(c,/HttpOnly/);assert.match(c,/SameSite=Strict/);return c.split(';')[0];}
 assert.equal((await call('/api/runs')).status,401);assert.equal((await call('/')).status,303);
 assert.equal((await call('/healthz',{host:'evil.example'})).status,421);
 assert.equal((await call('/login',{body:'access=wrong',form:true})).status,401);
 const a=await login(),b=await login();assert.notEqual(a,b);
 assert.equal((await call('/api/run',{cookie:a,body:input,originOverride:'https://evil.example'})).status,403);
 assert.equal((await call('/api/run',{cookie:a+'tampered',body:input})).status,401);
 const r=await call('/api/run',{cookie:a,body:input});assert.equal(r.status,200);assert.match(r.headers.get('strict-transport-security'),/31536000/);const run=await r.json();
 assert.equal(run.status,'HUMAN_REVIEW');assert.equal(run.report.verdict,'CORRECT');assert.equal(run.proposalMathVerified,false);
 assert.deepEqual((await (await call('/api/runs',{cookie:b})).json()).runs,[]);
 assert.equal((await call('/api/runs/'+run.id,{cookie:b})).status,400);
 const shown=await (await call('/api/runs/'+run.id,{cookie:a})).json();assert.deepEqual(shown.run.proposal,run.proposal);
 const review={id:run.id,bindingHash:run.bindingHash,displayToken:shown.displayToken,decision:'APPROVE',comment:'Synthetic test decision'};
 assert.equal((await call('/api/review',{cookie:b,body:review})).status,400);
 assert.equal((await call('/api/review',{cookie:a,body:{...review,bindingHash:'changed'}})).status,400);
 const historical=await (await call('/api/jury-example',{cookie:a})).json();assert.equal(historical.run.status,'RELEASED');assert.equal(historical.run.juryReadOnly,true);assert.equal(historical.run.provider,'NEBIUS_LIVE');
 assert.equal((await call('/api/review',{cookie:a,body:{...review,id:historical.run.id,bindingHash:historical.run.bindingHash}})).status,400);
 assert.equal((await call('/data/showcase.json',{cookie:a})).status,400);
 const approved=await (await call('/api/review',{cookie:a,body:review})).json();assert.equal(approved.status,'RELEASED');assert.ok(approved.nextTask);
 assert.equal((await call('/api/review',{cookie:a,body:review})).status,400);
 await stop();await start();
 const restored=await (await call('/api/runs/'+run.id,{cookie:a})).json();assert.equal(restored.run.status,'RELEASED');assert.deepEqual(restored.run.proposal,run.proposal);
 assert.deepEqual(await (await call('/api/jury-example',{cookie:b})).json(),historical);
 const live=await (await call('/api/live-status',{cookie:a})).json();assert.equal(live.counts.inference_calls,0);
 assert.equal((await call('/logout',{cookie:a,method:'POST'})).status,303);assert.equal((await call('/api/runs',{cookie:a})).status,401);
 now+=86400001;assert.equal((await call('/api/runs',{cookie:b})).status,401);
});
