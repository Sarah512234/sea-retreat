const assert=require('node:assert/strict');
const SeaAudio=require('../src/sea-audio.js');
class Param {
  constructor(){this.value=0;this.events=[];}
  setValueAtTime(value,time){this.record(value,time);}
  linearRampToValueAtTime(value,time){this.record(value,time);}
  exponentialRampToValueAtTime(value,time){assert(value>0);this.record(value,time);}
  setTargetAtTime(value,time,constant){assert(constant>0);this.record(value,time);}
  cancelScheduledValues(time){this.events=this.events.filter(e=>e.time<time);}
  record(value,time){assert(Number.isFinite(value)&&Number.isFinite(time));this.value=value;this.events.push({value,time});}
}
class Node {
  constructor(c){this.c=c;this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.connections=[];c.nodes.push(this);}
  connect(node){this.connections.push(node);}
  disconnect(){this.connections=[];}
  start(time=0){assert(!this.started);this.started=true;this.startAt=time;}
  stop(time){this.stopAt=time;}
}
class Context {
  constructor(){this.nodes=[];this.sampleRate=8000;this.currentTime=0;this.destination={};}
  createGain(){return new Node(this);}
  createOscillator(){return new Node(this);}
  createBiquadFilter(){return new Node(this);}
  createBufferSource(){return new Node(this);}
  createBuffer(channels,length){const data=new Float32Array(length);return {getChannelData:()=>data};}
  async resume(){}
  advance(time){this.currentTime=time;for(const n of this.nodes)if(n.onended&&n.stopAt<=time){const end=n.onended;n.onended=null;end();}}
}
(async()=>{
  const originalSet=global.setInterval,originalClear=global.clearInterval;
  const timers=new Set();global.setInterval=fn=>{timers.add(fn);return fn;};global.clearInterval=fn=>timers.delete(fn);
  try {
    const c=new Context(),s=new SeaAudio(()=>c);
    s.setTrack('shore');s.cat();s.chime();assert.equal(s.ctx,undefined);
    await s.setEnabled(true);assert.equal(s.master.gain.value,.5);assert.equal(timers.size,1);
    assert.equal(s.rainBus.gain.value,0);assert(s.sea.gain.value<.22);
    s.setRain(true);assert(s.rainBus.gain.value>0);
    s.setRain(false);assert.equal(s.rainBus.gain.value,0);
    s.setLevel('sea',0);assert.equal(s.sea.gain.value,0);
    s.setLevel('master',2);assert.equal(s.master.gain.value,1);
    s.setLevel('master',NaN);assert.equal(s.master.gain.value,1);
    for(const track of ['cloud','moon','shore']){
      s.setTrack(track);assert.equal(timers.size,1);
      for(let beat=0;beat<70;beat++){c.advance(c.currentTime+1.2);s.schedule();}
      assert(s.step>=64,`${track} should play beyond one arrangement`);
    }
    s.setTrack('off');assert.equal(timers.size,0);c.advance(c.currentTime+6);
    assert.equal(s.voices.size,0);
    const variants=new Set();
    const random=Math.random;
    try {
      for(let i=0;i<6;i++){
        Math.random=()=>((i%3)+.1)/3;
        c.advance(c.currentTime+1);const last=s.lastCatVariant;s.cat();
        assert.notEqual(s.lastCatVariant,last);variants.add(s.lastCatVariant);
        const count=s.voices.size;s.cat();assert.equal(s.voices.size,count);
      }
    } finally {Math.random=random;}
    assert.equal(variants.size,3);
    c.advance(c.currentTime+3);s.chime();assert.equal(s.voices.size,3);
    assert([...s.voices].every(v=>v.g.gain.events.some(e=>e.value===.045)));
    s.setTrack('moon');s.setHidden(true);assert.equal(s.master.gain.value,0);assert.equal(timers.size,0);
    c.advance(c.currentTime+8);assert.equal(s.voices.size,0);
    s.setHidden(false);assert.equal(timers.size,1);
    await s.setEnabled(false);assert.equal(s.master.gain.value,0);assert.equal(timers.size,0);
    s.setHidden(true);s.setHidden(false);assert.equal(timers.size,0);
    const failing=new SeaAudio(()=>{throw Error('unsupported');});
    await assert.rejects(()=>failing.setEnabled(true));assert.equal(failing.enabled,false);
    console.log('PASS: sound opt-in, rain transitions, level bounds, all three arrangements, meow variants/cooldown, chime level, track switching, mute/hide timer and voice cleanup, initialization failure.');
  } finally {global.setInterval=originalSet;global.clearInterval=originalClear;}
})().catch(error=>{console.error(error);process.exitCode=1;});
