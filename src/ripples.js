/* Random, short-lived surface disturbances. Candidates are visible, filled pore IDs. */
(function(root){
 'use strict';
 function create(random=Math.random){
   let events=[],running=false,untilNext=0;
   const uniforms=new Float32Array(16);
   function pack(){uniforms.fill(-1);events.forEach((e,i)=>uniforms.set([e.cell,e.age,e.x,e.z],i*4));return uniforms;}
   return {update(dt,candidates,enabled=true,preferred=-1){
     if(!enabled||!candidates.length){events=[];running=false;return pack();}
     const available=new Set(candidates);
     events=events.filter(e=>{e.age+=dt;return e.age<2.5&&available.has(e.cell);});
     if(!running){untilNext=.35+.9*random();running=true;}
     untilNext-=dt;
     if(untilNext<=0){
       const cell=available.has(preferred)&&random()<.6?preferred:candidates[Math.min(candidates.length-1,Math.floor(random()*candidates.length))];
       const angle=random()*Math.PI*2,radius=.28*Math.sqrt(random());
       if(events.length===4)events.shift();
       events.push({cell,age:0,x:Math.cos(angle)*radius,z:Math.sin(angle)*radius});
       untilNext=1.7+random()*2.9;
     }
     return pack();
   }};
 }
 root.PoreRipples={create};
})(typeof window==='undefined'?globalThis:window);
