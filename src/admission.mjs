// Standalone, local quota port. No browser/runtime/platform imports.
import {need} from './errors.mjs';
export function createBrowserAdmission({now=Date.now,intervalMs=60000,maxAttempts=4,maxBudget=120000}={}){
 let active=false,attempts=0,reserved=0,last=-Infinity;
 return Object.freeze({take(tokens){need(!active,'RATE_LIMIT');need(Number.isSafeInteger(tokens)&&tokens>0&&tokens<=30000,'BUDGET_BLOCKED');const t=now();need(t-last>=intervalMs,'RATE_LIMIT');need(attempts<maxAttempts&&reserved+tokens<=maxBudget,'BUDGET_BLOCKED');active=true;last=t;attempts++;reserved+=tokens;},release(){active=false;},get state(){return {active,attempts,reserved};}});
}
