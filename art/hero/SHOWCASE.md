# Hero showcase

The active model remains `public/characters/imported/meshy-hero/455844cbad360431.glb`. No geometry, source textures or paid assets were changed.

## Controls
Open Settings > Showcase. Power up and Beam release play once and settle. Energy charge and Hover idle hold their final pose with breathing/drift. Hero pose selects power stance, airborne combat, charging or release. Pause freezes motion and VFX; orbit remains available. Neutral view removes effects, grading, energy lights and cinematic shading. Advanced offers original materials, ink width and quality.

## Implementation
- `showcase-director.js`: pose-key data, eased transitions, interruption blending, held poses and a release event.
- `hero-rig-controls.js`: rest-relative torso/shoulder/head control, reach-clamped analytic arm/leg IK with elbow/knee poles, world-space foot locking, wrist orientation, breathing/tremor and hover.
- `hero-finish.js`: bounded cel treatment over original PBR textures, skinned silhouette outlines; reversible via Original materials or neutral inspection.
- VFX and lighting read the same timeline's charge/release signals. The orb and point light follow the actual solved wrist midpoint; the beam follows the hero's aim. Bloom, rising ribbons, lightning, spiral sparks and ground shockwave remain code-driven.
- High quality preserves up to 3840 x 2160 render pixels (1.5x minimum supersampling where budget permits). Balanced/Performance adapt resolution. This is not an 8K texture upgrade or a 4K frame-rate guarantee.

## Limitations
The 21-bone rig has no articulated fingers or face. Wrist placement/orientation is procedural, but finger shapes remain authored. Upper-body deformations and hand overlap should be reviewed before adding extreme moves. This is a focused showcase, not a combat/locomotion system.


## Action sequence
Settings > Showcase > Action sequence plays a 9.8-second one-shot: guard, three open-hand strikes, pivot spin kick, aerial dash, planted stop, charge, beam and recovery. The existing non-articulated fingers cannot form fists.

Advanced > Playback speed offers normal, half and quarter speed. Review action pose scrubs to an exact timestamp and pauses without firing impact cues. Resume continues from that pose. Neutral view and a disabled cinematic camera allow a motion-only review.

New pose channels include hip rotation, root travel, unwrapped turn angle, planted-foot pivot, ankle orientation, foot and knee targets, impact holds and per-limb trail weights. Cue data synchronizes camera kicks, strike pulses, landing rings and beam release. Interruptions blend the turn angle along the shortest path; changing moves or resetting never leaves a stale effect trail. This remains a solo choreography showcase, not opponent collision or damage simulation.


## Automatic training and effects pass

The normal page starts automatic training (unless reduced motion or inspection is active). Auto chooses complete strikes, spins, dashes, hover/landing, power-up and beam gestures without immediately repeating a move. Music energy influences selection and energy pulses. Manual actions interrupt Auto; the Auto button resumes it.

`HeroMotionPhysics` supplies bounded root locomotion with 120 Hz steps, acceleration/speed limits, damped braking, gravity and floor contacts. The existing IK/pose layers still control the limbs. This is solo choreographed motion, not a ragdoll or opponent combat simulator. Finger articulation is still unavailable in the current rig.

The power-up uses staggered pointed flame geometry, reduced front opacity, blue lightning, sparks, light response and surge cues. The beam has a rapidly travelling front and a slower widening envelope, with a growing hand emitter and outward pressure rings. Its radius grows for the first 1.25 seconds and tapers with the animation.

High quality preserves the presented canvas, uses restrained FXAA subpixel blending and up to 16x anisotropy on all texture maps. Offscreen MSAA was removed after blank-frame capture diagnostics. Adaptive resolution only resizes internal work buffers before rendering, never the presented canvas. Bloom is narrower and restrained; GLB images remain unchanged. Runtime graphics diagnostics and pose review are still accessible at `/?debug=1`; the normal interface exposes only actions and essential audio/display controls.


Camera changes now interpolate position, target and FOV instead of cutting on every action phase. Lightning fades in and out, tremor and camera shake are restrained. Frame captures verified no blank frames after the presentation-buffer correction.

The cosmic backdrop contains a 4096 x 2048 baked nebula/star map, a separate textured lunar sphere, a textured emissive sun and corona, and nearby stars for parallax. The nebula/star map is locally generated with `scripts/build-cosmos.py`. Lunar color and normal maps now use NASA LROC/LOLA data (see `public/environment/cosmos/CREDITS.md`); the older procedural moon is unused. `scripts/bake-solar-detail.py` bakes solar granulation and sunspot groups; a limb-darkening shader and irregular corona complete the sun. No paid service is involved. Inspection mode hides the entire cosmic environment.


## Subtle energy deformation

`EnergyMotion` adds critically damped spring response to power, charge and beam width. A bounded movement-driven offset lets the upper aura trail during travel and settle afterward; its base stays attached to the character. Charge deformation preserves volume. Core and shell share the same small travelling cross-section deformation, anchored at the hands, and pressure rings follow it. No renderer or canvas changes are involved. Pause freezes this state; reset/pose review initializes it directly to the selected pose.


Motion refinement: monotone cubic pose curves preserve velocity through ordinary keys while repeated keys retain anticipation/contact holds. Wrist cup/guard directions and hover offsets blend continuously. Chest and head follow-through use deterministic 55/95 ms offsets; planted pivots and impact holds disable idle sway.


The approved DBZ-inspired color library lives in `src/engine/palette.js` (all 51 exact sRGB swatches). VFX shaders convert these to linear RGB before separate HDR intensity scaling. Gold/yellow/cream power-up, cyan/blue/white charge and beam, yellow impacts, and purple UI/environment accents are active. Original character albedo and skin maps remain authored; other character/environment families are retained for future assets. Neutral inspection keeps white lighting and no effects.
