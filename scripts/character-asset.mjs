import { createHash } from 'node:crypto';
export const REQUIRED_STATES = ['idle','anticipation','walk','run','gesture','turn','jump','float','land','powerup','charge','blast','recover','punch','kick','impact','hero'];
export function inspectGLB(bytes) {
  if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw new Error('Expected a complete binary glTF 2.0 file.');
  let json, binary;
  for (let offset=12; offset<bytes.length;) {
    if (offset+8>bytes.length) throw new Error('Truncated GLB chunk.');
    const length=bytes.readUInt32LE(offset), type=bytes.readUInt32LE(offset+4);
    if (offset+8+length>bytes.length) throw new Error('Invalid GLB chunk length.');
    const chunk=bytes.subarray(offset+8,offset+8+length);
    if(type===0x4e4f534a) json=JSON.parse(chunk.toString('utf8').trim());
    if(type===0x004e4942) binary=chunk;
    offset+=8+length;
  }
  if(!json || !binary) throw new Error('The GLB must embed its JSON and binary data.');
  if((json.buffers||[]).length!==1 || json.buffers[0].uri || json.buffers[0].byteLength>binary.length) throw new Error('Embed all buffers in the GLB before importing.');
  for(const view of json.bufferViews||[]) if(view.buffer!==0 || (view.byteOffset||0)+view.byteLength>binary.length) throw new Error('Invalid buffer view.');
  const errors=[],warnings=[];
  for(const extension of json.extensionsRequired||[]) {
    if(['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(extension)) errors.push(`Decode ${extension} in Blender before import; this runtime has no decoder configured.`);
  }
  const skins=json.skins||[], nodes=json.nodes||[], images=json.images||[], materials=json.materials||[];
  if(!skins.length) errors.push('No skeleton/skin. A static generated mesh still needs rigging.');
  for(const skin of skins) if(!skin.joints?.length || skin.joints.some(i=>!nodes[i])) errors.push('Skin has invalid joint references.');
  let skinnedPrimitives=0,vertices=0,triangles=0;
  for(const node of nodes) {
    if(node.mesh===undefined) continue;
    const mesh=json.meshes?.[node.mesh];
    if(!mesh) {errors.push('Invalid mesh reference.');continue;}
    for(const p of mesh.primitives) {
      const position=json.accessors?.[p.attributes?.POSITION];
      if(!position || !Number.isFinite(position.count)) {errors.push('Missing vertex positions.');continue;}
      vertices+=position.count;
      triangles+=(p.indices===undefined?position.count:json.accessors[p.indices]?.count||0)/3;
      if(node.skin!==undefined) {
        skinnedPrimitives++;
        if(!skins[node.skin]) errors.push('Invalid skin on a mesh node.');
        for(const attribute of ['JOINTS_0','WEIGHTS_0']) {
          const a=json.accessors?.[p.attributes?.[attribute]];
          if(!a || a.count!==position.count || a.type!=='VEC4') errors.push(`Missing or mismatched ${attribute}.`);
        }
      }
      if(p.attributes?.TEXCOORD_0===undefined) warnings.push('A mesh primitive has no primary UV set.');
    }
  }
  if(!skinnedPrimitives) errors.push('No mesh is attached to a skeleton.');
  if(!images.length) errors.push('No embedded material artwork.');
  for(const image of images) if(image.uri || image.bufferView===undefined || !json.bufferViews[image.bufferView]) errors.push('Embed every texture image before importing.');
  if(!materials.some(m=>m.pbrMetallicRoughness?.baseColorTexture || m.extensions?.VRMC_materials_mtoon)) errors.push('No textured or authored toon material found.');
  const animations=(json.animations||[]).map(a=>a.name);
  if(animations.some(n=>!n) || new Set(animations).size!==animations.length) errors.push('Animation clips need unique names.');
  if(!animations.length) warnings.push('No animation clips; acceptable for staging, not for runtime promotion.');
  return {json, report:{sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,vertices,triangles:Math.round(triangles),skins:skins.length,skinnedPrimitives,materials:materials.map(m=>m.name||'(unnamed)'),embeddedImages:images.length,animations,bones:skins.flatMap(s=>s.joints.map(i=>nodes[i]?.name)),errors:[...new Set(errors)],warnings:[...new Set(warnings)],visualQuality:'Not established by structural validation. Requires neutral-light and deformation review.'}};
}
export function validateManifest(manifest, report, promote=false) {
  const errors=[...report.errors];
  if(!/^[a-z][a-z0-9-]{1,63}$/.test(manifest.id||'')) errors.push('Use a lowercase character id with hyphens.');
  if(!manifest.name || manifest.provenance?.kind!=='external' || !manifest.provenance.source || !manifest.provenance.license) errors.push('Provide the external source, license and character name.');
  if(!Number.isFinite(manifest.height) || manifest.height<=0 || !Number.isFinite(manifest.facing)) errors.push('Provide a positive height and numeric facing angle.');
  if(manifest.shading!=='authored') errors.push('Preserve imported materials with shading: authored.');
  for(const [state,clip] of Object.entries(manifest.clips||{})) if(!report.animations.includes(clip)) errors.push(`Mapped clip is missing: ${state} -> ${clip}`);
  for(const [role,bone] of Object.entries(manifest.bones||{})) if(!report.bones.includes(bone)) errors.push(`Mapped bone is missing: ${role} -> ${bone}`);
  if(promote) {
    for(const state of REQUIRED_STATES) if(!manifest.clips?.[state]) errors.push(`Production clip mapping missing: ${state}`);
    for(const role of ['head','rightHand']) if(!manifest.bones?.[role]) errors.push(`Production bone mapping missing: ${role}`);
    if(!manifest.review?.neutralLight || !manifest.review?.deformation || !manifest.review?.sourceTerms) errors.push('Complete neutral-light, deformation and source-terms review before promotion.');
  }
  return [...new Set(errors)];
}
