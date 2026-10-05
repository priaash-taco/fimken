import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MToonMaterial } from '@pixiv/three-vrm';
import { CharacterLook } from '../src/engine/character-look.js';

test('character finish preserves authored textures and restores original material values',()=>{
 const texture=new THREE.Texture();
 const material=new MToonMaterial({map:texture});material.name='cloth';
 material.outlineWidthMode='worldCoordinates';material.outlineWidthFactor=.003;
 const original={shade:material.shadeColorFactor.clone(),rim:material.parametricRimColorFactor.clone(),gi:material.giEqualizationFactor};
 const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BufferGeometry(),material));
 const look=new CharacterLook(root,{cloth:'cloth'});
 look.apply('cinematic');assert.equal(material.map,texture);
 assert.notDeepEqual(material.shadeColorFactor,original.shade);
 look.apply('cinematic',true);assert.equal(material.parametricRimColorFactor.getHex(),0);
 look.apply('authored',false);
 assert.deepEqual(material.shadeColorFactor,original.shade);
 assert.deepEqual(material.parametricRimColorFactor,original.rim);
 assert.equal(material.giEqualizationFactor,original.gi);
 assert.equal(material.outlineWidthFactor,.003);assert.equal(material.map,texture);
});
test('outline control respects disabled eye outlines and is reversible',()=>{
 const eye=new MToonMaterial();eye.name='eye';eye.outlineWidthMode='none';eye.outlineWidthFactor=.5;
 const hair=new MToonMaterial();hair.name='hair (Outline)';hair.outlineWidthMode='worldCoordinates';
 const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BufferGeometry(),eye),new THREE.Mesh(new THREE.BufferGeometry(),hair));
 const look=new CharacterLook(root,{eye:'eye',hair:'hair'});look.apply('cinematic');
 const width=hair.outlineWidthFactor;look.setOutlineScale(0);assert.equal(hair.outlineWidthFactor,0);
 assert.equal(eye.outlineWidthMode,'none');assert.equal(eye.outlineWidthFactor,.5);
 look.setOutlineScale(1);assert.equal(hair.outlineWidthFactor,width);
});
