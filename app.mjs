import {randomUUID} from 'node:crypto';
import {hash} from './src/binding.mjs';
import {createRunStore} from './run-store.mjs';
import {createServer} from 'node:http';
import {readFileSync,writeFileSync,mkdtempSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createWorkflow,tasks} from './src/workflow.mjs';
export function createApp({mode='LOCAL_SIMULATION',liveProvider,onProof=()=>{},store=null,juryExample=null,publicOrigin=null}={}){
 const flow=createWorkflow({mode,liveProvider,store}),tickets=new Map(),assets=new Map([['/',['replay.html','text/html']],['/app.mjs',['replay-app.mjs','text/javascript']],['/style.css',['style.css','text/css']]]);
 return createServer(async(req,res)=>{
  const send=(code,data,type='application/json')=>{res.writeHead(code,{'Content-Type':type+'; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(type==='application/json'?JSON.stringify(data):data);};
  try{
   const origin=publicOrigin??('http://127.0.0.1:'+res.socket.localPort);
   if(req.headers.host!==new URL(origin).host)throw Error('LOCAL_HOST_REQUIRED');
   if(req.method==='GET'&&assets.has(req.url)){const [file,type]=assets.get(req.url);return send(200,readFileSync(new URL('./public/'+file,import.meta.url),'utf8'),type);}
   if(req.method==='GET'&&req.url==='/api/tasks')return send(200,{tasks,provider:mode,liveEnabled:mode==='NEBIUS_LIVE',juryExampleAvailable:!!juryExample});
   if(req.method==='GET'&&req.url==='/api/jury-example'&&juryExample)return send(200,juryExample());
   if(req.method==='GET'&&req.url==='/api/runs')return send(200,{runs:flow.list()});
   if(req.method==='GET'&&/^\/api\/runs\/[a-f0-9-]{36}$/.test(req.url)){
    const run=flow.get(req.url.slice('/api/runs/'.length));const displayToken=randomUUID();
    if(tickets.size>=1000)tickets.clear();tickets.set(displayToken,{id:run.id,digest:hash(run)});
    return send(200,{run,displayToken});
   }
   if(req.method==='GET'&&req.url==='/api/live-status')return send(200,flow.proof);
   if(req.method!=='POST'||req.headers.origin!==origin||req.headers['x-local-demo']!=='1'||req.headers['content-type']!=='application/json')throw Error('LOCAL_REQUEST_REQUIRED');
   let data='',size=0;for await(const chunk of req){size+=chunk.length;if(size>12000)throw Error('BODY_LIMIT');data+=chunk;}const body=JSON.parse(data);
   if(req.url==='/api/run'){const result=await flow.run(body);onProof(flow.proof);return send(200,result);}
   if(req.url==='/api/review'){
    if(Object.keys(body).sort().join(',')!=='bindingHash,comment,decision,displayToken,id')throw Error('INVALID_REVIEW');
    const ticket=tickets.get(body.displayToken);if(!ticket||ticket.id!==body.id||ticket.digest!==hash(flow.get(body.id)))throw Error('STALE_DISPLAY');
    const {displayToken,...review}=body;const result=flow.review(review);tickets.delete(displayToken);onProof(flow.proof);return send(200,result);}
   if(req.url==='/api/task-draft')return send(200,await flow.taskDraft(body));
   return send(404,{error:'NOT_FOUND'});
  }catch{send(400,{error:'Anfrage abgelehnt. Eingaben, Freigabestand und lokale Herkunft prüfen.'});}
 });
}