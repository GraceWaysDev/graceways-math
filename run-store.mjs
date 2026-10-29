import {mkdirSync,readFileSync,readdirSync,writeFileSync,linkSync,unlinkSync,existsSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash} from './src/binding.mjs';
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
// Immutable, flushed snapshot + separate immutable decision. Only allowlisted workflow data enters here.
export function createRunStore(directory){
 const root=resolve(directory);mkdirSync(root,{recursive:true});
 const path=(id,suffix)=>{if(!validId(id))throw Error('INVALID_RUN_ID');return join(root,id+suffix);};
 function read(file){const envelope=JSON.parse(readFileSync(file,'utf8'));if(envelope.version!==1||hash(envelope.value)!==envelope.sha256)throw Error('STORAGE_INTEGRITY');return envelope.value;}
 function put(file,value){const temp=join(root,'.pending-'+randomUUID());writeFileSync(temp,JSON.stringify({version:1,sha256:hash(value),value},null,2),{flag:'wx',flush:true});try{linkSync(temp,file);}finally{unlinkSync(temp);}}
 return Object.freeze({
  save(r){put(path(r.id,'.run.json'),r);},
  decide(r){const original=read(path(r.id,'.run.json'));if(original.bindingHash!==r.bindingHash||original.proposalHash!==r.proposalHash)throw Error('STALE_REVIEW');put(path(r.id,'.decision.json'),{id:r.id,bindingHash:r.bindingHash,proposalHash:r.proposalHash,status:r.status,release:r.release??null,nextTask:r.nextTask??null,decision:r.decision});},
  load(id){const r=read(path(id,'.run.json'));if(r.id!==id)throw Error('STORAGE_INTEGRITY');const decision=path(id,'.decision.json');if(existsSync(decision)){const d=read(decision);if(d.id!==id||d.bindingHash!==r.bindingHash||d.proposalHash!==r.proposalHash||!['RELEASED','REJECTED'].includes(d.status))throw Error('STORAGE_INTEGRITY');Object.assign(r,d);}return r;},
  list(){return readdirSync(root).filter(n=>n.endsWith('.run.json')).map(n=>{const id=n.slice(0,-9);try{const r=this.load(id);return {id,status:r.status,createdAt:r.createdAt,title:r.task.title,provider:r.provider};}catch{return {id,status:'STORAGE_INTEGRITY',title:'Beschädigter Lauf – gesperrt'};}});}
 });
}
