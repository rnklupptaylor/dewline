(()=>{
 'use strict';
 const $=id=>document.getElementById(id),K=window.Kelvin,design=K.design(90,2.5),f=(x,n=2)=>x.toFixed(n);
 const state={humidity:72.5,temperature:20,maxDiameter:design.largest,zoom:0,selected:5},ids=['humidity','temperature','maxDiameter','zoom'];
 let diameters=[],sweeping=false,frame=0,activePreset='',section=false,cameraMode='perspective';
 const fill=id=>{const e=$(id);e.style.setProperty('--fill',100*(+e.value-e.min)/(e.max-e.min)+'%');};
 function set(id,v){state[id]=v;$(id).value=v;fill(id);}
 function rebuild(){diameters=Array.from({length:12},(_,i)=>2.5*Math.pow(state.maxDiameter/2.5,i/11));$('mobileArray').innerHTML=diameters.map((d,i)=>`<option value="${i}">${i+1} · ${f(d)} nm</option>`).join('');}
 function presetState(id){activePreset=id;['A','B','C'].forEach(k=>$('preset'+k).classList.toggle('active',id===k));}
 function zoomDisplay(){const z=state.zoom;$('zoomOut').textContent=z<1?'Device':f(z,0)+'% focus';$('homeView').classList.toggle('active',z<1);$('focusPore').classList.toggle('active',z>=90);window.PoreDevice?.setZoom(z);}
 function chart(){
   const W=$('responseChart').clientWidth||600,H=$('responseChart').clientHeight||180;
   $('responseChart').setAttribute('viewBox',`0 0 ${W} ${H}`);
   const L=29,R=W-10,T=14,B=H-28,xmax=Math.max(25,Math.ceil(state.maxDiameter/5)*5),x=d=>L+d/xmax*(R-L),y=h=>B-h/100*(B-T);
   const curve=t=>Array.from({length:160},(_,i)=>{const d=.5+(xmax-.5)*i/159;return`${i?'L':'M'}${f(x(d))},${f(y(K.threshold(t,d)))}`;}).join(' ');
   let s=`<defs><clipPath id="clip"><rect x="${L}" y="${T}" width="${R-L}" height="${B-T}"/></clipPath></defs>`;
   [0,50,100].forEach(h=>s+=`<path d="M${L} ${y(h)} H${R}" stroke="#263844" stroke-dasharray="2 5"/><text x="21" y="${y(h)+3}" text-anchor="end">${h}</text>`);
   [0,1,2,3,4,5].forEach(i=>s+=`<text x="${x(xmax*i/5)}" y="${H-14}" text-anchor="middle">${f(xmax*i/5,0)}</text>`);
   s+=`<text x="${L}" y="8" style="font-size:8px">RH (%)</text><text x="${R}" y="${H-1}" text-anchor="end" style="font-size:8px">Pore diameter (nm)</text><g clip-path="url(#clip)">`;
   for(const [t,c,dash] of [[-10,'#8297b6','4 4'],[40,'#b095d4','4 4'],[state.temperature,'#72e2d0','']])s+=`<path d="${curve(t)}" stroke="${c}" stroke-width="${dash?1.2:2}" stroke-dasharray="${dash}" fill="none"/>`;
   const h=state.humidity,d=diameters[state.selected],px=x(d),py=y(K.threshold(state.temperature,d));
   s+=`<path d="M${L} ${y(h)} H${R}" stroke="#c9bd9b" stroke-dasharray="4 4" stroke-opacity=".65"/><path d="M${px} ${T} V${B}" stroke="#72e2d0" stroke-opacity=".2"/><circle cx="${px}" cy="${py}" r="6" fill="#72e2d0" fill-opacity=".1"/><circle data-marker="threshold" cx="${px}" cy="${py}" r="3" fill="#a5f3e0"/><circle data-marker="ambient" cx="${px}" cy="${y(h)}" r="4" fill="#0e171f" stroke="#e6d2a3" stroke-width="1.5"/></g>`;
   const hy=Math.max(27,y(h)-5);s+=`<rect x="${R-81}" y="${hy-10}" width="81" height="13" fill="#0e171f"/><text x="${R-2}" y="${hy}" text-anchor="end" style="fill:#b5b09b;font-size:8px">Ambient ${f(h,1)}%</text>`;
   $('responseChart').innerHTML=s;
 }
 function update(){
   const {humidity:h,temperature:t,selected}=state,d=diameters[selected],rh=K.threshold(t,d),wet=h+1e-8>=rh,thresholds=diameters.map(v=>K.threshold(t,v)),filled=thresholds.map(v=>h+1e-8>=v),count=filled.filter(Boolean).length;
   $('humidityOut').innerHTML=`${f(h,1)} <small>%</small>`;$('temperatureOut').innerHTML=`${f(t,1)} <small>°C</small>`;$('maxDiameterOut').innerHTML=`${f(state.maxDiameter)} <small>nm</small>`;
   $('arrayInfo').textContent=String(selected+1).padStart(2,'0')+' / 12';$('diameterOut').innerHTML=`${f(d)} <small>nm</small>`;
   $('mobileArray').value=selected;$('mobileArray').setAttribute('aria-label',`Pore selector, array ${selected+1} of 12`);
   $('chartThreshold').textContent=`Selected pore: ${f(rh,2)}% RH · ${wet?'filled':'empty'}`;
   $('thresholdValue').innerHTML=`${f(rh,2)} <small>% RH</small>`;$('radiusValue').textContent=f(d/2)+' nm';$('criticalD').textContent=f(K.criticalDiameter(t,h))+' nm';
   $('phaseBadge').textContent=wet?'FILLED':'EMPTY';$('phaseBadge').classList.toggle('empty',!wet);
   $('phaseDescription').textContent=Math.abs(h-rh)<.005?'At the Kelvin equilibrium threshold.':wet?'Liquid water is favored.':'Below threshold. This pore stays empty.';
   $('filledCount').textContent=`${count} / 12 arrays filled`;
   $('bracketReadout').textContent=count===0?`RH < ${f(thresholds[0],1)}%`:count===12?`RH ≥ ${f(thresholds[11],1)}%`:`${f(thresholds[count-1],1)}–${f(thresholds[count],1)}%`;
   [...$('arrayButtons').children].forEach((b,i)=>{b.classList.toggle('wet',filled[i]);b.setAttribute('aria-pressed',String(i===selected));b.title=`Array ${i+1} · ${f(diameters[i])} nm · fills at ${f(thresholds[i])}% RH · ${filled[i]?'water':'air'}`;b.setAttribute('aria-label',`Inspect array ${i+1}, ${f(diameters[i])} nanometres`);});
   const schematic=window.PoreLayout.create(diameters);$('deviceDimensions').textContent=`Equal-area sections · 9–${schematic.arrays[0].count} pores shown per section`;
   window.PoreDevice?.update({diameters,filled,selected});zoomDisplay();chart();
 }
 function stop(){sweeping=false;cancelAnimationFrame(frame);$('sweep').innerHTML='▷ Sweep humidity <span>→</span>';}
 function setSection(v){section=v;$('section').setAttribute('aria-pressed',String(v));window.PoreDevice?.setSection(v);}
 function whole(){set('zoom',0);setSection(false);if(window.PoreDevice?.frameDevice)window.PoreDevice.frameDevice();else window.PoreDevice?.reset();zoomDisplay();}
 function cameraDisplay(mode){cameraMode=mode;$('planView').setAttribute('aria-pressed',String(mode==='plan'));$('perspectiveView').setAttribute('aria-pressed',String(mode==='perspective'));$('navigationHint').textContent=mode==='plan'?'Drag to pan · wheel to zoom at pointer':'Drag to rotate · right / Shift-drag to pan · wheel to zoom';}
 for(let i=0;i<12;i++){const b=document.createElement('button');b.className='array-button';b.textContent=i+1;b.addEventListener('click',()=>{state.selected=i;update();});$('arrayButtons').append(b);}
 ids.forEach(id=>{fill(id);$(id).addEventListener('input',()=>{state[id]=+$(id).value;fill(id);if(id==='zoom'){zoomDisplay();return;}stop();presetState('');$('presetNote').textContent='Select a preset to see its solution in the device.';if(id==='maxDiameter')rebuild();update();});});
 $('homeView').addEventListener('click',whole);
 $('focusPore').addEventListener('click',()=>{window.PoreDevice?.focus?.();set('zoom',95);setSection(cameraMode!=='plan');zoomDisplay();});
 $('planView').addEventListener('click',()=>{setSection(false);window.PoreDevice?.setView?.('plan');cameraDisplay('plan');});
 $('perspectiveView').addEventListener('click',()=>{window.PoreDevice?.setView?.('perspective');cameraDisplay('perspective');});
 $('section').addEventListener('click',()=>setSection(!section));
 $('labels').addEventListener('click',()=>{const on=$('labels').getAttribute('aria-pressed')!=='true';$('labels').setAttribute('aria-pressed',String(on));$('labels').textContent=on?'All labels':'Diameter only';$('labels').title=on?'Switch to only the zoomed pore diameter':'Show all device and pore labels';window.PoreDevice?.setLabels(on);});
 if(window.PoreDevice){window.PoreDevice.onSelect=i=>{state.selected=i;update();};window.PoreDevice.onZoom=z=>{set('zoom',z);zoomDisplay();};window.PoreDevice.onViewChange=cameraDisplay;}
 $('reset').addEventListener('click',()=>{stop();set('humidity',72.5);set('temperature',20);set('maxDiameter',design.largest);state.selected=5;presetState('');$('presetNote').textContent='Select a preset to see its solution in the device.';rebuild();window.PoreDevice?.reset();cameraDisplay('perspective');whole();update();});
 function loadPreset(k,t,h,index){stop();set('temperature',t);set('humidity',h);set('maxDiameter',design.largest);state.selected=index;rebuild();whole();presetState(k);update();}
 $('presetA').addEventListener('click',()=>{loadPreset('A',20,70,0);$('presetNote').textContent='Concave curvature lowers vapor pressure; smaller pores fill at lower RH.';});
 $('presetB').addEventListener('click',()=>{loadPreset('B',40,90,11);$('presetNote').textContent='Filled by 90% throughout the range; at −10 °C, this pore fills at 86.90%.';});
 $('presetC').addEventListener('click',()=>{loadPreset('C',40,design.minimum,0);$('presetNote').textContent='The 2.50 nm pore sets the lower limit: 46.38% RH at 40 °C.';});
 $('sweep').addEventListener('click',()=>{if(sweeping){stop();return;}sweeping=true;presetState('');$('sweep').innerHTML='Ⅱ Pause sweep <span>→</span>';const start=performance.now();function step(ms){if(!sweeping)return;const p=Math.min(1,(ms-start)/14000);set('humidity',1+98*p);update();if(p<1)frame=requestAnimationFrame(step);else stop();}frame=requestAnimationFrame(step);});
 function toggleModel(v){$('modelNote').hidden=!v;$('modelToggle').setAttribute('aria-expanded',String(v));}
 $('modelToggle').addEventListener('click',()=>toggleModel($('modelNote').hidden));$('closeModel').addEventListener('click',()=>toggleModel(false));
 $('animateFilling').addEventListener('change',()=>window.PoreDevice?.setAnimation($('animateFilling').checked));
 $('animateRipples').addEventListener('change',()=>window.PoreDevice?.setRipples($('animateRipples').checked));
 $('mobileArray').addEventListener('change',()=>{state.selected=+$('mobileArray').value;update();});
 const mobileViews=['Controls','Response','Presets'];
 function mobileView(name){$('workspace').dataset.mobileView=name.toLowerCase();mobileViews.forEach(v=>{const b=$('mobile'+v);b.setAttribute('aria-selected',String(v===name));b.tabIndex=v===name?0:-1;});}
 mobileViews.forEach((name,index)=>{const b=$('mobile'+name);b.addEventListener('click',()=>mobileView(name));b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(index+(e.key==='ArrowRight'?1:2))%3;mobileView(mobileViews[next]);$('mobile'+mobileViews[next]).focus();}});});
 ['equation','assumptions'].forEach(name=>$('model'+name).addEventListener('click',()=>{$('modelNote').dataset.page=name;['equation','assumptions'].forEach(v=>$('model'+v).setAttribute('aria-pressed',String(v===name)));}));
 document.addEventListener('keydown',e=>{if(e.key==='Escape')toggleModel(false);});
 $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{$('fullscreen').title='Full screen is unavailable in this browser; expand the app panel instead.';}});
 document.addEventListener('fullscreenchange',()=>{$('fullscreen').textContent=document.fullscreenElement?'⛶ Exit full screen':'⛶ Full screen';$('fullscreen').setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Enter full screen');});
 $('download').addEventListener('click',()=>{const rows=['diameter_nm,threshold_RH_percent_at_minus10C,threshold_RH_percent_at_currentT,threshold_RH_percent_at_40C,current_temperature_C,ambient_RH_percent'];for(let d=2.5;d<=35;d+=.1)rows.push([f(d,2),K.threshold(-10,d),K.threshold(state.temperature,d),K.threshold(40,d),state.temperature,state.humidity].join(','));const url=URL.createObjectURL(new Blob([rows.join('\r\n')],{type:'text/csv'})),a=document.createElement('a');a.href=url;a.download='meniscus-kelvin-response.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 cameraDisplay('perspective');rebuild();update();
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(chart).observe($('responseChart'));
})();
