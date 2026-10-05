const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
// A fast travelling front, followed by a slower widening energy surge.
// Uses timeline age rather than accumulated frame deltas, so paused poses match.
export function beamEnvelope(age,amount=1){
 const t=Math.max(0,age),power=clamp(amount);
 return {length:11*(1-Math.exp(-t*11)),radius:(.30+smooth(.04,.88,t)*1.25+smooth(.65,1.25,t)*.23)*power,orbScale:1+smooth(0,.9,t)*.45*power};
}
