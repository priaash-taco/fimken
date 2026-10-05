import * as THREE from 'three';

const noise = `
float hash3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(hash3(i),hash3(i+vec3(1,0,0)),f.x),mix(hash3(i+vec3(0,1,0)),hash3(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash3(i+vec3(0,0,1)),hash3(i+vec3(1,0,1)),f.x),mix(hash3(i+vec3(0,1,1)),hash3(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise3(p)*a;p=p*2.03+7.;a*=.5;}return v;}
`;

export class SpaceWorld {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    let seed = 413;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(95, 48, 32), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      uniforms: { tint: { value: new THREE.Color('#372854') } },
      vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vDirection; uniform vec3 tint; ${noise}
      void main(){vec3 d=normalize(vDirection);float n=fbm(d*4.);float band=exp(-pow((d.y+.12-d.x*.2)*3.8,2.));vec3 col=mix(vec3(.006,.008,.019),tint,band*n*.48);col+=vec3(.06,.025,.015)*pow(n,4.);gl_FragColor=vec4(col,1.);}`,
    }));
    this.root.add(this.sky);
    const positions=[], colors=[];
    for(let i=0;i<1500;i++) {
      const a=random()*Math.PI*2, y=random()*2-1, r=70+random()*15;
      const horizontal=Math.sqrt(1-y*y);
      positions.push(Math.cos(a)*horizontal*r,y*r,Math.sin(a)*horizontal*r);
      const c=new THREE.Color().setHSL(.52+random()*.2,.2,.45+random()*.5);
      colors.push(c.r,c.g,c.b);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.root.add(new THREE.Points(geometry,new THREE.PointsMaterial({size:.07,vertexColors:true,transparent:true,opacity:.75})));
    const planetMaterial = new THREE.ShaderMaterial({
      uniforms:{ tint:{value:new THREE.Color('#68528b')} },
      vertexShader:'varying vec3 vN; varying vec3 vP; varying vec3 vEye; void main(){vec4 p=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vP=position;vEye=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
      fragmentShader:`varying vec3 vN; varying vec3 vP; varying vec3 vEye; uniform vec3 tint; ${noise}
      void main(){float n=fbm(vP*.23);float l=max(0.,dot(normalize(vN),normalize(vec3(-.8,.6,.8))));float rim=pow(1.-abs(dot(normalize(vN),normalize(vEye))),3.);vec3 c=tint*(.06+l*.45)*(.5+n*.7);c+=vec3(.25,.16,.5)*rim*.55;gl_FragColor=vec4(c,1.);}`,
    });
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(16,80,48),planetMaterial);
    this.planet.position.set(-28,15,-65);
    this.root.add(this.planet);
    const ring=new THREE.Mesh(new THREE.RingGeometry(19.3,22,150),new THREE.MeshBasicMaterial({color:'#826f97',side:THREE.DoubleSide,transparent:true,opacity:.16,depthWrite:false}));
    ring.position.copy(this.planet.position); ring.rotation.set(1.25,.4,-.35); this.root.add(ring);

    const material = new THREE.MeshStandardMaterial({ color:'#3e3441',roughness:1,flatShading:true });
    const rock = new THREE.IcosahedronGeometry(1,2);
    const attr=rock.attributes.position;
    for(let i=0;i<attr.count;i++) {
      const p=new THREE.Vector3().fromBufferAttribute(attr,i);
      const length=1+.13*Math.sin(p.x*11+p.y*7)*Math.cos(p.z*9);
      p.multiplyScalar(length);attr.setXYZ(i,p.x,p.y,p.z);
    }
    rock.computeVertexNormals();
    this.rocks=[];
    for(let i=0;i<44;i++) {
      const mesh=new THREE.Mesh(rock,material);
      const a=random()*Math.PI*2, r=7+random()*25;
      mesh.position.set(Math.cos(a)*r,-4-random()*9,Math.sin(a)*r-10);
      const scale=.35+Math.pow(random(),3)*3;
      mesh.scale.set(scale*(.7+random()),scale*(1+random()),scale);
      mesh.rotation.set(random()*6,random()*6,random()*6);
      mesh.castShadow=mesh.receiveShadow=true;
      this.rocks.push({mesh,y:mesh.position.y,phase:random()*6}); this.root.add(mesh);
    }
    // A real floating training platform, with a broken rock underside.
    const island=new THREE.Group();
    const top=new THREE.CylinderGeometry(4.8,3.7,.55,48,2);
    const pos=top.attributes.position;
    for(let i=0;i<pos.count;i++) {
      const x=pos.getX(i),z=pos.getZ(i); const variation=Math.sin(x*1.7)*Math.cos(z*1.3)*.11;
      pos.setY(i,pos.getY(i)+variation);
    }
    top.computeVertexNormals();
    const cap=new THREE.Mesh(top,new THREE.MeshStandardMaterial({color:'#4c3c41',roughness:.95,flatShading:true}));
    cap.position.y=-4.1; cap.receiveShadow=true; island.add(cap);
    for(let i=0;i<12;i++) {
      const chunk=new THREE.Mesh(rock,material); const a=i/12*Math.PI*2;
      chunk.position.set(Math.cos(a)*2.9,-5.1-random()*.5,Math.sin(a)*2.9);
      chunk.scale.set(1.6,1.8+random()*1.3,1.8); chunk.rotation.y=a; chunk.castShadow=chunk.receiveShadow=true; island.add(chunk);
    }
    this.root.add(island);
    // Thin, irregular cracks catch reflected energy close to his feet.
    this.cracks=new THREE.Group();
    for(let i=0;i<11;i++) {
      const a=i*2.399, pts=[];
      for(let j=0;j<6;j++) {const r=.8+j*.55;pts.push(new THREE.Vector3(Math.sin(a+j*.09)*r,-3.80+Math.sin(r*2)*.03,Math.cos(a+j*.09)*r));}
      this.cracks.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:'#ffbd55',transparent:true,opacity:.08})));
    }
    this.root.add(this.cracks);
  }
  setTheme(name) {
    this.sky.material.uniforms.tint.value.set(name==='eclipse'?'#203c58':'#372854');
    this.planet.material.uniforms.tint.value.set(name==='eclipse'?'#365d79':'#68528b');
  }
  update(time, power, effects) {
    for(const {mesh,y,phase} of this.rocks) {mesh.position.y=y+Math.sin(time*.25+phase)*.15;mesh.rotation.y+=.00015;}
    this.cracks.children.forEach(line=>{line.material.opacity=(.05+power*.28)*effects;});
  }
}
