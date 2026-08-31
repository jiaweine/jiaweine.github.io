const mount = document.getElementById('avatar3d');
const stage = mount?.closest('.avatar-stage');

async function importFirst(urls) {
  let lastError;
  for (const url of urls) {
    try { return await import(url); } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Module unavailable');
}

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));

function springAxis(state, target, dt, stiffness = 62, damping = 13) {
  state.v += (target - state.x) * stiffness * dt;
  state.v *= Math.exp(-damping * dt);
  state.x += state.v * dt;
}

function trianglesFromMediaPipe(connections) {
  const indices = [];
  for (let i = 0; i + 2 < connections.length; i += 3) {
    const edges = [connections[i], connections[i + 1], connections[i + 2]];
    const unique = [];
    for (const edge of edges) {
      if (!unique.includes(edge.start)) unique.push(edge.start);
      if (!unique.includes(edge.end)) unique.push(edge.end);
    }
    if (unique.length === 3) indices.push(unique[0], unique[1], unique[2]);
  }
  return indices;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function sampleSkinColor(THREE, image, landmarks) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const sampleIds = [1, 4, 50, 280, 101, 330, 152];
  let r = 0, g = 0, b = 0, n = 0;
  for (const id of sampleIds) {
    const p = landmarks[id];
    if (!p) continue;
    const x = clamp(Math.round(p.x * canvas.width), 2, canvas.width - 3);
    const y = clamp(Math.round(p.y * canvas.height), 2, canvas.height - 3);
    const data = ctx.getImageData(x - 2, y - 2, 5, 5).data;
    for (let i = 0; i < data.length; i += 4) {
      const rr = data[i], gg = data[i + 1], bb = data[i + 2];
      const light = (rr + gg + bb) / 3;
      if (light > 70 && light < 245 && rr > bb * .95) {
        r += rr; g += gg; b += bb; n += 1;
      }
    }
  }
  if (!n) return new THREE.Color(0xd5ad98);
  const color = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
  color.offsetHSL(0, -0.04, -0.015);
  return color;
}

function createFaceMesh(THREE, FaceLandmarker, landmarks, texture) {
  const usable = landmarks.slice(0, 468);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of usable) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  const cx = (minX + maxX) * .5;
  const cy = (minY + maxY) * .5;
  const cz = (minZ + maxZ) * .5;
  const width = Math.max(.001, maxX - minX);
  const height = Math.max(.001, maxY - minY);

  const positions = new Float32Array(landmarks.length * 3);
  const uvs = new Float32Array(landmarks.length * 2);
  landmarks.forEach((p, i) => {
    positions[i * 3] = (p.x - cx) / width * 2.02;
    positions[i * 3 + 1] = -(p.y - cy) / height * 2.30 + .16;
    positions[i * 3 + 2] = -(p.z - cz) / width * 1.95 + .30;
    uvs[i * 2] = p.x;
    uvs[i * 2 + 1] = 1 - p.y;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(trianglesFromMediaPipe(FaceLandmarker.FACE_LANDMARKS_TESSELATION));
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    roughness: .62,
    metalness: .0,
    clearcoat: .06,
    clearcoatRoughness: .76,
    side: THREE.DoubleSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 4;
  mesh.castShadow = true;
  return mesh;
}

function addBustGeometry(THREE, headRoot, bodyRoot, skinColor) {
  const skin = new THREE.MeshPhysicalMaterial({ color: skinColor, roughness: .72, metalness: 0, clearcoat: .025, clearcoatRoughness: .85 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x101216, roughness: .92, metalness: .02 });
  const suitMat = new THREE.MeshPhysicalMaterial({ color: 0x182d41, roughness: .69, metalness: .06, clearcoat: .08, clearcoatRoughness: .8 });
  const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xf3f5f6, roughness: .42, metalness: .04, clearcoat: .18, clearcoatRoughness: .5 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x090b0d, roughness: .78 });

  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), skin);
  skull.scale.set(1.01, 1.20, .88);
  skull.position.set(0, .24, -.48);
  skull.castShadow = true;
  headRoot.add(skull);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(1.035, 64, 32, 0, Math.PI * 2, 0, Math.PI * .47), hairMat);
  hairCap.scale.set(1.02, 1.19, .91);
  hairCap.position.set(0, .56, -.43);
  headRoot.add(hairCap);

  const fringeData = [
    [-.64, .90, .08, .34, .19, .18, -.18],
    [-.33, 1.00, .12, .42, .19, .19, -.08],
    [ .02, 1.02, .13, .43, .18, .20, .02],
    [ .37, .98, .10, .39, .18, .18, .10],
    [ .67, .87, .05, .30, .16, .16, .20]
  ];
  for (const [x,y,z,sx,sy,sz,rz] of fringeData) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), hairMat);
    lock.scale.set(sx, sy, sz);
    lock.position.set(x, y, z);
    lock.rotation.z = rz;
    headRoot.add(lock);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.39, .45, .72, 40), skin);
  neck.position.set(0, -1.27, -.43);
  bodyRoot.add(neck);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 28), suitMat);
  torso.scale.set(1.75, .70, .78);
  torso.position.set(0, -1.92, -.52);
  bodyRoot.add(torso);

  const shirt = new THREE.Mesh(new THREE.PlaneGeometry(.92, .80), whiteMat);
  shirt.position.set(0, -1.78, .19);
  bodyRoot.add(shirt);

  const tie = new THREE.Mesh(new THREE.BoxGeometry(.18, .64, .055), tieMat);
  tie.position.set(0, -1.92, .245);
  tie.rotation.z = -.015;
  bodyRoot.add(tie);

  const band = new THREE.Mesh(new THREE.TorusGeometry(.72, .047, 16, 96, Math.PI * 1.48), whiteMat);
  band.position.set(0, -1.22, .03);
  band.rotation.z = Math.PI * .76;
  band.scale.y = .78;
  bodyRoot.add(band);

  for (const side of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.BoxGeometry(.26, .43, .19, 4, 4, 4), whiteMat);
    cup.position.set(side * .66, -1.43, .18);
    cup.rotation.z = side * -.12;
    bodyRoot.add(cup);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(.20, .34, .07, 4, 4, 4), new THREE.MeshStandardMaterial({ color: 0xdde2e5, roughness: .8 }));
    pad.position.set(side * .66, -1.43, .285);
    pad.rotation.z = side * -.12;
    bodyRoot.add(pad);
  }
}

function setLiveState(text) {
  const label = stage?.querySelector('.live-chip span');
  if (label) label.textContent = text;
}

if (mount && stage) {
  (async () => {
    try {
      setLiveState('BUILDING TRUE 3D');
      const [THREE, vision] = await Promise.all([
        importFirst([
          'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js',
          'https://unpkg.com/three@0.169.0/build/three.module.js'
        ]),
        importFirst([
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/+esm',
          'https://esm.sh/@mediapipe/tasks-vision@0.10.14'
        ])
      ]);

      const { FaceLandmarker, FilesetResolver } = vision;
      const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const finePointer = matchMedia('(pointer:fine)').matches;

      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
      camera.position.set(0, -.18, 6.75);

      const world = new THREE.Group();
      const bodyRoot = new THREE.Group();
      const headRoot = new THREE.Group();
      headRoot.position.y = .32;
      world.add(bodyRoot, headRoot);
      scene.add(world);

      scene.add(new THREE.HemisphereLight(0xddeeff, 0x0a1118, 1.18));
      const key = new THREE.DirectionalLight(0xffffff, 2.1);
      key.position.set(2.6, 3.5, 5.5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x93c9e0, 1.0);
      fill.position.set(-3.6, .6, 3.0);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0x75b9d4, 1.45);
      rim.position.set(3.5, 2.0, -3.5);
      scene.add(rim);

      const portraitImage = await loadImage('./assets/digital-human.webp');
      const portraitTexture = new THREE.Texture(portraitImage);
      portraitTexture.colorSpace = THREE.SRGBColorSpace;
      portraitTexture.needsUpdate = true;
      portraitTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

      const wasm = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm');
      const landmarker = await FaceLandmarker.createFromOptions(wasm, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'IMAGE',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: .55,
        minFacePresenceConfidence: .55
      });

      const result = landmarker.detect(portraitImage);
      const landmarks = result.faceLandmarks?.[0];
      if (!landmarks?.length) throw new Error('No face landmarks detected in portrait');

      const skinColor = sampleSkinColor(THREE, portraitImage, landmarks);
      addBustGeometry(THREE, headRoot, bodyRoot, skinColor);
      const faceMesh = createFaceMesh(THREE, FaceLandmarker, landmarks, portraitTexture);
      headRoot.add(faceMesh);
      landmarker.close?.();

      const haloMat = new THREE.MeshBasicMaterial({ color: 0x7ab8cd, transparent: true, opacity: .055, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.02, .009, 8, 180), haloMat);
      ring1.position.set(.02, -.05, -1.0); ring1.rotation.set(1.18, .14, -.52); scene.add(ring1);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.37, .007, 8, 180, Math.PI * 1.72), haloMat.clone());
      ring2.material.opacity = .035; ring2.position.set(.02, -.05, -1.12); ring2.rotation.set(1.16, -.22, .72); scene.add(ring2);

      const pointer = { x: 0, y: 0, tx: 0, ty: 0, inside: false, speed: 0, lastX: 0, lastY: 0, lastAt: performance.now() };
      const attention = { value: 0, target: 0 };
      const yaw = { x: 0, v: 0 }, pitch = { x: 0, v: 0 }, roll = { x: 0, v: 0 };
      let focusPulse = 0;
      let lastInteraction = performance.now();

      if (finePointer && !reduceMotion) {
        stage.addEventListener('pointerenter', () => { pointer.inside = true; attention.target = 1; lastInteraction = performance.now(); }, { passive: true });
        stage.addEventListener('pointermove', (event) => {
          const rect = stage.getBoundingClientRect();
          const now = performance.now();
          const nx = ((event.clientX - rect.left) / rect.width - .5) * 2;
          const ny = ((event.clientY - rect.top) / rect.height - .5) * 2;
          const elapsed = Math.max(16, now - pointer.lastAt) / 1000;
          pointer.speed = clamp(Math.hypot(nx - pointer.lastX, ny - pointer.lastY) / elapsed, 0, 8);
          pointer.lastX = nx; pointer.lastY = ny; pointer.lastAt = now;
          pointer.tx = clamp(nx, -1, 1);
          pointer.ty = clamp(ny, -1, 1);
          lastInteraction = now;
        }, { passive: true });
        stage.addEventListener('pointerleave', () => { pointer.inside = false; attention.target = 0; pointer.tx = 0; pointer.ty = 0; }, { passive: true });
        stage.addEventListener('pointerdown', () => { focusPulse = 1; lastInteraction = performance.now(); }, { passive: true });
      }

      const resize = () => {
        const rect = mount.getBoundingClientRect();
        const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const compact = w < 520;
        world.scale.setScalar(compact ? .88 : .96);
        camera.position.z = compact ? 7.15 : 6.75;
      };
      resize();
      new ResizeObserver(resize).observe(mount);
      stage.classList.add('webgl-ready');
      setLiveState('TRUE 3D / AWARE');

      let visible = true;
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => { visible = entries.some(e => e.isIntersecting); }, { rootMargin: '140px' });
        io.observe(stage);
      }

      let last = performance.now();
      const render = now => {
        requestAnimationFrame(render);
        if (document.hidden || !visible) { last = now; return; }
        const dt = Math.min(.04, Math.max(.001, (now - last) / 1000));
        last = now;
        const t = now * .001;

        pointer.x = damp(pointer.x, pointer.tx, 10, dt);
        pointer.y = damp(pointer.y, pointer.ty, 10, dt);
        attention.value = damp(attention.value, attention.target, pointer.inside ? 7 : 2.2, dt);
        pointer.speed = damp(pointer.speed, 0, 4.5, dt);

        const idleFor = (now - lastInteraction) / 1000;
        const idleBlend = reduceMotion ? 0 : clamp((idleFor - 1.8) / 3.0, 0, 1) * (1 - attention.value);
        const idleYaw = (Math.sin(t * .29) * .045 + Math.sin(t * .13 + 1.4) * .022) * idleBlend;
        const idlePitch = (Math.sin(t * .23 + .7) * .018) * idleBlend;
        const responsiveness = 1 - clamp(pointer.speed / 7, 0, .34);
        const targetYaw = (pointer.x * .19 * attention.value * responsiveness) + idleYaw;
        const targetPitch = (-pointer.y * .105 * attention.value * responsiveness) + idlePitch;
        const targetRoll = (-pointer.x * .018 * attention.value) + Math.sin(t * .19) * .0025 * idleBlend;

        if (!reduceMotion) {
          springAxis(yaw, targetYaw, dt, 66, 14);
          springAxis(pitch, targetPitch, dt, 62, 14);
          springAxis(roll, targetRoll, dt, 52, 13);
          headRoot.rotation.set(pitch.x, yaw.x, roll.x);
          headRoot.position.z = .02 + focusPulse * .045;
          bodyRoot.rotation.y = yaw.x * .15;
          bodyRoot.rotation.x = pitch.x * .045;
          bodyRoot.position.y = Math.sin(t * 1.08) * .010;
          bodyRoot.scale.y = 1 + Math.sin(t * 1.08) * .0045;
          world.position.y = Math.sin(t * .58) * .006 - Math.min(.07, scrollY / Math.max(innerHeight, 1) * .05);
          ring1.rotation.z += dt * .055;
          ring2.rotation.z -= dt * .028;
          focusPulse = damp(focusPulse, 0, 3.8, dt);
        }

        key.position.x = damp(key.position.x, 2.6 + pointer.x * 1.6 * attention.value, 5.5, dt);
        key.position.y = damp(key.position.y, 3.5 - pointer.y * .8 * attention.value, 5.5, dt);
        fill.intensity = .92 + Math.abs(pointer.x) * .16 * attention.value;

        const label = stage.querySelector('.live-chip span');
        if (label && !reduceMotion) {
          if (pointer.inside && attention.value > .55) label.textContent = pointer.speed > 2.2 ? 'TRACKING MOTION' : 'TRACKING ATTENTION';
          else if (idleBlend > .45) label.textContent = 'TRUE 3D / IDLE';
          else label.textContent = 'TRUE 3D / AWARE';
        }

        renderer.render(scene, camera);
      };
      requestAnimationFrame(render);
    } catch (error) {
      console.warn('True 3D avatar unavailable; using static portrait fallback.', error);
      setLiveState('STATIC FALLBACK');
    }
  })();
}
