// Exact, bounded polynomial parser. No eval, Function, CAS or model dependency.
const unsupported=()=>{throw Error('UNSUPPORTED_INPUT');};
const gcd=(a,b)=>b?gcd(b,a%b):(a<0n?-a:a);
function q(n,d=1n){n=BigInt(n);d=BigInt(d);if(!d||String(n).length>42||String(d).length>42)unsupported();if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return {n:n/g,d:d/g};}
const zero=()=>q(0),one=()=>q(1),add=(a,b)=>q(a.n*b.d+b.n*a.d,a.d*b.d),neg=a=>q(-a.n,a.d),sub=(a,b)=>add(a,neg(b)),mul=(a,b)=>q(a.n*b.n,a.d*b.d),div=(a,b)=>q(a.n*b.d,a.d*b.n);
const qs=a=>a.d===1n?String(a.n):a.n+'/'+a.d;
const poly=(a=zero(),b=zero(),c=zero())=>[a,b,c];
const padd=(a,b)=>a.map((v,i)=>add(v,b[i]));
function pmul(a,b){const r=Array.from({length:5},zero);for(let i=0;i<3;i++)for(let j=0;j<3;j++)r[i+j]=add(r[i+j],mul(a[i],b[j]));if(r[3].n||r[4].n)unsupported();return r.slice(0,3);}
function tokens(text){if(typeof text!=='string'||text.length>250)unsupported();text=text.replaceAll('²','^2').replaceAll('−','-').replaceAll('·','*').replaceAll('×','*');const t=[];let i=0;while(i<text.length){if(/\s/u.test(text[i])){i++;continue;}const m=/^(?:\d+(?:\.\d{1,6})?|x|sqrt|[+*/^()=-])/.exec(text.slice(i));if(!m)unsupported();t.push(m[0]);i+=m[0].length;if(t.length>120)unsupported();}return t;}
function number(s){if(!/^\d+(?:\.\d{1,6})?$/.test(s)||s.length>12)unsupported();const [a,b='']=s.split('.');return q(BigInt(a+b),10n**BigInt(b.length));}
function parseExpression(text,algebra){const t=tokens(text);let i=0,depth=0;const take=()=>t[i++];
 function atom(){if(++depth>20)unsupported();let v;const a=take();if(a==='('){v=sum();if(take()!==')')unsupported();}else if(a==='x'){if(!algebra.variable)unsupported();v=algebra.variable();}else if(a==='sqrt'){if(!algebra.sqrt||take()!=='(')unsupported();const r=sum();if(take()!==')')unsupported();v=algebra.sqrt(r);}else v=algebra.constant(number(a??''));depth--;return v;}
 function power(){let v=atom();if(t[i]==='^'){take();const e=take();if(!/^[1-4]$/.test(e)||Number(e)>(algebra.maxPower??2))unsupported();const base=v;for(let k=1;k<Number(e);k++)v=algebra.mul(v,base);}return v;}
 function unary(){if(t[i]==='+'){take();return unary();}if(t[i]==='-'){take();return algebra.neg(unary());}return power();}
 function product(){let v=unary();while(i<t.length){const op=t[i];if(op==='*'||op==='/'){take();const r=unary();v=op==='*'?algebra.mul(v,r):algebra.div(v,r);}else if(op==='x'||op==='('||op==='sqrt'){v=algebra.mul(v,unary());}else break;}return v;}
 function sum(){let v=product();while(t[i]==='+'||t[i]==='-'){const op=take(),r=product();v=algebra.add(v,op==='+'?r:algebra.neg(r));}return v;}
 if(t.length===0)unsupported();const v=sum();if(i!==t.length)unsupported();return v;
}
const polynomial={constant:a=>poly(a),variable:()=>poly(zero(),one()),add:padd,neg:a=>a.map(neg),mul:pmul,div:(a,b)=>{if(b[1].n||b[2].n)unsupported();return a.map(v=>div(v,b[0]));}};
// a + b*sqrt(d), d is a positive square-free integer. Bounded factorization.
function radical(a=zero(),b=zero(),d=1n){if(d<0n||d>10000000000n)unsupported();if(!b.n||d===0n)return {a,b:zero(),d:1n};let square=1n;for(let f=2n;f*f<=d;f++){while(d%(f*f)===0n){square*=f;d/=f*f;}}b=mul(b,q(square));if(d===1n)return {a:add(a,b),b:zero(),d:1n};return {a,b,d};}
function radd(u,v){if(u.b.n&&v.b.n&&u.d!==v.d)unsupported();return radical(add(u.a,v.a),add(u.b,v.b),u.b.n?u.d:v.d);}
const rneg=u=>radical(neg(u.a),neg(u.b),u.d);
function rmul(u,v){if(u.b.n&&v.b.n&&u.d!==v.d)unsupported();const d=u.b.n?u.d:v.d;return radical(add(mul(u.a,v.a),mul(mul(u.b,v.b),q(d))),add(mul(u.a,v.b),mul(u.b,v.a)),d);}
function rdiv(u,v){const conjugate=rneg({...v,a:neg(v.a)});const norm=sub(mul(v.a,v.a),mul(mul(v.b,v.b),q(v.d)));const n=rmul(u,conjugate);return radical(div(n.a,norm),div(n.b,norm),n.d);}
const radicalAlgebra={constant:a=>radical(a),add:radd,neg:rneg,mul:rmul,div:rdiv,sqrt:r=>{if(r.b.n||r.a.n<0n)unsupported();return radical(zero(),q(1,r.a.d),r.a.n*r.a.d);}};
const key=r=>qs(r.a)+'|'+qs(r.b)+'|'+r.d;
function label(r){if(!r.b.n)return qs(r.a);const term=(r.b.n<0n?'-':'+')+(qs(q(r.b.n<0n?-r.b.n:r.b.n,r.b.d))==='1'?'':qs(q(r.b.n<0n?-r.b.n:r.b.n,r.b.d))+'*')+'sqrt('+r.d+')';return r.a.n?qs(r.a)+term:term.replace(/^\+/,'');}
const finite=roots=>({kind:'FINITE',values:[...new Map(roots.map(r=>[key(r),r])).values()].sort((a,b)=>key(a).localeCompare(key(b)))});
function solve(text){const parts=text.split('=');if(parts.length!==2)unsupported();const c=padd(parseExpression(parts[0],polynomial),parseExpression(parts[1],polynomial).map(neg));let [C,B,A]=c;if(!A.n){if(!B.n)return C.n?finite([]):{kind:'ALL_REAL',values:[]};return finite([radical(div(neg(C),B))]);}const denominator=A.d*B.d*C.d;let ai=A.n*(denominator/A.d),bi=B.n*(denominator/B.d),ci=C.n*(denominator/C.d);const g=gcd(gcd(ai,bi),ci);ai/=g;bi/=g;ci/=g;const D=bi*bi-4n*ai*ci;if(D<0n)return finite([]);const center=q(-bi,2n*ai);if(D===0n)return finite([radical(center)]);return finite([radical(center,q(1,2n*ai),D),radical(center,q(-1,2n*ai),D)]);}
function submitted(text){if(typeof text!=='string'||text.length>500)unsupported();text=text.trim().replace(/^(?:L|S)\s*=\s*/,'');if(['R','ℝ'].includes(text))return {kind:'ALL_REAL',values:[]};if(['{}','∅'].includes(text))return finite([]);text=text.replace(/^x\s*=\s*/,'');if(text.startsWith('{')&&text.endsWith('}'))text=text.slice(1,-1);if(!text.trim())return finite([]);const parts=text.split(/[;,]/);if(parts.length>4||parts.some(s=>!s.trim()))unsupported();return finite(parts.map(s=>parseExpression(s.trim(),radicalAlgebra)));}
const setKey=s=>s.kind+':'+s.values.map(key).sort().join(';');
const expose=s=>({kind:s.kind,values:s.values.map(label)});
export function verify({equation,steps=[],solution}){
 const result={checker:'exact-polynomial-v1',verification_source:'DETERMINISTIC_CHECKER',verdict:'UNKNOWN',reason:'UNSUPPORTED_INPUT',expected:null,submitted:null,steps:[],complete:false};
 if(!Array.isArray(steps)||steps.length>8)return result;
 let original,final;try{original=solve(equation);result.expected=expose(original);}catch{return result;}
 let previous=original,unknown=false,invalid=false;
 for(let i=0;i<steps.length;i++){try{const current=solve(steps[i]);const same=setKey(previous)===setKey(current);result.steps.push({index:i+1,status:same?'EQUIVALENT':'NON_EQUIVALENT',solution_set:expose(current)});if(!same)invalid=true;previous=current;}catch{unknown=true;result.steps.push({index:i+1,status:'UNKNOWN'});}}
 try{final=submitted(solution);result.submitted=expose(final);}catch{return {...result,reason:'UNSUPPORTED_SOLUTION'};}
 if(unknown)return {...result,reason:'UNSUPPORTED_STEP'};
 result.complete=setKey(original)===setKey(final);
 result.verdict=(!invalid&&result.complete)?'CORRECT':'INCORRECT';
 result.reason=invalid?'NON_EQUIVALENT_STEP':result.complete?'COMPLETE_REAL_SOLUTION_SET':'SOLUTION_SET_MISMATCH';
 return result;
}

// Separate bounded polynomial operations for tangent checks. The equation solver
// above retains its original degree-two algebra and historical report format.
export function checkTangent({polynomial:expression,at,solution,steps=[]}) {
 const result={checker:'exact-polynomial-tangent-v1',verification_source:'DETERMINISTIC_CHECKER',verdict:'UNKNOWN',reason:'UNSUPPORTED_INPUT',expected:null,submitted:null,steps:[],complete:false};
 const size=5,blank=()=>Array.from({length:size},zero);
 const algebra={maxPower:4,constant:a=>[a,...Array.from({length:4},zero)],variable:()=>[zero(),one(),zero(),zero(),zero()],add:(a,b)=>a.map((v,i)=>add(v,b[i])),neg:a=>a.map(neg),mul:(a,b)=>{const r=Array.from({length:9},zero);for(let i=0;i<size;i++)for(let j=0;j<size;j++)r[i+j]=add(r[i+j],mul(a[i],b[j]));if(r.slice(size).some(v=>v.n))unsupported();return r.slice(0,size);},div:(a,b)=>{if(b.slice(1).some(v=>v.n))unsupported();return a.map(v=>div(v,b[0]));}};
 const parse=s=>parseExpression(s,algebra);
 const constant=s=>{const a=parse(s);if(a.slice(1).some(v=>v.n))unsupported();return a[0];};
 const value=(a,x)=>a.reduceRight((acc,v)=>add(mul(acc,x),v),zero());
 const line=s=>{if(typeof s!=='string')unsupported();const parts=s.split('=');if(parts.length!==2||!['y','t(x)'].includes(parts[0].trim()))unsupported();const a=parse(parts[1]);if(a.slice(2).some(v=>v.n))unsupported();return a;};
 const exposed=a=>({kind:'TANGENT',slope:qs(a[1]),intercept:qs(a[0])});
 try {
  if(!Array.isArray(steps)||steps.length>8)unsupported();
  const f=parse(expression),x=constant(at),derivative=f.slice(1).map((v,i)=>mul(q(i+1),v));
  const slope=value(derivative,x),y=value(f,x),expected=blank();expected[0]=sub(y,mul(slope,x));expected[1]=slope;
  result.expected={...exposed(expected),point:{x:qs(x),y:qs(y)}};
  const equal=a=>a.every((v,i)=>qs(v)===qs(expected[i]));
  let invalid=false;
  for(let i=0;i<steps.length;i++){const a=line(steps[i]),ok=equal(a);result.steps.push({index:i+1,status:ok?'EQUIVALENT':'NON_EQUIVALENT',tangent:exposed(a)});if(!ok)invalid=true;}
  const answer=line(solution);result.submitted=exposed(answer);result.complete=equal(answer);
  result.verdict=result.complete&&!invalid?'CORRECT':'INCORRECT';result.reason=invalid?'INCORRECT_TANGENT_STEP':result.complete?'EXACT_TANGENT_MATCH':'TANGENT_MISMATCH';
 }catch {result.reason='UNSUPPORTED_TANGENT_INPUT';}
 return result;
}
