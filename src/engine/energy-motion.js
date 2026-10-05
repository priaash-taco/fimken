const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Exact critically damped spring update: stable even during slow render frames.
export class EnergySpring {
 constructor(value=0){this.value=value;this.velocity=0;}
 reset(value=0){this.value=value;this.velocity=0;}
 step(target,dt,frequency=12){
  if(dt<=0)return this.value;
  const t=Math.min(dt,.25),offset=this.value-target,c=this.velocity+frequency*offset,e=Math.exp(-frequency*t);
  this.value=target+(offset+c*t)*e;this.velocity=(this.velocity-frequency*c*t)*e;
  return this.value;
 }
}
export class EnergyMotion {
 constructor(){this.power=new EnergySpring();this.charge=new EnergySpring();this.radius=new EnergySpring();this.x=new EnergySpring();this.z=new EnergySpring();this.reset();}
 reset(){this.initialized=false;this.wasBeam=false;this.lastTime=0;this.previous={x:0,y:0,z:0};this.wind={x:0,z:0};this.radius.reset();}
 update(dt,time,power,charge,position,paused=false){
  if(!this.initialized||time<this.lastTime||time-this.lastTime>.5){
   this.power.reset(power);this.charge.reset(charge);this.x.reset();this.z.reset();this.previous={...position};this.initialized=true;
  }else if(!paused&&dt>0){
   const vx=clamp((position.x-this.previous.x)/dt,-5,5),vz=clamp((position.z-this.previous.z)/dt,-5,5);
   this.power.step(power,dt,11);this.charge.step(charge,dt,15);
   this.x.step(clamp(-vx*.045,-.14,.14),dt,9);this.z.step(clamp(-vz*.045,-.14,.14),dt,9);
  }
  this.lastTime=time;this.previous={x:position.x,y:position.y,z:position.z};this.wind.x=this.x.value;this.wind.z=this.z.value;
  return this;
 }
 beam(target,dt,active,paused){
  if(!active){this.wasBeam=false;this.radius.reset();return 0;}
  if(!this.wasBeam){this.radius.reset(target);this.wasBeam=true;}
  if(!paused)this.radius.step(target,dt,45);
  return Math.max(0,this.radius.value);
 }
}
// A shared cross-section keeps the luminous core, shell and pressure rings together.
// Deformation is zero at the hands, modest farther away, and does not change length.
export function beamSection(u,time){
 const fade=u*u;
 return {x:Math.sin(u*5-time*2.2)*.018*fade,z:Math.sin(u*7-time*1.7)*.012*fade,width:1+Math.sin(u*10-time*4)*.045*u};
}
export function deformBeam(geometry,time){
 const a=geometry.attributes.position;
 const rest=geometry.userData.energyRest||(geometry.userData.energyRest=a.array.slice());
 const sections=Array.from({length:33},(_,i)=>beamSection(i/32,time));
 for(let i=0;i<a.count;i++){
  const y=rest[i*3+1],s=sections[Math.round((y+.5)*32)];
  a.setXYZ(i,rest[i*3]*s.width+s.x,y,rest[i*3+2]*s.width+s.z);
 }
 a.needsUpdate=true;
}
