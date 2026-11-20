const assert=require('node:assert/strict');require('../src/ripples.js');
function seeded(seed){return()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};}
for(const fps of [15,60,144]){
 const motion=globalThis.PoreRipples.create(seeded(394)),eligible=[4,7,17],seen=new Set(),origins=new Set();let launches=0;
 for(let frame=0;frame<fps*120;frame++){
   const data=motion.update(1/fps,eligible,true,17);
   for(let i=0;i<16;i+=4)if(data[i]>=0){
     assert.ok(eligible.includes(data[i]),'Only eligible visible water pores can ripple');
     assert.ok(data[i+1]>=0&&data[i+1]<=2.5);assert.ok(Math.hypot(data[i+2],data[i+3])<=.281);
     seen.add(data[i]);origins.add(data[i+2]+','+data[i+3]);if(data[i+1]===0)launches++;
   }
 }
 assert.deepEqual([...seen].sort((a,b)=>a-b),eligible);assert.ok(origins.size>20,'Ripple origins must vary');
 assert.ok(launches>20&&launches<65,'Ripples must be occasional, not continuous');
 assert.ok(motion.update(.1,eligible,false).every(v=>v===-1),'Overview or animation-off must clear active ripples');
 for(let i=0;i<60;i++)motion.update(.05,[17],true,17);
 assert.ok(motion.update(.01,[]).every(v=>v===-1),'Empty or offscreen pores must clear immediately');
}
const delayed=globalThis.PoreRipples.create(()=>.5);
assert.ok(delayed.update(.2,[17]).every(v=>v===-1));
let output;for(let i=0;i<10;i++)output=delayed.update(.1,[17]);assert.equal(output[0],17);
console.log('Passed: random delays and origins; occasional events at 15–144 FPS; eligible filled pores only; finite lifetimes; immediate cleanup outside microscopic mode, on emptying, or when switched off.');
