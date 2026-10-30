import {randomUUID} from 'node:crypto';
import {verify,checkTangent} from './math.mjs';
const verifyAttempt=(task,attempt)=>task.kind==='TANGENT'?checkTangent({polynomial:task.polynomial,at:task.at,...attempt}):verify({equation:task.equation,...attempt});
import {hash,createBoundRequest,bindingValid} from './binding.mjs';
import {createSimulatedLearningAIProvider,createLearningAIProvider,validateLearningAIResult} from './learning-ai-provider.mjs';
import {createBrowserAdmission} from './admission.mjs';
export const tasks=Object.freeze([
 {id:'tangent-exam',kind:'TANGENT',title:'Prüfungsaufgabe: Tangente an eine Funktion 4. Grades',polynomial:'-4/5*x^4+29/5*x^2-5',at:'3/2',equation:'f(x) = -4/5*x^4 + 29/5*x^2 - 5; Tangente bei x = 3/2',steps:[],solution:'y = 33/5*x - 59/10',follow:'tangent-next'},
 {id:'tangent-next',kind:'TANGENT',title:'Vertiefung: Tangente an eine kubische Funktion',polynomial:'x^3-2*x+1',at:'2',equation:'f(x) = x^3 - 2*x + 1; Tangente bei x = 2',steps:[],solution:'y = 10*x - 15',follow:'tangent-exam'},
 {id:'linear',title:'Lineare Gleichung',equation:'3(x + 2) = 21',steps:['3x + 6 = 21','3x = 15','x = 5'],solution:'{5}',follow:'linear-next'},
 {id:'quadratic',title:'Zwei reelle Wurzeln',equation:'x^2 = 4',steps:['(x - 2)(x + 2) = 0'],solution:'{-2; 2}',follow:'quadratic-next'},
 {id:'lost-root',title:'Null als Lösung erhalten',equation:'x^2 = x',steps:['x(x - 1) = 0'],solution:'{0; 1}',follow:'quadratic'},
 {id:'irrational',title:'Exakte Wurzelschreibweise',equation:'x^2 - 2 = 0',steps:['x^2 = 2'],solution:'{-sqrt(2); sqrt(2)}',follow:'quadratic-next'},
 {id:'empty',title:'Keine reelle Lösung',equation:'x^2 + 1 = 0',steps:['x^2 = -1'],solution:'{}',follow:'quadratic'},
 {id:'linear-next',title:'Nächster Schritt: linear',equation:'2(x - 3) = 8',steps:[],solution:'{7}',follow:'quadratic'},
 {id:'quadratic-next',title:'Nächster Schritt: quadratisch',equation:'x^2 - 5x + 6 = 0',steps:[],solution:'{2; 3}',follow:'irrational'}
]);
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
function need(ok,code){if(!ok)throw Error(code);}
export function controlledFeedback(report){
 if(report.verdict==='UNKNOWN')return 'Nicht entscheidbar im unterstützten Umfang. Eingabe oder Schritt gemeinsam klären; kein Modellaufruf.';
 if(report.checker==='exact-polynomial-tangent-v1')return report.verdict==='CORRECT'?'Steigung und Achsenabschnitt der Tangente stimmen exakt mit Ableitung und Berührpunkt überein. Freitextbegründungen wurden nicht geprüft.':'Die Tangentengleichung oder eine eingegebene Tangentenzeile stimmt nicht mit der unabhängig berechneten Tangente überein. Prüfe Ableitung, Steigung und Berührpunkt.';
 if(report.reason==='NON_EQUIVALENT_STEP')return 'Mindestens ein Zwischenschritt verändert die reelle Lösungsmenge. Vergleiche die markierten Gleichungen; insbesondere kann Division durch x eine Lösung verlieren.';
 if(report.verdict==='INCORRECT')return 'Die angegebene Lösungsmenge stimmt nicht vollständig mit der unabhängig berechneten reellen Lösungsmenge überein. Prüfe fehlende oder zusätzliche Wurzeln.';
 return 'Die vollständige reelle Lösungsmenge stimmt überein. Alle eingegebenen Gleichungszeilen sind im unterstützten Umfang äquivalent. Nicht eingegebene Begründungen wurden nicht geprüft.';
}
export function createWorkflow({mode='LOCAL_SIMULATION',liveProvider,store=null}={}){
 need(['LOCAL_SIMULATION','NEBIUS_LIVE'].includes(mode),'INVALID_MODE');
 const live=mode==='NEBIUS_LIVE',liveAdapter=live?(liveProvider??createLearningAIProvider({enabled:true})):null;
 const records=new Map(),drafted=new Set(),admission=createBrowserAdmission({intervalMs:0,maxAttempts:100,maxBudget:3000000});let calls=0;
 function validateStored(r){
 need(r&&bindingValid(r.request)&&hash({id:r.id,task:r.task,attempt:r.attempt,report:r.report,request:r.request})===r.bindingHash,'STORAGE_INTEGRITY');
 need(hash(verifyAttempt(r.task,r.attempt))===hash(r.report)&&hash(r.request.verification.report)===hash(r.report),'STORAGE_INTEGRITY');
 need(r.proposal&&hash(r.proposal)===r.proposalHash&&['HUMAN_REVIEW','RELEASED','REJECTED'].includes(r.status),'STORAGE_INTEGRITY');
 validateLearningAIResult('REVIEW',r.proposal,r.request.input);return r;
 }
 const get=id=>{const r=store?validateStored(store.load(id)):records.get(id);need(r,'NOT_FOUND');return r;};
 function view(r){return structuredClone({id:r.id,bindingHash:r.bindingHash,status:r.status,task:r.task,attempt:r.attempt,report:r.report,pre:r.pre,post:r.post,provider:r.provider,model:r.model??null,responseId:r.responseId??null,createdAt:r.createdAt,receivedAt:r.receivedAt??null,decision:r.decision??null,controlledFeedback:controlledFeedback(r.report),proposal:r.proposal,proposalMathVerified:false,error:r.error??null,release:r.release??null,nextTask:r.nextTask??null});}
 async function run(raw){
  need(exact(raw,['taskId','steps','solution','scenario']),'INVALID_INPUT');
  const task=tasks.find(t=>t.id===raw.taskId);need(task,'UNKNOWN_TASK');
  need(Array.isArray(raw.steps)&&raw.steps.length<=8&&raw.steps.every(s=>typeof s==='string'&&s.length<=250)&&typeof raw.solution==='string'&&raw.solution.length<=500,'INPUT_LIMIT');
  need(['positive','contradiction','false_verification','wrong_report','wrong_binding','malformed','incomplete','PROVIDER_UNAVAILABLE'].includes(raw.scenario),'UNKNOWN_SIMULATION');
  if(live)need(raw.scenario==='positive','SIMULATION_SCENARIO_IN_LIVE');
  need(records.size<100,'SESSION_LIMIT_RESTART_SERVER');
  const attempt={steps:[...raw.steps],solution:raw.solution},report=verifyAttempt(task,attempt);
  const input={subject:'Mathematik – synthetische Demo',title:task.title,instruction:task.equation,answer:JSON.stringify(attempt),teacher_notes:'Nur der unabhängige Prüfer '+report.checker+' verifiziert. Befunde: '+JSON.stringify(report)};
  const id=randomUUID(),request=createBoundRequest({id,kind:'REVIEW',input,report});
  const bindingHash=hash({id,task,attempt,report,request}),r={id,task,attempt,report,request,bindingHash,provider:mode,createdAt:new Date().toISOString(),status:'CHECKING',pre:report.verdict==='UNKNOWN'?'REVIEW':'PASS',post:'NOT_REACHED',proposal:null};
  records.set(id,r);
  if(r.pre!=='PASS'){r.status='INPUT_REVIEW';return view(r);}
  const recheck=()=>need(hash({id,task,attempt,report,request})===bindingHash&&report.verdict!=='UNKNOWN','STALE_CONTEXT');
  const provider=live?liveAdapter:createSimulatedLearningAIProvider({admission,caseName:raw.scenario});
  try{
   recheck();const result=await provider.generate(request,recheck);
   recheck();r.receivedAt=new Date().toISOString();r.model=result.model;r.responseId=result.responseId??null;r.proposal=result.result;r.proposalHash=hash(result.result);r.status='HUMAN_REVIEW';r.post='REVIEW';
  }catch(error){r.status='BLOCKED';r.post='BLOCKED';r.error=['INVALID_RESPONSE','INCOMPLETE_OUTPUT','PROVIDER_UNAVAILABLE','BUDGET_BLOCKED','RATE_LIMIT','POLICY_BLOCKED','MISSING_PROVIDER_SECRET','MODEL_CHANGE_REQUIRES_APPROVAL','MODEL_NOT_AVAILABLE','AUTHENTICATION_ERROR','TIMEOUT','NETWORK_ERROR','CALL_LIMIT','HOST_BLOCKED','PROVIDER_REFUSAL'].includes(error.message)?error.message:'SAFE_PROVIDER_FAILURE';}
  finally{calls+=provider.counts.simulated_calls;}
  if(r.status==='HUMAN_REVIEW'&&store){try{store.save(r);}catch{records.delete(id);throw Error('STORAGE_WRITE_FAILED');}}
  return view(r);
 }
 function review(raw){
  need(exact(raw,['id','bindingHash','decision','comment']),'INVALID_REVIEW');
  const r=structuredClone(get(raw.id));need(r.status==='HUMAN_REVIEW','NOT_REVIEWABLE');need(raw.bindingHash===r.bindingHash&&hash(r.proposal)===r.proposalHash,'STALE_REVIEW');
  need(['APPROVE','REJECT'].includes(raw.decision)&&typeof raw.comment==='string'&&raw.comment.length<=1000,'INVALID_REVIEW');
  r.decision={value:raw.decision,comment:raw.comment,at:new Date().toISOString(),scope:'LOCAL_DEMO_HUMAN_ACTION'};
  if(raw.decision==='REJECT'){r.status='REJECTED';r.release=null;if(store)store.decide(r);records.set(r.id,r);return view(r);}
  r.status='RELEASED';r.release={controlledFeedback:controlledFeedback(r.report),modelFeedback:r.proposal.feedback,modelFeedbackMathVerified:false,humanComment:raw.comment,commentMathVerified:false,approvedAt:new Date().toISOString(),scope:'LOCAL_DEMO_HUMAN_ACTION'};
  // Selection is deterministic and remains human-approved, never an AI grading decision.
  const nextId=r.report.verdict==='CORRECT'?r.task.follow:r.task.id;
  const next=tasks.find(t=>t.id===nextId);r.nextTask={id:next.id,title:next.title,equation:next.equation,reason:r.report.verdict==='CORRECT'?'Vertiefung nach Freigabe':'Gleiche Aufgabe gezielt erneut bearbeiten'};
  if(store)store.decide(r);records.set(r.id,r);return view(r);
 }
 async function taskDraft(raw){
  need(!live,'LIVE_TASK_DRAFT_DISABLED_ONE_SHOT');
  need(exact(raw,['id','bindingHash']),'INVALID_TASK_DRAFT');const r=get(raw.id);
  need(r.status==='RELEASED'&&raw.bindingHash===r.bindingHash&&!drafted.has(r.id),'NOT_RELEASED_OR_ALREADY_REQUESTED');drafted.add(r.id);
  const input={subject:'Mathematik',brief:'Formulierungshilfe zur fest ausgewählten synthetischen Folgeaufgabe '+r.nextTask.equation+'. Keine andere Gleichung auswählen.'};
  const request=createBoundRequest({id:randomUUID(),kind:'TASK',input,report:r.report});
  const result=await createSimulatedLearningAIProvider({admission}).generate(request,()=>need(r.status==='RELEASED','STALE_REVIEW'));calls++;
  return {provider:'LOCAL_SIMULATION',draft:result.result,mathVerified:false,usableAsTask:false,notice:'Ungeprüfter TASK-Vertragsentwurf. Er ersetzt die ausgewählte Folgeaufgabe nicht.'};
 }
 return {run,review,taskDraft,list:()=>store?store.list():[...records.values()].filter(r=>r.proposal).map(r=>({id:r.id,status:r.status,title:r.task.title,createdAt:r.createdAt,provider:r.provider})),get:id=>view(get(id)),get counts(){return {simulated:calls,live:liveAdapter?.counts.inference_calls??0};},get proof(){const r=[...records.values()].at(-1);return {mode,model:'nvidia/nemotron-3-super-120b-a12b',one_shot_consumed:liveAdapter?.status().oneShotConsumed??false,counts:liveAdapter?.counts??{catalogue_calls:0,inference_calls:0,simulated_calls:calls},diagnostics:liveAdapter?.diagnostics??null,status:r?.status??'NOT_STARTED',checker_verdict:r?.report.verdict??null,request_binding:r?.bindingHash??null,post:r?.post??'NOT_REACHED',human_review:r?.status==='RELEASED'?'APPROVED':r?.status==='REJECTED'?'REJECTED':'NOT_PERFORMED',model_text_math_verified:false,error:r?.error??null};}};
}
