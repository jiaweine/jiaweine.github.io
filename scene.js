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

function makeTube(parent, points, radius, material, segments = 30) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return addMesh(parent, new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
}

function makeHairAlphaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#202020';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const rand = (seed) => {
    const x = Math.sin(seed * 1337.17) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 160; i++) {
    const x = 3 + rand(i + 1) * 122;
    const drift = (rand(i + 31) - .5) * 17;
    ctx.beginPath();
    ctx.moveTo(x, -8);
    ctx.bezierCurveTo(x + drift * .25, 150, x - drift * .18, 330, x + drift, 520);
    const light = 140 + Math.floor(rand(i + 61) * 90);
    ctx.strokeStyle = `rgba(${light},${light},${light},${.32 + rand(i + 91) * .64})`;
    ctx.lineWidth = .35 + rand(i + 121) * .86;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function makeRibbonGeometry(points, width = .085, segments = 22) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const vertices = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const front = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    curve.getTangentAt(Math.min(.999, t), tangent).normalize();
    side.crossVectors(tangent, front).normalize();
    if (side.lengthSq() < .01) side.set(1, 0, 0);
    const taper = Math.max(.14, Math.sin(Math.PI * (.05 + t * .90)));
    const half = width * taper * .5;
    vertices.push(
      p.x - side.x * half, p.y - side.y * half, p.z - side.z * half,
      p.x + side.x * half, p.y + side.y * half, p.z + side.z * half
    );
    normals.push(0, 0, 1, 0, 0, 1);
    uvs.push(0, t * 1.55, 1, t * 1.55);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function addHairRibbon(parent, points, width, material) {
  const mesh = addMesh(parent, makeRibbonGeometry(points, width, 24), material);
  mesh.renderOrder = 3;
  return mesh;
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
    const front = (v.z - center.z) / Math.max(size.z * .5, 1e-5);
    let xScale = .992;
    if (ny < .40) xScale *= .95 + ny * .10;
    if (ny > .50 && ny < .68) xScale *= 1.006;
    v.x = center.x + (v.x - center.x) * xScale;
    if (ny < .27 && front > .18) v.z += size.z * .008 * (1 - ny / .27);
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
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .90;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0d0c, .024);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .04).texture;
  room.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(27, 1, .1, 100);
  camera.position.set(.10, 1.52, 6.35);
  const portrait = new THREE.Group();
  portrait.position.set(.17, -.40, 0);
  portrait.rotation.y = -.065;
  scene.add(portrait);
  const headRig = new THREE.Group();
  portrait.add(headRig);

  const hairAlpha = makeHairAlphaTexture();
  const hairCardMaterial = new THREE.MeshStandardMaterial({ color: 0x070807, roughness: .78, alphaMap: hairAlpha, transparent: true, alphaTest: .15, side: THREE.DoubleSide, depthWrite: true });
  const hairScalpMaterial = new THREE.MeshPhysicalMaterial({ color: 0x090a09, roughness: .54, metalness: .01, clearcoat: .02, envMapIntensity: .38 });
  const scleraMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe8e2da, roughness: .36, clearcoat: .24, clearcoatRoughness: .18 });
  const irisMaterial = new THREE.MeshPhysicalMaterial({ color: 0x2d1c15, roughness: .20, clearcoat: .72, clearcoatRoughness: .08 });
  const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x060605 });
  const corneaMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .06, roughness: .03, clearcoat: 1, clearcoatRoughness: .02 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xd8dbde, metalness: .98, roughness: .14, clearcoat: .48, clearcoatRoughness: .13, envMapIntensity: 1.35 });
  const cushionMaterial = new THREE.MeshPhysicalMaterial({ color: 0x1a1d1b, metalness: .14, roughness: .42 });

  const [gltf, colorMap, normalMap] = await Promise.all([
    loadGLTF(MODEL_URL),
    loadTexture(COLOR_URL),
    loadTexture(NORMAL_URL).catch(() => null)
  ]);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  if (normalMap) normalMap.colorSpace = THREE.NoColorSpace;

  const faceMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: colorMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(.19, .19),
    roughness: .60,
    metalness: 0,
    clearcoat: .015,
    clearcoatRoughness: .90,
    sheen: .015,
    sheenColor: new THREE.Color(0xffd8ca),
    envMapIntensity: .64
  });

  const scan = gltf.scene.clone(true);
  scan.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry = sculptFaceGeometry(obj.geometry);
    obj.material = faceMaterial;
    obj.castShadow = true;
    obj.receiveShadow = true;
  });
  scan.updateMatrixWorld(true);
  const sourceBox = new THREE.Box3().setFromObject(scan);
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  scan.scale.setScalar(2.63 / Math.max(sourceSize.y, 1e-5));
  scan.updateMatrixWorld(true);
  const scaledBox = new THREE.Box3().setFromObject(scan);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  scan.position.x -= scaledCenter.x;
  scan.position.y += 1.99 - scaledCenter.y;
  scan.position.z -= scaledCenter.z + .03;
  headRig.add(scan);

  const eyes = [];
  for (const side of [-1, 1]) {
    const eyeRig = new THREE.Group();
    eyeRig.position.set(side * .258, 2.475, .535);
    headRig.add(eyeRig);
    addMesh(eyeRig, new THREE.SphereGeometry(.078, 40, 28), scleraMaterial, [0, 0, 0], [1.16, .78, .94]);
    addMesh(eyeRig, new THREE.SphereGeometry(.030, 30, 22), irisMaterial, [0, 0, .067], [1, .92, .38]);
    addMesh(eyeRig, new THREE.SphereGeometry(.0125, 24, 18), pupilMaterial, [0, 0, .078], [1, 1, .35]);
    addMesh(eyeRig, new THREE.SphereGeometry(.080, 40, 28), corneaMaterial, [0, 0, .002], [1.16, .78, .94]);
    eyes.push({ rig: eyeRig, side });
  }

  // Crown stops above the brow line. Hair cards carry the front shape so the cap never becomes a visor.
  const scalp = addMesh(headRig, new THREE.SphereGeometry(.77, 80, 52, 0, Math.PI * 2, 0, Math.PI * .34), hairScalpMaterial, [0, 2.535, .045], [.91, .60, .84]);
  scalp.rotation.x = .015;

  const leftCards = [
    { w:.100, p:[[-.018,2.985,.29],[-.09,2.90,.43],[-.20,2.80,.52],[-.31,2.69,.54],[-.39,2.56,.49]] },
    { w:.092, p:[[-.050,2.98,.22],[-.15,2.89,.37],[-.27,2.78,.47],[-.39,2.64,.46],[-.47,2.47,.38]] },
    { w:.086, p:[[-.095,2.95,.14],[-.21,2.86,.29],[-.34,2.73,.37],[-.46,2.58,.35],[-.53,2.40,.27]] },
    { w:.080, p:[[-.15,2.91,.06],[-.28,2.82,.18],[-.42,2.69,.23],[-.53,2.53,.18],[-.58,2.34,.10]] },
    { w:.074, p:[[-.21,2.85,-.01],[-.34,2.77,.09],[-.48,2.64,.11],[-.58,2.48,.05],[-.61,2.30,-.03]] },
    { w:.076, p:[[-.085,2.97,.35],[-.16,2.87,.49],[-.28,2.73,.58],[-.37,2.59,.58],[-.42,2.46,.52]] },
    { w:.070, p:[[-.18,2.90,.30],[-.29,2.79,.43],[-.41,2.66,.47],[-.49,2.51,.42],[-.53,2.38,.33]] },
    { w:.066, p:[[-.28,2.81,.19],[-.39,2.71,.29],[-.50,2.59,.30],[-.57,2.44,.23],[-.58,2.31,.14]] }
  ];
  for (const card of leftCards) {
    addHairRibbon(headRig, card.p, card.w, hairCardMaterial);
    addHairRibbon(headRig, card.p.map(([x, y, z]) => [-x, y, z]), card.w, hairCardMaterial);
  }
  const partMaterial = new THREE.MeshStandardMaterial({ color: 0x5d443b, roughness: .92, transparent: true, opacity: .22 });
  makeTube(headRig, [[0,2.99,.30],[0,2.91,.39],[0,2.83,.43]], .0035, partMaterial, 18);

  // Headband travels behind the neck. The front view mainly sees metal cups/yokes, not a stethoscope-shaped loop.
  makeTube(headRig, [[-.44,1.38,.28],[-.54,1.48,.04],[-.43,1.58,-.17],[0,1.63,-.25],[.43,1.58,-.17],[.54,1.48,.04],[.44,1.38,.28]], .026, silver, 58);
  for (const side of [-1, 1]) {
    const cup = addMesh(headRig, new THREE.CylinderGeometry(.088, .088, .072, 40), silver, [side * .455, 1.37, .33]);
    cup.rotation.z = Math.PI / 2;
    cup.rotation.y = side * .16;
    const cushion = addMesh(headRig, new THREE.CylinderGeometry(.071, .071, .078, 40), cushionMaterial, [side * .455, 1.37, .33], [.94, 1, .94]);
    cushion.rotation.z = Math.PI / 2;
    cushion.rotation.y = side * .16;
    const yoke = addMesh(headRig, new THREE.BoxGeometry(.055, .16, .045), silver, [side * .45, 1.49, .29]);
    yoke.rotation.z = side * -.10;
  }

  scene.add(new THREE.HemisphereLight(0xf1eae3, 0x111512, .88));
  const key = new THREE.DirectionalLight(0xffddcf, 2.55);
  key.position.set(-3.6, 5.8, 5.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = .5;
  key.shadow.camera.far = 18;
  key.shadow.bias = -.0003;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe7efed, .95);
  fill.position.set(4.8, 2.7, 3.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.55);
  rim.position.set(3.2, 4.4, -4.2);
  scene.add(rim);
  const accent = new THREE.PointLight(0xff744f, 1.25, 7.5, 2);
  accent.position.set(-2.8, .8, 3.0);
  scene.add(accent);

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
      portrait.scale.setScalar(.93);
      portrait.position.set(.27, -.30, 0);
      camera.position.set(.06, 1.58, 6.75);
    } else if (width < 850) {
      portrait.scale.setScalar(.98);
      portrait.position.set(.22, -.36, 0);
      camera.position.set(.08, 1.55, 6.50);
    } else {
      portrait.scale.setScalar(1);
      portrait.position.set(.17, -.40, 0);
      camera.position.set(.10, 1.52, 6.35);
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
      portrait.rotation.y = -.065 + pointer.x * .038 + scrollState.value * .085;
      portrait.rotation.x = pointer.y * .010 - scrollState.value * .009;
      headRig.rotation.y = pointer.x * .050;
      headRig.rotation.x = -pointer.y * .022;
      headRig.position.y = Math.sin(t * 1.12) * .004;
      eyes.forEach(({ rig, side }) => {
        rig.rotation.y = pointer.x * .045 + side * .006;
        rig.rotation.x = -pointer.y * .030;
      });
      camera.position.y = 1.52 - scrollState.value * .08;
      camera.position.x = .10 + scrollState.value * .06;
      camera.lookAt(.10, 1.72 - scrollState.value * .06, 0);
    } else {
      camera.lookAt(.10, 1.72, 0);
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
