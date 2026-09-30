"use strict";
// Original, offline soundscapes. No samples or third-party recordings are used.
class SeaAudio {
  constructor(createContext = () => new AudioContext()) {
    this.createContext = createContext;
    this.enabled = false;
    this.hidden = false;
    this.rain = false;
    this.track = 'off';
    this.levels = { master: .5, sea: .45, rain: .45, music: .5 };
    this.voices = new Set();
    this.lastCat = -Infinity;
    this.lastChime = -Infinity;
    this.lastCatVariant = -1;
    this.timer = null;
    this.step = 0;
    this.nextNote = 0;
  }

  init() {
    if(this.ctx) return;
    const c = this.createContext();
    this.ctx = c;
    this.master = c.createGain();this.master.gain.value = 0;
    this.master.connect(c.destination);
    this.sea = c.createGain();this.rainBus = c.createGain();this.music = c.createGain();
    for(const bus of [this.sea,this.rainBus,this.music]) {bus.gain.value=0;bus.connect(this.master);}
    // Short cosine fades avoid a click at the eight-second buffer seam.
    const length = c.sampleRate * 8;
    const seaBuffer = c.createBuffer(1,length,c.sampleRate);
    const rainBuffer = c.createBuffer(1,length,c.sampleRate);
    const seaData = seaBuffer.getChannelData(0),rainData=rainBuffer.getChannelData(0);
    let brown=0;
    for(let i=0;i<length;i++){
      brown=(brown+Math.random()*.04-.02)/1.02;
      seaData[i]=brown*6;rainData[i]=Math.random()*2-1;
    }
    for(const data of [seaData,rainData]){
      const end=data.length-1,fade=Math.round(c.sampleRate*.04);
      for(let i=0;i<fade;i++){
        const weight=(1-Math.cos(Math.PI*i/fade))*.5;
        data[i]*=weight;data[end-i]*=weight;
      }
    }
    const makeNoise=(buffer,bus,type,frequency)=>{
      const source=c.createBufferSource(),filter=c.createBiquadFilter();
      source.buffer=buffer;source.loop=true;filter.type=type;filter.frequency.value=frequency;
      filter.Q.value=.5;source.connect(filter);filter.connect(bus);source.start();
    };
    const swell=c.createGain();swell.gain.value=.72;swell.connect(this.sea);
    makeNoise(seaBuffer,swell,'lowpass',750);
    const lfo=c.createOscillator(),mod=c.createGain();
    lfo.frequency.value=.085;mod.gain.value=.28;lfo.connect(mod);mod.connect(swell.gain);lfo.start();
    makeNoise(rainBuffer,this.rainBus,'bandpass',2300);
    this.updateGains();
  }

  ramp(param,value,seconds=.3){param.setTargetAtTime(value,this.ctx.currentTime,seconds);}
  updateGains(){
    if(!this.ctx)return;
    this.ramp(this.master.gain,this.enabled&&!this.hidden?this.levels.master:0);
    // Default peak sea gain .12 vs the previous .32; chime gain remains .045.
    this.ramp(this.sea.gain,this.levels.sea*(.12/.45));
    this.ramp(this.rainBus.gain,this.rain?this.levels.rain*.16:0,.6);
    this.ramp(this.music.gain,this.levels.music*.7);
  }
  async setEnabled(value){
    this.enabled=value;
    try {
      if(value){this.init();await this.ctx.resume();}
      this.updateGains();this.refreshMusic();
      return this.enabled;
    } catch(error){this.enabled=false;this.updateGains();this.stopMusic();throw error;}
  }
  setHidden(value){this.hidden=value;this.updateGains();this.refreshMusic();}
  setRain(value){this.rain=value;this.updateGains();}
  setLevel(key,value){
    if(Object.hasOwn(this.levels,key)&&Number.isFinite(value))this.levels[key]=Math.max(0,Math.min(1,value));
    this.updateGains();
  }
  setTrack(value){
    if(value!=='off'&&!SeaAudio.tracks[value])return;
    if(this.track===value)return;
    this.stopMusic();this.track=value;this.step=0;this.refreshMusic();
  }
  voice(frequency,at,duration,volume,type='sine',bus=this.master){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(frequency,at);
    g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(volume,at+.025);
    g.gain.exponentialRampToValueAtTime(.0001,at+duration);
    o.connect(g);g.connect(bus);
    const v={o,g,music:bus===this.music};this.voices.add(v);
    o.onended=()=>{o.disconnect();g.disconnect();this.voices.delete(v);};
    o.start(at);o.stop(at+duration+.05);return v;
  }
  chime(){
    if(!this.enabled||this.hidden||!this.ctx)return;
    const now=this.ctx.currentTime;if(now-this.lastChime<.45)return;this.lastChime=now;
    [659.25,880,1174.66].forEach((f,i)=>this.voice(f,now+i*.17,2.5,.045));
  }
  cat(){
    if(!this.enabled||this.hidden||!this.ctx)return;
    const now=this.ctx.currentTime;if(now-this.lastCat<.85)return;this.lastCat=now;
    // Three vowel-shaped meows: short greeting, soft long meow, double chirrup.
    let variant=Math.floor(Math.random()*3);
    if(variant===this.lastCatVariant)variant=(variant+1)%3;
    this.lastCatVariant=variant;
    const shapes=[[[0,.5,560,820,440]],[[0,.72,430,650,330]],[[0,.24,650,930,610],[.30,.32,570,810,460]]];
    for(const [offset,duration,start,peak,end] of shapes[variant]){
      const at=now+offset,c=this.ctx,v=this.voice(start,at,duration,.085,'sawtooth');
      const filter=c.createBiquadFilter();filter.type='bandpass';filter.Q.value=1.7;
      filter.frequency.setValueAtTime(1100,at);filter.frequency.linearRampToValueAtTime(1700,at+duration*.3);filter.frequency.exponentialRampToValueAtTime(750,at+duration);
      v.o.disconnect();v.o.connect(filter);filter.connect(v.g);
      const cleanup=v.o.onended;v.o.onended=()=>{filter.disconnect();cleanup();};
      v.o.frequency.exponentialRampToValueAtTime(peak,at+duration*.28);
      v.o.frequency.exponentialRampToValueAtTime(end,at+duration);
    }
  }
  stopMusic(){
    if(this.timer!==null){clearInterval(this.timer);this.timer=null;}
    if(!this.ctx)return;
    const now=this.ctx.currentTime;
    for(const v of this.voices)if(v.music){
      v.g.gain.cancelScheduledValues(now);v.g.gain.setTargetAtTime(0,now,.035);v.o.stop(now+.15);
    }
  }
  refreshMusic(){
    if(!this.ctx||!this.enabled||this.hidden||this.track==='off'){this.stopMusic();return;}
    if(this.timer!==null)return;
    this.nextNote=this.ctx.currentTime+.08;
    this.schedule();this.timer=setInterval(()=>this.schedule(),120);
  }
  schedule(){
    if(!this.enabled||this.hidden||this.track==='off')return;
    const song=SeaAudio.tracks[this.track],beat=60/song.bpm,now=this.ctx.currentTime;
    // Do not catch up a backlog after a throttled tab or sleeping machine.
    if(this.nextNote<now-.2)this.nextNote=now+.05;
    while(this.nextNote<now+.3){
      const index=this.step%64,bar=Math.floor(index/4),chord=song.chords[Math.floor(bar/2)%song.chords.length];
      const midi=song.melody[index%song.melody.length],at=this.nextNote;
      if(midi!==null){
        const f=440*Math.pow(2,(midi-69)/12);
        this.voice(f,at,beat*2.7,.085,'sine',this.music);
        this.voice(f*(song.bell?2:1.002),at,beat*1.4,.014,'sine',this.music);
      }
      if(index%4===0)chord.forEach((n,i)=>this.voice(440*Math.pow(2,(n-69)/12),at+i*.065,beat*4.5,.032,'sine',this.music));
      this.step++;this.nextNote+=beat;
    }
  }
}
SeaAudio.tracks={
  shore:{bpm:62,chords:[[48,55,64],[45,52,60],[53,60,67],[43,55,62]],melody:[72,null,76,79,76,74,72,null,69,null,72,76,74,null,72,null,77,null,76,72,74,72,69,null,67,null,71,74,72,null,null,null]},
  cloud:{bpm:72,bell:true,chords:[[53,60,69],[50,57,65],[46,53,62],[48,55,64]],melody:[77,81,null,84,81,null,79,null,77,null,74,77,81,null,null,null,74,77,null,81,79,77,null,74,76,null,79,76,72,null,null,null]},
  moon:{bpm:52,chords:[[50,57,65],[46,53,62],[53,60,69],[48,55,64]],melody:[69,null,null,72,74,null,77,null,74,null,72,null,69,null,null,null,65,null,69,null,72,null,74,72,67,null,64,null,65,null,null,null]}
};
if(typeof module!=='undefined')module.exports=SeaAudio;
