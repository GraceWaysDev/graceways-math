import {createServer} from 'node:http';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {mkdirSync,readFileSync,existsSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createApp} from './app.mjs';
import {createRunStore} from './run-store.mjs';
import {createLearningAIProvider} from './src/nebius-provider.mjs';
import {persistentLiveBudget} from './src/persistent-live-budget.mjs';
const digest=s=>createHash('sha256').update(s).digest();
const same=(a,b)=>timingSafeEqual(digest(a),digest(b));
const login=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GraceWays Math · Jury access</title><link rel="stylesheet" href="/style.css"><main class="login"><h1>GraceWays Math</h1><p>Private jury preview. Saved Nebius evidence and interactive simulation. No live AI calls.</p><form action="/login" method="post"><label for="access">Jury access code</label><input id="access" name="access" type="password" autocomplete="current-password" required maxlength="256"><button>Open jury preview</button></form><p>Use synthetic inputs only. Each sign-in creates a separate browser session. Sign out on shared devices. Sessions expire after 24 hours; administrators retain stored files until the demo is removed.</p></main></html>`;
export function createHostedApp({origin,dataDir,accessCode,sessionSecret,local=false,clock=Date.now,mode='LOCAL_SIMULATION',acknowledgeLive=false,liveProvider}={}){
 if(!['LOCAL_SIMULATION','NEBIUS_LIVE'].includes(mode)||(mode==='NEBIUS_LIVE'&&!acknowledgeLive)||(mode!=='NEBIUS_LIVE'&&liveProvider))throw Error('EXPLICIT_LIVE_ACTIVATION_REQUIRED');
 const url=new URL(origin);
 if(url.origin!==origin||url.username||url.password||(!local&&url.protocol!=='https:')||(local&&(url.protocol!=='http:'||url.hostname!=='127.0.0.1')))throw Error('INVALID_PUBLIC_ORIGIN');
 if(typeof accessCode!=='string'||accessCode.length<32||typeof sessionSecret!=='string'||sessionSecret.length<32||!dataDir)throw Error('HOST_CONFIGURATION_REQUIRED');
 const root=resolve(dataDir);mkdirSync(root,{recursive:true});
 const provider=mode==='NEBIUS_LIVE'?persistentLiveBudget(liveProvider??createLearningAIProvider({enabled:true}),root):undefined;
 const example=JSON.parse(readFileSync(new URL('./data/showcase.json',import.meta.url),'utf8'));
 if(example.run.juryReadOnly!==true||example.run.status!=='RELEASED'||example.run.proposalMathVerified!==false)throw Error('INVALID_SHOWCASE');
 const sessions=new Map(),cookieName=local?'gwmath':'__Host-gwmath';let loginWindow=0,loginAttempts=0;
 const signature=s=>createHmac('sha256',sessionSecret).update(s).digest('hex');
 const cookie=(token,maxAge)=>`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${local?'':'; Secure'}`;
 const server=createServer(async(req,res)=>{
  const send=(code,value,type='text/plain')=>{res.writeHead(code,{'Content-Type':type+'; charset=utf-8'});res.end(value);};
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  if(!local)res.setHeader('Strict-Transport-Security','max-age=31536000');
  try{
   // Render terminates TLS. Never derive authority or origin from forwarded headers.
   if(req.headers.host!==url.host)return send(421,'Invalid host');
   if(req.method==='GET'&&req.url==='/healthz')return send(200,'ok');
   if(req.method==='GET'&&req.url==='/style.css')return send(200,readFileSync(new URL('./public/style.css',import.meta.url),'utf8'),'text/css');
   if(req.method==='GET'&&req.url==='/login')return send(200,mode==='NEBIUS_LIVE'?login.replace('No live AI calls.','Explicit live mode enabled: one shared catalogue query and one inference maximum, using the operator’s credits.'):login,'text/html');
   if(req.method==='POST'&&req.headers.origin!==origin)return send(403,'Origin rejected');
   if(req.method==='POST'&&req.url==='/login'){
    if(clock()-loginWindow>60000){loginWindow=clock();loginAttempts=0;}
    // Global limit is intentional: no trust in client-controlled forwarded IPs.
    if(++loginAttempts>20)return send(429,'Please wait before signing in again.');
    if(req.headers['content-type']!=='application/x-www-form-urlencoded')return send(415,'Unsupported form');
    let body='',bytes=0;for await(const c of req){bytes+=c.length;if(bytes>2048)return send(413,'Form too large');body+=c;}
    const fields=new URLSearchParams(body);
    if([...fields.keys()].join(',')!=='access'||!same(fields.get('access'),accessCode))return send(401,'Access denied. Return to /login.');
    if(readdirSync(root,{withFileTypes:true}).filter(x=>x.isDirectory()).length>=500)return send(503,'Session capacity reached. Contact the demo owner.');
    const id=randomBytes(32).toString('hex'),expires=clock()+86400000,payload=id+'.'+expires,token=payload+'.'+signature(payload);
    mkdirSync(join(root,id));
    res.setHeader('Set-Cookie',cookie(token,86400));res.writeHead(303,{Location:'/#jury&lang=en'});return res.end();
   }
   const token=(req.headers.cookie??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1)??'';
   const match=/^([a-f0-9]{64})\.(\d{13})\.([a-f0-9]{64})$/.exec(token);
   const valid=match&&Number(match[2])>clock()&&Number(match[2])<=clock()+86400000&&same(match[3],signature(match[1]+'.'+match[2]))&&existsSync(join(root,match[1]))&&!existsSync(join(root,match[1],'revoked'));
   if(!valid){if(req.url.startsWith('/api/'))return send(401,JSON.stringify({error:'AUTH_REQUIRED'}),'application/json');res.writeHead(303,{Location:'/login'});return res.end();}
   const id=match[1];
   if(req.method==='POST'&&req.url==='/logout'){
    writeFileSync(join(root,id,'revoked'),'revoked',{flag:'wx'});sessions.delete(id);res.setHeader('Set-Cookie',cookie('',0));res.writeHead(303,{Location:'/login'});return res.end();
   }
   for(const [key,value] of sessions)if(value.expires<=clock())sessions.delete(key);
   if(!sessions.has(id)){
    const store=createRunStore(join(root,id,'runs'));
    const app=createApp({mode,liveProvider:provider,store,juryExample:()=>structuredClone(example),publicOrigin:origin});
    sessions.set(id,{app,store,expires:Number(match[2]),busy:false,requests:0});
   }
   const session=sessions.get(id);
   if(req.method==='POST'){
    if(session.busy)return send(409,'Request already running');
    if(++session.requests>200||session.store.list().length>=100&&req.url==='/api/run')return send(429,'Session simulation limit reached');
    session.busy=true;res.once('close',()=>{session.busy=false;});
   }
   session.app.emit('request',req,res);
  }catch{return send(400,'Request rejected');}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;server.maxHeadersCount=50;
 return server;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),local=args.includes('--local'),live=args.includes('--nebius-live-once');
 if(args.some(x=>!['--local','--nebius-live-once','--acknowledge-credit-use'].includes(x))||live!==args.includes('--acknowledge-credit-use'))throw Error('EXPLICIT_LIVE_ACTIVATION_REQUIRED');
 const server=createHostedApp({origin:process.env.PUBLIC_ORIGIN,dataDir:process.env.DATA_DIR,accessCode:process.env.JURY_ACCESS_CODE,sessionSecret:process.env.SESSION_SECRET,local,mode:live?'NEBIUS_LIVE':'LOCAL_SIMULATION',acknowledgeLive:live});
 server.on('error',()=>{console.error('Server could not start.');process.exitCode=1;});
 server.listen(Number(process.env.PORT??10000),local?'127.0.0.1':'0.0.0.0',()=>console.log('GraceWays Math: jury access required; '+(live?'explicit one-shot Nebius mode.':'simulation and read-only evidence only.')));
}
