import * as THREE from 'three';

export class SaiyanAura {
  constructor() {
    this.root = new THREE.Group();
    this.uniforms = { time:{value:0}, strength:{value:0}, color:{value:new THREE.Color('#ffc332')} };
    const material = new THREE.ShaderMaterial({
      uniforms:this.uniforms, transparent:true, depthWrite:false, side:THREE.DoubleSide, blending:THREE.AdditiveBlending,
      vertexShader:`uniform float time; varying vec2 vUv; void main(){vUv=uv;vec3 p=position;p.x+=sin(p.y*3.1+time*3.+p.z)*.055*uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader:`uniform float time;uniform float strength;uniform vec3 color;varying vec2 vUv;
        void main(){float x=abs(vUv.x-.5)*2.;float tip=1.-vUv.y;float w=pow(tip,.55)*(.75+.20*sin(vUv.y*22.-time*5.));float edge=1.-smoothstep(w*.1,w,x);float vertical=smoothstep(0.,.16,vUv.y)*(1.-smoothstep(.62,1.,vUv.y));float streak=.45+.55*pow(.5+.5*sin(vUv.y*19.-time*7.+vUv.x*2.),3.);float a=edge*vertical*streak*strength;gl_FragColor=vec4(mix(color,vec3(1.,.95,.68),pow(edge,8.)*.6),a*.38);}`,
    });
    for(let i=0;i<19;i++) {
      const angle=i/19*Math.PI*2;
      const height=6.8+Math.sin(i*8)*.8;
      const geometry=new THREE.PlaneGeometry(.65+Math.sin(i*13)*.18,height,4,28);
      const p=geometry.attributes.position;
      for(let j=0;j<p.count;j++) {
        const v=geometry.attributes.uv.getY(j);
        p.setX(j,p.getX(j)+Math.sin(v*Math.PI)*.14);
        p.setZ(j,Math.sin(v*Math.PI)*.2);
      }
      const ribbon=new THREE.Mesh(geometry,material);
      ribbon.position.set(Math.sin(angle)*1.5,.1,Math.cos(angle)*.85-.15);
      ribbon.rotation.y=angle;
      ribbon.rotation.z=Math.sin(angle)*-.11;
      this.root.add(ribbon);
    }
    const count=120, positions=new Float32Array(count*3);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
    this.embers=new THREE.Points(geometry,new THREE.PointsMaterial({color:'#ffe098',size:.035,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));
    this.root.add(this.embers);
    this.light=new THREE.PointLight('#ffca64',0,12,2);this.light.position.set(0,1,1);this.root.add(this.light);
  }
  update(time,power,effects,position) {
    this.root.position.copy(position);
    this.uniforms.time.value=time;
    this.uniforms.strength.value=(.12+power*.85)*effects;
    const attr=this.embers.geometry.attributes.position;
    for(let i=0;i<attr.count;i++) {
      const angle=i*2.399+time*.06;
      const y=((i*.283+time*(.8+power))%8)-3.7;
      const radius=1.2+Math.sin(i*17)*.45+(y+3.7)*.025;
      attr.setXYZ(i,Math.sin(angle)*radius,y,Math.cos(angle)*radius*.7);
    }
    attr.needsUpdate=true;
    this.embers.material.opacity=(.16+power*.65)*effects;
    this.light.intensity=power*effects*7;
  }
}
