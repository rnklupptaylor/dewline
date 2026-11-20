/* A schematic device with equal-area sections and correctly scaled individual pores. */
(()=>{
 'use strict';
 const canvas=document.getElementById('deviceCanvas'),svg=document.getElementById('annotations');
 const gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'low-power'});
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 let diameters=[],filled=[],selected=5,row=0,pitch=90,width=360,depth=270,thickness=15,layout=null;
 let fillLevels=[],fillVelocities=[],animateFilling=true,ripplesEnabled=true;
 let zoom=0,section=false,labels=false,yaw=.015,elevation=.83,drag=null,clicked=false,oldKey='',viewMode='perspective';
 let panOffset=[0,0,0];
 let target=[0,-3,0],camDistance=430,last=0,matrix=null,cam=[0,200,300];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 window.PoreDevice={
   update(data){const changed=selected!==data.selected;diameters=data.diameters;filled=data.filled;selected=data.selected;if(!fillLevels.length){fillLevels=filled.map(v=>v?1:0);fillVelocities=filled.map(()=>0);}const key=diameters.join(',');if(key!==oldKey){oldKey=key;layout=window.PoreLayout.create(diameters);pitch=layout.side;width=layout.width;depth=layout.depth;thickness=diameters.at(-1)*.83;row=layout.arrays[selected].focus;panOffset=[0,0,0];if(gl)build();}else if(changed){row=layout.arrays[selected].focus;panOffset=[0,0,0];}},
   setZoom(v){zoom=clamp(v,0,100);},setSection(v){section=v;},setLabels(v){labels=Boolean(v);if(matrix)annotation();},
   setAnimation(v){animateFilling=Boolean(v);},
   setRipples(v){ripplesEnabled=Boolean(v);},
   setView(mode){viewMode=mode==='plan'?'plan':'perspective';if(viewMode==='perspective'){yaw=.015;elevation=.83;}window.PoreDevice.onViewChange?.(viewMode);},
   frameDevice(){panOffset=[0,0,0];if(layout)row=layout.arrays[selected].focus;},
   focus(){panOffset=[0,0,0];},
   reset(){yaw=.015;elevation=.83;panOffset=[0,0,0];viewMode='perspective';if(layout)row=layout.arrays[selected].focus;window.PoreDevice.onViewChange?.(viewMode);},onSelect:null,onZoom:null,onViewChange:null
 };
 if(!gl){document.getElementById('renderError').hidden=false;return;}
 const instancing=gl.getExtension('ANGLE_instanced_arrays');
 if(!instancing){document.getElementById('renderError').hidden=false;return;}
 const rippleMotion=window.PoreRipples.create();
 const vertex=`attribute vec3 position,normal,offset;attribute float kind,cell;uniform mat4 vp;
 uniform float filling[12],poreDiameters[12],pitch;
 varying vec3 p,n;varying vec2 poreCenter;varying float k,c;
 void main(){
   p=position+vec3(offset.x,0.,offset.y);n=normal;k=kind;c=cell+offset.z;poreCenter=offset.xy;
   if(kind>3.5&&kind<4.5||kind>6.5&&kind<7.5){
     float wet=0.,diameter=1.,col=floor(cell/4096.);
     for(int i=0;i<12;i++){if(abs(col-float(i))<.1){wet=filling[i];diameter=poreDiameters[i];}}
     // The floor and meniscus are congruent hemispheres separated vertically by 0.15 D.
     // Translate the surface while filling; keep the curved floor of the section cap fixed.
     if(kind<4.5)p.y=position.y-.15*diameter*(1.-wet);
     else{
       float localX=position.x,r=diameter*.5;
       float floorY=-.15*diameter-sqrt(max(0.,r*r-localX*localX));
       p.y=mix(floorY,position.y,wet);
     }
   }
   gl_Position=vp*vec4(p,1.);
 }`;
 const fragment=`precision highp float;
 varying vec3 p,n;varying vec2 poreCenter;varying float k,c;
 uniform vec3 camera;uniform float time,selectedArray,selectedCell,selectedZ,cut,pitch,plateW,plateD,thickness;uniform float filling[12],poreDiameters[12];uniform vec4 ripples[4];
 vec3 environment(vec3 d){vec3 s=mix(vec3(.018,.05,.075),vec3(.17,.34,.39),smoothstep(-.3,1.,d.y));s+=vec3(.7,1.,.91)*pow(max(0.,dot(d,normalize(vec3(-.3,1.,.7)))),75.)*2.;s+=vec3(.12,.48,.6)*pow(max(0.,dot(d,normalize(vec3(.8,.5,-.4)))),25.);return s;}
 void main(){
   float col=floor(c/4096.);bool chosen=abs(c-selectedCell)<.1;
   if(c>-.5&&chosen&&cut>.5&&p.z>selectedZ+.002&&k<5.5)discard;
   if(k>5.5&&k<7.5&&(!chosen||cut<.5))discard;
   if(k>4.5&&k<5.5&&abs(col-selectedArray)>.1)discard;
   float wet=0.,diameter=1.;for(int i=0;i<12;i++){if(abs(col-float(i))<.1){wet=filling[i];diameter=poreDiameters[i];}}
   if((k>3.5&&k<4.5||k>6.5&&k<7.5)&&wet<.0001)discard;
   vec3 norm=normalize(n),v=normalize(camera-p),l=normalize(vec3(-.4,1.,.6));
   float diff=max(0.,dot(norm,l)),fres=pow(1.-max(0.,dot(norm,v)),5.);
   vec3 color=vec3(.04,.075,.10);
   if(k<.5){
     float grain=.97+.03*sin(p.x*80.)*sin(p.z*71.);
     color=vec3(.105,.16,.19)*(.35+.65*diff)*grain;
     color+=environment(reflect(-v,norm))*(.08+.14*fres);
     vec2 edges=abs(mod(p.xz+vec2(plateW,plateD)*.5,pitch)-pitch*.5);
     color*=.62+.38*smoothstep(0.,pitch*.018,pitch*.5-max(edges.x,edges.y));
   }else if(k<1.5){
     float shade=clamp(1.+p.y/(pitch*.36),.16,1.);
     color=vec3(.13,.22,.25)*(.3+.5*diff)*shade+environment(reflect(-v,norm))*.055;
   }else if(k<2.5){color=vec3(.045,.085,.105)*(.35+diff*.45)+environment(reflect(-v,norm))*.025;
   }else if(k<3.5){color=vec3(.065,.10,.13)*(.5+diff*.6);color+=vec3(.02,.04,.05)*step(.85,fract(p.y*5.));
   }else if(k<4.5||k>6.5&&k<7.5){
     float ringLight=0.;
     if(k<4.5){
       norm=normalize(norm+vec3(sin(p.x*1.3+time*.45),0.,cos(p.z*1.4-time*.3))*.008);
       vec2 local=(p.xz-poreCenter)/(diameter*.5);
       float edge=pow(max(0.,1.-dot(local,local)),.8);
       for(int j=0;j<4;j++){
         vec4 event= ripples[j];
         if(abs(event.x-c)<.1&&event.y>=0.&&event.y<2.5){
           vec2 delta=local-event.zw;float dist=length(delta),age=event.y;
           float envelope=smoothstep(0.,.16,age)*(1.-smoothstep(1.1,2.5,age))*exp(-7.*pow(dist-.85*age,2.))*edge;
           float phase=24.*(dist-.85*age);
           vec2 direction=delta/max(dist,.025);
           norm=normalize(norm+vec3(direction.x,0.,direction.y)*cos(phase)*envelope*.23);
           ringLight+=pow(max(0.,sin(phase)),5.)*envelope;
         }
       }
     }
     float f=pow(1.-max(0.,dot(norm,v)),4.);
     color=mix(vec3(.025,.23,.26),environment(reflect(-v,norm)),.12+f*.75);
     color+=vec3(.03,.13,.12)*max(0.,dot(norm,normalize(vec3(1.,.7,-.3))));
     color+=vec3(.7,1.,.95)*pow(max(0.,dot(norm,normalize(l+v))),140.)*.9;
     float caustic=pow(.5+.5*sin(p.x*1.7+p.z*2.+sin(p.x+time*.3)),14.);
     color+=vec3(.05,.18,.15)*caustic*.2;
     color+=vec3(.10,.34,.30)*ringLight;
     if(k>6.5){color=vec3(.025,.20,.23)+environment(reflect(-v,norm))*.08;}
     color=mix(vec3(.014,.035,.048),color,smoothstep(0.,.12,wet));
   }else if(k<5.5){color=vec3(.25,.73,.61);
   }else if(k<6.5){float hatch=step(.5,fract((p.x-p.y)*2.));color=mix(vec3(.10,.17,.20),vec3(.14,.22,.25),hatch);
   }else{
     float sx=max(abs(p.x)-plateW*.5,0.),sz=max(abs(p.z)-plateD*.5,0.);
     float shadow=1.-.60*exp(-(sx*sx+sz*sz)/(pitch*pitch*.4));
     vec2 grid=abs(fract(p.xz/(pitch*2.)+.5)-.5);
     float line=1.-smoothstep(.0,.009,min(grid.x,grid.y));
     color=(vec3(.025,.045,.061)+line*.008)*shadow;
     color=mix(vec3(.027,.052,.071),color,exp(-dot(p.xz,p.xz)/(plateW*plateW*3.)));
   }
   color=pow(max(color,vec3(0.)),vec3(.9));
   gl_FragColor=vec4(color,1.);
 }`;
 function shader(type,s){const a=gl.createShader(type);gl.shaderSource(a,s);gl.compileShader(a);if(!gl.getShaderParameter(a,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(a));return a;}
 let program;
 try{program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}
 catch(e){document.getElementById('renderError').hidden=false;console.error(e);return;}
 gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.clearColor(.027,.052,.071,1.);
 let meshes=[],bodyMesh=null;
 const instanceBuffer=gl.createBuffer(),origin=new Float32Array([0,0,0]);
 const attributes=[['position',3,0],['normal',3,12],['kind',1,24],['cell',1,28]].map(([name,size,offset])=>({loc:gl.getAttribLocation(program,name),size,offset}));
 const offsetLocation=gl.getAttribLocation(program,'offset');
 attributes.forEach(a=>gl.enableVertexAttribArray(a.loc));gl.enableVertexAttribArray(offsetLocation);instancing.vertexAttribDivisorANGLE(offsetLocation,1);
 const u={};['vp','camera','time','selectedArray','selectedCell','selectedZ','cut','pitch','plateW','plateD','thickness','filling[0]','poreDiameters[0]','ripples[0]'].forEach(name=>u[name]=gl.getUniformLocation(program,name));
 function center(i,j){return layout.center(i,j);}
 function upload(vertices){const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.STATIC_DRAW);return{buffer,count:vertices.length/8};}
 function draw(mesh,instances){if(!instances.length)return;gl.bindBuffer(gl.ARRAY_BUFFER,mesh.buffer);for(const a of attributes)gl.vertexAttribPointer(a.loc,a.size,gl.FLOAT,false,32,a.offset);gl.bindBuffer(gl.ARRAY_BUFFER,instanceBuffer);gl.bufferData(gl.ARRAY_BUFFER,instances,gl.DYNAMIC_DRAW);gl.vertexAttribPointer(offsetLocation,3,gl.FLOAT,false,12,0);instancing.drawArraysInstancedANGLE(gl.TRIANGLES,0,mesh.count,instances.length/3);}
 function build(){
   for(const mesh of meshes){gl.deleteBuffer(mesh.low.buffer);gl.deleteBuffer(mesh.high.buffer);}if(bodyMesh)gl.deleteBuffer(bodyMesh.buffer);
   const vertices=[];
   function vert(p,n,k,c){vertices.push(...p,...n,k,c);}
   function tri(a,b,c,n,k,id){vert(a,n,k,id);vert(b,n,k,id);vert(c,n,k,id);}
   function quad(a,b,c,d,n,k,id){tri(a,b,c,n,k,id);tri(a,c,d,n,k,id);}
   function triNormals(a,b,c,na,nb,nc,k,id){vert(a,na,k,id);vert(b,nb,k,id);vert(c,nc,k,id);}
   function pore(i,N,M){
     vertices.length=0;
     const x=0,z=0,h=layout.arrays[i].spacing/2,id=i*4096,r=diameters[i]/2,join=-diameters[i]*.15;
     for(let q=0;q<N;q++){
       const a=q/N*2*Math.PI,b=(q+1)/N*2*Math.PI,ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b);
       const oa=h/Math.max(Math.abs(ca),Math.abs(sa)),ob=h/Math.max(Math.abs(cb),Math.abs(sb));
       const pa=[x+r*ca,0,z+r*sa],pb=[x+r*cb,0,z+r*sb];
       quad(pa,[x+oa*ca,0,z+oa*sa],[x+ob*cb,0,z+ob*sb],pb,[0,1,0],0,id);
       const ba=[pa[0],join,pa[2]],bb=[pb[0],join,pb[2]];
       triNormals(pa,pb,bb,[-ca,0,-sa],[-cb,0,-sb],[-cb,0,-sb],1,id);triNormals(pa,bb,ba,[-ca,0,-sa],[-cb,0,-sb],[-ca,0,-sa],1,id);
       const r2=r+Math.max(r*.045,.05);
       quad([x+r*ca,.035,z+r*sa],[x+r2*ca,.035,z+r2*sa],[x+r2*cb,.035,z+r2*sb],[x+r*cb,.035,z+r*sb],[0,1,0],5,id);
       for(let ring=0;ring<M;ring++){
         const t1=ring/M*Math.PI/2,t2=(ring+1)/M*Math.PI/2;
         const wp=(t,c,s)=>[x+r*Math.sin(t)*c,-r*Math.cos(t),z+r*Math.sin(t)*s];
         const wn=(t,c,s)=>[-Math.sin(t)*c,Math.cos(t),-Math.sin(t)*s];
         const p1=wp(t1,ca,sa),p2=wp(t1,cb,sb),p3=wp(t2,cb,sb),p4=wp(t2,ca,sa),n1=wn(t1,ca,sa),n2=wn(t1,cb,sb),n3=wn(t2,cb,sb),n4=wn(t2,ca,sa);
         triNormals(p1,p2,p3,n1,n2,n3,4,id);triNormals(p1,p3,p4,n1,n3,n4,4,id);
         // Lower hemisphere joins the cylindrical neck with the same inward normal at its rim.
         const floor=p=>[p[0],p[1]+join,p[2]];
         triNormals(floor(p1),floor(p2),floor(p3),n1,n2,n3,2,id);triNormals(floor(p1),floor(p3),floor(p4),n1,n3,n4,2,id);
       }
     }
     // Cap the optional section plane through this pore; only the selected cell renders it.
     quad([x-h,0,z],[x-r,0,z],[x-r,-thickness,z],[x-h,-thickness,z],[0,0,1],6,id);
     quad([x+r,0,z],[x+h,0,z],[x+h,-thickness,z],[x+r,-thickness,z],[0,0,1],6,id);
     for(let q=0;q<N;q++){
       const a=-r+2*r*q/N,b=-r+2*r*(q+1)/N,ya=-Math.sqrt(Math.max(0,r*r-a*a)),yb=-Math.sqrt(Math.max(0,r*r-b*b));
       // Solid substrate below the bowl and liquid between two matching curved profiles.
       quad([x+a,ya+join,z],[x+b,yb+join,z],[x+b,-thickness,z],[x+a,-thickness,z],[0,0,1],6,id);
       quad([x+a,ya+join,z],[x+b,yb+join,z],[x+b,yb,z],[x+a,ya,z],[0,0,1],7,id);
     }
     return upload(vertices);
   }
   // Every square corner occurs at 45°: both mesh resolutions must sample all eight octants.
   meshes=layout.arrays.map((a,i)=>{const N=8*Math.max(1,Math.round(4*diameters[i]/diameters.at(-1))),instances=new Float32Array(a.count*3);for(let j=0;j<a.count;j++){const p=center(i,j);instances.set([p[0],p[2],j],j*3);}return{low:pore(i,N,Math.max(2,N/4)),high:pore(i,64,16),instances};});
   vertices.length=0;
   const X=width/2,Z=depth/2,Y=-thickness;
   quad([-X,0,Z],[X,0,Z],[X,Y,Z],[-X,Y,Z],[0,0,1],3,-1);
   quad([X,0,-Z],[-X,0,-Z],[-X,Y,-Z],[X,Y,-Z],[0,0,-1],3,-1);
   quad([-X,0,-Z],[-X,0,Z],[-X,Y,Z],[-X,Y,-Z],[-1,0,0],3,-1);
   quad([X,0,Z],[X,0,-Z],[X,Y,-Z],[X,Y,Z],[1,0,0],3,-1);
   quad([-X,Y,-Z],[X,Y,-Z],[X,Y,Z],[-X,Y,Z],[0,-1,0],3,-1);
   quad([-width*4,Y-1,-width*4],[width*4,Y-1,-width*4],[width*4,Y-1,width*4],[-width*4,Y-1,width*4],[0,1,0],8,-1);
   bodyMesh=upload(vertices);
 }
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),norm=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);},cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 function lookAt(eye,target){const z=norm(sub(eye,target)),x=norm(cross(viewMode==='plan'?[0,0,-1]:[0,1,0],z)),y=cross(z,x);return[x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1];}
 function perspective(aspect){const f=1/Math.tan(Math.PI/8),near=.03,far=5000;return[f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0];}
 function orthographic(aspect){const half=camDistance*Math.tan(Math.PI/8),far=5000;return[1/(half*aspect),0,0,0,0,1/half,0,0,0,0,-2/far,0,0,0,-1,1];}
 function distanceAt(value){const aspect=canvas.clientWidth/canvas.clientHeight,overview=Math.max(width*.7,width/(aspect*.7));return Math.exp(Math.log(overview)*(1-value/100)+Math.log(diameters[selected]*3.5)*value/100);}
 function baseTarget(value=zoom){const z=value/100,pan=Math.min(1,z/.55),blend=pan*pan*(3-2*pan),pc=center(selected,row);return[pc[0]*blend,-thickness*.2*(1-blend)-diameters[selected]*.2*blend,pc[2]*blend-(viewMode==='plan'?0:depth*1.2*(1-blend))];}
 function cameraAt(at,distance){return viewMode==='plan'?[at[0],at[1]+distance,at[2]]:[at[0]+Math.sin(yaw)*Math.cos(elevation)*distance,at[1]+Math.sin(elevation)*distance,at[2]+Math.cos(yaw)*Math.cos(elevation)*distance];}
 function groundPoint(x,y,at=target,distance=camDistance){
   const eye=cameraAt(at,distance),back=norm(sub(eye,at)),right=norm(cross(viewMode==='plan'?[0,0,-1]:[0,1,0],back)),up=cross(back,right),half=distance*Math.tan(Math.PI/8),aspect=canvas.clientWidth/canvas.clientHeight;
   const sx=(x/canvas.clientWidth*2-1),sy=1-y/canvas.clientHeight*2;
   const origin=viewMode==='plan'?eye.map((v,i)=>v+right[i]*sx*half*aspect+up[i]*sy*half):eye;
   const ray=viewMode==='plan'?back.map(v=>-v):norm(back.map((v,i)=>-v+right[i]*sx*Math.tan(Math.PI/8)*aspect+up[i]*sy*Math.tan(Math.PI/8)));
   if(ray[1]>=-1e-6)return null;const t=-origin[1]/ray[1];return t>0?origin.map((v,i)=>v+ray[i]*t):null;
 }
 function movePan(delta){const base=baseTarget();panOffset[0]=clamp(base[0]+panOffset[0]+delta[0],-width*.65,width*.65)-base[0];panOffset[2]=clamp(base[2]+panOffset[2]+delta[2],-depth*2,depth*2)-base[2];target=base.map((v,i)=>v+panOffset[i]);cam=cameraAt(target,camDistance);}
 function panBetween(x1,y1,x2,y2){const a=groundPoint(x1,y1),b=groundPoint(x2,y2);if(a&&b)movePan(sub(a,b));}
 function zoomAt(value,x,y){value=clamp(value,0,100);const anchor=groundPoint(x,y),base=baseTarget(value),distance=distanceAt(value),at=base.map((v,i)=>v+panOffset[i]);const next=groundPoint(x,y,at,distance);emitZoom(value);if(anchor&&next)movePan(sub(anchor,next));camDistance=distance;target=baseTarget().map((v,i)=>v+panOffset[i]);cam=cameraAt(target,camDistance);}
 function multiply(a,b){const m=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)for(let k=0;k<4;k++)m[c*4+r]+=a[k*4+r]*b[c*4+k];return m;}
 function project(p){if(!matrix)return null;const [x,y,z]=p,m=matrix,w=m[3]*x+m[7]*y+m[11]*z+m[15];if(w<=0)return null;return[(m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5*canvas.clientWidth+canvas.clientWidth*.5,-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5*canvas.clientHeight+canvas.clientHeight*.5];}
 function annotation(){
   const w=canvas.clientWidth,h=canvas.clientHeight,compact=w<650||h<320;svg.setAttribute('viewBox',`0 0 ${w} ${h}`);let lines='';
   const label=(p,text,dx,dy,mint=false)=>{const a=project(p);if(!a||a[0]<5||a[0]>w-5||a[1]<(compact?55:105)||a[1]>h-(compact?40:55))return;const minY=compact?65:125,tx=clamp(a[0]+dx,12,w-155),ty=clamp(a[1]+dy*(compact?.55:1),minY,Math.max(minY,h-(compact?50:100)));lines+=`<path class="leader" d="M${a[0]},${a[1]} L${tx-5},${ty-4}"/><circle cx="${a[0]}" cy="${a[1]}" r="1.5"/><text x="${tx}" y="${ty}" class="${mint?'mint':''}">${text}</text>`;};
   if(zoom<48&&labels){
     label([-width*.43,0,depth*.3],'Hydrophobic substrate',-85,-55);
     const wetIndex=filled.findLastIndex(v=>v),dryIndex=filled.findIndex(v=>!v);
     if(wetIndex>=0){const p=center(Math.floor(wetIndex*.65),2);label([p[0],-diameters[Math.floor(wetIndex*.65)]*.2,p[2]],'Water-filled arrays',-60,65,true);}
     if(dryIndex>=0){const p=center(Math.min(11,dryIndex+1),2);label(p,'Air-filled arrays',25,55);}
     const p=center(11,0);label(p,`Dmax ${diameters[11]?.toFixed(2)} nm`,20,-43);
   }else if(zoom>=48){
     const p=center(selected,row),r=diameters[selected]/2;
     if(labels){
     label([p[0]+r,-r*.2,p[2]],'Hydrophilic pore wall',38,-55);
     const level=fillLevels[selected],visible=level>.002;
     const caption=visible?(filled[selected]?(level<.998?'Filling meniscus':'Concave water meniscus'):'Receding meniscus'):'Empty pore';
     label([p[0],-r-.3*r*(1-level),p[2]],caption,-130,68,visible);
     if(section)label([p[0]+r*.55,-.3*r-r*Math.sqrt(1-.55*.55),p[2]],'Matching hemispherical bottom',42,95);
     }
     const a=project([p[0]-r,.06,p[2]]),b=project([p[0]+r,.06,p[2]]);
     if(a&&b)lines+=`<path class="dim" d="M${a[0]},${a[1]-6} L${a[0]},${a[1]+6} M${a[0]},${a[1]} L${b[0]},${b[1]} M${b[0]},${b[1]-6} L${b[0]},${b[1]+6}"/><text x="${(a[0]+b[0])/2}" y="${(a[1]+b[1])/2-12}" text-anchor="middle" class="mint">D = ${diameters[selected].toFixed(2)} nm</text>`;
   }
   svg.innerHTML=lines;
 }
 function render(ms){
   requestAnimationFrame(render);if(!diameters.length||ms-last<32||document.hidden)return;
   const dt=Math.min(.1,(ms-last)/1000);last=ms;
   for(let i=0;i<filled.length;i++)[fillLevels[i],fillVelocities[i]]=window.PoreMotion.advance(fillLevels[i],fillVelocities[i],filled[i]?1:0,dt,!animateFilling);
   const cw=canvas.clientWidth,ch=canvas.clientHeight;if(!cw||!ch)return;
   const dpr=Math.min(devicePixelRatio||1,1.5),w=Math.round(cw*dpr),h=Math.round(ch*dpr);if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;gl.viewport(0,0,w,h);}
   const desiredDistance=distanceAt(zoom),pc=center(selected,row),desiredTarget=baseTarget().map((v,i)=>v+panOffset[i]);
   const smoothing=reduced?1:Math.min(1,dt*8);camDistance+=(desiredDistance-camDistance)*smoothing;target=target.map((v,i)=>v+(desiredTarget[i]-v)*smoothing);
   cam=cameraAt(target,camDistance);
   matrix=multiply(viewMode==='plan'?orthographic(cw/ch):perspective(cw/ch),lookAt(cam,target));
   const rippleCandidates=[];
   const visible=meshes.map((mesh,i)=>{
     if(zoom<48)return mesh.instances;
     const instances=[],diameterPixels=ch*diameters[i]/(2*camDistance*Math.tan(Math.PI/8)),margin=Math.max(20,diameterPixels);
     for(let j=0;j<layout.arrays[i].count;j++){
       const p=project(center(i,j));if(!p||p[0]<-margin||p[0]>cw+margin||p[1]<-margin||p[1]>ch+margin)continue;
       instances.push(...mesh.instances.subarray(j*3,j*3+3));
       if(ripplesEnabled&&filled[i]&&fillLevels[i]>.995&&p[0]>5&&p[0]<cw-5&&p[1]>90&&p[1]<ch-45&&diameterPixels>10)rippleCandidates.push(i*4096+j);
     }
     return new Float32Array(instances);
   });
   gl.uniform4fv(u['ripples[0]'],rippleMotion.update(dt,rippleCandidates,zoom>=48&&ripplesEnabled,selected*4096+row));
   gl.uniformMatrix4fv(u.vp,false,matrix);gl.uniform3fv(u.camera,new Float32Array(cam));gl.uniform1f(u.time,reduced?0:ms*.001);gl.uniform1f(u.selectedArray,selected);gl.uniform1f(u.selectedCell,selected*4096+row);gl.uniform1f(u.selectedZ,pc[2]);gl.uniform1f(u.cut,section?1:0);gl.uniform1f(u.pitch,pitch);gl.uniform1f(u.plateW,width);gl.uniform1f(u.plateD,depth);gl.uniform1f(u.thickness,thickness);gl.uniform1fv(u['filling[0]'],new Float32Array(fillLevels));gl.uniform1fv(u['poreDiameters[0]'],new Float32Array(diameters));
   gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);draw(bodyMesh,origin);meshes.forEach((mesh,i)=>{const diameterPixels=ch*diameters[i]/(2*camDistance*Math.tan(Math.PI/8)),detail=zoom>=48&&(i===selected||diameterPixels>14);draw(detail?mesh.high:mesh.low,visible[i]);});annotation();
 }
 function emitZoom(value){zoom=clamp(value,0,100);window.PoreDevice.onZoom?.(zoom);}
 canvas.addEventListener('pointerdown',e=>{if(!layout)return;e.preventDefault();drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,pan:viewMode==='plan'||e.button===1||e.button===2||e.shiftKey};clicked=e.button===0;canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5)clicked=false;if(!clicked){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(drag.pan){const rect=canvas.getBoundingClientRect();panBetween(drag.x-rect.left,drag.y-rect.top,e.clientX-rect.left,e.clientY-rect.top);}else{yaw-=dx*.005;elevation=clamp(elevation+dy*.004,.15,1.45);}}drag.x=e.clientX;drag.y=e.clientY;});
 canvas.addEventListener('pointerup',e=>{if(clicked&&drag){const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;let best=Infinity,hit=null;for(let i=0;i<12;i++)for(let j=0;j<layout.arrays[i].count;j++){const p=project(center(i,j));if(!p)continue;const d=Math.hypot(p[0]-x,p[1]-y);if(d<best){best=d;hit=[i,j];}}if(hit&&best<Math.max(12,canvas.clientHeight*diameters[hit[0]]/camDistance*.7)){selected=hit[0];row=hit[1];const base=baseTarget();panOffset=target.map((v,i)=>i===1?0:v-base[i]);window.PoreDevice.onSelect?.(selected);}}drag=null;});
 canvas.addEventListener('pointercancel',()=>drag=null);
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 canvas.addEventListener('dblclick',()=>{panOffset=[0,0,0];emitZoom(95);});
 canvas.addEventListener('wheel',e=>{e.preventDefault();if(!layout)return;const rect=canvas.getBoundingClientRect(),delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?canvas.clientHeight:1);zoomAt(zoom-clamp(delta,-160,160)*.045,e.clientX-rect.left,e.clientY-rect.top);},{passive:false});
 canvas.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','Home'].includes(e.key))return;e.preventDefault();if(viewMode==='plan'&&e.key.startsWith('Arrow')){const dx=e.key==='ArrowLeft'?-25:e.key==='ArrowRight'?25:0,dy=e.key==='ArrowUp'?-25:e.key==='ArrowDown'?25:0;panBetween(canvas.clientWidth/2,canvas.clientHeight/2,canvas.clientWidth/2+dx,canvas.clientHeight/2+dy);}else{if(e.key==='ArrowLeft')yaw+=.08;if(e.key==='ArrowRight')yaw-=.08;if(e.key==='ArrowUp')elevation=clamp(elevation+.06,.15,1.45);if(e.key==='ArrowDown')elevation=clamp(elevation-.06,.15,1.45);}if(e.key==='+'||e.key==='=')zoomAt(zoom+5,canvas.clientWidth/2,canvas.clientHeight/2);if(e.key==='-')zoomAt(zoom-5,canvas.clientWidth/2,canvas.clientHeight/2);if(e.key==='Home'){emitZoom(0);window.PoreDevice.frameDevice();}});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('renderError').hidden=false;});
 requestAnimationFrame(render);
})();
