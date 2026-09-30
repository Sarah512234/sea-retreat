"use strict";
// Everything is local: no remote images, fonts, audio or analytics.
const settings = { time: 'live', rain: false, candle: true, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, music: 'off', levels: { master: .5, sea: .45, rain: .45, music: .5 } };
try { const saved = JSON.parse(localStorage.getItem('sea-retreat') || '{}');
  if(['live','12','18','23'].includes(saved.time)) settings.time = saved.time;
  for(const key of ['rain','candle','reduced']) if(typeof saved[key] === 'boolean') settings[key] = saved[key];
  if(saved.music==='off'||Object.hasOwn(SeaAudio.tracks,saved.music))settings.music=saved.music;
  for(const key of Object.keys(settings.levels))if(Number.isFinite(saved.levels?.[key]))settings.levels[key]=clamp(saved.levels[key],0,1);
} catch {}
function saveSettings(){ try { localStorage.setItem('sea-retreat',JSON.stringify(settings)); } catch {} }
let elapsed = 0, previousFrame = performance.now(), lastPaint = 0, breathing = false;
const ripples = [], hearts = [];
let watered = -100, chimed = -100, lastRipple = -100, toastTimer;
function sceneTime(){ return elapsed; }
function say(message){ const el=document.getElementById('toast'); el.textContent=message;el.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('visible'),3200); }
function hash(n){ return ((Math.sin(n * 127.1 + 311.7) * 43758.5453) % 1 + 1) % 1; }

// Perspective compresses distant waves and stretches the foreground into long swells.
let seaBuffer;
drawSea = function(L,t,animT,horizon){
  const top=Math.max(GY0,Math.round(horizon)), height=GY1-top;
  if(height<=0) return;
  if(!seaBuffer || seaBuffer.height!==height) seaBuffer=ctx.createImageData(GLASS_W,height);
  const data=seaBuffer.data, sunX=lastCelestial ? lastCelestial.x : 250;
  const reflection=lastCelestial ? lastCelestial.color : [170,201,219];
  const light=mixC([69,115,139],[206,243,228],L.d);
  for(let y=0;y<height;y++){
    const z=y/height, distance=Math.log(1+z*13)*19;
    const base=mixC(L.seaHor,mixC(L.seaDeep,[25,130,136],L.d*.52),Math.pow(z,.65));
    for(let x=0;x<GLASS_W;x++){
      const xx=x/(.35+z*1.8);
      const swell=Math.sin(distance*1.6-animT*.9+Math.sin(xx*.026+animT*.17)*1.7);
      const detail=Math.sin(xx*.29+distance*2.8+animT*.47)*Math.sin(xx*.091-distance*.9-animT*.35);
      const crest=Math.max(0,swell*.72+detail*.28-.48);
      const shade=(swell*.5+detail*.5)*12;
      const path=sunX+Math.sin(distance*.6+animT*.3)*(3+z*12);
      const beam=Math.max(0,1-Math.abs(GX0+x-path)/(3+z*37));
      const glint=beam*beam*Math.max(0,Math.sin(distance*3.7+detail*2-animT*1.1))*.7;
      const foam=crest*(.5+L.d*.4), i=(y*GLASS_W+x)*4;
      for(let c=0;c<3;c++) data[i+c]=lerp(lerp(base[c]+shade,light[c],foam),reflection[c],glint);
      data[i+3]=255;
    }
  }
  ctx.putImageData(seaBuffer,GX0,top);
  ctx.fillStyle=css(L.skyHor,.35);ctx.fillRect(GX0,top,GLASS_W,1);
  // Broken horizontal foam lines travel toward the viewer at different depths.
  for(let j=0;j<11;j++){
    const z=((j/11+animT*.017)%1), y=top+Math.pow(z,1.8)*height;
    for(let k=0;k<7;k++){
      const x=GX0+hash(j*13+k)*GLASS_W+Math.sin(animT*.35+j)*4;
      ctx.fillStyle=css(light,Math.sin(z*Math.PI)*(.08+.16*hash(k+j)));
      ctx.fillRect(x|0,y|0,2+z*17,1);
    }
  }
  for(let i=ripples.length-1;i>=0;i--){
    const p=ripples[i], age=animT-p.t;
    if(age>3.6){ ripples.splice(i,1);continue; }
    ctx.strokeStyle=css(light,(1-age/3.6)*.65);ctx.lineWidth=1;
    for(let ring=0;ring<2;ring++){
      const r=age*15-ring*5;if(r<=0)continue;
      ctx.beginPath();ctx.ellipse(p.x,p.y,r,r*.23,0,0,Math.PI*2);ctx.stroke();
    }
  }
};

function drawOutside(L,t,horizon){
  // Distant island silhouettes sit in the haze, without obscuring the water.
  ptri([GX1-76,horizon],[GX1-46,horizon-8],[GX1-17,horizon],css(mixC(L.seaHor,L.skyHor,.5),.65));
  ptri([GX1-42,horizon],[GX1-18,horizon-12],[GX1+8,horizon],css(L.seaHor,.55));
  if(L.d>.2 && !settings.rain){
    for(let i=0;i<3;i++){
      const x=GX0+((t*3+i*25)%(GLASS_W+30))-15,y=horizon-25-i*7+Math.sin(t*.55+i)*3;
      const wing=Math.sin(t*2.3+i)*2;
      pline(x-3,y+wing,x,y,css([68,98,111],.65));pline(x,y,x+3,y+wing,css([68,98,111],.65));
    }
  }
  if(settings.rain){
    ctx.fillStyle='rgba(62,87,107,.18)';ctx.fillRect(GX0,GY0,GLASS_W,GLASS_H);
    for(let i=0;i<72;i++){
      const x=GX0+((hash(i)*GLASS_W+t*9)%GLASS_W),y=GY0+((hash(i+100)*GLASS_H+t*(39+hash(i)*35))%GLASS_H);
      pline(x,y,x-2,y+5,'rgba(211,232,234,.28)');
    }
    for(let i=0;i<12;i++){
      const cycle=(t*.6+hash(i*2))%1,x=GX0+hash(i+500)*GLASS_W,y=horizon+hash(i+90)*(GY1-horizon);
      ctx.strokeStyle=`rgba(207,235,227,${(1-cycle)*.22})`;ctx.beginPath();ctx.ellipse(x,y,cycle*7+1,cycle*2+.5,0,0,Math.PI*2);ctx.stroke();
    }
  }
}

function drawDetails(L,t){
  // A brass wind chime, paper wish tag, little book and a steaming cup.
  const swing=Math.sin(t*.85)*1.5 + Math.sin((t-chimed)*8)*Math.exp(-Math.max(0,t-chimed)*1.4)*8;
  pline(330,81,330+swing,103,'#886444');
  pellipse(330+swing,107,7,5,'#b19b69');
  ctx.fillStyle='#dfc997';ctx.fillRect(324+swing,107,13,2);
  pline(330+swing,109,330+swing*1.7,127,'#8b7151');
  ctx.save();ctx.translate(330+swing*1.7,128);ctx.rotate(-swing*.035);
  ctx.fillStyle='#e8d9ab';ctx.fillRect(-3,0,7,16);ctx.fillStyle='#96aaa0';ctx.fillRect(-1,4,2,7);ctx.restore();
  ctx.fillStyle='#687f72';ctx.fillRect(122,287,31,4);ctx.fillStyle='#eddbb9';ctx.fillRect(123,284,28,3);ctx.fillStyle='#ac775d';ctx.fillRect(120,282,32,2);
  pellipse(168,291,11,2,'#674b37');ctx.fillStyle='#eadac0';ctx.fillRect(160,279,13,11);
  ctx.strokeStyle='#eadac0';ctx.lineWidth=2;ctx.strokeRect(173,281,4,6);ctx.fillStyle='#775744';ctx.fillRect(162,279,9,2);
  for(let i=0;i<3;i++){
    const phase=(t*.22+i/3)%1;ctx.fillStyle=`rgba(252,238,209,${(1-phase)*.35})`;
    ctx.fillRect(165+Math.sin(phase*7+i)*3,275-phase*17,2,4);
  }
  // Warm light falls across the sill in slow moving patches.
  ctx.fillStyle=css([255,219,152],L.d*.09);ctx.fillRect(113,301,254,2);
  const age=t-watered;
  if(age<3){
    for(let i=0;i<12;i++){
      const d=(age*22+i*3)%32;ctx.fillStyle=`rgba(157,224,235,${Math.max(0,1-age/3)})`;ctx.fillRect(188+hash(i)*20,243+d,1,3);
    }
  }
  if(age<25){
    const a=clamp(age/2,0,1)*clamp((25-age)/3,0,1);
    pcircle(202,263,3,css([237,172,148],a));pcircle(202,263,1,css([255,232,165],a));
  }
  for(let i=hearts.length-1;i>=0;i--){
    const age=t-hearts[i];if(age>3){hearts.splice(i,1);continue;}
    ctx.fillStyle=`rgba(232,163,146,${1-age/3})`;
    const x=282+Math.sin(age*2)*3,y=253-age*10;
    ctx.fillRect(x-3,y,3,3);ctx.fillRect(x+1,y,3,3);ctx.fillRect(x-2,y+2,5,3);ctx.fillRect(x,y+5,1,1);
  }
}

function ripple(p){
  if(elapsed-lastRipple<.13) return;lastRipple=elapsed;
  if(ripples.length>=24) ripples.shift();ripples.push({x:p.x,y:p.y,t:elapsed});
}
function seaHit(p){ const now=currentTime();return p.x>GX0 && p.x<GX1 && p.y>horizonY(now.getHours()+now.getMinutes()/60,elapsed)+3 && p.y<GY1-3; }
function interact(e){
  const p=toScene(e.clientX,e.clientY);setMouse(e.clientX,e.clientY);
  if(p.x>=264 && p.x<=308 && p.y>=252 && p.y<=296){ fx.cat=elapsed;if(hearts.length<8)hearts.push(elapsed);soundscape.cat();say('它眯起眼睛，把安心分给你一点。');return; }
  if(p.x>=230 && p.x<=252 && p.y>=264 && p.y<=296){ settings.candle=!settings.candle;fx.candle=elapsed;saveSettings();say(settings.candle?'留一盏小小的暖光。':'让月光陪你一会儿。');return; }
  if(p.x>=184 && p.x<=214 && p.y>=256 && p.y<=294){watered=elapsed;say('慢慢长大，也是一件很好的事。');return;}
  if(p.x>=316 && p.x<=344 && p.y>=95 && p.y<=150){chimed=elapsed;playChime();say('风从海上来。');return;}
  if(seaHit(p)) ripple(p);
}
stage.addEventListener('pointerdown',interact);
stage.addEventListener('pointermove',e=>{ const p=toScene(e.clientX,e.clientY);if(e.buttons===1 && seaHit(p))ripple(p);stage.style.cursor=(seaHit(p)||(p.y>255&&p.y<295&&p.x>184&&p.x<310)||(p.x>316&&p.x<344&&p.y>95&&p.y<150))?'pointer':'default'; });

// Sound preference never auto-enables playback; one explicit click unlocks audio.
const soundscape = new SeaAudio();
soundscape.setRain(settings.rain);
soundscape.setTrack(settings.music);
for(const key of Object.keys(settings.levels))soundscape.setLevel(key,settings.levels[key]);
let audioPending=false;
async function toggleAudio(){
  if(audioPending)return;
  audioPending=true;
  try {
    soundscape.setHidden(document.hidden);
    await soundscape.setEnabled(!soundscape.enabled);
  } catch { say('当前环境无法播放声音，仍可安静看海。'); }
  finally {
    audioPending=false;
    document.getElementById('sound').textContent=soundscape.enabled?'声音开':'声音关';
    document.getElementById('sound').setAttribute('aria-pressed',String(soundscape.enabled));
  }
}
function playChime(){soundscape.chime();}
const timeNames={live:'此刻',12:'晴昼',18:'日落',23:'月夜'};
function syncControls(){
  document.getElementById('time').textContent=timeNames[settings.time];document.getElementById('weather').textContent=settings.rain?'细雨':'晴天';document.getElementById('weather').setAttribute('aria-pressed',String(settings.rain));document.getElementById('motion').setAttribute('aria-pressed',String(settings.reduced));
  document.getElementById('mood').textContent=settings.rain?'雨落下来，心也慢下来。':'留一点时间，听海。';
}
document.getElementById('time').onclick=()=>{const modes=['live','12','18','23'];settings.time=modes[(modes.indexOf(settings.time)+1)%4];syncControls();saveSettings();};
document.getElementById('weather').onclick=()=>{settings.rain=!settings.rain;soundscape.setRain(settings.rain);syncControls();saveSettings();};
document.getElementById('sound').onclick=toggleAudio;
function closeAudioPanel(){document.getElementById('audio-panel').hidden=true;document.getElementById('soundscape').setAttribute('aria-expanded','false');}
document.getElementById('soundscape').onclick=()=>{
  const panel=document.getElementById('audio-panel');panel.hidden=!panel.hidden;
  document.getElementById('soundscape').setAttribute('aria-expanded',String(!panel.hidden));
  document.getElementById('guide').hidden=true;document.getElementById('help').setAttribute('aria-expanded','false');
};
document.getElementById('music-track').value=settings.music;
document.getElementById('music-track').onchange=e=>{soundscape.setTrack(e.target.value);settings.music=soundscape.track;saveSettings();};
for(const key of Object.keys(settings.levels)){
  const slider=document.getElementById('volume-'+key);slider.value=Math.round(settings.levels[key]*100);
  slider.oninput=e=>{soundscape.setLevel(key,Number(e.target.value)/100);settings.levels[key]=soundscape.levels[key];saveSettings();};
}
document.getElementById('motion').onclick=()=>{settings.reduced=!settings.reduced;syncControls();saveSettings();};
document.getElementById('breathe').onclick=()=>{breathing=!breathing;document.getElementById('breathing').hidden=!breathing;document.getElementById('breathe').setAttribute('aria-pressed',String(breathing));};
document.getElementById('help').onclick=()=>{closeAudioPanel();const el=document.getElementById('guide');el.hidden=!el.hidden;document.getElementById('help').setAttribute('aria-expanded',String(!el.hidden));};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeAudioPanel();document.getElementById('guide').hidden=true;document.getElementById('help').setAttribute('aria-expanded','false');breathing=false;document.getElementById('breathing').hidden=true;document.getElementById('breathe').setAttribute('aria-pressed','false');}});
document.addEventListener('visibilitychange',()=>{previousFrame=performance.now();soundscape.setHidden(document.hidden);});
function tick(now){
  const delta=Math.min((now-previousFrame)/1000,.1);previousFrame=now;
  if(!document.hidden){
    elapsed+=delta*(settings.reduced?.2:1);
    if(now-lastPaint>=(settings.reduced?100:1000/30)){
      lastPaint=now;render();
      if(breathing){const phase=(now/1000)%10, expansion=phase<4?phase/4:1-(phase-4)/6;document.querySelector('#breathing div').style.transform=`scale(${1+expansion*.45})`;document.querySelector('#breathing span').textContent=phase<4?'慢慢吸气':'轻轻呼气';}
    }
  }
  requestAnimationFrame(tick);
}
syncControls();requestAnimationFrame(tick);
if(window.seaWindow){
  document.getElementById('window-actions').hidden=false;
  window.seaWindow.onPinChange(pinned=>document.getElementById('pin').setAttribute('aria-pressed',String(pinned)));
  document.getElementById('pin').onclick=async()=>{const pinned=await window.seaWindow.togglePin();document.getElementById('pin').setAttribute('aria-pressed',String(pinned));};
  document.getElementById('hide-window').onclick=()=>window.seaWindow.hide();
}
