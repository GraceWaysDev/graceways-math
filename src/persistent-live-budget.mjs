import {existsSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
// One allowance for the installation, not one per browser or server restart.
// Claim before dispatch; a crash consumes the allowance and never enables a retry.
export function persistentLiveBudget(provider,directory){
 const claim=join(directory,'nebius-once.claim'),receipt=join(directory,'nebius-once.receipt.json');
 return Object.freeze({
  status:()=>({configuration:'NEBIUS_LIVE',oneShotConsumed:existsSync(claim)}),
  get counts(){if(existsSync(receipt))return JSON.parse(readFileSync(receipt,'utf8')).counts;return provider.counts;},
  get diagnostics(){return existsSync(claim)&&!existsSync(receipt)?{allowance_claimed:true,completed_receipt_available:false}:null;},
  async generate(request,recheck){
   recheck();
   if(!['CORRECT','INCORRECT'].includes(request?.verification?.report?.verdict))throw Error('POLICY_BLOCKED');
   try{writeFileSync(claim,'consumed',{flag:'wx',flush:true});}catch{throw Error('CALL_LIMIT');}
   try{return await provider.generate(request,recheck);}
   finally{writeFileSync(receipt,JSON.stringify({counts:provider.counts}),{flag:'wx',flush:true});}
  }
 });
}
