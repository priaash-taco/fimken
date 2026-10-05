// Root locomotion only: the authored pose and IK still control the limbs.
// Fixed steps, critically damped steering, gravity and non-bouncing floor contacts.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class HeroMotionPhysics {
  constructor(){this.reset();}
  reset(position={x:0,y:0,z:0}){this.position={...position};this.velocity={x:0,y:0,z:0};this.accumulator=0;this.landings=0;this.impact=0;}
  impulse(x,y,z){this.velocity.x+=x;this.velocity.y+=y;this.velocity.z+=z;}
  update(dt,target,airborne=false){
    this.impact=0;this.accumulator+=clamp(dt,0,.25);
    while(this.accumulator+1e-10>=1/120){this.step(1/120,target,airborne);this.accumulator-=1/120;}
    return this.position;
  }
  step(dt,target,airborne){
    for(const axis of ['x','z']){
      const goal=clamp(target[axis],-1.3,1.3);
      const a=clamp((goal-this.position[axis])*90-this.velocity[axis]*18,-34,34);
      this.velocity[axis]=clamp(this.velocity[axis]+a*dt,-5,5);
      this.position[axis]+=this.velocity[axis]*dt;
      if(Math.abs(this.position[axis])>1.4){this.position[axis]=Math.sign(this.position[axis])*1.4;this.velocity[axis]=0;}
    }
    const a=airborne?clamp((clamp(target.y,0,.8)-this.position.y)*100-this.velocity.y*18,-28,28):-12;
    this.velocity.y=clamp(this.velocity.y+a*dt,-5,4);this.position.y+=this.velocity.y*dt;
    if(this.position.y<=0){
      if(this.velocity.y<-.65){this.impact=Math.min(1,-this.velocity.y/4);this.landings++;}
      this.position.y=0;this.velocity.y=0;
    }
  }
}
