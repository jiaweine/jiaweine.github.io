import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const mount = document.getElementById('avatar3d');
const fallback = document.getElementById('sceneFallback');
if (!mount) throw new Error('3D mount missing');

const ASSET_BASE = 'https://raw.githubusercontent.com/mrdoob/three.js/r169/examples/models/gltf/LeePerrySmith/';
const MODEL_URL = `${ASSET_BASE}LeePerrySmith.glb`;
const COLOR_URL = `${ASSET_BASE}Map-COL.jpg`;
const NORMAL_URL = `${ASSET_BASE}Infinite-Level_02_Tangent_SmoothUV.jpg`;

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer:fine)').matches;

function loadGLTF(url) {
  return new Promise((resolve, reject) => new GLTFLoader().load(url, resolve, undefined, reject));
}

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(url, resolve, undefined, reject);
  });
}

function addMesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeCurveMesh(parent, points, radius, material, segments = 34) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return addMesh(parent, new THREE.TubeGeometry(curve, segments, radius, 10, false), material);
}

function sculptFaceGeometry(geometry) {
  const g = geometry.clone();
  g.computeBoundingBox();
  const box = g.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const pos = g.attributes.position;
  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const ny = (v.y - box.min.y) / Math.max(size.y, 1e-5);
    const nx = Math.abs((v.x - center.x) / Math.max(size.x * .5, 1e-5));
    const front = (v.z - center.z) / Math.max(size.z * .5, 1e-5);

    // Refine the lower third toward a cleaner V-line without destroying the scan detail.
    let xScale = .975;
    if (ny < .43) xScale *= .90 + ny * .18;
    if (ny > .50 && ny < .68) xScale *= 1.018;
    if (nx > .82) xScale *= .99;
    v.x = center.x + (v.x - center.x) * xScale;

    // Slightly strengthen the chin and face projection for a sharper profile.
    if (ny < .28 && front > .15) v.z += size.z * .014 * (1 - ny / .28);
    if (ny > .48 && ny < .62 && front > .3) v.z += size.z * .006;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  pos.needsUpdate = true;
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

async function init() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0d0c, .028);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .045).texture;
  room.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(28, 1, .1, 100);
  camera.position.set(.18, 1.22, 7.35);

  const portrait = new THREE.Group();
  portrait.position.set(.20, -.72, 0);
  portrait.rotation.y = -.10;
  scene.add(portrait);

  const torsoRig = new THREE.Group();
  portrait.add(torsoRig);

  const headRig = new THREE.Group();
  portrait.add(headRig);

  const fabric = new THREE.MeshPhysicalMaterial({
    color: 0x131715,
    roughness: .78,
    metalness: .02,
    sheen: .35,
    sheenColor: new THREE.Color(0x626c65),
    envMapIntensity: .65
  });
  const fabricEdge = new THREE.MeshStandardMaterial({ color: 0x242a26, roughness: .74 });
  const hairMat = new THREE.MeshPhysicalMaterial({
    color: 0x111211,
    roughness: .31,
    metalness: .03,
    clearcoat: .1,
    clearcoatRoughness: .6,
    envMapIntensity: .9
  });
  const hairSoft = new THREE.MeshStandardMaterial({ color: 0x1a1c19, roughness: .42 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x171815, roughness: .48 });
  const skinOverlay = new THREE.MeshStandardMaterial({ color: 0xb8785d, roughness: .58 });
  const silver = new THREE.MeshPhysicalMaterial({
    color: 0xd3d7db,
    metalness: .96,
    roughness: .15,
    clearcoat: .55,
    clearcoatRoughness: .14,
    envMapIntensity: 1.35
  });
  const headphoneDark = new THREE.MeshPhysicalMaterial({ color: 0x202422, roughness: .28, metalness: .38 });

  // Tailored upper body: broad enough to read as a portrait, quiet enough not to feel like a toy.
  const torso = addMesh(torsoRig, new THREE.CapsuleGeometry(.82, 1.28, 12, 48), fabric, [0, -.04, -.18], [1.28, 1, .71]);
  torso.rotation.x = -.035;
  addMesh(torsoRig, new THREE.SphereGeometry(.70, 48, 30), fabricEdge, [-.69, .35, -.12], [.82, .74, .72]);
  addMesh(torsoRig, new THREE.SphereGeometry(.70, 48, 30), fabricEdge, [.69, .35, -.12], [.82, .74, .72]);
  addMesh(torsoRig, new THREE.CylinderGeometry(.29, .39, .72, 48), skinOverlay, [0, .93, -.01], [1, 1, .9]);

  // Silver headphones resting around the neck.
  const band = addMesh(torsoRig, new THREE.TorusGeometry(.50, .043, 18, 112, Math.PI * 1.44), silver, [0, .84, .19]);
  band.rotation.set(1.39, 0, .79);
  for (const side of [-1, 1]) {
    const cup = addMesh(torsoRig, new THREE.CylinderGeometry(.145, .145, .115, 40), silver, [side * .48, .77, .37]);
    cup.rotation.z = Math.PI / 2;
    const cushion = addMesh(torsoRig, new THREE.CylinderGeometry(.116, .116, .12, 40), headphoneDark, [side * .48, .77, .37], [.88, 1, .88]);
    cushion.rotation.z = Math.PI / 2;
  }

  const [gltf, colorResult, normalResult] = await Promise.all([
    loadGLTF(MODEL_URL),
    loadTexture(COLOR_URL).catch(() => null),
    loadTexture(NORMAL_URL).catch(() => null)
  ]);

  const colorMap = colorResult;
  const normalMap = normalResult;
  if (colorMap) colorMap.colorSpace = THREE.SRGBColorSpace;
  if (normalMap) normalMap.colorSpace = THREE.NoColorSpace;

  const faceMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xc98b6f,
    map: colorMap || null,
    normalMap: normalMap || null,
    normalScale: new THREE.Vector2(.32, .32),
    roughness: .46,
    metalness: 0,
    clearcoat: .08,
    clearcoatRoughness: .78,
    sheen: .12,
    sheenColor: new THREE.Color(0xffc5aa),
    envMapIntensity: .82
  });

  const scan = gltf.scene.clone(true);
  scan.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry = sculptFaceGeometry(obj.geometry);
    obj.material = faceMaterial;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });

  // Normalize the scan to a predictable portrait coordinate system.
  scan.updateMatrixWorld(true);
  const sourceBox = new THREE.Box3().setFromObject(scan);
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  const targetHeight = 2.63;
  const scale = targetHeight / Math.max(sourceSize.y, 1e-5);
  scan.scale.setScalar(scale);
  scan.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(scan);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  scan.position.x -= scaledCenter.x;
  scan.position.y += 1.99 - scaledCenter.y;
  scan.position.z -= scaledCenter.z + .03;
  headRig.add(scan);

  // Hair cap and sculpted clumps: middle part, layered rather than spaghetti-like single tubes.
  const hairCap = addMesh(headRig, new THREE.SphereGeometry(.84, 72, 52, 0, Math.PI * 2, 0, Math.PI * .58), hairSoft, [0, 2.56, -.07], [.94, .76, .86]);
  hairCap.rotation.x = .02;

  const clumps = [
    [[-.02,2.93,.24],[-.12,2.84,.43],[-.30,2.69,.55],[-.46,2.48,.54],[-.53,2.23,.42]],
    [[-.07,2.94,.16],[-.22,2.82,.35],[-.41,2.62,.43],[-.55,2.38,.36],[-.58,2.15,.23]],
    [[-.13,2.90,.05],[-.31,2.78,.19],[-.50,2.57,.23],[-.61,2.34,.14],[-.62,2.10,.03]],
    [[-.20,2.82,-.06],[-.40,2.72,.02],[-.58,2.54,.01],[-.67,2.28,-.07]],
    [[-.05,2.92,.33],[-.15,2.78,.53],[-.34,2.56,.63],[-.48,2.29,.56]],
    [[-.12,2.87,.40],[-.25,2.70,.59],[-.42,2.45,.64],[-.49,2.19,.51]],
    [[-.24,2.76,.28],[-.39,2.60,.45],[-.53,2.38,.43],[-.57,2.17,.31]]
  ];
  clumps.forEach((strand, i) => makeCurveMesh(headRig, strand, i < 2 ? .07 : .062, i % 2 ? hairSoft : hairMat, 38));
  clumps.forEach((strand, i) => makeCurveMesh(headRig, strand.map(([x, y, z]) => [-x, y, z]), i < 2 ? .07 : .062, i % 2 ? hairSoft : hairMat, 38));
  makeCurveMesh(headRig, [[0,2.94,.30],[0,2.86,.40],[0,2.75,.46]], .012, skinOverlay, 22);

  // Sword-shaped brows and subtle monolid crease overlays.
  for (const side of [-1, 1]) {
    const browPoints = side < 0
      ? [[-.10,2.19,.735],[-.22,2.215,.755],[-.37,2.235,.73],[-.49,2.24,.66]]
      : [[.10,2.19,.735],[.22,2.215,.755],[.37,2.235,.73],[.49,2.24,.66]];
    makeCurveMesh(headRig, browPoints, .025, browMat, 28);

    const lidPoints = side < 0
      ? [[-.12,2.03,.755],[-.24,2.048,.775],[-.39,2.028,.745]]
      : [[.12,2.03,.755],[.24,2.048,.775],[.39,2.028,.745]];
    makeCurveMesh(headRig, lidPoints, .009, skinOverlay, 22);
  }

  // Lighting: warm key, neutral fill, cool rim + subtle accent lift.
  scene.add(new THREE.HemisphereLight(0xf1e9df, 0x111512, 1.18));
  const key = new THREE.DirectionalLight(0xffd7c5, 3.7);
  key.position.set(-3.8, 5.9, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = .5;
  key.shadow.camera.far = 18;
  key.shadow.bias = -.00035;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe4ece9, 1.55);
  fill.position.set(4.6, 2.4, 3.4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xdce9ff, 2.15);
  rim.position.set(3.4, 4.2, -4.2);
  scene.add(rim);

  const accent = new THREE.PointLight(0xff744f, 2.4, 7.5, 2);
  accent.position.set(-2.8, .4, 3.2);
  scene.add(accent);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), new THREE.ShadowMaterial({ color: 0x000000, opacity: .28 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.21;
  floor.receiveShadow = true;
  scene.add(floor);

  const dustCount = 80;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - .5) * 7.2;
    dustPositions[i * 3 + 1] = Math.random() * 5.4 - 1.1;
    dustPositions[i * 3 + 2] = Math.random() * 4.8 - 1.2;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xe9e6df, size: .009, transparent: true, opacity: .18, depthWrite: false }));
  scene.add(dust);

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
      portrait.scale.setScalar(.78);
      portrait.position.set(.38, -.57, 0);
      camera.position.set(.10, 1.24, 8.0);
    } else if (width < 850) {
      portrait.scale.setScalar(.90);
      portrait.position.set(.29, -.65, 0);
      camera.position.set(.14, 1.22, 7.65);
    } else {
      portrait.scale.setScalar(1);
      portrait.position.set(.20, -.72, 0);
      camera.position.set(.18, 1.22, 7.35);
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

    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 5.2);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 5.2);
    scrollState.value += (scrollState.target - scrollState.value) * Math.min(1, dt * 3.2);

    if (!reduceMotion) {
      portrait.rotation.y = -.10 + pointer.x * .045 + scrollState.value * .10;
      portrait.rotation.x = pointer.y * .014 - scrollState.value * .012;
      headRig.rotation.y = pointer.x * .075;
      headRig.rotation.x = -pointer.y * .032;
      headRig.position.y = Math.sin(t * 1.18) * .006;
      torsoRig.scale.y = 1 + Math.sin(t * 1.18) * .0035;
      camera.position.y = 1.22 - scrollState.value * .12;
      camera.position.x = .18 + scrollState.value * .08;
      camera.lookAt(.18, 1.08 - scrollState.value * .10, 0);
      dust.rotation.y = t * .008;
    } else {
      camera.lookAt(.18, 1.08, 0);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

init().catch((error) => {
  console.warn('3D portrait unavailable', error);
  fallback?.querySelector('strong')?.replaceChildren(document.createTextNode('Realtime portrait unavailable'));
});
