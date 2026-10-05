// Timed, editable body choreography. Coordinates are metres in hero-root space;
// joint angles are radians. IK, follow-through, cue dispatch and VFX remain separate.
export function createStagedMoves({stance,guard,pivot,chamber,kick}) {
 const pose=(base,changes={})=>({...base,...changes});
 // Keys without a phase are grounded guard work, or floating once the pose lifts off.
 const K=(at,base,changes,phase,stage,shot='strikeHero')=>{const p=pose(base,changes);phase??=p.lift>.03?'float':p.hitStop>.5?(p.trails?.[2]>.5?'kick':'punch'):'guard';return {at,pose:p,phase,stage:stage??phase,shot};};
 const move=(label,keys,cues=[],hold=false)=>({label,duration:keys.at(-1).at,keys,cues,hold,
  clip:null,blendIn:.35,blendOut:.35,rootMotion:'pose+bounded-physics',
  stages:keys.map(k=>({at:k.at,action:k.stage})),cameraCue:keys[0].shot,audioCue:null});
 const wide=pose(stance,{footControl:1,leftFoot:[.075,0,.045],rightFoot:[-.075,0,-.055]});
 const loaded=pose(wide,{fist:.9,focus:1,shout:.3,crouch:.14,headPitch:.22,lean:.055,shoulderLift:.10,tension:.7,left:[.32,.91,-.025],right:[-.32,.91,-.025],leftElbow:[.85,1.02,-.35],rightElbow:[-.85,1.02,-.35]});
 // Peak: feet wide, knees out, chest open, elbows flared with the hands held away from the hips.
 const dominant=pose(wide,{fist:.85,focus:1,shout:.45,crouch:.10,lean:-.085,headPitch:-.06,shoulderDrive:-.09,shoulderLift:.06,tension:.45,power:1,left:[.56,1.02,.12],right:[-.56,1.02,.12],
  leftElbow:[1.1,1.25,-.5],rightElbow:[-1.1,1.25,-.5],leftFoot:[.17,0,.05],rightFoot:[-.17,0,-.05],leftKnee:[.6,.55,1],rightKnee:[-.6,.55,1]});
 const charge=pose(guard,{fist:.25,focus:1,crouch:.13,twist:-.53,hipYaw:-.12,lean:.02,headYaw:.40,headPitch:.05,guard:0,power:.85,charge:1,
  left:[-.18,1.03,.16],right:[-.39,1.08,.08],leftElbow:[.34,.96,.5],rightElbow:[-.85,1.04,-.35],
  shoulderDrive:.13,shoulderLift:.07,rightAnkle:[0,-.26,0],hipShift:[-.035,-.04]});
 const release=pose(guard,{fist:.1,focus:1,shout:.55,charge:1,beam:1,power:1,guard:0,crouch:.08,twist:.07,hipYaw:.14,lean:.20,headPitch:-.045,
  left:[.065,1.28,.49],right:[-.065,1.28,.49],shoulderDrive:.23,shoulderLift:.03,
  rightFoot:[0,.035,-.09],rightAnkle:[.18,0,0],hipShift:[0,.04]});
 const float=pose(stance,{fist:.15,focus:0,lift:.38,crouch:.02,lean:-.035,power:.4,headYaw:.06,footControl:1,leftFoot:[0,.045,.015],rightFoot:[0,.025,-.015],left:[.44,.98,.10],right:[-.44,.98,.10]});
 const air=pose(guard,{fist:.6,lift:.44,crouch:.04,lean:.16,twist:.18,headYaw:-.12,leftFoot:[.03,.22,.17],rightFoot:[-.02,.02,-.16],left:[.22,1.40,.24],right:[-.27,1.30,.15]});
 const p1=pose(guard,{fist:1,focus:.9,twist:-.25,hipYaw:-.09,lean:.12,headYaw:.10,left:[.10,1.29,.47],shoulderDrive:.16,trails:[1,0,0],hitStop:1});
 const p2=pose(guard,{fist:1,focus:.9,twist:.31,hipYaw:.14,lean:.15,headYaw:-.15,right:[-.09,1.32,.48],shoulderDrive:.19,trails:[0,1,0],hitStop:1});
 const hook=pose(guard,{fist:1,focus:1,shout:.25,crouch:.17,twist:-.38,hipYaw:-.18,bank:.08,left:[-.10,1.13,.33],leftElbow:[.82,1.15,.05],trails:[1,0,0],hitStop:1});
 const upper=pose(guard,{fist:1,focus:1,shout:.3,crouch:.035,twist:.29,hipYaw:.12,lean:-.02,right:[-.08,1.50,.30],rightElbow:[-.55,.86,.24],trails:[0,1,0],hitStop:1});
 const heavyLoad=pose(guard,{fist:1,focus:1,crouch:.19,hipShift:[-.04,-.05],hipYaw:-.26,twist:-.34,headYaw:.3,right:[-.35,1.11,-.03],rightElbow:[-.8,1.12,-.4]});
 const heavyHit=pose(p2,{shout:.45,twist:.40,hipYaw:.23,lean:.23,shoulderDrive:.25,travel:[0,.18]});
 const fly=pose(guard,{fist:1,focus:1,lift:.52,crouch:.01,lean:.49,twist:-.26,headPitch:-.20,right:[-.34,1.1,-.12],leftFoot:[0,.13,-.32],rightFoot:[0,.08,-.40],rightElbow:[-.8,1,-.4]});
 // Flight: the whole body pitches forward (negative flip), one fist leading.
 const soar=pose(guard,{fist:.95,focus:.7,lift:.45,flip:-1.15,crouch:0,lean:.12,headPitch:-.55,guard:0,power:.42,left:[.2,1.62,.42],right:[-.36,1.02,-.2],rightElbow:[-.8,1,-.5],leftFoot:[.04,.10,-.42],rightFoot:[-.04,.06,-.48],trails:[.3,.3,.3]});
 const dash=pose(guard,{fist:.7,lift:.10,crouch:.12,lean:.38,bank:-.09,headPitch:-.12,left:[.36,.99,-.14],right:[-.36,1.07,-.18],leftFoot:[0,.08,-.12],rightFoot:[0,.04,-.2],trails:[.25,.25,.25]});
 return {
  powerup:move('Power-up',[
   K(0,stance,{},'powerup','Begin planted','powerBuild'),K(.5,loaded,{power:.30},'powerup','Widen feet, bend knees, draw hands to hips','powerBuild'),
   K(1.5,loaded,{lean:-.025,headPitch:.26,power:.6,tension:1},'powerup','Retract elbows, lift chest, lower head','powerPeak'),
   K(2.5,dominant,{headPitch:.14,power:.96,tension:1},'powerup','Extend spine and spread arms under tension','powerPeak'),
   K(3.5,dominant,{},'powerup','Raise head last; hold dominant stance','powerPeak')],[{at:1.9,type:'surge',strength:1}],true),
  charge:move('Energy charge',[
   K(0,guard,{},'charge','Set guard','chargeHero'),K(.65,charge,{charge:.08,power:.3,left:[.02,1.10,.22],right:[-.40,1.15,.1]},'charge','Pivot rear foot; rotate torso 30 degrees','chargeHero'),
   K(1.5,charge,{charge:.35,power:.5,left:[-.14,1.01,.18],right:[-.42,1.11,.05]},'charge','Cup hands by rear hip, compress shoulders','chargeHero'),
   K(2.6,charge,{},'charge','Face target and hold','chargeHero'),K(2.85,charge,{},'charge','Anticipation hold','chargeHero'),
   K(3.4,charge,{left:[-.22,1.04,.15],right:[-.36,1.08,.10],tension:.8},'charge','Tighten hands around the energy','chargeHero')],[],true),
  blast:move('Beam release',[
   K(0,guard,{},'charge','Set stance','chargeHero'),K(1.6,charge,{charge:.3,power:.5},'charge','Draw energy to rear hip','chargeHero'),
   K(3.1,charge,{},'charge','Compress and aim','chargeHero'),K(3.45,charge,{},'charge','Anticipation hold','chargeHero'),
   K(3.54,charge,{hipYaw:.10,twist:-.20,shoulderDrive:.18},'charge','Hips initiate; shoulders follow','beamHero'),
   K(3.62,release,{},'blast','Thrust both hands; lift rear heel','beamHero'),
   K(3.84,release,{lean:-.065,crouch:.13,left:[.08,1.26,.40],right:[-.08,1.26,.40]},'blast','Recoil against the beam','beamHero'),
   K(4.2,release,{lean:-.02,crouch:.12,left:[.075,1.265,.42],right:[-.075,1.265,.42]},'blast','Hold the beam on target','beamImpact'),
   K(4.8,release,{lean:.16},'blast','Brace and sustain','beamImpact'),K(5.05,release,{beam:0,charge:.05,power:.45},'recover','Release pressure','beamHero'),
   K(6.6,guard,{},'idle','Settle into guard','strikeHero')],[{at:3.62,type:'release',strength:1}]),
  dash:move('Instant dash',[
   K(0,guard,{},'dash','Ready'),K(.16,guard,{crouch:.19,lean:.18,bank:-.08},'dash','Load knees; drop lead shoulder'),
   K(.26,dash,{},'dash','Arms trail behind burst'),K(.58,dash,{travel:[0,.78]},'dash','Rapid forward travel'),
   K(.76,guard,{travel:[0,.82],crouch:.20,twist:.25,headYaw:-.20},'land','Absorb arrival through knees'),K(1.35,guard,{travel:[0,.82]},'idle','Recover guard')],[{at:.76,type:'landing',strength:.5}]),
  strikes:move('Rapid punch combo',[
   K(0,guard,{},'guard','Guard'),K(.30,guard,{twist:.12,left:[.27,1.29,.1]},'punch','Load jab'),
   K(.44,p1,{},'punch','Jab'),K(.49,p1,{},'punch','Contact'),K(.65,guard,{travel:[0,.035]},'guard','Return to guard; small step'),
   K(.80,p2,{travel:[0,.07]},'punch','Cross'),K(.85,p2,{travel:[0,.07]},'punch','Contact'),K(1.05,guard,{travel:[0,.10],crouch:.18},'guard','Guard and load hook'),
   K(1.22,hook,{travel:[0,.12]},'punch','Body hook'),K(1.27,hook,{travel:[0,.12]},'punch','Contact'),K(1.48,guard,{travel:[0,.14],crouch:.21,right:[-.24,1.05,.18]},'guard','Drop for uppercut'),
   K(1.65,upper,{travel:[0,.18]},'punch','Short uppercut'),K(1.71,upper,{travel:[0,.18]},'punch','Contact'),K(2.25,guard,{travel:[0,.18]},'idle','Both hands recover to guard')],
   [.44,.80,1.22,1.65].map((at,i)=>({at,type:'impact',limb:i%2?'rightHand':'leftHand',strength:.35+i*.1}))),
  heavy:move('Heavy straight punch',[
   K(0,guard,{},'guard','Guard'),K(.6,heavyLoad,{},'punch','Load rear leg and draw fist to ribs'),K(.75,heavyLoad,{hipYaw:.05},'punch','Hips drive first'),
   K(.9,heavyHit,{},'punch','Drive shoulder and extend fist'),K(.96,heavyHit,{},'punch','Contact'),
   K(1.10,heavyHit,{hitStop:0,lean:.27,twist:.44,trails:[0,.3,0]},'recover','Small body overshoot'),K(1.8,guard,{travel:[0,.18]},'idle','Recoil to guard')],[{at:.9,type:'impact',limb:'rightHand',strength:.9}]),
  flying:move('Flying punch',[
   K(0,guard,{},'guard','Ready'),K(.3,guard,{crouch:.19,lean:.20},'dash','Load takeoff'),K(.65,fly,{},'float','Accelerate with fist held back'),
   K(1.02,fly,{travel:[0,.48],twist:-.10},'float','Legs trail behind'),K(1.18,fly,{travel:[0,.62],twist:.30,hipYaw:.14,right:[-.06,1.35,.48],shoulderDrive:.22,trails:[0,1,0],hitStop:1},'punch','Extend fist late'),
   K(1.24,fly,{travel:[0,.62],twist:.30,hipYaw:.14,right:[-.06,1.35,.48],shoulderDrive:.22,trails:[0,1,0],hitStop:1},'punch','Contact'),
   K(1.58,air,{travel:[0,.70],lift:.3,leftFoot:[0,.18,.15],rightFoot:[0,.12,.12]},'float','Swing legs forward to brake'),K(1.95,guard,{travel:[0,.70],crouch:.21},'land','Land through knees'),K(2.45,guard,{travel:[0,.70]},'idle','Recover')],[{at:1.18,type:'impact',limb:'rightHand',strength:.8},{at:1.95,type:'landing',strength:.6}]),
  spin:move('Spinning kick',[
   K(0,guard,{},'guard','Ready'),K(.25,pivot,{headYaw:.48},'kick','Plant lead foot; look into turn'),K(.48,pivot,{headYaw:.55,twist:.35,hipYaw:.12},'kick','Shoulders follow head, then hips'),
   K(.8,chamber,{headYaw:.18},'kick','Rear knee chambers'),K(1.03,kick,{},'kick','Extend through spin'),K(1.10,kick,{},'kick','Contact'),
   K(1.35,chamber,{yaw:Math.PI*1.9,rightFoot:[.09,.35,.14]},'kick','Retract knee'),K(1.6,guard,{yaw:Math.PI*2,crouch:.2},'land','Land facing target'),K(2.0,guard,{yaw:Math.PI*2},'idle','Recover')],[{at:1.03,type:'impact',limb:'rightFoot',strength:.8},{at:1.6,type:'landing',strength:.5}]),
  hover:move('Hover idle',[K(0,stance,{},'float','Relax stance','hoverHero'),K(.7,stance,{crouch:.10},'float','Soft takeoff','hoverHero'),K(2.2,float,{},'float','Float with loose knees and relaxed arms','hoverHero')],[],true),
  airborne:move('Mid-air combat stance',[K(0,guard,{},'float','Guard','hoverHero'),K(.6,guard,{crouch:.15},'float','Load takeoff','hoverHero'),K(1.8,air,{},'float','Raise lead knee, trail rear leg and face target','hoverHero')],[],true),
  reaction:move('Impact reaction',[
   K(0,guard,{},'guard','Guard'),K(.18,guard,{lean:-.23,headPitch:-.28,headYaw:.12,left:[.48,1.16,.08],right:[-.48,1.16,.08],twist:.10},'recoil','Chest and head snap back'),
   K(.36,guard,{lean:-.18,hipYaw:.20,twist:.24,headPitch:-.10,lift:.08,leftFoot:[.02,.13,.08],travel:[0,-.18],left:[.43,1.16,.10],right:[-.43,1.16,.10]},'recoil','Hips lag; step back under force'),
   K(.75,guard,{travel:[0,-.22],crouch:.20,lean:.12},'land','Catch balance'),K(1.5,guard,{travel:[0,-.22]},'idle','Recover defensive posture')]),
  flip:move('Backflip',[
   K(0,guard,{},'guard','Ready'),K(.22,guard,{crouch:.24,lean:.16,left:[.3,1.0,-.1],right:[-.3,1.0,-.1]},'dash','Sink and swing the arms back'),
   K(.40,guard,{lift:.35,crouch:.02,lean:-.12,flip:.5,left:[.25,1.7,.1],right:[-.25,1.7,.1]},'float','Drive up; arms throw overhead'),
   K(.62,guard,{lift:.78,crouch:.10,flip:Math.PI,travel:[0,-.2],leftFoot:[.02,.42,.16],rightFoot:[-.02,.38,.12],left:[.24,.95,.3],right:[-.24,.95,.3]},'float','Tuck at the top'),
   K(.86,guard,{lift:.38,crouch:.04,flip:Math.PI*1.82,travel:[0,-.4],leftFoot:[0,.14,.05],rightFoot:[0,.10,0]},'float','Open out; spot the landing'),
   K(1.02,guard,{flip:Math.PI*2,travel:[0,-.46],crouch:.24,lean:.16},'land','Land through the knees'),K(1.55,guard,{flip:Math.PI*2,travel:[0,-.46]},'idle','Recover guard')],[{at:1.02,type:'landing',strength:.6}]),
  flight:move('Flight',[
   K(0,stance,{},'float','Ready','flightWide'),K(.45,stance,{crouch:.2,lean:.1},'float','Sink before takeoff','flightWide'),
   K(1.0,soar,{lift:.3,flip:-.8,travel:[.5,.35],yaw:.9},'float','Launch and bank right','flightWide'),
   K(1.9,soar,{travel:[1.05,-.35],yaw:2.6,bank:-.22},'float','Sweep around the far side','flightWide'),
   K(2.9,soar,{lift:.7,travel:[-.2,-1.0],yaw:4.2,bank:-.25},'float','Climb across the back','flightWide'),
   K(3.9,soar,{travel:[-1.05,.1],yaw:5.5,bank:-.2},'float','Dive back toward the front','flightWide'),
   K(4.7,air,{lift:.4,travel:[-.3,.5],yaw:Math.PI*2,lean:.1},'float','Brake upright','flightWide'),
   K(5.3,guard,{travel:[0,.45],yaw:Math.PI*2,crouch:.2},'land','Touch down','flightWide'),K(5.8,guard,{travel:[0,.45],yaw:Math.PI*2},'idle','Recover','flightWide')],[{at:5.3,type:'landing',strength:.5}]),
  // 6 Combat bounce: knees flex to the beat, weight alternates, hands float. Fitted to whole beats in Auto.
  bounce:move('Combat bounce',[
   K(0,guard,{crouch:.10}),K(.25,guard,{crouch:.15,hipShift:[.03,0],shoulderLift:.02}),K(.5,guard,{crouch:.09,left:[.19,1.34,.44],right:[-.13,1.31,.28]}),
   K(.75,guard,{crouch:.15,hipShift:[-.03,0],shoulderLift:.02}),K(1.0,guard,{crouch:.10}),K(1.25,guard,{crouch:.15,hipShift:[.03,0]}),
   K(1.5,guard,{crouch:.09,left:[.15,1.37,.47]}),K(1.75,guard,{crouch:.15,hipShift:[-.03,0]}),K(2.0,guard,{crouch:.10})]),
  // 27 Combat idle: breathing, tiny weight changes, a shoulder roll.
  combatIdle:move('Combat idle',[
   K(0,guard,{}),K(.8,guard,{shoulderLift:.05,lean:.07,hipShift:[.02,0]}),K(1.6,guard,{shoulderLift:-.02,hipShift:[-.02,.01],headYaw:.08,left:[.19,1.33,.44]}),K(2.4,guard,{})],[],true),
  // 9-11 Footwork: the lead foot moves first and the rear catches up; upper body stays ready.
  stepForward:move('Step forward',[
   K(0,guard,{}),K(.18,guard,{leftFoot:[0,.05,.22],travel:[0,.05]}),K(.32,guard,{leftFoot:[0,0,.2],travel:[0,.14],crouch:.12}),
   K(.5,guard,{leftFoot:[0,0,.09],rightFoot:[0,.04,-.04],travel:[0,.24]}),K(.68,guard,{travel:[0,.3]})]),
  stepBack:move('Step back',[
   K(0,guard,{}),K(.18,guard,{rightFoot:[0,.05,-.2],travel:[0,-.05]}),K(.32,guard,{rightFoot:[0,0,-.2],travel:[0,-.14],crouch:.12}),
   K(.5,guard,{rightFoot:[0,0,-.09],leftFoot:[0,.04,.05],travel:[0,-.24]}),K(.68,guard,{travel:[0,-.3]})]),
  shuffle:move('Side shuffle',[
   K(0,guard,{}),K(.16,guard,{leftFoot:[.2,.04,.09],travel:[.05,0],bank:.03}),K(.3,guard,{leftFoot:[.18,0,.09],travel:[.16,0],crouch:.12}),
   K(.48,guard,{leftFoot:[0,0,.09],rightFoot:[.04,.04,-.09],travel:[.3,0],bank:-.02}),K(.66,guard,{travel:[.36,0]})]),
  // 30 Side vanish: compress, twist toward the destination, one anticipation frame, then gone.
  vanish:move('Side vanish',[
   K(0,guard,{}),K(.14,guard,{crouch:.22,twist:.32,headYaw:.45,lean:.08}),K(.2,guard,{crouch:.2,twist:.32,headYaw:.45,lean:.1}),
   K(.27,guard,{crouch:.14,lean:.12,bank:.14,travel:[1.1,0],trails:[.3,.3,.3],left:[.3,1.1,.1],right:[-.3,1.15,.0]}),
   K(.38,guard,{crouch:.22,travel:[1.15,0],headYaw:-.3,twist:-.1}),K(.9,guard,{travel:[1.15,0]})]),
  // 18 Front kick: knee first, snap, lean back, quick retract.
  frontKick:move('Front kick',[
   K(0,guard,{}),K(.22,guard,{crouch:.12,rightFoot:[0,.32,.1],rightKnee:[-.2,1.3,.9],lean:-.04}),
   K(.36,guard,{rightFoot:[0,.78,.72],rightKnee:[-.2,1.15,.95],rightAnkle:[.3,0,0],lean:-.18,left:[.25,1.3,.3],right:[-.3,1.2,.1],trails:[0,0,1],hitStop:1}),
   K(.42,guard,{rightFoot:[0,.78,.72],rightKnee:[-.2,1.15,.95],rightAnkle:[.3,0,0],lean:-.18,left:[.25,1.3,.3],right:[-.3,1.2,.1],trails:[0,0,1],hitStop:1}),
   K(.56,guard,{crouch:.12,rightFoot:[0,.3,.1],rightKnee:[-.2,1.3,.9]}),K(.9,guard,{})],[{at:.36,type:'impact',limb:'rightFoot',strength:.6}]),
  // 20 Spinning back kick: look over the shoulder, spin, heel drives back toward the target.
  backKick:move('Spinning back kick',[
   K(0,guard,{}),K(.2,guard,{headYaw:-.7,crouch:.14,twist:-.15}),K(.4,pivot,{yaw:-Math.PI*.55,twist:-.25,headYaw:-.6}),
   K(.58,pivot,{yaw:-Math.PI*.9,rightFoot:[-.05,.45,-.05],rightKnee:[-.3,1.1,-.5],lean:.15,headYaw:-.3}),
   K(.72,pivot,{yaw:-Math.PI,rightFoot:[0,.85,-.8],rightKnee:[-.2,.95,-.7],rightAnkle:[-.4,0,0],lean:.32,headPitch:.1,trails:[0,0,1],hitStop:1}),
   K(.78,pivot,{yaw:-Math.PI,rightFoot:[0,.85,-.8],rightKnee:[-.2,.95,-.7],rightAnkle:[-.4,0,0],lean:.32,headPitch:.1,trails:[0,0,1],hitStop:1}),
   K(1.0,pivot,{yaw:-Math.PI*1.4,rightFoot:[.05,.4,.05],rightKnee:[-.3,1.1,.6],lean:.1}),K(1.35,guard,{yaw:-Math.PI*2,crouch:.18}),K(1.8,guard,{yaw:-Math.PI*2})],
   [{at:.72,type:'impact',limb:'rightFoot',strength:.85}]),
  // 21 High kick: a short step, hips open, leg arcs to head height, opposite arm balances.
  highKick:move('High kick',[
   K(0,guard,{}),K(.2,guard,{leftFoot:[0,.04,.2],travel:[0,.08],crouch:.12}),K(.36,guard,{travel:[0,.1],crouch:.1,rightFoot:[-.15,.5,.25],rightKnee:[-.6,1.2,.6],hipYaw:.2,twist:.2}),
   K(.5,guard,{travel:[0,.1],rightFoot:[.05,1.5,.42],rightKnee:[-.5,1.3,.7],rightAnkle:[.2,0,-.2],hipYaw:.3,twist:.35,lean:-.1,bank:.12,left:[.45,1.1,-.1],right:[-.35,1.25,.15],trails:[0,0,1],hitStop:1}),
   K(.56,guard,{travel:[0,.1],rightFoot:[.05,1.5,.42],rightKnee:[-.5,1.3,.7],rightAnkle:[.2,0,-.2],hipYaw:.3,twist:.35,lean:-.1,bank:.12,left:[.45,1.1,-.1],right:[-.35,1.25,.15],trails:[0,0,1],hitStop:1}),
   K(.74,guard,{travel:[0,.1],rightFoot:[-.1,.4,.2],rightKnee:[-.5,1.2,.6],crouch:.12}),K(1.1,guard,{travel:[0,.1]})],[{at:.5,type:'impact',limb:'rightFoot',strength:.7}]),
  // 40 Heavy kick: setup step, hard hip rotation, full extension at peak speed, follow-through and a small spin to recover.
  heavyKick:move('Heavy kick',[
   K(0,guard,{}),K(.25,guard,{leftFoot:[.05,.04,.18],travel:[0,.08],crouch:.14,headYaw:.2}),K(.45,pivot,{yaw:Math.PI*.2,travel:[0,.1],crouch:.1,rightFoot:[.05,.4,.1],rightKnee:[-.4,1.2,.7],twist:-.2,hipYaw:-.1}),
   K(.6,pivot,{yaw:Math.PI*.55,travel:[0,.1],rightFoot:[.2,.95,.75],rightKnee:[-.2,1.0,.8],rightAnkle:[-.3,0,-.1],lean:.05,bank:-.2,twist:.1,left:[.5,1.15,-.2],right:[-.25,1.3,.1],trails:[0,0,1],hitStop:1}),
   K(.66,pivot,{yaw:Math.PI*.55,travel:[0,.1],rightFoot:[.2,.95,.75],rightKnee:[-.2,1.0,.8],rightAnkle:[-.3,0,-.1],lean:.05,bank:-.2,twist:.1,left:[.5,1.15,-.2],right:[-.25,1.3,.1],trails:[0,0,1],hitStop:1}),
   K(.85,pivot,{yaw:Math.PI*.95,travel:[0,.1],rightFoot:[.3,.6,.1],rightKnee:[-.2,1.1,.5],bank:-.12,trails:[0,0,.3]}),K(1.2,guard,{yaw:Math.PI*2,travel:[0,.1],crouch:.18,lean:.1}),K(1.7,guard,{yaw:Math.PI*2,travel:[0,.1]})],
   [{at:.6,type:'impact',limb:'rightFoot',strength:1}]),
  // 36 Air combo: straight, hook, knee, roundhouse, hammer, brief hover.
  airCombo:move('Air combo',[
   K(0,guard,{}),K(.3,guard,{crouch:.18}),K(.6,air,{lift:.5}),
   K(.78,air,{lift:.5,twist:.3,hipYaw:.12,right:[-.08,1.34,.5],shoulderDrive:.2,trails:[0,1,0],hitStop:1}),K(.84,air,{lift:.5,twist:.3,hipYaw:.12,right:[-.08,1.34,.5],shoulderDrive:.2,trails:[0,1,0],hitStop:1}),
   K(1.02,air,{lift:.5,twist:-.35,hipYaw:-.15,left:[-.1,1.2,.35],leftElbow:[.8,1.15,.05],trails:[1,0,0],hitStop:1}),K(1.08,air,{lift:.5,twist:-.35,hipYaw:-.15,left:[-.1,1.2,.35],leftElbow:[.8,1.15,.05],trails:[1,0,0],hitStop:1}),
   K(1.3,air,{lift:.55,leftFoot:[.05,.55,.4],rightFoot:[-.02,.0,-.2],lean:.25,left:[.3,1.2,.1],right:[-.3,1.2,.1],trails:[0,0,1],hitStop:1}),K(1.36,air,{lift:.55,leftFoot:[.05,.55,.4],rightFoot:[-.02,.0,-.2],lean:.25,left:[.3,1.2,.1],right:[-.3,1.2,.1],trails:[0,0,1],hitStop:1}),
   K(1.6,air,{lift:.6,yaw:Math.PI*.6,twist:-.2,rightFoot:[.2,.5,.2],rightKnee:[-.2,1.3,.8]}),
   K(1.8,air,{lift:.6,yaw:Math.PI*1.3,bank:-.15,rightFoot:[.15,.8,.8],rightKnee:[-.15,1.2,.8],rightAnkle:[-.25,0,-.1],trails:[0,0,1],hitStop:1}),K(1.86,air,{lift:.6,yaw:Math.PI*1.3,bank:-.15,rightFoot:[.15,.8,.8],rightKnee:[-.15,1.2,.8],rightAnkle:[-.25,0,-.1],trails:[0,0,1],hitStop:1}),
   K(2.15,air,{lift:.65,yaw:Math.PI*2,left:[.2,1.75,.2],right:[-.2,1.75,.2],leftElbow:[.7,1.6,-.2],rightElbow:[-.7,1.6,-.2],lean:-.1}),
   K(2.32,air,{lift:.5,yaw:Math.PI*2,left:[.12,.95,.5],right:[-.12,.95,.5],lean:.35,headPitch:.3,trails:[1,1,0],hitStop:1}),K(2.38,air,{lift:.5,yaw:Math.PI*2,left:[.12,.95,.5],right:[-.12,.95,.5],lean:.35,headPitch:.3,trails:[1,1,0],hitStop:1}),
   K(2.8,float,{lift:.45,yaw:Math.PI*2,fist:.5}),K(3.2,float,{lift:.4,yaw:Math.PI*2})],
   [{at:.78,type:'impact',limb:'rightHand',strength:.5},{at:1.02,type:'impact',limb:'leftHand',strength:.55},{at:1.3,type:'impact',limb:'leftFoot',strength:.6},{at:1.8,type:'impact',limb:'rightFoot',strength:.8},{at:2.32,type:'impact',limb:'rightHand',strength:.9}],true),
  // 42 Hard landing: drop in, one leg first, deep compression, hand brushes the ground, stand into stance.
  hardLanding:move('Hard landing',[
   K(0,guard,{}),K(.3,guard,{crouch:.2}),K(.6,air,{lift:.9,lean:.05}),K(.9,air,{lift:.6,lean:.1,leftFoot:[.03,.05,.15],rightFoot:[-.02,.2,-.1]}),
   K(1.05,guard,{crouch:.38,lean:.35,hipShift:[0,.05],leftFoot:[.03,0,.15],rightFoot:[-.05,.08,-.15],left:[.3,.55,.35],right:[-.3,1.0,.2],headPitch:.3,hitStop:1}),K(1.15,guard,{crouch:.38,lean:.35,hipShift:[0,.05],leftFoot:[.03,0,.15],rightFoot:[-.05,.08,-.15],left:[.3,.55,.35],right:[-.3,1.0,.2],headPitch:.3,hitStop:1}),
   K(1.5,guard,{crouch:.3,lean:.25,left:[.3,.7,.35],headPitch:-.05}),K(2.1,guard,{})],[{at:1.05,type:'landing',strength:.9}]),
  // 43 Three-point landing: foot, knee, hand; head down, then look up slowly and push to standing.
  threePoint:move('Three-point landing',[
   K(0,guard,{}),K(.3,guard,{crouch:.2}),K(.6,air,{lift:1.0,lean:.1}),K(.95,air,{lift:.55,lean:.2,leftFoot:[.08,.05,.2],rightFoot:[-.1,.15,-.3]}),
   K(1.1,guard,{crouch:.5,lean:.45,hipShift:[0,.02],leftFoot:[.08,0,.2],rightFoot:[-.12,.06,-.35],rightKnee:[-.4,.3,.6],left:[.3,1.0,.1],right:[-.25,.06,.3],rightElbow:[-.5,.6,.2],headPitch:.55,hitStop:1}),
   K(1.25,guard,{crouch:.5,lean:.45,hipShift:[0,.02],leftFoot:[.08,0,.2],rightFoot:[-.12,.06,-.35],rightKnee:[-.4,.3,.6],left:[.3,1.0,.1],right:[-.25,.06,.3],rightElbow:[-.5,.6,.2],headPitch:.55,hitStop:1}),
   K(1.9,guard,{crouch:.5,lean:.4,leftFoot:[.08,0,.2],rightFoot:[-.12,.06,-.35],rightKnee:[-.4,.3,.6],left:[.3,1.0,.1],right:[-.25,.06,.3],rightElbow:[-.5,.6,.2],headPitch:-.1}),
   K(2.5,guard,{crouch:.25,lean:.15,rightFoot:[-.05,.02,-.2]}),K(3.0,guard,{})],[{at:1.1,type:'landing',strength:1}]),
  // 57 Confident reset: shoulders drop, arms relax, a foot slides back, hands slowly return to guard.
  reset:move('Confident reset',[
   K(0,guard,{}),K(.5,stance,{shoulderLift:-.04,lean:-.02,headPitch:-.03,fist:.2,footControl:1,leftFoot:[.0,0,.03],rightFoot:[0,0,-.03]}),
   K(1.3,stance,{shoulderLift:-.03,fist:.1,footControl:1,leftFoot:[.0,0,.03],rightFoot:[0,0,-.03],headYaw:.05}),K(2.2,guard,{fist:.4})]),
  // 1 Relaxed idle: weight shifts foot to foot, a glance around, breathing comes from the rig.
  relaxedIdle:move('Relaxed idle',[
   K(0,stance,{hipShift:[.03,0],crouch:.04,fist:.1}),K(2.2,stance,{hipShift:[-.03,.01],crouch:.045,headYaw:.14,fist:.1}),K(4.4,stance,{hipShift:[.03,0],crouch:.04,headYaw:-.08,fist:.1}),K(6.0,stance,{hipShift:[0,0],fist:.1})],[],true),
  // 2 Alert: head turns first, chest follows a few degrees, hands come up, weight onto the balls of the feet.
  alert:move('Alert',[
   K(0,stance,{fist:.1}),K(.3,stance,{headYaw:.5,fist:.15}),K(.7,stance,{headYaw:.5,twist:.15,shoulderLift:.04,fist:.4,crouch:.07,left:[.4,1.05,.2],right:[-.4,1.05,.18]}),
   K(1.3,guard,{headYaw:.25,crouch:.1}),K(2.0,guard,{})]),
  // 3 Stretch shoulders: one arm across the chest, the other forearm pulls it in; torso turns; then the other side.
  stretch:move('Shoulder stretch',[
   K(0,stance,{fist:.1}),K(.7,stance,{left:[-.3,1.32,.3],leftElbow:[.2,1.3,.4],right:[-.05,1.28,.42],rightElbow:[-.7,1.0,.5],twist:.18,fist:.2}),
   K(2.0,stance,{left:[-.34,1.33,.3],leftElbow:[.2,1.3,.4],right:[-.06,1.3,.44],rightElbow:[-.7,1.0,.5],twist:.22,fist:.2}),K(2.7,stance,{fist:.1}),
   K(3.4,stance,{right:[.3,1.32,.3],rightElbow:[-.2,1.3,.4],left:[.05,1.28,.42],leftElbow:[.7,1.0,.5],twist:-.18,fist:.2}),
   K(4.7,stance,{right:[.34,1.33,.3],rightElbow:[-.2,1.3,.4],left:[.06,1.3,.44],leftElbow:[.7,1.0,.5],twist:-.22,fist:.2}),K(5.4,stance,{fist:.1})]),
  // 4 Neck warm-up: tilt left, centre, tilt right, centre, look down, lift, a small roll.
  neckRoll:move('Neck warm-up',[
   K(0,stance,{fist:.1}),K(.6,stance,{headYaw:.55,fist:.1}),K(1.1,stance,{fist:.1}),K(1.7,stance,{headYaw:-.55,fist:.1}),K(2.2,stance,{fist:.1}),
   K(2.8,stance,{headPitch:.5,fist:.1}),K(3.6,stance,{headPitch:-.1,fist:.1}),K(4.0,stance,{headPitch:.25,headYaw:.3,fist:.1}),K(4.4,stance,{headPitch:-.15,headYaw:0,fist:.1}),K(4.8,stance,{headPitch:.25,headYaw:-.3,fist:.1}),K(5.4,stance,{fist:.1})]),
  // 5 Wrist warm-up: hands in front of the torso, rotate out and in, open and close, a small shake.
  wristWarmup:move('Wrist warm-up',[
   K(0,stance,{fist:.1}),K(.5,stance,{left:[.16,1.12,.38],right:[-.16,1.12,.38],leftElbow:[.6,.9,.3],rightElbow:[-.6,.9,.3],fist:.2}),
   K(1.0,stance,{left:[.2,1.1,.38],right:[-.2,1.1,.38],leftElbow:[.6,.9,.3],rightElbow:[-.6,.9,.3],fist:.1}),K(1.5,stance,{left:[.12,1.14,.38],right:[-.12,1.14,.38],leftElbow:[.6,.9,.3],rightElbow:[-.6,.9,.3],fist:.3}),
   K(2.0,stance,{left:[.16,1.12,.38],right:[-.16,1.12,.38],leftElbow:[.6,.9,.3],rightElbow:[-.6,.9,.3],fist:1}),K(2.4,stance,{left:[.16,1.12,.38],right:[-.16,1.12,.38],leftElbow:[.6,.9,.3],rightElbow:[-.6,.9,.3],fist:0}),
   K(2.7,stance,{left:[.16,1.12,.38],right:[-.16,1.12,.38],leftElbow:[.6,.9,.3],rightElbow:[-.6,.9,.3],fist:1}),K(3.0,stance,{left:[.17,1.1,.4],right:[-.17,1.1,.4],leftElbow:[.6,.9,.3],rightElbow:[-.6,.9,.3],fist:.2,tension:.6}),
   K(3.3,stance,{left:[.15,1.13,.37],right:[-.15,1.13,.37],leftElbow:[.6,.9,.3],rightElbow:[-.6,.9,.3],fist:.2,tension:.6}),K(3.9,stance,{fist:.1})]),
  transformation:move('Transformation stance',[
   K(0,stance,{},'powerup','Begin','powerHero'),K(.7,loaded,{headPitch:.30,lean:.10,power:.35},'powerup','Bow head, hunch shoulders, bend knees','powerHero'),
   K(2.0,loaded,{headPitch:.30,lean:-.03,power:.65,tension:.9},'powerup','Lift chest gradually, keep head bowed','powerHero'),
   K(3.0,dominant,{headPitch:.22,power:.9,tension:.9},'powerup','Spread arms into wide stance','powerHero'),K(4.3,dominant,{headPitch:-.08},'powerup','Head rises last','heroClose')],[{at:3.0,type:'surge',strength:.8}],true),
 };
}
