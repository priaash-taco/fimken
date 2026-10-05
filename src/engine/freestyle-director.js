import {ShowcaseDirector,SHOWCASE_MOVES,unwind} from './showcase-director.js';
import {HeroMotionPhysics} from './hero-motion-physics.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// How much each move may change between performances: mirrored left-to-right, and turned to
// a new heading by up to this many radians. Moves tied to one side or one camera stay as authored.
const VARIATION={relaxedIdle:{turn:.3},alert:{mirror:true,turn:.8},stretch:{turn:.4},neckRoll:{turn:.4},wristWarmup:{turn:.4},stepForward:{mirror:true,turn:.6},stepBack:{mirror:true,turn:.6},shuffle:{mirror:true,turn:.9},vanish:{mirror:true,turn:1.2},frontKick:{mirror:true,turn:.7},backKick:{mirror:true,turn:.6},highKick:{mirror:true,turn:.7},heavyKick:{mirror:true,turn:.7},airCombo:{mirror:true,turn:.6},hardLanding:{mirror:true,turn:.8},threePoint:{mirror:true,turn:.8},bounce:{mirror:true,turn:.4},combatIdle:{mirror:true,turn:.4},reset:{turn:.3},strikes:{mirror:true,turn:.75},heavy:{mirror:true,turn:.75},dash:{mirror:true,turn:.95},flying:{mirror:true,turn:.75},flip:{mirror:true,turn:.85},
  reaction:{mirror:true,turn:.6},airborne:{mirror:true,turn:.5},flight:{mirror:true,turn:0},spin:{turn:.6},hover:{turn:.5}};
// Moves by intensity. Silence draws from tiers 0-2 (a training session); with sound the tier
// follows the music's energy, so quiet passages warm up and peaks go all out.
const TIERS=[['relaxedIdle','combatIdle','alert','neckRoll','wristWarmup','stretch','reset'],['bounce','stepForward','stepBack','shuffle','combatIdle','alert'],
  ['strikes','frontKick','highKick','spin','bounce','vanish','stepForward','shuffle'],['heavy','heavyKick','backKick','dash','flying','flip','airCombo','hardLanding','threePoint','flight','vanish'],
  ['powerup','blast','transformation','airCombo','flying','heavyKick','backKick']];
const TIER_OF=Object.fromEntries(TIERS.flatMap((ids,t)=>ids.map(id=>[id,t])));
const SOFT=new Set(['relaxedIdle','alert','neckRoll','wristWarmup','stretch','bounce','combatIdle','stepForward','stepBack','shuffle','reset','stance','hover']);
const flipX=v=>[-v[0],v[1],v[2]];
function mirror(move){
  for(const {pose:p} of move.keys){
    for(const part of ['','Elbow','Foot','Knee'])[p['left'+part],p['right'+part]]=[flipX(p['right'+part]),flipX(p['left'+part])];
    [p.leftAnkle,p.rightAnkle]=[[p.rightAnkle[0],-p.rightAnkle[1],-p.rightAnkle[2]],[p.leftAnkle[0],-p.leftAnkle[1],-p.leftAnkle[2]]];
    for(const k of ['twist','hipYaw','headYaw','bank','yaw'])p[k]=-p[k];
    p.hipShift=[-p.hipShift[0],p.hipShift[1]];p.travel=[-p.travel[0],p.travel[1]];p.trails=[p.trails[1],p.trails[0],p.trails[2]];
  }
  for(const cue of move.cues||[])if(cue.limb)cue.limb=cue.limb.startsWith('left')?cue.limb.replace('left','right'):cue.limb.replace('right','left');
}
// Seeded, no-repeat move selection. Randomness selects complete gestures, never
// random joint angles. Action keys, hand/foot IK and cue dispatch remain shared.
export class FreestyleDirector extends ShowcaseDirector {
  constructor(seed=Date.now()){super();this.seed=seed>>>0;this.motion=new HeroMotionPhysics();this.auto=false;this.history=[];}
  random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296;}
  reset(){super.reset();this.auto=false;this.motion?.reset();this.history=[];}
  practice(id){
    if(id!=='freestyle'){this.auto=false;super.practice(id);return;}
    this.motion.reset({x:this.pose.travel[0],y:this.pose.lift,z:this.pose.travel[1]});
    this.auto=true;this.history=[];this.begin('powerup');
  }
  begin(id){
    const old=this.pose,origin=[this.motion.position.x,this.motion.position.z];
    const move=structuredClone(SHOWCASE_MOVES[id]);
    if(move.hold&&move.keys.at(-1).pose.lift>0){
      const end=move.duration;move.duration=end+2.1;
      move.keys.push({...structuredClone(move.keys.at(-1)),at:end+1},
       {...structuredClone(SHOWCASE_MOVES.stance.keys[0]),at:end+1.7,phase:'land'},
       {...structuredClone(SHOWCASE_MOVES.stance.keys[0]),at:move.duration});
    }
    this.heading=0;const vary=VARIATION[id];
    if(vary){
      const forced=this.forcedVariation;
      if(forced?forced.mirror:vary.mirror&&this.random()<.5)mirror(move);
      const heading=forced?forced.heading||0:(this.random()*2-1)*vary.turn,c=Math.cos(heading),s=Math.sin(heading);this.heading=heading;
      for(const k of move.keys){const [x,z]=k.pose.travel;k.pose.travel=[x*c+z*s,-x*s+z*c];k.pose.yaw+=heading;}
    }
    for(const k of move.keys)k.pose.travel=k.pose.travel.map((v,i)=>clamp(v+origin[i],-1.2,1.2));
    this.from=unwind(old);this.move=move;this.moveId=id;this.time=0;this.revision++;this.history.push(id);if(this.history.length>32)this.history.shift();
    // Land and settle before the next grounded attack.
    // Strikes follow the tempo when one is detected.
    // Everything else gets a slightly different pace each time; the beam keeps its timing.
    // With a tempo, fit the move to whole beats so its hits land on them; otherwise vary the pace.
    const bpm=this.music?.bpm,period=bpm&&this.music.confidence>.5?60/bpm:0;
    if(id==='blast')this.rate=1;
    else if(period){const beats=Math.max(1,Math.round(move.duration/period));this.rate=clamp(move.duration/(beats*period),.8,1.35);}
    else this.rate=.88+this.random()*.3;
    super.update(0);
  }
  choose(music){
    const sound=(music?.rolling||0)>.03;let tier;
    if(!sound){const r=this.random();tier=r<.3?0:r<.62?1:2;}
    else{
      const e=music.rolling,base=e<.11?0:e<.2?1:e<.32?2:e<.44?3:4;
      const nudge=music.section==='build'?1:music.section==='breakdown'?-1:0,wander=this.random()<.25?(this.random()<.5?-1:1):0;
      tier=clamp(base+nudge+wander,0,4);
      if(tier===4&&music.section!=='build'&&music.section!=='peak')tier=3;
      if(music.section==='quiet'&&this.random()<.4)return this.history.at(-1)==='hover'?'combatIdle':'hover';
    }
    const pool=TIERS[tier],recent=this.history.slice(-3);const options=pool.filter(id=>!recent.includes(id));
    return (options.length?options:pool)[Math.floor(this.random()*options.length||pool.length)];
  }
  // Big moves (tier 3 and up) start on the bar's first beat; smaller ones on any beat.
  ready(music,id){
    const period=music?.bpm&&music.confidence>.5?60/music.bpm:0;if(!period)return true;
    const tier=TIER_OF[id]??2;this.waited=(this.waited||0)+1/60;
    if(music.beat&&(tier<3||music.beatCount%4===0))return true;
    return this.waited>period*(tier<3?2:4.2);
  }
  rehearse(id,variation){this.forcedVariation=variation;this.motion.reset();this.history=[];this.begin(id);this.forcedVariation=null;this.auto=false;this.from=null;super.update(0);}
  seek(time){this.auto=false;super.seek(time);}
  update(dt,music){
    if(!this.auto){super.update(dt);return;}
    if(dt<=0)return;
    this.music=music;
    // A drop fires the beam: charge in a hurry, release at normal speed.
    // Sound calls moves directly (bible mapping): a drop dashes, a crescendo charges and fires the beam,
    // a bass hit throws the heavy punch, a held tone lifts into a hover. Only soft moves are cut short.
    const grounded=this.motion.position.y<.015,soft=SOFT.has(this.moveId)||this.time>=this.move.duration;
    if(music?.crescendo&&this.moveId!=='blast'&&grounded)this.begin('blast');
    else if(music?.drop&&grounded&&soft)this.begin('dash');
    else if(music?.bassHit&&grounded&&soft&&music.beatCount%2===0&&music.time-(this.lastHeavy??-9)>5){this.lastHeavy=music.time;this.begin(this.random()<.6?'heavy':'heavyKick');}
    else if(music?.sustained&&grounded&&soft&&this.moveId!=='hover'&&this.time>.6)this.begin('hover');
    // With a tempo, the next move waits for a beat (up to one bar) so it starts on the music.
    if(this.time>=this.move.duration && this.motion.position.y<.015){
      this.next??=this.choose(music);
      if(this.ready(music,this.next)){this.waited=0;const id=this.next;this.next=null;this.begin(id);}
    }
    super.update(dt*this.rate);
    // Every beat lands in the body: a quick dip and shoulder flinch that decays before the next.
    this.pulse=Math.max((this.pulse||0)*Math.exp(-dt*9),music?.beat?music.beatStrength:0);
    const hit=this.pulse*(this.pose.hitStop>.5?.3:1);
    this.pose.crouch+=hit*.05;this.pose.shoulderLift+=hit*.05;this.pose.headPitch+=hit*.06;this.pose.lean+=hit*.03;
    const goal=this.pose.travel;
    if(this.signals.release)this.motion.impulse(0,0,-.8);
    const p=this.motion.update(dt,{x:goal[0],y:this.pose.lift,z:goal[1]},this.pose.lift>.03);
    this.pose.travel=[p.x,p.z];this.pose.lift=p.y;
    this.pose.bank-=clamp(this.motion.velocity.x*.025,-.10,.10);
    if(this.motion.impact && !this.signals.landing)this.signals.landing={type:'landing',strength:this.motion.impact};
    if(music?.beatStrength && this.pose.power>.4)this.pose.power=clamp(this.pose.power+music.beatStrength*.10,0,1);
    this.power=this.pose.power;
  }
}
