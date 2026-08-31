const mount = document.getElementById('avatar3d');
const stage = mount?.closest('.avatar-stage');
const shell = document.querySelector('[data-avatar-shell]');

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

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

if (shell) {
  const topMeta = shell.querySelectorAll('.avatar-meta-top span');
  const bottomMeta = shell.querySelectorAll('.avatar-meta-bottom span');
  if (topMeta[1]) topMeta[1].textContent = '2.5D DEPTH PORTRAIT';
  if (bottomMeta[0]) bottomMeta[0].textContent = 'MOVE POINTER — SOFT PARALLAX';
  if (bottomMeta[1]) bottomMeta[1].textContent = 'NO FACIAL WARP · STABLE IDENTITY';
}

if (mount && stage) {
  try {
    const THREE = await loadThree();
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(pointer:fine)').matches;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, .1, 100);
    camera.position.set(0, .03, 6.35);

    const root = new THREE.Group();
    scene.add(root);

    const texture = await new THREE.TextureLoader().loadAsync('./assets/digital-human.webp');
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const uniforms = {
      uMap: { value: texture },
      uTime: { value: 0 },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uPointer: { value: new THREE.Vector2() },
      uScroll: { value: 0 },
      uBreath: { value: 0 },
      uAttention: { value: 0 }
    };

    const geometry = new THREE.PlaneGeometry(3.42, 4.56, 92, 122);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        varying float vDepth;
        varying float vFace;
        uniform float uTime;
        uniform float uMotion;
        uniform float uScroll;
        uniform float uBreath;
        uniform float uAttention;
        uniform vec2 uPointer;

        float g(vec2 uv, vec2 center, vec2 spread){
          vec2 d=(uv-center)/spread;
          return exp(-dot(d,d)*1.55);
        }

        void main(){
          vUv=uv;
          vec3 p=position;

          float head=g(uv,vec2(.50,.705),vec2(.285,.315));
          float face=g(uv,vec2(.50,.675),vec2(.215,.235));
          float headphones=g(uv,vec2(.50,.445),vec2(.43,.155));
          float torso=g(uv,vec2(.50,.245),vec2(.67,.34));
          float shoulders=g(uv,vec2(.50,.14),vec2(.78,.18));

          float depth=head*.135+face*.085+headphones*.045+torso*.026+shoulders*.012;
          float attention=uAttention*uMotion;

          p.z += depth;
          p.z += uPointer.x*(uv.x-.5)*head*.045*attention;
          p.z += -uPointer.y*(uv.y-.58)*head*.028*attention;

          p.x += uPointer.x*head*.030*attention;
          p.y += -uPointer.y*head*.015*attention;
          p.x += -uPointer.x*shoulders*.008*attention;

          float breathe=(uBreath-.5)*torso*.016*uMotion;
          p.y += breathe;
          p.z += breathe*.42;
          p.y += uScroll*.040;

          vDepth=clamp(depth*5.2,0.0,1.0);
          vFace=face;
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        varying float vDepth;
        varying float vFace;
        uniform sampler2D uMap;
        uniform float uTime;
        uniform float uMotion;
        uniform float uAttention;
        uniform vec2 uPointer;

        float roundedMask(vec2 uv){
          vec2 p=uv*2.0-1.0;
          vec2 q=abs(p)-vec2(.966,.974)+.055;
          float d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.055;
          return 1.0-smoothstep(-.004,.015,d);
        }

        void main(){
          vec4 tex=texture2D(uMap,vUv);
          vec3 color=tex.rgb;

          float vignette=smoothstep(.74,.12,distance(vUv,vec2(.50,.52)));
          color*=.925+vignette*.085;

          float scan=sin(vUv.y*980.0+uTime*1.7)*.5+.5;
          color*=mix(1.0,.994+scan*.006,uMotion);

          float sweep=fract(vUv.y*.70+vUv.x*.12-uTime*.030);
          float sheen=smoothstep(.490,.505,sweep)*(1.0-smoothstep(.505,.535,sweep))*uMotion;
          color+=vec3(.18,.43,.56)*sheen*(.018+.026*vFace);

          float pointerLight=clamp(.5+uPointer.x*.35,0.0,1.0)*uAttention*uMotion;
          color*=1.0+pointerLight*vDepth*.012;

          float rim=pow(1.0-vignette,2.0);
          color+=vec3(.08,.18,.24)*rim*.040;

          gl_FragColor=vec4(color,roundedMask(vUv));
        }
      `
    });

    const portrait = new THREE.Mesh(geometry, material);
    portrait.position.set(0,-.03,.20);
    root.add(portrait);

    const backdrop = new THREE.Mesh(
      new THREE.PlaneGeometry(3.54,4.70),
      new THREE.MeshBasicMaterial({ color:0x0d1720, transparent:true, opacity:.36 })
    );
    backdrop.position.set(0,-.03,-.12);
    root.add(backdrop);

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.58,4.74,.04)),
      new THREE.LineBasicMaterial({ color:0xa8d8e8, transparent:true, opacity:.14 })
    );
    frame.position.set(0,-.03,-.08);
    root.add(frame);

    const ringMaterial = new THREE.MeshBasicMaterial({ color:0x8ec4d6, transparent:true, opacity:.060, side:THREE.DoubleSide, depthWrite:false, blending:THREE.AdditiveBlending });
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.02,.009,8,200),ringMaterial);
    ring1.position.set(.02,.30,-.36); ring1.rotation.set(1.26,.12,-.55); root.add(ring1);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.36,.006,8,200,Math.PI*1.7),ringMaterial.clone());
    ring2.material.opacity=.040; ring2.position.set(.02,.18,-.41); ring2.rotation.set(1.2,-.2,.7); root.add(ring2);

    const particleCount=88;
    const positions=new Float32Array(particleCount*3);
    for(let i=0;i<particleCount;i++){
      const a=(i/particleCount)*Math.PI*2+Math.random()*.25;
      const radius=2.08+Math.random()*.75;
      positions[i*3]=Math.cos(a)*radius;
      positions[i*3+1]=Math.sin(a)*radius*1.08+.15;
      positions[i*3+2]=-.48+Math.random()*.34;
    }
    const pg=new THREE.BufferGeometry();
    pg.setAttribute('position',new THREE.BufferAttribute(positions,3));
    const particles=new THREE.Points(pg,new THREE.PointsMaterial({ color:0xa8d8e8, size:.014, transparent:true, opacity:.28, depthWrite:false, blending:THREE.AdditiveBlending }));
    root.add(particles);

    const pointer={ x:0, y:0, tx:0, ty:0, inside:false, lastX:0, lastY:0, speed:0, lastAt:performance.now() };
    let attention=0;

    if(finePointer&&!reduceMotion){
      stage.addEventListener('pointerenter',()=>{ pointer.inside=true; },{passive:true});
      stage.addEventListener('pointermove',(event)=>{
        const rect=stage.getBoundingClientRect();
        const now=performance.now();
        const nx=clamp(((event.clientX-rect.left)/rect.width-.5)*2,-1,1);
        const ny=clamp(((event.clientY-rect.top)/rect.height-.5)*2,-1,1);
        const elapsed=Math.max(16,now-pointer.lastAt)/1000;
        pointer.speed=clamp(Math.hypot(nx-pointer.lastX,ny-pointer.lastY)/elapsed,0,10);
        pointer.lastX=nx; pointer.lastY=ny; pointer.lastAt=now;
        pointer.tx=nx*.72;
        pointer.ty=ny*.62;
      },{passive:true});
      stage.addEventListener('pointerleave',()=>{ pointer.inside=false; pointer.tx=0; pointer.ty=0; },{passive:true});
    }

    const liveLabel=stage.querySelector('.live-chip span');
    if(liveLabel) liveLabel.textContent=reduceMotion?'2.5D / STILL':'2.5D / LIVE';

    const resize=()=>{
      const rect=mount.getBoundingClientRect();
      const w=Math.max(1,rect.width),h=Math.max(1,rect.height);
      renderer.setSize(w,h,false);
      camera.aspect=w/h;
      camera.updateProjectionMatrix();
      const compact=w<520;
      root.scale.setScalar(compact?.92:1);
      camera.position.z=compact?6.58:6.35;
    };
    resize();
    new ResizeObserver(resize).observe(mount);
    stage.classList.add('webgl-ready');

    let visible=true;
    if('IntersectionObserver'in window){
      const io=new IntersectionObserver(entries=>{ visible=entries.some(e=>e.isIntersecting); },{rootMargin:'120px'});
      io.observe(stage);
    }

    let last=performance.now();
    const render=(now)=>{
      requestAnimationFrame(render);
      if(document.hidden||!visible){ last=now; return; }
      const dt=Math.min(.04,Math.max(.001,(now-last)/1000)); last=now;
      const t=now*.001;

      pointer.x=damp(pointer.x,pointer.tx,6.4,dt);
      pointer.y=damp(pointer.y,pointer.ty,6.4,dt);
      pointer.speed=damp(pointer.speed,0,4.5,dt);
      attention=damp(attention,pointer.inside?1:0,pointer.inside?5.5:2.4,dt);

      const speedGuard=1-clamp(pointer.speed/10,0,.42);
      const px=pointer.x*speedGuard;
      const py=pointer.y*speedGuard;
      const breath=reduceMotion?.5:(.5+.5*Math.sin(t*1.05));

      uniforms.uTime.value=t;
      uniforms.uPointer.value.set(px,py);
      uniforms.uAttention.value=attention;
      uniforms.uBreath.value=breath;
      uniforms.uScroll.value=Math.min(1,scrollY/Math.max(1,innerHeight));

      if(!reduceMotion){
        root.rotation.y=px*.020*attention;
        root.rotation.x=-py*.010*attention;
        root.rotation.z=Math.sin(t*.22)*.0018;
        root.position.y=Math.sin(t*.62)*.006;
        root.position.x=Math.sin(t*.19)*.003;
        portrait.scale.setScalar(1+Math.sin(t*1.05)*.0018);
        ring1.rotation.z+=dt*.050;
        ring2.rotation.z-=dt*.024;
        particles.rotation.z=t*.013;
        particles.rotation.y=Math.sin(t*.17)*.032;
      }
      renderer.render(scene,camera);
    };
    requestAnimationFrame(render);
  } catch (error) {
    console.warn('2.5D portrait unavailable; using static fallback.', error);
  }
}
