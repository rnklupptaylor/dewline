/* Critically damped visual fill level. Time is in seconds; this is not a kinetics model. */
(function(root){
 'use strict';
 function advance(level,velocity,target,dt,instant=false){
   if(instant)return[target,0];
   const omega=6,offset=level-target,c=velocity+omega*offset,decay=Math.exp(-omega*Math.max(0,dt));
   const next=target+(offset+c*dt)*decay,nextVelocity=(velocity-omega*c*dt)*decay;
   if(next<0||next>1)return[Math.max(0,Math.min(1,next)),0];
   if(Math.abs(next-target)<.0001&&Math.abs(nextVelocity)<.001)return[target,0];
   return[next,nextVelocity];
 }
 root.PoreMotion={advance};
})(typeof window==='undefined'?globalThis:window);
