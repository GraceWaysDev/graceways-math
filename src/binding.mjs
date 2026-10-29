import {createHash} from 'node:crypto';
export const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function createBoundRequest({id,kind,input,report}){
 const verification={task_hash:hash({subject:input.subject,title:input.title??null,instruction:input.instruction??input.brief}),answer_hash:hash(input.answer??null),report_hash:hash(report),report:structuredClone(report)};
 return {id,kind,inputHash:hash({kind,input,verification}),input:structuredClone(input),verification};
}
export function bindingValid(r){
 if(!r?.verification||!r.input)return false;
 const rebuilt=createBoundRequest({id:r.id,kind:r.kind,input:r.input,report:r.verification.report});
 return r.inputHash===rebuilt.inputHash&&JSON.stringify(r.verification)===JSON.stringify(rebuilt.verification);
}
