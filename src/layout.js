/* Equal-area schematic sections; individual pore diameters retain their relative scale. */
(function(root){
 'use strict';
 function create(diameters){
   const largest=diameters.at(-1),side=largest*4.8;
   const arrays=diameters.map((diameter,i)=>{
     const n=Math.max(3,Math.ceil(3*largest/diameter-1e-9)),spacing=side/n;
     const x=(i-5.5)*side,z=0;
     return {diameter,n,count:n*n,spacing,x,z,focus:Math.floor(n/2)*n+Math.floor(n/2)};
   });
   return {side,width:12*side,depth:side,arrays,
     center(i,j=arrays[i].focus){const a=arrays[i];return[a.x+(j%a.n-(a.n-1)/2)*a.spacing,0,a.z+(Math.floor(j/a.n)-(a.n-1)/2)*a.spacing];}
   };
 }
 root.PoreLayout={create};
})(typeof window==='undefined'?globalThis:window);
