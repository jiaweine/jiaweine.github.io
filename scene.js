const mount = document.getElementById('avatar3d');
const fallback = document.getElementById('sceneFallback');

async function loadThree() {
  const sources = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.169.0/three.module.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js',
    'https://unpkg.com/three@0.169.0/build/three.module.js'
  ];
  let lastError;
  for (const src of sources) {
    try { return await import(src); } catch (error) { lastError = error; }
  }
  throw lastError || new Error('Three.js failed to load');
}

if (mount) {
  try {
    const THREE = await loadThree();
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = matchMedia('(pointer:fine)').matches;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0.1, 1.25, 7.7);

    const root = new THREE.Group();
    root.position.set(-0.15, -0.52, 0);
    root.rotation.y = -0.15;
    scene.add(root);

    const clay = new THREE.MeshPhysicalMaterial({ color: 0xcbb9aa, roughness: 0.72, metalness: 0.0, clearcoat: 0.04 });
    const clayShadow = new THREE.MeshStandardMaterial({ color: 0xb69c88, roughness: 0.78 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x181a18, roughness: 0.34, metalness: 0.04 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x2d302c, roughness: 0.65 });
    const shirtSoft = new THREE.MeshStandardMaterial({ color: 0x424640, roughness: 0.72 });
    const silver = new THREE.MeshPhysicalMaterial({ color: 0xc8cbc9, roughness: 0.2, metalness: 0.88, clearcoat: 0.22 });
    const charcoal = new THREE.MeshStandardMaterial({ color: 0x20221f, roughness: 0.52 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x9a806b, roughness: 0.78 });
    const keyboardMat = new THREE.MeshStandardMaterial({ color: 0xe5e1d8, roughness: 0.68 });
    const screenMat = new THREE.MeshStandardMaterial({ color: 0x1d211d, emissive: 0x27362c, emissiveIntensity: 0.45, roughness: 0.38 });
    const codeMat = new THREE.MeshStandardMaterial({ color: 0xaebdb0, emissive: 0x6a8970, emissiveIntensity: 0.48, roughness: 0.42 });
    const codeWarm = new THREE.MeshStandardMaterial({ color: 0xc7a191, emissive: 0x765147, emissiveIntensity: 0.35, roughness: 0.42 });

    const shadowify = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };
    const add = (mesh) => { root.add(shadowify(mesh)); return mesh; };
    const sphere = (radius, material, position, scale = [1, 1, 1], seg = 40) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, seg, Math.max(20, Math.round(seg / 2))), material);
      mesh.position.set(...position);
      mesh.scale.set(...scale);
      return add(mesh);
    };
    const box = (size, material, position, rotation = [0, 0, 0]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
      mesh.position.set(...position);
      mesh.rotation.set(...rotation);
      return add(mesh);
    };

    // Adult proportions: smaller head, longer torso, restrained clay finish.
    const torso = sphere(1, shirt, [0, 0.50, -0.05], [0.96, 1.18, 0.58], 44);
    sphere(0.29, clayShadow, [0, 1.40, 0.02], [0.72, 0.92, 0.7], 32);
    const head = sphere(1, clay, [0, 2.20, 0.10], [0.60, 0.78, 0.56], 56);
    sphere(0.16, clayShadow, [-0.60, 2.19, 0.09], [0.52, 0.78, 0.40], 26);
    sphere(0.16, clayShadow, [0.60, 2.19, 0.09], [0.52, 0.78, 0.40], 26);

    // Middle-part hair, shaped to read as a sculpted hairstyle rather than a cartoon cap.
    sphere(0.68, hair, [0, 2.58, -0.03], [0.88, 0.54, 0.82], 46);
    const leftHair = sphere(0.52, hair, [-0.28, 2.61, 0.20], [0.72, 0.70, 0.70], 42);
    leftHair.rotation.z = -0.18;
    const rightHair = sphere(0.52, hair, [0.28, 2.61, 0.20], [0.72, 0.70, 0.70], 42);
    rightHair.rotation.z = 0.18;
    box([0.13, 0.42, 0.18], hair, [-0.43, 2.43, 0.45], [0, 0, -0.28]);
    box([0.13, 0.42, 0.18], hair, [0.43, 2.43, 0.45], [0, 0, 0.28]);

    // Sword-like brows and monolid eyes.
    box([0.30, 0.038, 0.048], charcoal, [-0.245, 2.27, 0.635], [0, 0, -0.11]);
    box([0.30, 0.038, 0.048], charcoal, [0.245, 2.27, 0.635], [0, 0, 0.11]);
    const eyeGeo = new THREE.SphereGeometry(0.105, 24, 12);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x23241f, roughness: 0.48 });
    const eyeL = add(new THREE.Mesh(eyeGeo, eyeMat)); eyeL.position.set(-0.24, 2.13, 0.658); eyeL.scale.set(1, 0.15, 0.12);
    const eyeR = eyeL.clone(); eyeR.position.x = 0.24; root.add(eyeR);
    box([0.045, 0.13, 0.042], clayShadow, [0, 2.03, 0.662], [0.1, 0, 0]);
    box([0.20, 0.018, 0.04], new THREE.MeshStandardMaterial({ color: 0x8d6f66, roughness: 0.72 }), [0, 1.86, 0.647]);

    // Silver headphones resting around the neck.
    const band = add(new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.038, 16, 72, Math.PI * 1.48), silver));
    band.position.set(0, 1.31, 0.28); band.rotation.set(1.32, 0, 0.80);
    const cupGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.14, 28);
    const cupL = add(new THREE.Mesh(cupGeo, silver)); cupL.rotation.z = Math.PI / 2; cupL.position.set(-0.43, 1.29, 0.41);
    const cupR = cupL.clone(); cupR.position.x = 0.43; root.add(cupR);

    // Desk, keyboard and monitor form a restrained studio scene.
    box([4.25, 0.17, 1.34], wood, [0.55, -0.72, 1.24]);
    box([1.72, 0.08, 0.58], keyboardMat, [0.06, -0.53, 1.55], [-0.11, 0, 0]);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) {
      box([0.13, 0.026, 0.09], shirtSoft, [-0.48 + c * 0.145, -0.48, 1.39 + r * 0.14], [-0.11, 0, 0]);
    }
    box([2.05, 1.38, 0.09], silver, [1.62, 0.55, 0.86], [0, -0.22, 0]);
    const screen = box([1.82, 1.15, 0.025], screenMat, [1.58, 0.56, 0.76], [0, -0.22, 0]);
    box([0.10, 0.68, 0.10], silver, [1.58, -0.48, 0.91], [0, -0.22, 0]);
    box([0.66, 0.07, 0.34], silver, [1.60, -0.75, 0.95], [0, -0.22, 0]);
    for (let i = 0; i < 6; i++) {
      const width = [0.82, 0.54, 0.70, 0.94, 0.48, 0.76][i];
      const line = box([width, 0.028, 0.011], i === 0 ? codeWarm : codeMat, [1.08 + width * 0.07, 0.90 - i * 0.15, 0.675], [0, -0.22, 0]);
      if (i % 2) line.position.x += 0.16;
    }

    function cylinderBetween(from, to, radius, material) {
      const mesh = add(new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 28), material));
      const up = new THREE.Vector3(0, 1, 0);
      const update = (a, b) => {
        const direction = new THREE.Vector3().subVectors(b, a);
        mesh.position.copy(a).add(b).multiplyScalar(0.5);
        mesh.scale.set(1, direction.length(), 1);
        mesh.quaternion.setFromUnitVectors(up, direction.clone().normalize());
      };
      update(from, to);
      return { mesh, update };
    }

    const shoulderL = new THREE.Vector3(-0.69, 1.03, 0.16);
    const shoulderR = new THREE.Vector3(0.69, 1.03, 0.16);
    const restL = new THREE.Vector3(-0.40, -0.29, 1.48);
    const restR = new THREE.Vector3(0.44, -0.29, 1.50);
    const armL = cylinderBetween(shoulderL, restL, 0.145, shirtSoft);
    const armR = cylinderBetween(shoulderR, restR, 0.145, shirtSoft);
    const palmL = sphere(0.14, clay, restL.toArray(), [1.15, 0.52, 0.90], 28);
    const palmR = sphere(0.14, clay, restR.toArray(), [1.15, 0.52, 0.90], 28);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.11 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.83; floor.receiveShadow = true; scene.add(floor);

    const hemi = new THREE.HemisphereLight(0xfffbf2, 0x74766f, 2.2); scene.add(hemi);
    const key = new THREE.DirectionalLight(0xfff2e7, 4.0); key.position.set(-4.5, 7, 5.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0004; scene.add(key);
    const fill = new THREE.DirectionalLight(0xc9d1cc, 2.1); fill.position.set(4.5, 3, 1); scene.add(fill);
    const rim = new THREE.PointLight(0xc7d0ca, 5, 8); rim.position.set(-2.8, 2.5, -2.0); scene.add(rim);

    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    if (finePointer && !reduceMotion) {
      mount.addEventListener('pointermove', (event) => {
        const rect = mount.getBoundingClientRect();
        pointer.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        pointer.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
      }, { passive: true });
      mount.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });
    }

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const mobile = width < 560;
      root.scale.setScalar(mobile ? 0.78 : width < 760 ? 0.9 : 1);
      camera.position.z = mobile ? 8.5 : 7.7;
      camera.position.y = mobile ? 1.18 : 1.25;
    };
    resize();
    new ResizeObserver(resize).observe(mount);
    fallback?.classList.add('hidden');

    let last = performance.now();
    const render = (now) => {
      const dt = Math.min(0.04, (now - last) / 1000); last = now;
      const t = now * 0.001;
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 5);
      pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 5);

      if (!reduceMotion) {
        root.rotation.y = -0.15 + pointer.x * 0.09;
        root.rotation.x = pointer.y * 0.035;
        head.rotation.y = pointer.x * 0.055;
        head.rotation.x = -pointer.y * 0.028;
        const tapL = Math.sin(t * 8.2);
        const tapR = Math.sin(t * 8.2 + Math.PI);
        const left = new THREE.Vector3(-0.40, -0.29 + tapL * 0.026, 1.48 + Math.cos(t * 8.2) * 0.012);
        const right = new THREE.Vector3(0.44, -0.29 + tapR * 0.026, 1.50 + Math.cos(t * 8.2 + Math.PI) * 0.012);
        armL.update(shoulderL, left); armR.update(shoulderR, right);
        palmL.position.copy(left); palmR.position.copy(right);
        torso.scale.y = 1.18 + Math.sin(t * 1.55) * 0.006;
        const blinking = (t % 5.6) > 5.34;
        eyeL.scale.y = blinking ? 0.025 : 0.15;
        eyeR.scale.y = blinking ? 0.025 : 0.15;
        screen.material.emissiveIntensity = 0.43 + Math.sin(t * 2.0) * 0.04;
      }
      renderer.render(scene, camera);
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  } catch (error) {
    console.warn('3D portrait unavailable', error);
    fallback?.querySelector('small')?.replaceChildren(document.createTextNode('3D portrait unavailable'));
  }
}
