export const codes=Object.freeze(['MISSING_PROVIDER_SECRET','HOST_BLOCKED','MODEL_CHANGE_REQUIRES_APPROVAL','MODEL_NOT_AVAILABLE','AUTHENTICATION_ERROR','RATE_LIMIT','TIMEOUT','PROVIDER_UNAVAILABLE','INVALID_RESPONSE','INCOMPLETE_OUTPUT','CONTEXT_LIMIT','PROVIDER_REFUSAL','POLICY_BLOCKED','SYNTHETIC_DATA_BLOCKED','BUDGET_BLOCKED','CALL_LIMIT','NETWORK_ERROR','DUPLICATE_RESPONSE']);
const branded=new WeakSet();
export class BoundaryError extends Error{constructor(code){super(codes.includes(code)?code:'NETWORK_ERROR');this.name='BoundaryError';this.code=this.message;branded.add(this);}}
export const fail=code=>{throw new BoundaryError(code);};
export const safeError=e=>Object.freeze({code:branded.has(e)?e.code:'NETWORK_ERROR',message:branded.has(e)?e.code:'NETWORK_ERROR'});
export const retryable=e=>branded.has(e)&&['TIMEOUT','RATE_LIMIT','PROVIDER_UNAVAILABLE'].includes(e.code);
export const need=(condition,code='POLICY_BLOCKED')=>{if(!condition)fail(code);};
