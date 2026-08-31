const mount = document.getElementById('avatar3d');
const fallback = document.getElementById('sceneFallback');

const addDigitalHumanStyles = () => {
  if (document.querySelector('link[data-digital-human]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = './digital-human.css';
  link.dataset.digitalHuman = 'true';
  document.head.appendChild(link);
};

const setStageCopy = () => {
  const caption = document.querySelector('.stage-caption');
  const foot = document.querySelector('.stage-foot');
  if (caption?.children?.[1]) caption.children[1].textContent = 'WEBGL / LIVING PORTRAIT';
  if (foot?.children?.[0]) foot.children[0].textContent = 'DIGITAL HUMAN STUDY';
  if (foot?.children?.[1]) foot.children[1].textContent = 'POINTER / DEPTH / IDLE MOTION';
};

const addStageUI = () => {
  const stage = mount?.closest('.hero-stage');
  if (!stage || stage.querySelector('.digital-human-status')) return;

  const status = document.createElement('div');
  status.className = 'digital-human-status';
  status.innerHTML = '<span aria-hidden="true"></span><b>LIVE MODEL</b><small>idle / responsive</small>';
  stage.appendChild(status);

  const hint = document.createElement('div');
  hint.className = 'digital-human-hint';
  hint.textContent = 'MOVE POINTER · THE PORTRAIT RESPONDS';
  stage.appendChild(hint);
};

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
  throw lastError || new Error('Three.js failed to load');
}

if (mount) {
  addDigitalHumanStyles();
  setStageCopy();
  addStageUI();

  try {
    const THREE = await loadThree();
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(pointer:fine)').matches;
    const stage = mount.closest('.hero-stage');

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(31, 1, 0.1, 100);
    camera.position.set(0, 0.18, 6.7);

    const root = new THREE.Group();
    root.position.set(0.03, -0.08, 0);
    let baseRootY = -0.08;
    scene.add(root);

    const textureLoader = new THREE.TextureLoader();
    const portrait = await textureLoader.loadAsync('./assets/digital-human.webp');
    portrait.colorSpace = THREE.SRGBColorSpace;
    portrait.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    const uniforms = {
      uMap: { value: portrait },
      uTime: { value: 0 },
      uPointer: { value: new THREE.Vector2(0, 0) },
      uMotion: { value: reduceMotion ? 0 : 1 },
      uIntensity: { value: 1 }
    };

    const portraitGeometry = new THREE.PlaneGeometry(3.24, 4.32, 72, 96);
    const portraitMaterial = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: true,
      vertexShader: `
        varying vec2 vUv;
        varying float vDepth;
        varying float vEdge;
        uniform float uTime;
        uniform float uMotion;
        uniform vec2 uPointer;

        float gaussian(vec2 uv, vec2 center, vec2 spread) {
          vec2 d = (uv - center) / spread;
          return exp(-dot(d, d) * 1.42);
        }

        void main() {
          vUv = uv;
          vec3 p = position;

          float face = gaussian(uv, vec2(.50, .68), vec2(.26, .30));
          float chest = gaussian(uv, vec2(.50, .31), vec2(.49, .36));
          float shoulder = gaussian(uv, vec2(.50, .19), vec2(.68, .20));
          float edge = smoothstep(.82, .18, distance(uv, vec2(.5)));
          float breathing = sin(uTime * 1.25) * .015 * chest * uMotion;
          float micro = sin((uv.y * 8.0 + uTime * .48)) * .004 * face * uMotion;

          p.z += face * .23 + chest * .075 + shoulder * .025 + breathing + micro;
          p.x += uPointer.x * face * .026 * uMotion;
          p.y -= uPointer.y * face * .012 * uMotion;

          vDepth = clamp(face * .92 + chest * .28, 0.0, 1.0);
          vEdge = edge;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        varying vec2 vUv;
        varying float vDepth;
        varying float vEdge;
        uniform sampler2D uMap;
        uniform float uTime;
        uniform vec2 uPointer;
        uniform float uMotion;
        uniform float uIntensity;

        float roundedBoxMask(vec2 uv, float radius) {
          vec2 p = uv * 2.0 - 1.0;
          vec2 q = abs(p) - vec2(.94, .965) + radius;
          float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - radius;
          return 1.0 - smoothstep(-.008, .018, d);
        }

        void main() {
          vec4 tex = texture2D(uMap, vUv);

          float vignette = smoothstep(.78, .14, distance(vUv, vec2(.5, .53)));
          float portraitMask = roundedBoxMask(vUv, .10);

          float scan = sin(vUv.y * 980.0 + uTime * 2.8) * .5 + .5;
          scan = mix(1.0, .985 + scan * .015, uMotion);

          float sweep = fract(vUv.y * .72 + vUv.x * .22 - uTime * .055);
          float sheen = smoothstep(.49, .515, sweep) * (1.0 - smoothstep(.515, .555, sweep));
          sheen *= (.035 + vDepth * .045) * uMotion;

          float coolRim = pow(1.0 - vignette, 2.2) * .08;
          vec3 color = tex.rgb;
          color *= .965 + vignette * .055;
          color *= scan;
          color += vec3(.12, .22, .31) * coolRim * uIntensity;
          color += vec3(.42, .68, .82) * sheen * uIntensity;

          float pointerGlow = max(0.0, 1.0 - distance(vUv, vec2(.5) + uPointer * vec2(.11, -.08)) * 1.65);
          color += vec3(.08, .13, .18) * pointerGlow * vDepth * .035 * uMotion;

          gl_FragColor = vec4(color, portraitMask);
        }
      `
    });

    const portraitMesh = new THREE.Mesh(portraitGeometry, portraitMaterial);
    portraitMesh.position.set(0, -0.04, 0.24);
    root.add(portraitMesh);

    const backPlate = new THREE.Mesh(
      new THREE.PlaneGeometry(3.34, 4.43),
      new THREE.MeshBasicMaterial({ color: 0xdfe7eb, transparent: true, opacity: .18 })
    );
    backPlate.position.set(0, -0.04, -0.035);
    root.add(backPlate);

    const frame = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(3.38, 4.47, .045)),
      new THREE.LineBasicMaterial({ color: 0x9fb7c3, transparent: true, opacity: .28 })
    );
    frame.position.set(0, -0.04, -0.01);
    root.add(frame);

    const haloMaterial = new THREE.MeshBasicMaterial({
      color: 0xb8d4df,
      transparent: true,
      opacity: .11,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.86, .012, 10, 220), haloMaterial);
    halo.position.set(.07, .45, -.32);
    halo.rotation.x = 1.18;
    halo.rotation.z = -.22;
    root.add(halo);

    const halo2 = new THREE.Mesh(new THREE.TorusGeometry(2.16, .007, 8, 220, Math.PI * 1.58), haloMaterial.clone());
    halo2.material.opacity = .065;
    halo2.position.set(.06, .33, -.39);
    halo2.rotation.set(1.25, .08, .62);
    root.add(halo2);

    const particleCount = 74;
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const a = (i / particleCount) * Math.PI * 2 + Math.random() * .22;
      const radius = 2.05 + Math.random() * .72;
      particlePositions[i * 3] = Math.cos(a) * radius;
      particlePositions[i * 3 + 1] = Math.sin(a) * radius * 1.15 + .18;
      particlePositions[i * 3 + 2] = -.42 + Math.random() * .26;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: 0x9abac8,
        size: .018,
        transparent: true,
        opacity: .38,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      })
    );
    root.add(particles);

    const glowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4.7, 5.4),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uTime: uniforms.uTime },
        vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime;
          void main(){
            vec2 p=vUv-.5;
            float d=length(p*vec2(.86,1.0));
            float core=(1.0-smoothstep(.08,.60,d))*.055;
            float pulse=.88+.12*sin(uTime*.7);
            gl_FragColor=vec4(vec3(.34,.58,.68)*core*pulse,core*pulse);
          }
        `
      })
    );
    glowPlane.position.z = -.55;
    root.add(glowPlane);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    if (finePointer && !reduceMotion) {
      mount.addEventListener('pointermove', (event) => {
        const rect = mount.getBoundingClientRect();
        pointer.tx = (((event.clientX - rect.left) / rect.width) - .5) * 2;
        pointer.ty = (((event.clientY - rect.top) / rect.height) - .5) * 2;
      }, { passive: true });
      mount.addEventListener('pointerleave', () => {
        pointer.tx = 0;
        pointer.ty = 0;
      });
    }

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      const compact = width < 560;
      const medium = width < 760;
      root.scale.setScalar(compact ? .83 : medium ? .93 : 1);
      baseRootY = compact ? -.05 : -.08;
      root.position.y = baseRootY;
      camera.position.z = compact ? 7.05 : 6.7;
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);

    fallback?.classList.add('hidden');
    stage?.classList.add('avatar-ready');

    let inView = true;
    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver((entries) => {
        inView = entries.some((entry) => entry.isIntersecting);
      }, { rootMargin: '120px' });
      visibilityObserver.observe(mount);
    }

    let last = performance.now();
    const render = (now) => {
      requestAnimationFrame(render);
      if (document.hidden || !inView) {
        last = now;
        return;
      }

      const dt = Math.min(.04, (now - last) / 1000);
      last = now;
      const t = now * .001;

      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 4.8);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 4.8);
      uniforms.uTime.value = t;
      uniforms.uPointer.value.set(pointer.x, pointer.y);

      if (!reduceMotion) {
        root.rotation.y = pointer.x * .105 + Math.sin(t * .42) * .012;
        root.rotation.x = -pointer.y * .034 + Math.sin(t * .31) * .006;
        const targetY = baseRootY + Math.sin(t * 1.05) * .013;
        root.position.y += (targetY - root.position.y) * .05;
        portraitMesh.rotation.z = Math.sin(t * .43) * .0028;
        portraitMesh.scale.setScalar(1 + Math.sin(t * 1.25) * .0028);
        halo.rotation.z += dt * .075;
        halo2.rotation.z -= dt * .038;
        particles.rotation.z = t * .018;
      }

      renderer.render(scene, camera);
    };

    requestAnimationFrame(render);
  } catch (error) {
    console.warn('Digital human portrait unavailable', error);
    mount.style.background = "center / contain no-repeat url('./assets/digital-human.webp')";
    fallback?.querySelector('small')?.replaceChildren(document.createTextNode('interactive portrait unavailable'));
  }
}
