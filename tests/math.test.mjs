import test from 'node:test';import assert from 'node:assert/strict';import {verify} from '../src/math.mjs';
const cases=[
 ['3(x+2)=21','{5}','CORRECT'],['3(x+2)=21','{4}','INCORRECT'],['x²=4','{-2;2}','CORRECT'],['x²=4','{2}','INCORRECT'],
 ['x^2=x','{0;1}','CORRECT'],['x^2=x','{1}','INCORRECT'],['x^2-2x+1=0','{1}','CORRECT'],['x^2+1=0','{}','CORRECT'],
 ['x^2+1=0','{1}','INCORRECT'],['2x=1','{0.5}','CORRECT'],['2x=1','{1/2}','CORRECT'],['x^2=2','{-sqrt(8)/2;sqrt(2)}','CORRECT'],
 ['x^2-2x-1=0','{1-sqrt(2);1+sqrt(2)}','CORRECT'],['2x^2-4x-1=0','{(2-sqrt(6))/2;(2+sqrt(6))/2}','CORRECT'],
 ['x=x','R','CORRECT'],['x=x+1','∅','CORRECT'],['x^2=0','{0;0}','CORRECT'],['-x^2=-4','{-2;2}','CORRECT'],
 ['x^2=2','{-1.414214;1.414214}','INCORRECT'],['x^2=2','{±sqrt(2)}','UNKNOWN'],['1/x=1','{1}','UNKNOWN'],
 ['x^3=1','{1}','UNKNOWN'],['sin(x)=0','{0}','UNKNOWN'],['x=1','ungefähr eins','UNKNOWN'],['x=1','{1,5}','INCORRECT'],
 ['x=1/0','{1}','UNKNOWN'],['x=1','{process.exit()}','UNKNOWN'],['x=1','{sqrt(-1)}','UNKNOWN'],['x=1','{1/0}','UNKNOWN'],
 ['0.5x^2=1','{-sqrt(2);sqrt(2)}','CORRECT'],['x^2=1/2','{-sqrt(0.5);sqrt(0.5)}','CORRECT'],
 ['x^2=2','{-2/sqrt(2);2/sqrt(2)}','CORRECT'],['x=1','{1/2+1/2}','CORRECT']
];
for(const [equation,solution,expected] of cases)test(equation+' :: '+solution,()=>assert.equal(verify({equation,solution}).verdict,expected));
test('equivalent steps checked against preceding and original solution sets',()=>{const r=verify({equation:'3(x+2)=21',steps:['3x+6=21','3x=15','x=5'],solution:'{5}'});assert.equal(r.verdict,'CORRECT');assert.ok(r.steps.every(s=>s.status==='EQUIVALENT'));});
test('lost zero root is rejected even if final set is repaired',()=>{const r=verify({equation:'x^2=x',steps:['x=1'],solution:'{0;1}'});assert.equal(r.verdict,'INCORRECT');assert.equal(r.reason,'NON_EQUIVALENT_STEP');});
test('extraneous root and later restoration do not excuse invalid step',()=>{assert.equal(verify({equation:'x=2',steps:['x^2=4','x=2'],solution:'{2}'}).verdict,'INCORRECT');});
test('unsupported steps are unknown even with correct final solution',()=>{assert.equal(verify({equation:'x=1',steps:['dividiere durch x'],solution:'{1}'}).verdict,'UNKNOWN');});
test('input/degree/radical bounds fail closed',()=>{for(const a of [{equation:'x=1',solution:'1',steps:Array(9).fill('x=1')},{equation:'x=1',solution:'1'.repeat(501)},{equation:'x^2=10000000001',solution:'{}'},{equation:'(x^2+1)(x^2-1)=0',solution:'{1;-1}'}])assert.equal(verify(a).verdict,'UNKNOWN');});
test('generated factorized quadratics: all integer pairs and changed sets',()=>{for(let a=-6;a<=6;a++)for(let b=-6;b<=6;b++){const equation=`(x-(${a}))(x-(${b}))=0`;assert.equal(verify({equation,solution:`{${a};${b}}`}).verdict,'CORRECT',equation);assert.equal(verify({equation,solution:`{${a};${b};99}`}).verdict,'INCORRECT');}});
test('linear family exact rational roots and scaling',()=>{for(let a=1;a<=15;a++)for(let b=-5;b<=5;b++)assert.equal(verify({equation:`${a}x=${b}`,steps:[`${a*2}x=${b*2}`],solution:`{${b}/${a}}`}).verdict,'CORRECT');});
test('zero exponents are outside scope rather than assigning 0^0 a value',()=>assert.equal(verify({equation:'0^0*x=1',solution:'{1}'}).verdict,'UNKNOWN'));
test('solution assignment tolerates whitespace',()=>assert.equal(verify({equation:'2x=1',solution:'x = 1/2'}).verdict,'CORRECT'));
