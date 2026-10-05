# Goku movement bible

Supplied by the user on 5 October 2026 as the reference vocabulary for the hero's motion and for
how sound should call moves. Each numbered entry is a reusable state or short sequence to blend,
not one long choreography. Items marked [built] exist in `src/engine/staged-moves.js` /
`showcase-director.js`; the rest are the backlog.

## Rules

> Never move the character as a rigid doll. Every major action originates through a kinetic chain:
> feet -> hips -> spine -> shoulder -> elbow -> wrist/hand, with the head tracking the target
> independently. Anticipation before explosive motion, overshoot after it, a short recovery after.

> Do not animate everything at the same speed. Calm movements ease naturally. Combat uses brief
> anticipation, very rapid acceleration, very short impact holds, slower recoveries. Strong attacks
> hold 1-3 frames of exaggerated impact/overshoot at 60 fps.

## Sound mapping (target)

energy rises -> power_up · beat drop -> dash · bass hit -> heavy_punch · sustained vocal -> hover ·
crescendo -> charge_beam. Implemented: section picks the pool; beats start moves, fit their rate and pulse the body;
bass hit -> heavy punch; crescendo -> charge and beam; drop -> dash; held tone -> hover (soft moves only are interrupted).

## Library

1. Neutral standing, relaxed: shoulder-width feet, weight on one leg, knees unlocked, loose arms, relaxed hands, breathing chest and shoulders, upright head, occasional glance, weight shift every few seconds, secondary hair/cloth. Loops. [partly built: stance] [built: relaxedIdle]
2. Neutral standing, alert: head turns to target first, chest follows a few degrees, feet planted, hands tense, shoulders rise, weight to balls of feet, finish looking at opponent. [built: alert]
3. Stretch shoulders: raise arms, cross one across chest, pull with other forearm, rotate torso, release, other side. [built: stretch]
4. Neck warm-up: tilt left, centre, tilt right, centre, look down, lift slowly, small roll. [built: neckRoll]
5. Wrist warm-up: hands before torso, rotate out, rotate in, open/close hands, small shake. [built: wristWarmup]
6. Combat bounce: feet wider than idle, rhythmic knee flex, fractional heel raise, alternating weight, hands at rib/chest, loose torso, head locked on. Subtle loop. [partly built: beat pulse] [built: bounce]
7. Basic fighting stance: lead foot forward, rear foot turned out, knees bent, pelvis low, torso 15-25 deg off centre, lead hand forward, rear hand near jaw, elbows relaxed, shoulders low, head on target. [built: guard]
8. Stance transition left/right: weight through hips, rear foot slides, front foot pivots, torso follows, hands ready, never snap the whole body.
9. Forward training step: front foot advances, rear follows, keep width, steady upper body. [built: stepForward]
10. Backward training step: rear foot first, front follows, weight centred, no crossing. [built: stepBack]
11. Side shuffle: lead foot first, other catches up, knees flexed, slight shoulder sway, head tracks. [built: shuffle]
12. Slow shadowboxing jab: lead shoulder rolls, elbow drives behind fist, wrist straightens, extend, rear hand guards, slight torso turn, fast retraction on same path. [built: strikes jab]
13. Cross: rear heel rotates, rear hip drives, torso rotates, shoulder follows, extend, lead hand guards face, snap back. [built: strikes cross]
14. Jab-cross combination: jab, recoil, rear foot/hip load, cross, shoulder overshoot, reset, repeat faster.
15. Body hook: dip, load same-side hip, elbow bent, hips rotate hard, fist arcs horizontally, shoulder follows, recoil. [built: strikes hook]
16. Uppercut: knees compress, fist drops, hips drive up, torso rotates, elbow under hand, vertical acceleration, finish at chin height. [built: strikes uppercut]
17. Training punch flurry: jab, cross, left hook, right body shot, uppercut, two rapid straights, pause, reset.
18. Front kick: weight to support leg, knee first, foot snaps out, torso leans back, fast retract, foot back to stance. [built: frontKick]
19. Roundhouse kick: head looks first, support foot pivots, knee rises sideways, hip turns over, lower leg extends, whip through, retract, rotate back. [partly built: spin]
20. Spinning back kick: look over shoulder, front foot pivots, hips rotate, rear leg chambers, heel drives back, upper body counterbalances, smooth recovery. [built: backKick]
21. High training kick: short step, hips open, leg arcs to head height, opposite arm balances, quick return. [built: highKick]
22. Training combo: jab, cross, duck, body hook, step, knee strike, roundhouse, land, two punches, step back.
23. Defensive slip: head and shoulders just outside the line, spine flexes, hips barely move, hands ready, recover at once.
24. Duck / weave: knees bend, torso lowers, head passes under, weight across hips, rise on the other side.
25. Forearm block: shoulder rotates in, forearm across body, other hand guards, body turns with impact, small recoil.
26. Two-arm energy block: forearms cross before face/chest, knees compress, hips back, spine leans away, arms shake, feet slide back, arms separate to recover.
27. Combat idle: fighting stance, breathing, tiny weight changes, hand adjustments, eyes/head follow, occasional shoulder roll, subtle fore/aft drift. [built: combatIdle]
28. Quick dash forward: brief crouch, torso tips, front foot pushes, arms trail, rapid translation, knees bend on arrival, upper body catches up last. [built: dash]
29. Quick dash backward: head/chest move first, rear leg pushes, fast translation, feet settle under centre, hands straight to guard.
30. Anime side vanish: compress down, twist toward destination, one anticipation frame, extremely fast lateral move, streamlined, arrive knees flexed, head reacquires at once. [built: vanish]
31. Flying start: knees bend, torso lowers, arms back, explosive extension, feet leave ground, body straightens into flight, arms settle. [partly built: flight takeoff]
32. Fast forward flight: torso near horizontal, head lifted to see, arms close or one forward, legs behind, small oscillation, banking from shoulders and hips together. [built: flight]
33. Hover: upright, feet off ground, knees slightly bent, toes down, arms float, slow vertical oscillation, head tracks, hair/cloth/aura upward. [built: hover]
34. Mid-air fighting stance: torso forward, one knee higher, asymmetric feet, hands up, slight lateral float, constant small reorientation. [built: airborne]
35. Flying punch: accelerate, punching arm back, other arm balances, shoulder rotates just before contact, arm snaps, rear leg extends back, continue through, aerial guard. [built: flying]
36. Air combo: flying straight, opposite hook, knee, torso rotate, roundhouse, reorient, downward hammer, brief hover. [built: airCombo]
37. Heavy punch wind-up: feet widen, shoulder retracts, heavy torso rotation, rear hip loads, fist by ribs, anticipation hold, eyes fixed. [built: heavy load]
38. Heavy punch release: rear leg drives, hip snaps, torso follows, shoulder accelerates, fist reaches full extension late, head stable, overshoot, strong recoil/reset. [built: heavy]
39. Rapid punch barrage: stable lower body, chest rotates subtly, extremely fast alternating punches, elbows never lock, shoulders drive rhythm, finish with one heavy straight.
40. Heavy kick: short setup step, plant, hips rotate hard, chamber, full extension at peak speed, upper body leans opposite, follow through, small spin to recover. [built: heavyKick]
41. Knockback reaction: head and chest first, arms open, torso folds or arches, hips follow later, feet lose position, travel back, unstable recovery. [built: reaction]
42. Hard landing: one leg first, deep knee, other foot plants, hand may touch ground, torso low, head raises, stand into stance. [built: hardLanding]
43. Three-point landing: one foot, opposite knee down, one hand on ground, shoulder absorbs, head down briefly, look up slowly, push to standing. [built: threePoint]
44. Power-up initial: neutral, feet slide wider, knees flex, fists close gradually, wrists rotate in, elbows bend, fists near hips, head lowers, shoulders contract. [built: powerup 0-1.5s]
45. Power-up build: chest expands, spine straightens, elbows out, forearms tense, fists squeeze, whole-body vibration absorbed by knees, head stays low. [built: powerup 1.5-2.5s]
46. Power-up peak: head lifts, chest opens, arms outward, shoulders broaden, spine extends, body rises, dominant wide hold, irregular tremors. [built: powerup 2.5-3.5s]
47. Transformation explosive power-up: crouched, fists clenched, head down, shoulders shake, knees straighten progressively, chest rises, arms part slowly, sudden full extension, head snaps up, hold. [built: transformation]
48. Energy sphere charge: torso sideways, rear foot steps out, elbows bend, hands to rear hip, palms oppose around a fixed virtual sphere, shoulders compress, head to target, spine curves around sphere, tension grows. [built: charge]
49. Large energy charge: as above, hands farther apart, elbows out, torso leans into force, feet wider, forearm vibration, chest/face respond to light, longer hold.
50. Beam release: anticipation freeze, rear hip rotates, hips drive, chest follows, shoulders drive, hands accelerate hip to target, elbows straighten, spine leans, rear heel lifts, full extension, recoil, sustained firing pose. [built: blast]
51. Beam struggle: hands extended, elbows bend under pressure, shoulders vibrate, feet slide back, deeper knees, spine alternates compression/extension, push forward again, head lowers with effort, sudden final extension when winning.
52. One-hand energy blast: arm pulls back, wrist rotates, palm opens, shoulder drives, arm snaps straight, palm stays open, small recoil, return to guard.
53. Double palm blast: elbows retract, hands beside ribs, palms forward, shoulders tense, both arms thrust, chest recoils.
54. Energy throw: energy ball near hand, shoulder back, torso rotates, throwing swing, wrist snap at release, follow-through across body.
55. Teleport / instant movement: combat idle, two-finger gesture near forehead if rig permits, head locks destination, very still beat, disappear, reappear already in stance, minimal settling.
56. Opponent tracking: eyes/head follow, neck reaches limit, chest follows, hips only if farther, feet last. Never rotate the model as one unit. [partly built: look-at]
57. Confident reset: shoulders drop, arms relax, exhale, one foot slides back to neutral, head stays on opponent, hands slowly return to guard. [built: reset]
58. Training exhaustion: torso leans forward, hands on thighs, bigger breathing, head hangs, straighten gradually, roll shoulders, back to stance.
59. Calm post-fight: arms relax, feet narrow, breathing slows, look at defeated opponent, head lifts, relaxed posture, back to neutral.
60. Full showcase sequence: 0-5 relaxed idle; 5-10 stretches; 10-18 stance and footwork; 18-25 jab-cross-hook-uppercut; 25-32 kicks; 32-38 defence; 38-44 dash/vanish; 44-50 flying/hover; 50-58 aerial combo; 58-65 heavy punch and knockback; 65-72 power-up; 72-80 charge; 80-84 beam; 84-90 hover recovery; 90-95 hero stance.
