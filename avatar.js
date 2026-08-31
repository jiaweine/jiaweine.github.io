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
      uMotion: { value: reduceMotion ? 0 : 1 },
      uScroll: { value: 0 }
    };

    const geometry = new THREE.PlaneGeometry(3.42, 4.56, 88, 116);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms,
      vertexShader: `
        varying vec2 vUv;
        varying float vFace;
        varying float vDepth;
        uniform float uTime;
        uniform float uMotion;
        uniform float uScroll;
        uniform vec2 uPointer;

        float g(vec2 uv, vec2 center, vec2 spread){
          vec2 d=(uv-center)/spread;
          return exp(-dot(d,d)*1.55);
        }

        void main(){
          vUv=uv;
          vec3 p=position;
          float head=g(uv,vec2(.50,.695),vec2(.255,.285));
          float face=g(uv,vec2(.50,.665),vec2(.205,.225));
          float chest=g(uv,vec2(.50,.30),vec2(.52,.35));
          float headphones=g(uv,vec2(.50,.455),vec2(.39,.14));
          float shoulders=g(uv,vec2(.50,.18),vec2(.68,.19));
          float breathe=sin(uTime*1.18)*.014*chest*uMotion;
          float micro=sin(uTime*.57+uv.y*7.0)*.0035*face*uMotion;
          float depth=head*.19+face*.105+headphones*.055+chest*.045+shoulders*.018;
          p.z+=depth+breathe+micro;
          p.x+=uPointer.x*face*.026*uMotion;
          p.y-=uPointer.y*face*.012*uMotion;
          p.y+=uScroll*.05;
          vFace=face;
          vDepth=clamp(depth*4.0,0.0,1.0);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        varying float vFace;
        varying float vDepth;
        uniform sampler2D uMap;
        uniform float uTime;
        uniform float uMotion;
        uniform vec2 uPointer;

        float roundedMask(vec2 uv){
          vec2 p=uv*2.0-1.0;
          vec2 q=abs(p)-vec2(.966,.974)+.055;
          float d=length(max(q,0.0))+min(max(q.x,q.y),0.0)-.055;
          return 1.0-smoothstep(-.004,.015,d);
        }

        void main(){
          vec2 uv=vUv;
          vec4 tex=texture2D(uMap,uv);
          vec3 color=tex.rgb;

          float vignette=smoothstep(.72,.10,distance(uv,vec2(.50,.52)));
          float scan=sin(uv.y*1120.0+uTime*2.3)*.5+.5;
          color*=mix(1.0,.989+scan*.011,uMotion);
          color*=.91+vignette*.105;

          float sweep=fract(uv.y*.78+uv.x*.18-uTime*.045);
          float sheen=smoothstep(.485,.505,sweep)*(1.0-smoothstep(.505,.545,sweep))*uMotion;
          color+=vec3(.22,.52,.66)*sheen*(.028+.052*vFace);

          float rim=pow(1.0-vignette,2.1);
          color+=vec3(.10,.23,.31)*rim*.055;
          float focus=max(0.0,1.0-distance(uv,vec2(.5)+uPointer*vec2(.08,-.06))*1.6);
          color+=vec3(.05,.10,.14)*focus*vDepth*.04*uMotion;

          float alpha=roundedMask(uv);
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

    const particleCount=96;
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

    const resize=()=>{
      const rect=mount.getBoundingClientRect();
      const w=Math.max(1,rect.width),h=Math.max(1,rect.height);
      renderer.setSize(w,h,false);
      camera.aspect=w/h;
      camera.updateProjectionMatrix();
      const compact=w<520;
      root.scale.setScalar(compact?.92:1);
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
    const render=(now)=>{
      requestAnimationFrame(render);
      if(document.hidden||!visible){last=now;return;}
      const dt=Math.min(.04,(now-last)/1000);last=now;
      const t=now*.001;
      pointer.x+=(pointer.tx-pointer.x)*Math.min(1,dt*4.8);
      pointer.y+=(pointer.ty-pointer.y)*Math.min(1,dt*4.8);
      uniforms.uTime.value=t;
      uniforms.uPointer.value.set(pointer.x,pointer.y);
      uniforms.uScroll.value=Math.min(1,scrollY/Math.max(1,innerHeight));
      if(!reduceMotion){
        root.rotation.y=pointer.x*.10+Math.sin(t*.36)*.012;
        root.rotation.x=-pointer.y*.032+Math.sin(t*.28)*.005;
        root.position.y=Math.sin(t*1.02)*.012;
        portrait.scale.setScalar(1+Math.sin(t*1.18)*.0025);
        ring1.rotation.z+=dt*.07;
        ring2.rotation.z-=dt*.034;
        particles.rotation.z=t*.017;
      }
      renderer.render(scene,camera);
    };
    requestAnimationFrame(render);
  } catch (error) {
    console.warn('Interactive portrait unavailable; using static fallback.', error);
  }
}
