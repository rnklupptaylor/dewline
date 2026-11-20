const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
require('../src/physics.js');const K=globalThis.Kelvin,D=K.design(90,2.5);
require('../src/layout.js');
assert.ok(Math.abs(D.largest-18.229143211972225)<1e-10);
assert.ok(Math.abs(D.minimum-46.38227650848877)<1e-10);
assert.ok(Math.abs(K.threshold(-10,D.largest)-86.90271819270554)<1e-10);
for(let t=-10;t<=40;t+=.25){
 assert.ok(K.threshold(t,D.largest)<=90+1e-10,'Largest pore must be filled BY 90% RH at every T');
 assert.ok(K.threshold(t,D.largest+.01)>90||t<40,'Any larger diameter fails the warm endpoint');
 assert.ok(K.threshold(t,2.5)<=D.minimum+1e-10,'Guaranteed lower RH limit');
 for(const h of [10,46.38,70,90,99])assert.ok(Math.abs(K.threshold(t,K.criticalDiameter(t,h))-h)<1e-10);
}
class Element{
 constructor(id){this.id=id;this.style={setProperty(){}};this.classList={toggle(){}};this.attributes={};this.children=[];this.handlers={};this.value='';this.min='';this.max='';this.hidden=true;this.dataset={};}
 setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k];}
 addEventListener(k,v){this.handlers[k]=v;}append(v){this.children.push(v);}click(){this.handlers.click?.();}
}
const elements={},el=id=>elements[id]??=new Element(id);
for(const [id,min,max,value] of [['humidity',1,99,72.5],['temperature',-10,40,20],['maxDiameter',3,35,D.largest],['zoom',0,100,0],['mobileArray',0,11,5]])Object.assign(el(id),{min,max,value});
let model,zoom,section,animate;
const ctx=vm.createContext({document:{getElementById:el,createElement:()=>new Element(),addEventListener(){},documentElement:{}},window:{Kelvin:K,PoreLayout:globalThis.PoreLayout,PoreDevice:{update(v){model=v;},setZoom(v){zoom=v;},setSection(v){section=v;},setAnimation(v){animate=v;},setLabels(){},reset(){}}},cancelAnimationFrame(){},requestAnimationFrame(){return 1;},performance:{now:()=>0},setTimeout(){},console});
vm.runInContext(fs.readFileSync('./src/app.js','utf8'),ctx);
assert.equal(model.diameters.length,12);assert.equal(el('arrayButtons').children.length,12);assert.equal(model.filled.length,12);
assert.equal(model.filled.filter(Boolean).length,6,'Opening scene must show exactly half of the twelve arrays filled');
function input(id,value){el(id).value=value;el(id).handlers.input();}
input('humidity',1);assert.equal(model.filled.filter(Boolean).length,0);
input('humidity',99);assert.equal(model.filled.filter(Boolean).length,12);
el('presetB').click();assert.equal(model.selected,11);assert.equal(model.filled.filter(Boolean).length,12);assert.equal(+el('temperature').value,40);assert.ok(el('thresholdValue').innerHTML.includes('90.00'));assert.equal(zoom,0);assert.equal(section,false);
input('temperature',-10);assert.ok(el('thresholdValue').innerHTML.includes('86.90'));assert.equal(model.filled.filter(Boolean).length,12);
el('presetC').click();assert.equal(model.selected,0);assert.equal(model.filled.filter(Boolean).length,1);assert.ok(el('thresholdValue').innerHTML.includes('46.38'));
el('presetA').click();assert.ok(model.filled[0]);assert.ok(!model.filled[11]);
el('focusPore').click();assert.equal(zoom,95);assert.equal(section,true);el('homeView').click();assert.equal(zoom,0);assert.equal(section,false);
input('maxDiameter',30);assert.equal(model.diameters[11],30);assert.ok(el('deviceDimensions').textContent.includes('Equal-area sections'));
el('reset').click();assert.equal(+el('humidity').value,72.5);assert.equal(+el('temperature').value,20);assert.equal(model.filled.filter(Boolean).length,6);assert.ok(Math.abs(model.diameters[11]-D.largest)<1e-10);
const html=fs.readFileSync('./src/index.html','utf8');assert.equal((html.match(/<canvas/g)||[]).length,1);assert.ok(!html.includes('exercise-section'));
require('../src/motion.js');const motion=globalThis.PoreMotion;
const atOneSecond=[];
for(const fps of [15,30,60,144]){
 let level=0,velocity=0,previous=0;
 for(let i=0;i<fps;i++){[level,velocity]=motion.advance(level,velocity,1,1/fps);assert.ok(level>=previous&&level<=1);previous=level;}
 assert.ok(level>.98&&level<1);atOneSecond.push(level);
 for(let i=0;i<fps*2;i++){[level,velocity]=motion.advance(level,velocity,0,1/fps);assert.ok(level>=0&&level<=1);}
 assert.equal(level,0);assert.equal(velocity,0);
}
assert.ok(Math.max(...atOneSecond)-Math.min(...atOneSecond)<1e-10,'Animation timing must be independent of frame rate');
let [moving,speed]=motion.advance(0,0,1,.25);const before=moving;
[moving,speed]=motion.advance(moving,speed,0,1/120);assert.ok(Math.abs(moving-before)<.03,'Reversing direction must preserve continuity');
assert.deepEqual(motion.advance(.4,1,0,.016,true),[0,0]);assert.deepEqual(motion.advance(.4,-1,1,.016,true),[1,0]);
assert.ok(html.indexOf('motion.js')<html.indexOf('scene.js'));
el('mobileResponse').click();assert.equal(el('workspace').dataset.mobileView,'response');assert.equal(el('mobileResponse').getAttribute('aria-selected'),'true');
el('mobilePresets').click();assert.equal(el('workspace').dataset.mobileView,'presets');
el('mobileControls').click();assert.equal(el('workspace').dataset.mobileView,'controls');
el('mobileArray').value=11;el('mobileArray').handlers.change();assert.equal(model.selected,11);assert.ok(el('mobileArray').getAttribute('aria-label').includes('array 12 of 12'));
el('arrayButtons').children[0].click();assert.equal(+el('mobileArray').value,0);
el('modelassumptions').click();assert.equal(el('modelNote').dataset.page,'assumptions');el('modelequation').click();assert.equal(el('modelNote').dataset.page,'equation');
el('animateFilling').checked=false;el('animateFilling').handlers.change();assert.equal(animate,false);
el('animateFilling').checked=true;el('animateFilling').handlers.change();assert.equal(animate,true);
console.log('Passed: corrected filled-by-90% envelope; inverse Kelvin relation; sensor wet/dry states; presets A/B/C; focus/overview; diameter scaling; reset; single device canvas.');
console.log('Passed: smooth fill and drain; continuous reversals; 15–144 FPS timing consistency; settled endpoints; animation on/off control.');
console.log('Passed: mobile tab navigation, mobile pore selection synchronized with the device, and compact model-information pages.');
