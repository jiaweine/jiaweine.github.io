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

function springAxis(state, target, dt, stiffness = 58, damping = 14) {
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

function createFaceFrame(landmarks) {
  const usable = landmarks.slice(0, 468);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (const p of usable) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }
  return {
    cx: (minX + maxX) * .5,
    cy: (minY + maxY) * .5,
    cz: (minZ + maxZ) * .5,
    width: Math.max(.001, maxX - minX),
    height: Math.max(.001, maxY - minY)
  };
}

function facePoint(THREE, p, frame) {
  return new THREE.Vector3(
    (p.x - frame.cx) / frame.width * 2.02,
    -(p.y - frame.cy) / frame.height * 2.30 + .16,
    -(p.z - frame.cz) / frame.width * 1.78 + .28
  );
}

function sampleSkinColor(THREE, image, landmarks) {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  const sampleIds = [10, 50, 101, 205, 280, 330, 425, 152];
  let r = 0, g = 0, b = 0, n = 0;
  for (const id of sampleIds) {
    const p = landmarks[id];
    if (!p) continue;
    const x = clamp(Math.round(p.x * canvas.width), 3, canvas.width - 4);
    const y = clamp(Math.round(p.y * canvas.height), 3, canvas.height - 4);
    const data = ctx.getImageData(x - 3, y - 3, 7, 7).data;
    for (let i = 0; i < data.length; i += 4) {
      const rr = data[i], gg = data[i + 1], bb = data[i + 2];
      const light = (rr + gg + bb) / 3;
      const chroma = Math.max(rr, gg, bb) - Math.min(rr, gg, bb);
      if (light > 82 && light < 232 && rr > bb * .98 && chroma > 5) {
        r += rr; g += gg; b += bb; n += 1;
      }
    }
  }

  const sampled = n ? new THREE.Color(r / n / 255, g / n / 255, b / n / 255) : new THREE.Color(0xd7ad99);
  const hsl = {};
  sampled.getHSL(hsl);
  sampled.setHSL(hsl.h, clamp(hsl.s, .20, .44), clamp(hsl.l, .54, .70));
  sampled.lerp(new THREE.Color(0xd4aa94), .34);
  return sampled;
}

function createFaceMesh(THREE, FaceLandmarker, landmarks, texture, frame) {
  const positions = new Float32Array(468 * 3);
  const uvs = new Float32Array(468 * 2);

  for (let i = 0; i < 468; i += 1) {
    const p = landmarks[i];
    const v = facePoint(THREE, p, frame);
    positions[i * 3] = v.x;
    positions[i * 3 + 1] = v.y;
    positions[i * 3 + 2] = v.z;
    uvs[i * 2] = p.x;
    uvs[i * 2 + 1] = 1 - p.y;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(trianglesFromMediaPipe(FaceLandmarker.FACE_LANDMARKS_TESSELATION));
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    map: texture,
    roughness: .78,
    metalness: 0,
    clearcoat: .025,
    clearcoatRoughness: .88,
    side: THREE.FrontSide
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 6;
  mesh.castShadow = true;
  return mesh;
}

function averagePoint(THREE, landmarks, ids, frame) {
  const v = new THREE.Vector3();
  let n = 0;
  for (const id of ids) {
    if (!landmarks[id]) continue;
    v.add(facePoint(THREE, landmarks[id], frame));
    n += 1;
  }
  return n ? v.multiplyScalar(1 / n) : v;
}

function createEyeRig(THREE, landmarks, frame) {
  const rig = new THREE.Group();
  const gazeRoots = [];
  const scleraMat = new THREE.MeshPhysicalMaterial({ color: 0xf2eee9, roughness: .32, clearcoat: .14, clearcoatRoughness: .28 });
  const irisMat = new THREE.MeshPhysicalMaterial({ color: 0x51443a, roughness: .55, clearcoat: .12, clearcoatRoughness: .35 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x11100f });
  const corneaMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .12, roughness: .04, transmission: .15, depthWrite: false });

  const specs = [
    { ids: [33, 133, 159, 145], iris: 468 },
    { ids: [362, 263, 386, 374], iris: 473 }
  ];

  for (const spec of specs) {
    const eyelidCenter = averagePoint(THREE, landmarks, spec.ids, frame);
    const irisPoint = landmarks[spec.iris] ? facePoint(THREE, landmarks[spec.iris], frame) : eyelidCenter.clone();
    const root = new THREE.Group();
    root.position.copy(eyelidCenter);
    root.position.z -= .075;

    const sclera = new THREE.Mesh(new THREE.SphereGeometry(.145, 36, 24), scleraMat);
    sclera.scale.set(1.18, .68, .72);
    root.add(sclera);

    const gaze = new THREE.Group();
    root.add(gaze);

    const iris = new THREE.Mesh(new THREE.CircleGeometry(.056, 36), irisMat);
    iris.position.set((irisPoint.x - eyelidCenter.x) * .25, (irisPoint.y - eyelidCenter.y) * .25, .112);
    gaze.add(iris);

    const pupil = new THREE.Mesh(new THREE.CircleGeometry(.026, 30), pupilMat);
    pupil.position.set(iris.position.x, iris.position.y, .115);
    gaze.add(pupil);

    const cornea = new THREE.Mesh(new THREE.CircleGeometry(.066, 36), corneaMat);
    cornea.position.set(iris.position.x, iris.position.y, .118);
    gaze.add(cornea);

    rig.add(root);
    gazeRoots.push(gaze);
  }

  return { rig, gazeRoots };
}

function addBustGeometry(THREE, headRoot, bodyRoot, skinColor) {
  const skin = new THREE.MeshPhysicalMaterial({ color: skinColor, roughness: .77, metalness: 0, clearcoat: .02, clearcoatRoughness: .9 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x101319, roughness: .94, metalness: .01 });
  const suitMat = new THREE.MeshPhysicalMaterial({ color: 0x183149, roughness: .74, metalness: .035, clearcoat: .035, clearcoatRoughness: .88 });
  const lapelMat = new THREE.MeshStandardMaterial({ color: 0x142a3e, roughness: .82 });
  const whiteMat = new THREE.MeshPhysicalMaterial({ color: 0xf1f3f4, roughness: .48, metalness: .025, clearcoat: .10, clearcoatRoughness: .58 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xd8dde0, roughness: .86 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: .82 });

  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 56, 40), skin);
  skull.scale.set(.99, 1.16, .84);
  skull.position.set(0, .22, -.50);
  skull.castShadow = true;
  headRoot.add(skull);

  const hairCap = new THREE.Mesh(new THREE.SphereGeometry(1.025, 56, 30, 0, Math.PI * 2, 0, Math.PI * .50), hairMat);
  hairCap.scale.set(1.02, 1.17, .88);
  hairCap.position.set(0, .53, -.45);
  headRoot.add(hairCap);

  const fringeData = [
    [-.62, .86, .01, .31, .17, .16, -.16],
    [-.31, .96, .08, .40, .17, .18, -.08],
    [ .02, .98, .09, .42, .17, .19, .01],
    [ .35, .94, .06, .37, .17, .17, .09],
    [ .63, .84, .00, .28, .15, .15, .17]
  ];
  for (const [x, y, z, sx, sy, sz, rz] of fringeData) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(1, 22, 12), hairMat);
    lock.scale.set(sx, sy, sz);
    lock.position.set(x, y, z);
    lock.rotation.z = rz;
    headRoot.add(lock);
  }

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.35, .42, .70, 36), skin);
  neck.position.set(0, -1.05, -.42);
  neck.scale.z = .90;
  bodyRoot.add(neck);

  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 52, 26), suitMat);
  torso.scale.set(1.76, .78, .76);
  torso.position.set(0, -1.77, -.54);
  bodyRoot.add(torso);

  const shirt = new THREE.Mesh(new THREE.CircleGeometry(.52, 48, Math.PI * .10, Math.PI * .80), whiteMat);
  shirt.scale.set(.95, 1.15, 1);
  shirt.position.set(0, -1.61, .18);
  shirt.rotation.z = Math.PI * .10;
  bodyRoot.add(shirt);

  const lapelGeom = new THREE.BufferGeometry();
  lapelGeom.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -.02, 0,  -.86, .28, 0,  -.34, -.58, 0,
    0, -.02, 0,   .86, .28, 0,   .34, -.58, 0
  ], 3));
  lapelGeom.computeVertexNormals();
  const lapels = new THREE.Mesh(lapelGeom, lapelMat);
  lapels.position.set(0, -1.67, .235);
  bodyRoot.add(lapels);

  const tie = new THREE.Mesh(new THREE.CylinderGeometry(.075, .105, .63, 16), tieMat);
  tie.position.set(0, -1.88, .27);
  bodyRoot.add(tie);

  const band = new THREE.Mesh(new THREE.TorusGeometry(.67, .042, 18, 110, Math.PI * 1.42), whiteMat);
  band.position.set(0, -1.04, -.02);
  band.rotation.z = Math.PI * .79;
  band.scale.y = .82;
  bodyRoot.add(band);

  for (const side of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), whiteMat);
    cup.scale.set(.15, .25, .115);
    cup.position.set(side * .61, -1.30, .12);
    cup.rotation.z = side * -.10;
    bodyRoot.add(cup);

    const pad = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), padMat);
    pad.scale.set(.12, .205, .060);
    pad.position.set(side * .61, -1.30, .225);
    pad.rotation.z = side * -.10;
    bodyRoot.add(pad);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(.028, .028, .28, 14), whiteMat);
    arm.position.set(side * .53, -1.12, .055);
    arm.rotation.z = side * -.28;
    bodyRoot.add(arm);
  }
}

function setLiveState(text) {
  const label = stage?.querySelector('.live-chip span');
  if (label) label.textContent = text;
}

if (mount && stage) {
  (async () => {
    try {
      setLiveState('CALIBRATING 3D');
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
      renderer.setPixelRatio(Math.min(devicePixelRatio, 1.55));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = .98;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.setClearColor(0x000000, 0);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(29, 1, .1, 100);
      camera.position.set(0, -.20, 7.12);

      const world = new THREE.Group();
      const bodyRoot = new THREE.Group();
      const headRoot = new THREE.Group();
      headRoot.position.set(0, .17, .02);
      headRoot.scale.setScalar(.84);
      bodyRoot.position.y = .02;
      world.add(bodyRoot, headRoot);
      scene.add(world);

      scene.add(new THREE.HemisphereLight(0xddeeff, 0x0a1118, 1.02));
      const key = new THREE.DirectionalLight(0xffffff, 1.72);
      key.position.set(2.5, 3.4, 5.5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x9bc9dc, .72);
      fill.position.set(-3.2, .8, 3.0);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0x6eaec7, 1.05);
      rim.position.set(3.4, 1.9, -3.4);
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

      const frame = createFaceFrame(landmarks);
      const skinColor = sampleSkinColor(THREE, portraitImage, landmarks);
      addBustGeometry(THREE, headRoot, bodyRoot, skinColor);

      const eyeRig = createEyeRig(THREE, landmarks, frame);
      headRoot.add(eyeRig.rig);

      const faceMesh = createFaceMesh(THREE, FaceLandmarker, landmarks, portraitTexture, frame);
      headRoot.add(faceMesh);
      landmarker.close?.();

      const haloMat = new THREE.MeshBasicMaterial({ color: 0x7ab8cd, transparent: true, opacity: .045, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
      const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.0, .008, 8, 170), haloMat);
      ring1.position.set(.02, -.08, -1.0); ring1.rotation.set(1.18, .14, -.52); scene.add(ring1);
      const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.32, .006, 8, 170, Math.PI * 1.72), haloMat.clone());
      ring2.material.opacity = .028; ring2.position.set(.02, -.08, -1.12); ring2.rotation.set(1.16, -.22, .72); scene.add(ring2);

      const pointer = { x: 0, y: 0, tx: 0, ty: 0, inside: false, speed: 0, lastX: 0, lastY: 0, lastAt: performance.now() };
      const attention = { value: 0, target: 0 };
      const yaw = { x: 0, v: 0 }, pitch = { x: 0, v: 0 }, roll = { x: 0, v: 0 };
      const gazeX = { x: 0, v: 0 }, gazeY = { x: 0, v: 0 };
      let focusPulse = 0;
      let lastInteraction = performance.now();

      if (finePointer && !reduceMotion) {
        stage.addEventListener('pointerenter', () => {
          pointer.inside = true;
          attention.target = 1;
          lastInteraction = performance.now();
        }, { passive: true });

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

        stage.addEventListener('pointerleave', () => {
          pointer.inside = false;
          attention.target = 0;
          pointer.tx = 0;
          pointer.ty = 0;
        }, { passive: true });

        stage.addEventListener('pointerdown', () => {
          focusPulse = 1;
          lastInteraction = performance.now();
        }, { passive: true });
      }

      const resize = () => {
        const rect = mount.getBoundingClientRect();
        const w = Math.max(1, rect.width), h = Math.max(1, rect.height);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        const compact = w < 520;
        world.scale.setScalar(compact ? .90 : .98);
        camera.position.z = compact ? 7.45 : 7.12;
      };
      resize();
      new ResizeObserver(resize).observe(mount);
      stage.classList.add('webgl-ready');
      setLiveState('TRUE 3D / CALM');

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

        pointer.x = damp(pointer.x, pointer.tx, 11.5, dt);
        pointer.y = damp(pointer.y, pointer.ty, 11.5, dt);
        attention.value = damp(attention.value, attention.target, pointer.inside ? 7.5 : 2.5, dt);
        pointer.speed = damp(pointer.speed, 0, 4.8, dt);

        const idleFor = (now - lastInteraction) / 1000;
        const idleBlend = reduceMotion ? 0 : clamp((idleFor - 2.1) / 3.4, 0, 1) * (1 - attention.value);
        const idleYaw = (Math.sin(t * .23) * .025 + Math.sin(t * .11 + 1.4) * .010) * idleBlend;
        const idlePitch = Math.sin(t * .19 + .7) * .010 * idleBlend;
        const responsiveness = 1 - clamp(pointer.speed / 7, 0, .45);

        const targetGazeX = (pointer.x * .20 * attention.value) + Math.sin(t * .31) * .015 * idleBlend;
        const targetGazeY = (-pointer.y * .13 * attention.value) + Math.sin(t * .27 + 1.1) * .010 * idleBlend;
        const targetYaw = (pointer.x * .105 * attention.value * responsiveness) + idleYaw;
        const targetPitch = (-pointer.y * .058 * attention.value * responsiveness) + idlePitch;
        const targetRoll = (-pointer.x * .008 * attention.value) + Math.sin(t * .17) * .0015 * idleBlend;

        if (!reduceMotion) {
          springAxis(gazeX, targetGazeX, dt, 92, 18);
          springAxis(gazeY, targetGazeY, dt, 92, 18);
          for (const gaze of eyeRig.gazeRoots) gaze.rotation.set(gazeY.x, gazeX.x, 0);

          springAxis(yaw, targetYaw, dt, 54, 14.5);
          springAxis(pitch, targetPitch, dt, 52, 14.5);
          springAxis(roll, targetRoll, dt, 46, 14);
          headRoot.rotation.set(pitch.x, yaw.x, roll.x);
          headRoot.position.z = .02 + focusPulse * .028;
          bodyRoot.rotation.y = yaw.x * .10;
          bodyRoot.rotation.x = pitch.x * .025;
          bodyRoot.position.y = .02 + Math.sin(t * 1.02) * .006;
          bodyRoot.scale.y = 1 + Math.sin(t * 1.02) * .0026;
          world.position.y = Math.sin(t * .52) * .004 - Math.min(.055, scrollY / Math.max(innerHeight, 1) * .04);
          ring1.rotation.z += dt * .045;
          ring2.rotation.z -= dt * .022;
          focusPulse = damp(focusPulse, 0, 4.2, dt);
        }

        key.position.x = damp(key.position.x, 2.5 + pointer.x * .85 * attention.value, 5.8, dt);
        key.position.y = damp(key.position.y, 3.4 - pointer.y * .45 * attention.value, 5.8, dt);
        fill.intensity = .70 + Math.abs(pointer.x) * .09 * attention.value;

        const label = stage.querySelector('.live-chip span');
        if (label && !reduceMotion) {
          if (pointer.inside && attention.value > .55) label.textContent = pointer.speed > 2.3 ? 'EYES LOCK / HEAD DAMPED' : 'ATTENTION LOCK';
          else if (idleBlend > .45) label.textContent = 'TRUE 3D / IDLE';
          else label.textContent = 'TRUE 3D / CALM';
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
