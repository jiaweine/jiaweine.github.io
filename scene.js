const mount = document.getElementById('avatar3d');
const fallback = document.getElementById('sceneFallback');
if (!mount) throw new Error('3D mount missing');

async function loadThree() {
  const sources = [
    'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.169.0/three.module.min.js',
    'https://unpkg.com/three@0.169.0/build/three.module.js'
  ];
  let lastError;
  for (const source of sources) {
    try { return await import(source); } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Unable to load Three.js');
}

try {
  const THREE = await loadThree();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(27, 1, .1, 100);
  camera.position.set(.05, 1.2, 7.8);

  const portrait = new THREE.Group();
  portrait.position.set(.28, -.62, 0);
  portrait.rotation.y = -.12;
  scene.add(portrait);

  const headRig = new THREE.Group();
  portrait.add(headRig);

  const skin = new THREE.MeshPhysicalMaterial({
    color: 0xc78969,
    roughness: .48,
    metalness: 0,
    clearcoat: .12,
    clearcoatRoughness: .7,
    sheen: .16,
    sheenColor: new THREE.Color(0xffc8ad)
  });
  const skinShadow = new THREE.MeshStandardMaterial({ color: 0xa96852, roughness: .65 });
  const skinHighlight = new THREE.MeshStandardMaterial({ color: 0xd59b7d, roughness: .55 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x111311, roughness: .36, metalness: .04 });
  const hairSoft = new THREE.MeshStandardMaterial({ color: 0x191b18, roughness: .46 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x171714, roughness: .58 });
  const irisMat = new THREE.MeshPhysicalMaterial({ color: 0x241814, roughness: .18, clearcoat: .7, clearcoatRoughness: .12 });
  const scleraMat = new THREE.MeshStandardMaterial({ color: 0xe7d8ca, roughness: .45 });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0x8e514c, roughness: .6 });
  const shirt = new THREE.MeshPhysicalMaterial({ color: 0x151815, roughness: .78, sheen: .35, sheenColor: new THREE.Color(0x596158) });
  const shirtEdge = new THREE.MeshStandardMaterial({ color: 0x222621, roughness: .78 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xc9cdd1, roughness: .16, metalness: .96, clearcoat: .55, clearcoatRoughness: .18 });
  const headphoneDark = new THREE.MeshStandardMaterial({ color: 0x252827, roughness: .32, metalness: .35 });

  const shadowify = (mesh) => {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  };

  function addMesh(geometry, material, position = [0, 0, 0], scale = [1, 1, 1], parent = portrait) {
    const mesh = shadowify(new THREE.Mesh(geometry, material));
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }

  function makeHeadGeometry() {
    const geometry = new THREE.SphereGeometry(1, 96, 72);
    const position = geometry.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      const ny = v.y;
      const front = Math.max(0, v.z);
      const jaw = ny < -.1 ? 1 - Math.pow(Math.min(1, (-ny - .1) / .9), 1.5) * .27 : 1;
      const chin = ny < -.64 ? 1 - Math.pow(Math.min(1, (-ny - .64) / .36), 1.4) * .13 : 1;
      const cheek = 1 + .045 * Math.exp(-Math.pow((ny + .02) / .24, 2));
      const temple = 1 - .03 * Math.exp(-Math.pow((ny - .48) / .2, 2));
      v.x *= .72 * jaw * chin * cheek * temple;
      v.y *= .91;
      v.z *= .66;
      if (front > 0) {
        v.z += .035 * Math.exp(-Math.pow((ny - .02) / .55, 2));
        if (ny < -.67) v.z += .05 * front;
      }
      position.setXYZ(i, v.x, v.y, v.z);
    }
    geometry.computeVertexNormals();
    return geometry;
  }

  const head = addMesh(makeHeadGeometry(), skin, [0, 1.95, .03], [1, 1, 1], headRig);

  addMesh(new THREE.CylinderGeometry(.34, .41, .72, 40), skinShadow, [0, .93, -.02], [1, 1, .9]);
  const torso = addMesh(new THREE.CapsuleGeometry(.82, 1.08, 10, 36), shirt, [0, -.02, -.18], [1.22, 1, .72]);
  torso.rotation.x = -.035;
  addMesh(new THREE.SphereGeometry(.66, 48, 28), shirtEdge, [-.68, .32, -.12], [.78, .72, .7]);
  addMesh(new THREE.SphereGeometry(.66, 48, 28), shirtEdge, [.68, .32, -.12], [.78, .72, .7]);

  for (const side of [-1, 1]) {
    addMesh(new THREE.SphereGeometry(.18, 36, 24), skin, [side * .7, 1.96, .01], [.55, .88, .43], headRig);
    addMesh(new THREE.TorusGeometry(.075, .015, 12, 38, Math.PI * 1.3), skinShadow, [side * .705, 1.96, .075], [1, 1, .55], headRig).rotation.z = side * .45;
  }

  const bridge = addMesh(new THREE.CapsuleGeometry(.065, .37, 8, 24), skinHighlight, [0, 1.93, .64], [.72, 1, .74], headRig);
  bridge.rotation.x = .12;
  addMesh(new THREE.SphereGeometry(.115, 32, 20), skinHighlight, [0, 1.69, .7], [1, .7, .82], headRig);
  addMesh(new THREE.SphereGeometry(.04, 18, 12), skinShadow, [-.067, 1.66, .763], [1.2, .42, .5], headRig);
  addMesh(new THREE.SphereGeometry(.04, 18, 12), skinShadow, [.067, 1.66, .763], [1.2, .42, .5], headRig);

  const eyeGroup = new THREE.Group();
  headRig.add(eyeGroup);
  const eyeMeshes = [];
  const pupils = [];
  for (const side of [-1, 1]) {
    const eye = addMesh(new THREE.SphereGeometry(.135, 36, 20), scleraMat, [side * .255, 1.93, .635], [1.45, .32, .32], eyeGroup);
    eyeMeshes.push(eye);
    const iris = addMesh(new THREE.SphereGeometry(.056, 28, 18), irisMat, [side * .255, 1.93, .754], [1, .82, .5], eyeGroup);
    pupils.push(iris);

    const upper = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * .115, 1.96, .768),
      new THREE.Vector3(side * .255, 2.005, .785),
      new THREE.Vector3(side * .405, 1.958, .758)
    ]);
    const lower = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * .118, 1.912, .765),
      new THREE.Vector3(side * .255, 1.895, .779),
      new THREE.Vector3(side * .402, 1.915, .754)
    ]);
    addMesh(new THREE.TubeGeometry(upper, 24, .018, 10, false), skinShadow, [0, 0, 0], [1, 1, 1], headRig);
    addMesh(new THREE.TubeGeometry(lower, 20, .011, 8, false), skinShadow, [0, 0, 0], [1, 1, 1], headRig);
  }

  for (const side of [-1, 1]) {
    const brow = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * .105, 2.17, .707),
      new THREE.Vector3(side * .245, 2.205, .735),
      new THREE.Vector3(side * .39, 2.23, .70),
      new THREE.Vector3(side * .49, 2.245, .635)
    ]);
    const eyebrow = addMesh(new THREE.TubeGeometry(brow, 28, .032, 12, false), browMat, [0, 0, 0], [1, 1, 1], headRig);
    eyebrow.scale.y = .84;
  }

  const upperLip = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.16, 1.47, .702),
    new THREE.Vector3(-.055, 1.505, .738),
    new THREE.Vector3(0, 1.49, .752),
    new THREE.Vector3(.055, 1.505, .738),
    new THREE.Vector3(.16, 1.47, .702)
  ]);
  const lowerLip = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-.145, 1.455, .705),
    new THREE.Vector3(0, 1.415, .742),
    new THREE.Vector3(.145, 1.455, .705)
  ]);
  addMesh(new THREE.TubeGeometry(upperLip, 32, .022, 12, false), lipMat, [0, 0, 0], [1, 1, 1], headRig);
  addMesh(new THREE.TubeGeometry(lowerLip, 24, .025, 12, false), lipMat, [0, 0, 0], [1, 1, 1], headRig);

  const hairCap = addMesh(new THREE.SphereGeometry(.81, 64, 44, 0, Math.PI * 2, 0, Math.PI * .61), hairSoft, [0, 2.44, -.03], [.93, .78, .88], headRig);
  hairCap.rotation.x = .03;

  function hairStrand(points, radius, material = hair) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
    return addMesh(new THREE.TubeGeometry(curve, 36, radius, 10, false), material, [0, 0, 0], [1, 1, 1], headRig);
  }

  const leftStrands = [
    [[-.045,2.86,.25],[-.18,2.77,.46],[-.38,2.57,.56],[-.49,2.33,.48]],
    [[-.09,2.87,.18],[-.27,2.77,.36],[-.48,2.56,.43],[-.56,2.26,.31]],
    [[-.16,2.82,.06],[-.37,2.69,.17],[-.55,2.47,.19],[-.59,2.2,.12]],
    [[-.22,2.73,-.06],[-.44,2.62,-.02],[-.61,2.42,-.01],[-.62,2.15,-.05]],
    [[-.12,2.86,.33],[-.26,2.72,.54],[-.43,2.49,.61],[-.49,2.22,.52]]
  ];
  leftStrands.forEach((strand, i) => hairStrand(strand, i === 4 ? .075 : .09, i % 2 ? hairSoft : hair));
  leftStrands.forEach((strand, i) => hairStrand(strand.map(([x,y,z]) => [-x,y,z]), i === 4 ? .075 : .09, i % 2 ? hairSoft : hair));
  hairStrand([[0,2.865,.315],[0,2.79,.39],[0,2.66,.43]], .018, skinHighlight);

  const band = addMesh(new THREE.TorusGeometry(.49, .045, 16, 96, Math.PI * 1.42), silver, [0, .87, .18], [1, 1.05, 1]);
  band.rotation.set(1.39, 0, .78);
  for (const side of [-1, 1]) {
    const cup = addMesh(new THREE.CylinderGeometry(.145, .145, .11, 36), silver, [side * .47, .79, .36], [1, 1, 1]);
    cup.rotation.z = Math.PI / 2;
    addMesh(new THREE.CylinderGeometry(.115, .115, .12, 36), headphoneDark, [side * .47, .79, .36], [.86, 1, .86]).rotation.z = Math.PI / 2;
  }

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ color: 0x000000, opacity: .32 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.17;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(new THREE.HemisphereLight(0xf4eadf, 0x101310, 1.45));
  const key = new THREE.DirectionalLight(0xffd7c4, 4.2);
  key.position.set(-3.6, 5.8, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1536, 1536);
  key.shadow.camera.near = .5;
  key.shadow.camera.far = 18;
  key.shadow.bias = -.0004;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdce5e5, 1.65);
  fill.position.set(4.8, 2.2, 3.1);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 2.4);
  rim.position.set(2.4, 3.8, -3.8);
  scene.add(rim);

  const accent = new THREE.PointLight(0xff6b45, 3.1, 7, 2);
  accent.position.set(-2.6, .1, 3.2);
  scene.add(accent);

  const particleCount = 110;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    particlePositions[i * 3] = (Math.random() - .5) * 8;
    particlePositions[i * 3 + 1] = Math.random() * 6 - 1.5;
    particlePositions[i * 3 + 2] = Math.random() * 5 - 1.5;
  }
  const particlesGeo = new THREE.BufferGeometry();
  particlesGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const particles = new THREE.Points(particlesGeo, new THREE.PointsMaterial({ color: 0xe8e5de, size: .012, transparent: true, opacity: .24, depthWrite: false }));
  scene.add(particles);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const scrollState = { value: 0, target: 0 };

  if (finePointer && !reduceMotion) {
    mount.addEventListener('pointermove', (event) => {
      const rect = mount.getBoundingClientRect();
      pointer.tx = ((event.clientX - rect.left) / rect.width - .5) * 2;
      pointer.ty = ((event.clientY - rect.top) / rect.height - .5) * 2;
    }, { passive: true });
    mount.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });
  }

  const updateScroll = () => {
    const hero = document.querySelector('.hero');
    const range = Math.max(1, hero?.offsetHeight || innerHeight);
    scrollState.target = Math.min(1, Math.max(0, scrollY / range));
  };
  updateScroll();
  addEventListener('scroll', updateScroll, { passive: true });

  function resize() {
    const rect = mount.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    if (width < 560) {
      portrait.scale.setScalar(.79);
      portrait.position.set(.42, -.53, 0);
      camera.position.set(.12, 1.22, 8.65);
    } else if (width < 850) {
      portrait.scale.setScalar(.9);
      portrait.position.set(.34, -.59, 0);
      camera.position.set(.08, 1.2, 8.1);
    } else {
      portrait.scale.setScalar(1);
      portrait.position.set(.28, -.62, 0);
      camera.position.set(.05, 1.2, 7.8);
    }
  }

  resize();
  new ResizeObserver(resize).observe(mount);
  fallback?.classList.add('hidden');

  let last = performance.now();
  function render(now) {
    const dt = Math.min(.04, (now - last) / 1000);
    last = now;
    const t = now * .001;

    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 5.5);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 5.5);
    scrollState.value += (scrollState.target - scrollState.value) * Math.min(1, dt * 3.4);

    if (!reduceMotion) {
      portrait.rotation.y = -.12 + pointer.x * .055 + scrollState.value * .16;
      portrait.rotation.x = pointer.y * .018 - scrollState.value * .018;
      headRig.rotation.y = pointer.x * .09;
      headRig.rotation.x = -pointer.y * .045;
      headRig.position.y = Math.sin(t * 1.25) * .006;
      torso.scale.y = 1 + Math.sin(t * 1.25) * .004;

      const blinkPhase = t % 5.6;
      const blink = blinkPhase > 5.35 && blinkPhase < 5.48 ? .08 : 1;
      eyeMeshes.forEach((eye) => { eye.scale.y = .32 * blink; });
      pupils.forEach((pupil, index) => {
        const side = index === 0 ? -1 : 1;
        pupil.position.x = side * .255 + pointer.x * .018;
        pupil.position.y = 1.93 - pointer.y * .011;
      });

      camera.position.y = 1.2 - scrollState.value * .16;
      camera.position.x = .05 + scrollState.value * .12;
      camera.lookAt(.16, 1.05 - scrollState.value * .12, 0);
      particles.rotation.y = t * .01;
    } else {
      camera.lookAt(.16, 1.05, 0);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
} catch (error) {
  console.warn('3D scene unavailable', error);
  fallback?.querySelector('span')?.replaceChildren(document.createTextNode('Realtime portrait unavailable'));
}
