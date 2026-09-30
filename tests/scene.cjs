// Dependency-free runtime checks. Canvas is instrumented, not visually rendered.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
let frames=0,pixels=0;
const context=new Proxy({
  createImageData(w,h){assert(w>0&&h>0);return {width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},
  putImageData(image){pixels++;assert(image.data.some(v=>v>0));},
  createRadialGradient(){return {addColorStop(){}};},
  drawImage(){frames++;},
}, {get(o,key){return key in o?o[key]:(...args)=>{for(const a of args)if(typeof a==='number')assert(Number.isFinite(a),`non-finite ${key}`);};}});
const nodes=new Map(),handlers={};
function element(id){if(!nodes.has(id)) nodes.set(id,{width:640,height:480,hidden:true,textContent:'',style:{},attributes:{},classList:{add(){},remove(){}},setAttribute(k,v){this.attributes[k]=v;},addEventListener(){},getContext(){return context;},getBoundingClientRect(){return {left:0,top:0};}});return nodes.get(id);}
const doc={hidden:false,createElement:()=>element('off'),getElementById:element,querySelector:element,addEventListener(k,f){handlers[k]=f;}};
const box={console,document:doc,window:{innerWidth:640,innerHeight:480,devicePixelRatio:1,addEventListener(){}},location:{search:''},performance:{now:()=>0},matchMedia:()=>({matches:false}),localStorage:{getItem:()=>null,setItem(){}},requestAnimationFrame(){},setTimeout(){},clearTimeout(){},Uint8ClampedArray};
vm.createContext(box);
const html=fs.readFileSync('src/index.html','utf8');
vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],box);
vm.runInContext(fs.readFileSync('src/sea-audio.js','utf8'),box);
vm.runInContext(fs.readFileSync('src/retreat.js','utf8'),box);
const run=code=>vm.runInContext(code,box);
for(const mode of ['live','12','18','23']){
  run(`settings.time='${mode}';`);
  for(const rain of [false,true])run(`settings.rain=${rain};elapsed+=.1;render();`);
}
assert.equal(frames,8);assert.equal(pixels,8);
run("interact({clientX:287*view.s+view.dx,clientY:275*view.s+view.dy});");
assert.equal(run('hearts.length'),1);
run("interact({clientX:198*view.s+view.dx,clientY:270*view.s+view.dy});");
assert.equal(run('watered'),run('elapsed'));
const candle=run('settings.candle');
run("interact({clientX:240*view.s+view.dx,clientY:282*view.s+view.dy});");
assert.equal(run('settings.candle'),!candle);
run("for(let i=0;i<100;i++){elapsed+=.2;ripple({x:220,y:235});}render();");
assert(run('ripples.length')<=24);
run('elapsed+=4;render();');assert.equal(run('ripples.length'),0);
for(const [w,h] of [[480,360],[1200,500],[400,700]]){box.window.innerWidth=w;box.window.innerHeight=h;run('blit();');assert(Math.abs(run('toScene(view.dx+240*view.s,view.dy+180*view.s).x')-240)<.01);}
const before=frames;doc.hidden=true;run('tick(1000)');assert.equal(frames,before);
doc.hidden=false;run('tick(1050)');assert(frames>before);
element('time').onclick();assert(['此刻','晴昼','日落','月夜'].includes(element('time').textContent));
element('breathe').onclick();assert.equal(element('breathing').hidden,false);
handlers.keydown({key:'Escape'});assert.equal(element('breathing').hidden,true);
console.log('PASS: day/night + rain rendering, pet/plant/candle, bounded ripple cleanup, resize mapping, hidden-window pause, controls.');
run(`for(let i=0;i<180;i++){
  mouse.active=true;mouse.x=110;mouse.y=200;mouse.lx=i%2?500:-500;mouse.ly=400;
  updateCloths(i/30,1/30);
}`);
assert(run('cloths.every(c=>c.nodes.every(n=>Math.abs(n.x-n.restX)<=2.00001 && Math.abs(n.y-n.restY)<=.60001))'));
run('settings.reduced=true;updateCloths(7,1/30);');
assert(run('cloths.every(c=>c.nodes.every(n=>Math.abs(n.x-n.restX)<=.70001))'));
element('music-track').onchange({target:{value:'moon'}});assert.equal(run('soundscape.track'),'moon');
element('volume-sea').oninput({target:{value:'25'}});assert.equal(run('soundscape.levels.sea'),.25);
element('weather').onclick();assert.equal(run('soundscape.rain'),run('settings.rain'));
assert.equal(run('soundscape.ctx'),undefined);
console.log('PASS: curtain movement bounds, reduced motion, music/volume/weather controls, no automatic audio initialization.');
