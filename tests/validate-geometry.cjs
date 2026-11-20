const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let meshes=[],draws=[],vp,camera;
const gl=new Proxy({createShader:()=>({}),createProgram:()=>({}),createBuffer:()=>({}),getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>0,getUniformLocation:(_,name)=>name,uniformMatrix4fv:(_,transpose,value)=>vp=Array.from(value),uniform3fv:(_,value)=>camera=Array.from(value),bufferData:(_,data)=>meshes.push(data),getExtension:()=>({vertexAttribDivisorANGLE(){},drawArraysInstancedANGLE(mode,first,vertices,count){draws.push({vertices,count});}})},{get:(obj,key)=>key in obj?obj[key]:(()=>{})});
let nextFrame;
const handlers={},canvas={getContext:()=>gl,addEventListener(name,fn){handlers[name]=fn;},setPointerCapture(){},getBoundingClientRect:()=>({left:0,top:0}),clientWidth:900,clientHeight:500};
const nodes={},node=id=>nodes[id]??={style:{},setAttribute(){},innerHTML:''};
const ctx=vm.createContext({window:{},document:{getElementById:id=>id==='deviceCanvas'?canvas:node(id),hidden:false},matchMedia:()=>({matches:true}),requestAnimationFrame(fn){nextFrame=fn;},devicePixelRatio:1,console});
vm.runInContext(fs.readFileSync('./src/motion.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('./src/layout.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('./src/ripples.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('./src/scene.js','utf8'),ctx);
const Dmax=18.229143211972225,diameters=Array.from({length:12},(_,i)=>2.5*Math.pow(Dmax/2.5,i/11)),pitch=Dmax*1.6;
ctx.window.PoreDevice.update({diameters,filled:diameters.map(()=>false),selected:5});
assert.equal(meshes.length,25,'Two reusable meshes per size plus the substrate');
function checkSurface(meshList){
 for(let m=0;m<24;m++){
   const mesh=meshList[m],col=Math.floor(m/2),a=ctx.window.PoreLayout.create(diameters).arrays[col];let area=0,topVertices=0;
   for(let v=0;v<mesh.length;v+=24)if(mesh[v+6]===0){const ax=mesh[v],az=mesh[v+2],bx=mesh[v+8],bz=mesh[v+10],cx=mesh[v+16],cz=mesh[v+18];area+=Math.abs((bx-ax)*(cz-az)-(bz-az)*(cx-ax))/2;topVertices+=3;}
   const N=topVertices/6,expected=a.spacing*a.spacing-N*(a.diameter/2)**2*Math.sin(2*Math.PI/N)/2;
   assert.ok(Math.abs(area-expected)<1e-5*a.spacing*a.spacing,'Solid surface must fill the square tile right up to every corner, with only the intended circular pore removed');
 }
}
checkSurface(meshes);
const layout=ctx.window.PoreLayout.create(diameters);
assert.equal(layout.width,12*layout.side);assert.equal(layout.depth,layout.side);assert.ok(layout.arrays.every(a=>a.z===0),'The original linear sequence of sections must be preserved');
assert.equal(layout.arrays[11].count,9);
assert.equal(layout.arrays[0].count,484);
for(let i=0;i<12;i++){
 const a=layout.arrays[i];assert.ok(Math.abs(a.n*a.spacing-layout.side)<1e-10,'Every grid must fill the same square area');
 assert.ok(a.spacing>a.diameter,'Pores must have separating substrate');
 if(i)assert.ok(a.count<=layout.arrays[i-1].count,'Smaller diameters require at least as many pores');
 for(let j=0;j<a.count;j++){const p=layout.center(i,j);assert.ok(Math.abs(p[0]-a.x)+a.diameter/2<layout.side/2);assert.ok(Math.abs(p[2]-a.z)+a.diameter/2<layout.side/2);}
}
let bowlVertices=0,joinedNormals=0,capVertices=0;
for(const mesh of meshes)for(let i=0;i<mesh.length;i+=8){
 const [x,y,z,nx,ny,nz,kind,cell]=mesh.subarray(i,i+8);
 if(kind!==2&&kind!==4&&kind!==7)continue;
 const col=Math.floor(cell/4096),d=diameters[col],r=d/2,rho2=x*x+z*z;
 assert.ok([x,y,z,nx,ny,nz].every(Number.isFinite));
 if(kind===2){
   bowlVertices++;
   assert.ok(Math.abs((y+.15*d)**2+rho2-r*r)<2e-5*Math.max(1,r*r),'Bottom must lie on the matching hemisphere');
   assert.ok(Math.abs(nx*nx+ny*ny+nz*nz-1)<1e-6,'Bowl normals must remain unit length');
   if(Math.abs(ny)<1e-5){joinedNormals++;assert.ok(Math.abs(y+.15*d)<1e-5);assert.ok(Math.abs(nx+x/r)<1e-4);assert.ok(Math.abs(nz+z/r)<1e-4);}
 }else if(kind===4){assert.ok(Math.abs(y*y+rho2-r*r)<2e-5*Math.max(1,r*r),'Meniscus radius must equal bowl radius');}
 else{
   capVertices++;
   // The section volume is bounded by two translated copies of the curved profile.
   // Use the implicit circle equation; sqrt is ill-conditioned at a rounded float32 rim.
   assert.ok(Math.min(Math.abs(y*y+rho2-r*r),Math.abs((y+.15*d)**2+rho2-r*r))<2e-5*Math.max(1,r*r));
 }
}
assert.ok(bowlVertices>70000&&joinedNormals>1000&&capVertices>1000);
console.log('Passed: equal-area grids, nine largest pores, increasing small-pore density, and matching hemispherical geometry in all reusable meshes.');
nextFrame(100);
assert.equal(draws.length,13);assert.equal(draws.at(-1).count,9);assert.equal(draws[1].count,484);
assert.equal(node('annotations').innerHTML,'','The opening perspective uses the quiet diameter-only label mode');
ctx.window.PoreDevice.setLabels(true);
assert.ok(node('annotations').innerHTML.includes('Hydrophobic substrate'));
ctx.window.PoreDevice.setLabels(false);
assert.equal(node('annotations').innerHTML,'','Overview annotations must disappear immediately');
ctx.window.PoreDevice.setZoom(95);ctx.window.PoreDevice.setSection(true);nextFrame(200);
assert.equal((node('annotations').innerHTML.match(/<text/g)||[]).length,1,'Diameter-only mode must leave exactly one label');
assert.ok(node('annotations').innerHTML.includes('D = 6.17 nm'));
assert.ok(!node('annotations').innerHTML.includes('leader'));
ctx.window.PoreDevice.setLabels(true);
assert.ok(node('annotations').innerHTML.includes('Hydrophilic pore wall'),'All labels must return immediately');
assert.ok(node('annotations').innerHTML.includes('Matching hemispherical bottom'));
ctx.window.PoreDevice.setLabels(false);
ctx.window.PoreDevice.update({diameters,filled:diameters.map(()=>false),selected:0});nextFrame(300);
assert.ok(node('annotations').innerHTML.includes('D = 2.50 nm'),'Diameter label must track pore selection');
ctx.window.PoreDevice.setZoom(0);nextFrame(400);
assert.equal(node('annotations').innerHTML,'','Diameter-only mode must stay clear in overview');
assert.ok(!fs.readFileSync('./src/index.html','utf8').includes('id="scaleBar"'));
for(const max of [3,35]){const d=Array.from({length:12},(_,i)=>2.5*Math.pow(max/2.5,i/11));const l=ctx.window.PoreLayout.create(d);assert.equal(l.arrays[11].count,9);assert.ok(l.arrays[0].count<4096);ctx.window.PoreDevice.update({diameters:d,filled:d.map(()=>true),selected:11});nextFrame(500+max*100);assert.ok(draws.at(-1).count===9);}
console.log('Passed: instanced rendering counts, diameter-range extremes, immediate label modes, selected-pore dimensions, and scale-bar removal.');
ctx.window.PoreDevice.setView('plan');nextFrame(10000);
assert.ok(vp.every(Number.isFinite));assert.equal(vp[15],1);assert.equal(vp[3],0);assert.equal(vp[7],0);assert.equal(vp[11],0);
assert.ok(Math.abs(Math.abs(vp[0]*900)-Math.abs(vp[9]*500))<1e-5,'Plan view must preserve circular pore proportions');
const event=(extra={})=>({clientX:450,clientY:250,button:0,pointerId:1,preventDefault(){},...extra});
const beforePan=vp.slice();handlers.pointerdown(event());handlers.pointermove(event({clientX:500}));handlers.pointerup(event({clientX:500}));nextFrame(10100);
assert.equal(vp[0],beforePan[0]);assert.equal(vp[9],beforePan[9]);assert.ok(vp[12]>beforePan[12],'Plan dragging must move the device with the pointer');
const sx=550,sy=250,world=[((sx/900*2-1)-vp[12])/vp[0],0,((1-sy/500*2)-vp[13])/vp[9]];
handlers.wheel(event({clientX:sx,clientY:sy,deltaY:-100,deltaMode:0}));nextFrame(10200);
const projected=[(vp[0]*world[0]+vp[12]+1)*450,(1-vp[9]*world[2]-vp[13])*250];
assert.ok(Math.abs(projected[0]-sx)<.01&&Math.abs(projected[1]-sy)<.01,'Wheel zoom must preserve the surface point under the cursor');
ctx.window.PoreDevice.setView('perspective');nextFrame(10300);const beforeOrbit=camera.slice();
handlers.pointerdown(event());handlers.pointermove(event({clientX:500}));handlers.pointerup(event({clientX:500}));nextFrame(10400);
assert.notDeepEqual(camera,beforeOrbit);assert.ok(vp.every(Number.isFinite));assert.notEqual(vp[15],1);
const beforeRightPan=vp.slice();handlers.pointerdown(event({button:2}));handlers.pointermove(event({button:2,clientX:480}));handlers.pointerup(event({button:2,clientX:480}));nextFrame(10500);
assert.ok(Math.abs(vp[0]-beforeRightPan[0])<1e-6&&Math.abs(vp[1]-beforeRightPan[1])<1e-6,'Right dragging pans without changing orientation');
console.log('Passed: sealed surface tiles at both detail levels; orthographic plan proportions; plan drag, perspective orbit, right-drag pan, and cursor-anchored wheel zoom.');
