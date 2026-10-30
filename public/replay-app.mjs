const $=id=>document.getElementById(id);let catalog=[],current=null,displayToken=null,busy=false,live=false,budgetKnown=false,budgetUsed=false,lang='de',translation=null,juryAvailable=false;
async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json','X-Local-Demo':'1'}:{},body:body?JSON.stringify(body):undefined});if(r.status===401){location.assign('/login');throw Error('Session expired. Please sign in.');}const d=await r.json();if(!r.ok)throw Error(d.error);return d;}

const tr=(de,en)=>lang==='en'?en:de;
const taskNames={'tangent-exam':'Exam task: tangent to a quartic polynomial','tangent-next':'Further practice: tangent to a cubic polynomial',linear:'Linear equation',quadratic:'Two real roots','lost-root':'Keep the zero root',irrational:'Exact radical notation',empty:'No real solution','linear-next':'Next step: linear','quadratic-next':'Next step: quadratic'};
function localizeStatic(){
 if(document.documentElement)document.documentElement.lang=lang;
 for(const el of document.querySelectorAll?.('[data-de]')??[])el.textContent=el.getAttribute('data-'+lang);
 for(const option of $('task').children)option.textContent=lang==='en'?(taskNames[option.value]??option.textContent):(catalog.find(t=>t.id===option.value)?.title??option.textContent);
 const tangent=catalog.find(t=>t.id===$('task').value)?.kind==='TANGENT';
 const solutionLabel=document.querySelector?.('label[for="solution"]'),stepsLabel=document.querySelector?.('label[for="steps"]');
 if(solutionLabel)solutionLabel.textContent=tangent?tr('Tangentengleichung · y = m*x + b','Tangent equation · y = m*x + b'):tr('Vollständige reelle Lösungsmenge','Complete real solution set');
 if(stepsLabel)stepsLabel.textContent=tangent?tr('Optional: weitere Tangentengleichungen · keine Ableitungszeilen','Optional: further tangent equations · no derivative steps'):tr('Zwischenschritte · eine Gleichung pro Zeile','Working · one equation per line');
 $('solution').placeholder=tangent?'y = m*x + b':'{-2; 2}';
 if(typeof document.title==='string')document.title=tr('GraceWays Math · Feedback mit Verantwortung','GraceWays Math · Feedback with responsibility');
 $('langDe').setAttribute('aria-pressed',String(lang==='de'));$('langEn').setAttribute('aria-pressed',String(lang==='en'));
 $('providerBadge').textContent=live?tr('NEBIUS · BEGRENZTE SITZUNG','NEBIUS · LIMITED SESSION'):tr('SIMULATION · OFFLINE','SIMULATION · OFFLINE');
 $('modeIntro').textContent=live?tr('Gespeicherte echte Nebius-Antworten und menschliche Entscheidungen bleiben nachvollziehbar. Wiederöffnen verbraucht kein Budget.','Saved real Nebius responses and human decisions remain traceable. Reopening uses no inference budget.'):tr('Teste die vollständige Kette mit einem lokalen Testanbieter. Kein echter KI-Aufruf. Der gespeicherte Nebius-Lauf ist separat gekennzeichnet.','Explore the complete workflow with a local test provider. No real AI calls. The saved Nebius example is labelled separately.');
 $('run').textContent=live?tr('Prüfen & einmal kostenpflichtig Nebius aufrufen','Check & call Nebius once (uses credits)'):tr('Lösung prüfen & Testfeedback erhalten','Check solution & get test feedback');
}
function section(target,title,paragraphs){const e=document.createElement('section');e.className='feedback-section';const h=document.createElement('h4');h.textContent=title;e.append(h);for(const text of paragraphs){const p=document.createElement('p');p.textContent=text;e.append(p);}target.append(e);return e;}
function readableProposal(target,p){
 section(target,tr('Einschätzung','Assessment'),[p.summary??'']);section(target,tr('Feedback','Feedback'),[p.feedback??'']);
 const checks=section(target,tr('Bezug zur eingereichten Antwort','References to the submitted answer'),[]);
 for(const c of p.checks??[]){const q=document.createElement('blockquote');q.textContent=c.quote;const comment=document.createElement('p');comment.textContent=c.comment;checks.append(q,comment);}
 section(target,tr('Grenzen dieses Feedbacks','Limitations of this feedback'),p.limitations??[]);
}
function present(r){
 $('savedNotice').textContent=r.juryReadOnly?tr('Gespeicherter realer Nebius-Lauf. Nur lesend, kein neuer Aufruf.','Saved real Nebius record. Read-only, no new call.'):r.proposal?tr('Vollständig aus dem gespeicherten Lauf geladen. Keine Provideranfrage.','Loaded entirely from the saved record. No provider request.'):'';
 if(r.juryReadOnly)$('providerBadge').textContent=tr('GESPEICHERTER NEBIUS-LAUF · NUR LESEND','SAVED NEBIUS RECORD · READ-ONLY');
 $('findings').replaceChildren();const verdict=document.createElement('p');verdict.className='result-verdict';verdict.textContent=r.report.verdict==='CORRECT'?(r.report.checker==='exact-polynomial-tangent-v1'?tr('Die Tangentengleichung stimmt.','The tangent equation is correct.'):tr('Die Lösungsmenge stimmt.','The solution set is correct.')):r.report.verdict==='INCORRECT'?tr('Hier lohnt ein zweiter Blick.','Take another look.'):tr('Eine Klärung ist erforderlich.','Clarification is needed.');$('findings').append(verdict);
 const set=v=>v?.kind==='TANGENT'?'y = '+v.slope+'*x + ('+v.intercept+')':v?.kind==='FINITE'?'{'+(v.values??[]).join('; ')+'}':v?.kind??'—';
 section($('findings'),tr('Unabhängiger Mathematikprüfer','Independent mathematics checker'),[tr('Erwartet: ','Expected: ')+set(r.report.expected),tr('Eingereicht: ','Submitted: ')+set(r.report.submitted),...(r.report.steps??[]).map(x=>tr('Schritt ','Step ')+x.index+': '+x.status)]);
 $('draft').replaceChildren();if(r.proposal){const tag=document.createElement('span');tag.className='feedback-tag';tag.textContent=r.provider==='NEBIUS_LIVE'?tr('GESPEICHERTE NEBIUS-ANTWORT · KI-TEXT UNGEPRÜFT','SAVED NEBIUS RESPONSE · AI TEXT UNVERIFIED'):tr('LOKALER TESTANBIETER · SYNTHETISCH','LOCAL TEST PROVIDER · SYNTHETIC');$('draft').append(tag);
 if(lang==='en'&&translation){const note=document.createElement('p');note.className='translation-notice';note.textContent='English translation prepared for the jury, not a new Nebius response. The translation has not been separately approved. The unchanged German original follows below and remains authoritative.';$('draft').append(note);readableProposal($('draft'),translation);section($('draft'),'Unchanged German original',[]);}
 else if(lang==='en'){const note=document.createElement('p');note.className='translation-notice';note.textContent='Original German response preserved. No translation is available for this record.';$('draft').append(note);}
 readableProposal($('draft'),r.proposal);
 }else if(r.error&&!technicalErrors.has(r.error)){section($('draft'),tr('Ausgabevalidierung','Output validation'),[r.error]);}
 $('release').replaceChildren();if(r.decision){const p=document.createElement('p');p.className='release-badge';p.textContent=(r.decision.value==='APPROVE'?tr('Menschliche Freigabe gespeichert','Human approval recorded'):tr('Menschliche Ablehnung gespeichert','Human rejection recorded'))+' · '+new Date(r.decision.at).toLocaleString(lang==='en'?'en-GB':'de-DE',{timeZone:'Europe/Berlin'})+' (Europe/Berlin)';$('release').append(p);if(r.decision.comment)section($('release'),tr('Originalkommentar','Original comment'),[r.decision.comment]);}
 if(r.juryReadOnly){const p=document.createElement('p');p.className='help';p.textContent=tr('Gespeicherter Live-Nachweis, nur lesend. Die vorhandene Entscheidung wird nicht neu ausgeführt.','Saved live evidence, read-only. The existing decision is not performed again.');$('release').append(p);}
}
const technicalErrors=new Set(['CALL_LIMIT','MISSING_PROVIDER_SECRET','MODEL_CHANGE_REQUIRES_APPROVAL','MODEL_NOT_AVAILABLE','AUTHENTICATION_ERROR','TIMEOUT','NETWORK_ERROR','RATE_LIMIT','PROVIDER_UNAVAILABLE','HOST_BLOCKED']);
function budgetState(status){
 if(!status||status.mode!=='NEBIUS_LIVE'||!status.counts)return {known:false,used:false};
 return {known:true,used:status.one_shot_consumed===true||status.counts.catalogue_calls>0||status.counts.inference_calls>0||status.status==='CHECKING'||status.status==='BLOCKED'};
}
function updateControls(){
 $('run').disabled=busy||(live&&(!budgetKnown||budgetUsed));
 $('budgetNotice').textContent=!live?tr('Simulation – kein Livebudget.','Simulation — no live budget.'):budgetUsed?tr('Der einmalige Live-Aufruf dieser Serverinstallation wurde bereits verwendet.','The one-time live call for this server installation has already been used.'):!budgetKnown?tr('Livebudget wird geprüft. Bei unbekanntem Status bleibt der Aufruf gesperrt.','Checking the live budget. Calls stay disabled while the status is unknown.'):tr('Ein einmaliger Live-Prüflauf ist für diese Serverinstallation verfügbar.','One live check is available for this server installation.');
 $('loadingNotice').hidden=!busy;$('run').setAttribute('aria-busy',String(busy));
}
async function refreshBudget(){
 if(!live){budgetKnown=true;updateControls();return;}
 try{const status=await api('/api/live-status');const state=budgetState(status);budgetKnown=state.known;budgetUsed=budgetUsed||state.used;
 $('providerStatus').textContent=status.error==='CALL_LIMIT'?tr('Aufruflimit erreicht. Kein zusätzlicher Provideraufruf. Gespeicherte erfolgreiche Läufe können oben geöffnet werden.','Call limit reached. No additional provider call. Saved successful records can be reopened above.'):status.error&&technicalErrors.has(status.error)?tr('Technischer Providerstatus: ','Technical provider status: ')+status.error+tr(' – keine Aussage zur Mathematik.',' — not a judgement of the mathematics.'):(tr('Serverport ','Server port ')+location.port+' · Catalogue: '+status.counts.catalogue_calls+' · Inference: '+status.counts.inference_calls);
 }catch{budgetKnown=false;$('providerStatus').textContent=tr('Serverstatus nicht erreichbar. Kein Liveaufruf möglich.','Server status unavailable. Live calls are disabled.');}updateControls();
}

function box(id,text){const p=document.createElement('pre');p.style.whiteSpace='pre-wrap';p.style.overflowWrap='anywhere';p.textContent=text;$(id).append(p);}
function invalidate(){localizeStatic();current=null;displayToken=null;$('readComplete').checked=false;for(const id of ['approve','reject','readComplete','comment','continue','taskDraft'])$(id).disabled=true;for(const id of ['proof','draft','release','taskOutput','findings'])$(id).replaceChildren();$('next').textContent=tr('Erst nach ausdrücklicher menschlicher Freigabe verfügbar.','Available only after explicit human approval.');$('status').textContent=tr('Eingabe geändert – gespeicherten Lauf gezielt wieder öffnen.','Input changed — reopen the saved record to review it.');}
function choose(id){$('task').value=id;$('equation').textContent=catalog.find(t=>t.id===id).equation;$('steps').value='';$('solution').value='';invalidate();}
const inputsMatch=()=>current&&$('task').value===current.task.id&&$('steps').value===current.attempt.steps.join('\n')&&$('solution').value===current.attempt.solution;
function enableReview(){const yes=current?.status==='HUMAN_REVIEW'&&!current.juryReadOnly&&!!displayToken&&inputsMatch()&&$('readComplete').checked;$('approve').disabled=$('reject').disabled=!yes;}
function render(r,token=null){
 invalidate();current=r;displayToken=token;$('task').value=r.task.id;$('equation').textContent=r.task.equation;$('steps').value=r.attempt.steps.join('\n');$('solution').value=r.attempt.solution;$('comment').value='';localizeStatic();
 $('status').textContent=tr('Mathematik: ','Mathematics: ')+r.report.verdict+' · Pre-Guardian: '+r.pre+' · Post-Guardian: '+(technicalErrors.has(r.error)?tr('NOT_REACHED – keine neue Modellantwort','NOT_REACHED — no new model response'):r.post);
 if(r.error)$('providerStatus').textContent=(r.error==='CALL_LIMIT'?'Aufruflimit: ':technicalErrors.has(r.error)?'Technischer Providerfehler: ':'Ausgabevalidierung: ')+r.error;
 box('proof',tr('UNVERÄNDERTE PRÜFVORLAGE\nLauf: ','UNCHANGED REVIEW RECORD\nRun: ')+r.id+tr('\nBindung: ','\nBinding: ')+r.bindingHash+tr('\nZeit: ','\nCreated: ')+r.createdAt+tr('\nEmpfangen: ','\nReceived: ')+(r.receivedAt??tr('nicht erfasst','not recorded'))+tr('\nAnbieter: ','\nProvider: ')+r.provider+tr('\nModell: ','\nModel: ')+r.model+'\nProvider-Response-ID: '+(r.responseId??tr('nicht verfügbar','not available')));
 box('proof',tr('Ursprüngliche Aufgabe\n','Original task\n')+JSON.stringify(r.task,null,2)+tr('\nUrsprünglicher synthetischer Lösungsversuch\n','\nOriginal synthetic attempt\n')+JSON.stringify(r.attempt,null,2)+tr('\nVollständige unabhängige Prüfbefunde\n','\nComplete independent findings\n')+JSON.stringify(r.report,null,2));
 box('proof',r.controlledFeedback);
 if(r.proposal)box('draft',(r.provider==='NEBIUS_LIVE'?'NEBIUS LIVE':'TESTANBIETER – SYNTHETISCH')+' · VOLLSTÄNDIGE UNGEPRÜFTE KI-ERKLÄRUNG\n'+JSON.stringify(r.proposal,null,2));
 if(r.error&&!technicalErrors.has(r.error))box('draft','Ausgabevalidierung: '+r.error);
 $('readComplete').disabled=$('comment').disabled=!(r.status==='HUMAN_REVIEW'&&token&&!r.juryReadOnly);
 if(r.decision)box('release','Gespeicherte menschliche Entscheidung\n'+JSON.stringify(r.decision,null,2));
 if(r.release)box('release','Freigegebene Inhalte (KI-Text weiterhin mathematisch ungeprüft)\n'+JSON.stringify(r.release,null,2));
 if(r.nextTask){$('next').textContent=r.nextTask.equation+' · '+(lang==='en'?(r.report.verdict==='CORRECT'?'Further practice after approval':'Revisit the same task after approval'):r.nextTask.reason);$('continue').disabled=false;}
 $('taskDraft').disabled=live||r.juryReadOnly||r.status!=='RELEASED';present(r);enableReview();
}
async function refreshList(){const {runs}=await api('/api/runs');$('savedRuns').replaceChildren();for(const r of runs){const o=document.createElement('option');o.value=r.id;o.textContent=[r.createdAt,r.title,r.status,r.provider,r.id].filter(Boolean).join(' · ');$('savedRuns').append(o);}}
async function openRun(id){translation=null;invalidate();const {run,displayToken:token}=await api('/api/runs/'+encodeURIComponent(id));render(run,token);location.hash='run='+run.id+'&lang='+lang;$('savedRuns').value=run.id;$('savedNotice').textContent=tr('Vollständig aus dem gespeicherten Lauf geladen. Keine Provideranfrage.','Loaded entirely from the saved record. No provider request.');}
async function action(fn){if(busy)return;busy=true;updateControls();for(const id of ['langDe','langEn','juryExample','run','openRun','savedRuns','task','steps','solution','scenario','example','lost','approve','reject','readComplete'])$(id).disabled=true;try{await fn();}catch(e){invalidate();$('status').textContent=e.message;}finally{busy=false;for(const id of ['langDe','langEn','juryExample','openRun','savedRuns','task','steps','solution','example','lost'])$(id).disabled=false;$('scenario').disabled=live;$('readComplete').disabled=current?.status!=='HUMAN_REVIEW'||!displayToken||!!current?.juryReadOnly;enableReview();await refreshBudget();}}
$('task').onchange=()=>choose($('task').value);for(const id of ['steps','solution','scenario'])$(id).oninput=invalidate;
$('example').onclick=()=>{const t=catalog.find(t=>t.id===$('task').value);invalidate();$('steps').value=t.steps.join('\n');$('solution').value=t.solution;};
$('lost').onclick=()=>{choose('lost-root');$('steps').value='x = 1';$('solution').value='{1}';};
$('readComplete').onchange=enableReview;
$('openRun').onclick=()=>action(()=>openRun($('savedRuns').value));
$('run').onclick=()=>{if(busy||(live&&(!budgetKnown||budgetUsed)))return;return action(async()=>{await refreshBudget();if(live&&(!budgetKnown||budgetUsed))return;const body={taskId:$('task').value,steps:$('steps').value.split('\n').map(s=>s.trim()).filter(Boolean),solution:$('solution').value,scenario:$('scenario').value};invalidate();const r=await api('/api/run',body);await refreshList();if(r.status==='HUMAN_REVIEW')await openRun(r.id);else{render(r);$('savedNotice').textContent='Dieser Versuch hat kein gespeichertes Feedback. Frühere Erfolge bleiben in der Liste abrufbar.';}});};
for(const [id,decision] of [['approve','APPROVE'],['reject','REJECT']])$(id).onclick=()=>{if(!inputsMatch()||!$('readComplete').checked)return;return action(async()=>{await api('/api/review',{id:current.id,bindingHash:current.bindingHash,decision,comment:$('comment').value,displayToken});const id=current.id;await refreshList();await openRun(id);});};
$('continue').onclick=()=>{if(current?.nextTask)choose(current.nextTask.id);};
$('taskDraft').onclick=()=>action(async()=>{if(!current)return;const d=await api('/api/task-draft',{id:current.id,bindingHash:current.bindingHash});$('taskDraft').disabled=true;box('taskOutput',d.notice+'\n'+d.draft.instruction);});
$('juryExample').onclick=()=>action(async()=>{const data=await api('/api/jury-example');translation=data.translation??null;render(data.run);location.hash='jury&lang='+lang;$('savedNotice').textContent=tr('Gespeicherter realer Nebius-Lauf. Nur lesend, kein neuer Aufruf.','Saved real Nebius record. Read-only, no new call.');});
for(const [id,value] of [['langDe','de'],['langEn','en']])$(id).onclick=()=>action(async()=>{lang=value;if(typeof history!=='undefined')history.replaceState(null,'',location.pathname+(location.hash.split('&')[0]||'#home')+'&lang='+lang);localizeStatic();if(current){const r=current,t=displayToken;render(r,t);}updateControls();});
for(const link of document.querySelectorAll?.('a[href^="#"]')??[])link.addEventListener('click',event=>{const target=document.getElementById(link.getAttribute('href').slice(1));if(target){event.preventDefault();target.scrollIntoView({behavior:'smooth'});}});
// Reloads reopen a saved ID, never regenerate feedback.
try{const data=await api('/api/tasks');catalog=data.tasks;live=data.liveEnabled;juryAvailable=!!data.juryExampleAvailable;$('juryExample').hidden=!juryAvailable;lang=/(?:#|&)lang=en(?:&|$)/.test(location.hash)?'en':'de';$('providerBadge').textContent=live?'NEBIUS LIVE · EIN PRÜFLAUF':'OFFLINE · TESTANBIETER';$('modeIntro').textContent='Vollständige synthetische Prüfvorlagen werden vor der Anzeige lokal gespeichert. Wiederöffnen und Freigeben rufen keinen Provider auf. '+(live?'Echter Nebius-Modus: höchstens ein Katalog- und ein Inference-Aufruf.':'Simulation: keine echten KI-Aufrufe.');$('scenario').disabled=live;$('run').textContent=live?'Prüfen & einmal kostenpflichtig Nebius aufrufen':'Unabhängig prüfen & Testfeedback anfordern';for(const t of catalog){const o=document.createElement('option');o.value=t.id;o.textContent=t.title;$('task').append(o);}localizeStatic();choose(catalog[0].id);await refreshBudget();await refreshList();const match=location.hash.match(/^#run=([a-f0-9-]{36})(?:&lang=(?:de|en))?$/);if(match)await openRun(match[1]);else if(location.hash.split('&')[0]==='#jury'&&juryAvailable){const d=await api('/api/jury-example');translation=d.translation??null;render(d.run);}}catch(e){invalidate();$('status').textContent=e.message;}
