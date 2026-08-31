const mount = document.getElementById('avatar3d');
const stage = mount?.closest('.avatar-stage');

async function loadThree() {
  const sources = [
    'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.169.0/three.module.min.js',
    'https://unpkg.com/three@0.169.0/build/three.module.js'
  ];
  let lastError;
  for (const src of sources) {
    try { return await import(src); } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Three.js unavailable');
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};

function sampleTrack(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    const a = keys[i];
    const b = keys[i + 1];
    if (t <= b[0]) {
      const p = smooth((t - a[0]) / Math.max(.0001, b[0] - a[0]));
      return a[1] + (b[1] - a[1]) * p;
    }
  }
  return keys[keys.length - 1][1];
}

function blinkPulse(t, center, width = .12) {
  const d = Math.abs(t - center);
  if (d >= width) return 0;
  const x = 1 - d / width;
  return smooth(x);
}

if (mount && stage) {
  try {
    const THREE = await loadThree();
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(pointer:fine)').matches;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, .1, 100);
    camera.position.set(0, .05, 6.25);

    const root = new THREE.Group();
    scene.add(root);

    const texture = await new THREE.TextureLoader().loadAsync('./assets/digital-human.webp');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const uniforms = {
      uMap: { value: texture },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2() },
      uLook: { value: new THREE.Vector2() },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uScroll: { value: 0 },
      uYaw: { value: 0 },
      uPitch: { value: 0 },
      uBlink: { value: 0 },
      uBreath: { value: 0 }
    };

    const geometry = new THREE.PlaneGeometry(3.42, 4.56, 104, 136);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        varying float vFace;
        varying float vHead;
        varying float vDepth;
        uniform float uTime;
        uniform float uMotion;
        uniform float uScroll;
        uniform float uYaw;
        uniform float uPitch;
        uniform float uBreath;
        uniform vec2 uPointer;

        float g(vec2 uv, vec2 center, vec2 spread){
          vec2 d=(uv-center)/spread;
          return exp(-dot(d,d)*1.55);
        }

        void main(){
          vUv=uv;
          vec3 p=position;
          float head=g(uv,vec2(.50,.705),vec2(.27,.30));
          float face=g(uv,vec2(.50,.675),vec2(.205,.225));
          float chest=g(uv,vec2(.50,.295),vec2(.53,.36));
          float headphones=g(uv,vec2(.50,.445),vec2(.40,.145));
          float shoulders=g(uv,vec2(.50,.17),vec2(.70,.20));
          float neck=g(uv,vec2(.50,.43),vec2(.20,.12));

          float depth=head*.19+face*.115+headphones*.062+chest*.042+shoulders*.018;
          float faceTurn=(uv.x-.5)*uYaw*head*uMotion;
          float headShift=uYaw*head*.15*uMotion;
          float pitchShift=uPitch*head*.11*uMotion;
          float shoulderCounter=-uYaw*shoulders*.028*uMotion;
          float breathe=uBreath*chest*.026*uMotion;
          float micro=sin(uTime*.63+uv.y*7.0)*.0034*face*uMotion;

          p.z += depth + faceTurn*.40 + breathe + micro;
          p.x += headShift + faceTurn*.19 + uPointer.x*face*.022*uMotion + shoulderCounter;
          p.y += pitchShift - uPointer.y*face*.010*uMotion + breathe*.32;
          p.y += uScroll*.05;
          p.z += neck*uYaw*uYaw*.025;

          vFace=face;
          vHead=head;
          vDepth=clamp(depth*4.0,0.0,1.0);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        varying float vFace;
        varying float vHead;
        varying float vDepth;
        uniform sampler2D uMap;
        uniform float uTime;
        uniform float uMotion;
        uniform float uBlink;
        uniform float uYaw;
        uniform vec2 uPointer;
        uniform vec2 uLook;

        float roundedMask(vec2 uv){
          vec2 p=uv*2.0-1.0;
          vec2 q=abs(p)-vec2(.966,.974)+.055;
          float d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.055;
          return 1.0-smoothstep(-.004,.015,d);
        }

        float gauss1(float x,float s){ return exp(-(x*x)/(s*s)); }

        void main(){
          vec2 uv=vUv;

          float leftEyeX=gauss1(uv.x-.405,.070);
          float rightEyeX=gauss1(uv.x-.595,.070);
          float eyeY=gauss1(uv.y-.676,.045);
          float eyeMask=max(leftEyeX,rightEyeX)*eyeY;
          vec2 gaze=(uLook+uPointer*.34)*vec2(.0055,-.0027)*uMotion;
          uv += gaze*eyeMask;

          float lidX=max(gauss1(uv.x-.405,.073),gauss1(uv.x-.595,.073));
          float lidY=gauss1(uv.y-.676,.056);
          float lidMask=lidX*lidY;
          float closeAmt=clamp(uBlink*lidMask,0.0,1.0)*uMotion;
          uv.y=mix(uv.y,.676+(uv.y-.676)*.10,closeAmt);

          vec4 tex=texture2D(uMap,uv);
          vec3 color=tex.rgb;

          float crease=lidX*gauss1(vUv.y-.676,.009)*uBlink*uMotion;
          color=mix(color,color*.34,crease*.62);

          float vignette=smoothstep(.72,.10,distance(vUv,vec2(.50,.52)));
          float scan=sin(vUv.y*1120.0+uTime*2.3)*.5+.5;
          color*=mix(1.0,.989+scan*.011,uMotion);
          color*=.91+vignette*.105;

          float sweep=fract(vUv.y*.78+vUv.x*.18-uTime*.045);
          float sheen=smoothstep(.485,.505,sweep)*(1.0-smoothstep(.505,.545,sweep))*uMotion;
          color+=vec3(.22,.52,.66)*sheen*(.028+.052*vFace);

          float turnLight=clamp(.5+uYaw*1.8,0.0,1.0);
          color*=mix(.985,1.018,turnLight*vHead*uMotion);
          float rim=pow(1.0-vignette,2.1);
          color+=vec3(.10,.23,.31)*rim*.055;
          float focus=max(0.0,1.0-distance(vUv,vec2(.5)+uPointer*vec2(.08,-.06))*1.6);
          color+=vec3(.05,.10,.14)*focus*vDepth*.04*uMotion;

          float alpha=roundedMask(vUv);
          gl_FragColor=vec4(color,alpha);
        }
      `
    });

    const portrait = new THREE.Mesh(geometry, material);
    portrait.position.set(0,-.03,.22);
    root.add(portrait);

    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(3.54,4.7),
      new THREE.MeshBasicMaterial({color:0x0d1720,transparent:true,opacity:.36})
    );
    backdrop.position.set(0,-.03,-.12);
    root.add(backdrop);

    const frameMaterial = new THREE.LineBasicMaterial({color:0xa8d8e8,transparent:true,opacity:.16});
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3.58,4.74,.04)),frameMaterial);
    frame.position.set(0,-.03,-.08);
    root.add(frame);

    const ringMaterial = new THREE.MeshBasicMaterial({color:0x8ec4d6,transparent:true,opacity:.075,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.02,.009,8,220),ringMaterial);
    ring1.position.set(.02,.3,-.36); ring1.rotation.set(1.26,.12,-.55); root.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.36,.006,8,220,Math.PI*1.7),ringMaterial.clone());
    ring2.material.opacity=.05; ring2.position.set(.02,.18,-.41); ring2.rotation.set(1.2,-.2,.7); root.add(ring2);

    const particleCount=112;
    const positions=new Float32Array(particleCount*3);
    for(let i=0;i<particleCount;i++){
      const a=(i/particleCount)*Math.PI*2+Math.random()*.28;
      const radius=2.06+Math.random()*.82;
      positions[i*3]=Math.cos(a)*radius;
      positions[i*3+1]=Math.sin(a)*radius*1.10+.15;
      positions[i*3+2]=-.48+Math.random()*.38;
    }
    const pg=new THREE.BufferGeometry();
    pg.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const particles=new THREE.Points(pg,new THREE.PointsMaterial({color:0xa8d8e8,size:.015,transparent:true,opacity:.34,depthWrite:false,blending:THREE.AdditiveBlending}));
    root.add(particles);

    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(5.0,5.7),
      new THREE.ShaderMaterial({
        transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
        uniforms:{uTime:uniforms.uTime},
        vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:`varying vec2 vUv;uniform float uTime;void main(){vec2 p=(vUv-.5)*vec2(.82,1.0);float d=length(p);float c=(1.0-smoothstep(.05,.63,d))*.052;float pulse=.86+.14*sin(uTime*.62);gl_FragColor=vec4(vec3(.18,.46,.58)*c*pulse,c*pulse);}`
      })
    );
    glow.position.z=-.52;
    root.add(glow);

    const pointer={x:0,y:0,tx:0,ty:0};
    if(finePointer&&!reduceMotion){
      stage.addEventListener('pointermove',(event)=>{
        const rect=stage.getBoundingClientRect();
        pointer.tx=((event.clientX-rect.left)/rect.width-.5)*2;
        pointer.ty=((event.clientY-rect.top)/rect.height-.5)*2;
      },{passive:true});
      stage.addEventListener('pointerleave',()=>{pointer.tx=0;pointer.ty=0;});
    }

    const yawTrack = [[0,0],[4,.025],[8,.18],[11,.09],[14,0],[18,-.16],[22,-.08],[25,.04],[28,.11],[32,0]];
    const pitchTrack = [[0,0],[5,-.015],[9,.035],[13,0],[17,.018],[21,-.025],[25,.045],[28,.015],[32,0]];
    const gazeXTrack = [[0,0],[3,.15],[6,.55],[9,.28],[12,-.15],[16,-.55],[20,-.25],[23,.42],[27,.12],[30,-.12],[32,0]];
    const gazeYTrack = [[0,0],[6,-.12],[10,.10],[15,.04],[19,-.09],[24,.15],[28,-.04],[32,0]];

    const liveLabel=stage.querySelector('.live-chip span');
    if(liveLabel&&!reduceMotion) liveLabel.textContent='32S LIVING LOOP';

    const resize=()=>{
      const rect=mount.getBoundingClientRect();
      const w=Math.max(1,rect.width),h=Math.max(1,rect.height);
      renderer.setSize(w,h,false);
      camera.aspect=w/h;
      camera.updateProjectionMatrix();
      const compact=w<520;
      root.scale.setScalar(compact ? .92 : 1);
      camera.position.z=compact?6.55:6.25;
    };
    resize();
    new ResizeObserver(resize).observe(mount);
    stage.classList.add('webgl-ready');

    let visible=true;
    if('IntersectionObserver'in window){
      const io=new IntersectionObserver((entries)=>{visible=entries.some(e=>e.isIntersecting);},{rootMargin:'120px'});
      io.observe(stage);
    }

    let last=performance.now();
    const startedAt=last;
    const render=(now)=>{
      requestAnimationFrame(render);
      if(document.hidden||!visible){last=now;return;}
      const dt=Math.min(.04,(now-last)/1000);last=now;
      const t=now*.001;
      const phase=((now-startedAt)*.001)%32;

      pointer.x+=(pointer.tx-pointer.x)*Math.min(1,dt*4.8);
      pointer.y+=(pointer.ty-pointer.y)*Math.min(1,dt*4.8);

      let autoYaw=0,autoPitch=0,gazeX=0,gazeY=0,blink=0,breath=0;
      if(!reduceMotion){
        autoYaw=sampleTrack(yawTrack,phase);
        autoPitch=sampleTrack(pitchTrack,phase);
        gazeX=sampleTrack(gazeXTrack,phase);
        gazeY=sampleTrack(gazeYTrack,phase);
        blink=Math.max(
          blinkPulse(phase,4.35,.12),
          blinkPulse(phase,10.9,.13),
          blinkPulse(phase,17.75,.12),
          blinkPulse(phase,24.55,.13),
          blinkPulse(phase,29.15,.11),
          blinkPulse(phase,29.55,.10)
        );
        breath=.5+.5*Math.sin(t*1.22);
      }

      uniforms.uTime.value=t;
      uniforms.uPointer.value.set(pointer.x,pointer.y);
      uniforms.uLook.value.set(gazeX,gazeY);
      uniforms.uYaw.value=autoYaw+pointer.x*.055;
      uniforms.uPitch.value=autoPitch-pointer.y*.028;
      uniforms.uBlink.value=blink;
      uniforms.uBreath.value=breath;
      uniforms.uScroll.value=Math.min(1,scrollY/Math.max(1,innerHeight));

      if(!reduceMotion){
        root.rotation.y=pointer.x*.028+autoYaw*.12;
        root.rotation.x=-pointer.y*.012+autoPitch*.08;
        root.rotation.z=Math.sin(t*.23)*.0025+autoYaw*.025;
        root.position.y=Math.sin(t*.76)*.010;
        root.position.x=Math.sin(t*.21)*.006;
        portrait.scale.setScalar(1+Math.sin(t*1.22)*.0028);
        ring1.rotation.z+=dt*.07;
        ring2.rotation.z-=dt*.034;
        particles.rotation.z=t*.017;
        particles.rotation.y=Math.sin(t*.19)*.045;
      }
      renderer.render(scene,camera);
    };
    requestAnimationFrame(render);
  } catch (error) {
    console.warn('Interactive portrait unavailable; using static fallback.', error);
  }
}
