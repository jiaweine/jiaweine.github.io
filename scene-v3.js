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

const loadGLTF = (url) => new Promise((resolve, reject) => new GLTFLoader().load(url, resolve, undefined, reject));
const loadTexture = (url) => new Promise((resolve, reject) => {
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');
  loader.load(url, resolve, undefined, reject);
});

function addMesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function tube(parent, points, radius, material, segments = 30) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return addMesh(parent, new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
}

function hairAlphaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#161616';
  ctx.fillRect(0, 0, 128, 512);
  const rand = (seed) => {
    const x = Math.sin(seed * 1337.17) * 43758.5453;
    return x - Math.floor(x);
  };
  for (let i = 0; i < 190; i++) {
    const x = 2 + rand(i + 1) * 124;
    const drift = (rand(i + 31) - .5) * 16;
    ctx.beginPath();
    ctx.moveTo(x, -8);
    ctx.bezierCurveTo(x + drift * .24, 150, x - drift * .17, 330, x + drift, 520);
    const light = 140 + Math.floor(rand(i + 61) * 95);
    ctx.strokeStyle = `rgba(${light},${light},${light},${.30 + rand(i + 91) * .66})`;
    ctx.lineWidth = .3 + rand(i + 121) * .75;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function ribbonGeometry(points, width = .078, segments = 24) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const vertices = [], normals = [], uvs = [], indices = [];
  const tangent = new THREE.Vector3(), side = new THREE.Vector3(), front = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    curve.getTangentAt(Math.min(.999, t), tangent).normalize();
    side.crossVectors(tangent, front).normalize();
    if (side.lengthSq() < .01) side.set(1, 0, 0);
    const taper = Math.max(.12, Math.sin(Math.PI * (.05 + t * .9)));
    const half = width * taper * .5;
    vertices.push(
      p.x - side.x * half, p.y - side.y * half, p.z - side.z * half,
      p.x + side.x * half, p.y + side.y * half, p.z + side.z * half
    );
    normals.push(0, 0, 1, 0, 0, 1);
    uvs.push(0, t * 1.6, 1, t * 1.6);
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

function hairCard(parent, points, width, material) {
  const mesh = addMesh(parent, ribbonGeometry(points, width), material);
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
    let xScale = .994;
    if (ny < .45) xScale *= .915 + ny * .19;
    if (ny > .50 && ny < .68) xScale *= 1.014;
    v.x = center.x + (v.x - center.x) * xScale;
    if (ny < .28 && front > .18) v.z += size.z * .011 * (1 - ny / .28);
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
  renderer.toneMappingExposure = .9;
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
  camera.position.set(.1, 1.56, 6.45);
  const portrait = new THREE.Group();
  portrait.position.set(.17, -.38, 0);
  portrait.rotation.y = -.06;
  scene.add(portrait);
  const headRig = new THREE.Group();
  portrait.add(headRig);

  const hairAlpha = hairAlphaTexture();
  const hairCardMat = new THREE.MeshStandardMaterial({
    color: 0x070807, roughness: .82, alphaMap: hairAlpha,
    transparent: true, alphaTest: .13, side: THREE.DoubleSide, depthWrite: true
  });
  const hairBaseMat = new THREE.MeshPhysicalMaterial({ color: 0x080908, roughness: .58, metalness: 0, clearcoat: .015, envMapIntensity: .3 });
  const scleraMat = new THREE.MeshPhysicalMaterial({ color: 0xe5ded6, roughness: .4, clearcoat: .17, clearcoatRoughness: .2 });
  const irisMat = new THREE.MeshPhysicalMaterial({ color: 0x291914, roughness: .24, clearcoat: .62, clearcoatRoughness: .1 });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x050504 });
  const corneaMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .045, roughness: .03, clearcoat: 1, clearcoatRoughness: .02 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xd9dcdf, metalness: .98, roughness: .13, clearcoat: .5, clearcoatRoughness: .12, envMapIntensity: 1.4 });
  const cushionMat = new THREE.MeshPhysicalMaterial({ color: 0x181b19, metalness: .12, roughness: .44 });

  const [gltf, colorMap, normalMap] = await Promise.all([
    loadGLTF(MODEL_URL), loadTexture(COLOR_URL), loadTexture(NORMAL_URL).catch(() => null)
  ]);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  if (normalMap) normalMap.colorSpace = THREE.NoColorSpace;
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, map: colorMap, normalMap, normalScale: new THREE.Vector2(.17, .17),
    roughness: .62, metalness: 0, clearcoat: .012, clearcoatRoughness: .92,
    sheen: .012, sheenColor: new THREE.Color(0xffd7c8), envMapIntensity: .61
  });

  const scan = gltf.scene.clone(true);
  scan.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.geometry = sculptFaceGeometry(obj.geometry);
    obj.material = faceMat;
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
    const eye = new THREE.Group();
    eye.position.set(side * .258, 2.462, .515);
    headRig.add(eye);
    addMesh(eye, new THREE.SphereGeometry(.068, 40, 28), scleraMat, [0, 0, 0], [1.2, .52, .93]);
    addMesh(eye, new THREE.SphereGeometry(.024, 30, 22), irisMat, [0, 0, .056], [1, .82, .34]);
    addMesh(eye, new THREE.SphereGeometry(.0095, 24, 18), pupilMat, [0, 0, .064], [1, .86, .30]);
    addMesh(eye, new THREE.SphereGeometry(.070, 40, 28), corneaMat, [0, 0, .002], [1.2, .52, .93]);
    eyes.push({ rig: eye, side });
  }

  // Middle-part crown: lifted forward so the scan never reads bald, while stopping above the natural brow line.
  const crown = addMesh(
    headRig,
    new THREE.SphereGeometry(.82, 88, 56, 0, Math.PI * 2, 0, Math.PI * .48),
    hairBaseMat,
    [0, 2.69, .17],
    [.94, .70, .92]
  );
  crown.rotation.x = .012;

  const left = [
    { w:.094, p:[[-.018,3.16,.35],[-.08,3.04,.49],[-.19,2.91,.58],[-.30,2.78,.59],[-.39,2.63,.52]] },
    { w:.088, p:[[-.052,3.14,.27],[-.14,3.02,.42],[-.26,2.89,.52],[-.38,2.74,.50],[-.47,2.56,.41]] },
    { w:.080, p:[[-.098,3.10,.19],[-.20,3.00,.34],[-.33,2.86,.42],[-.45,2.70,.39],[-.53,2.51,.30]] },
    { w:.076, p:[[-.15,3.06,.11],[-.27,2.96,.23],[-.41,2.82,.28],[-.52,2.65,.23],[-.58,2.46,.14]] },
    { w:.068, p:[[-.21,3.00,.04],[-.33,2.92,.14],[-.47,2.78,.16],[-.57,2.61,.09],[-.61,2.43,.01]] },
    { w:.072, p:[[-.086,3.13,.41],[-.15,3.01,.55],[-.27,2.87,.63],[-.36,2.72,.63],[-.42,2.57,.56]] },
    { w:.066, p:[[-.18,3.05,.35],[-.28,2.94,.48],[-.40,2.80,.52],[-.48,2.64,.46],[-.53,2.50,.36]] },
    { w:.062, p:[[-.28,2.96,.23],[-.38,2.85,.34],[-.49,2.72,.35],[-.56,2.56,.27],[-.58,2.43,.18]] }
  ];
  for (const card of left) {
    hairCard(headRig, card.p, card.w, hairCardMat);
    hairCard(headRig, card.p.map(([x, y, z]) => [-x, y, z]), card.w, hairCardMat);
  }
  const partMat = new THREE.MeshStandardMaterial({ color: 0x61473d, roughness: .95, transparent: true, opacity: .22 });
  tube(headRig, [[0,3.17,.38],[0,3.07,.48],[0,2.97,.53],[0,2.88,.51]], .0035, partMat, 20);

  // Headphones sit behind the neck; only the metallic cups/yokes lead visually from the front.
  tube(headRig, [[-.44,1.38,.28],[-.54,1.48,.04],[-.43,1.58,-.17],[0,1.63,-.25],[.43,1.58,-.17],[.54,1.48,.04],[.44,1.38,.28]], .025, silver, 58);
  for (const side of [-1, 1]) {
    const cup = addMesh(headRig, new THREE.CylinderGeometry(.084, .084, .070, 40), silver, [side * .455, 1.37, .33]);
    cup.rotation.z = Math.PI / 2;
    cup.rotation.y = side * .16;
    const cushion = addMesh(headRig, new THREE.CylinderGeometry(.068, .068, .076, 40), cushionMat, [side * .455, 1.37, .33], [.94, 1, .94]);
    cushion.rotation.z = Math.PI / 2;
    cushion.rotation.y = side * .16;
    const yoke = addMesh(headRig, new THREE.BoxGeometry(.052, .15, .043), silver, [side * .45, 1.49, .29]);
    yoke.rotation.z = side * -.10;
  }

  scene.add(new THREE.HemisphereLight(0xf1eae3, 0x111512, .86));
  const key = new THREE.DirectionalLight(0xffddcf, 2.5);
  key.position.set(-3.6, 5.8, 5.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0003;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe7efed, .92);
  fill.position.set(4.8, 2.7, 3.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.5);
  rim.position.set(3.2, 4.4, -4.2);
  scene.add(rim);
  const accent = new THREE.PointLight(0xff744f, 1.18, 7.5, 2);
  accent.position.set(-2.8, .8, 3);
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
  const onScroll = () => {
    const hero = document.querySelector('.hero');
    const range = Math.max(1, hero?.offsetHeight || innerHeight);
    scrollState.target = Math.min(1, Math.max(0, scrollY / range));
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  function resize() {
    const rect = mount.getBoundingClientRect();
    const width = Math.max(1, rect.width), height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (width < 560) {
      portrait.scale.setScalar(.93);
      portrait.position.set(.27, -.29, 0);
      camera.position.set(.06, 1.6, 6.72);
    } else if (width < 850) {
      portrait.scale.setScalar(.98);
      portrait.position.set(.22, -.35, 0);
      camera.position.set(.08, 1.57, 6.5);
    } else {
      portrait.scale.setScalar(1);
      portrait.position.set(.17, -.38, 0);
      camera.position.set(.1, 1.56, 6.45);
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
      portrait.rotation.y = -.06 + pointer.x * .036 + scrollState.value * .08;
      portrait.rotation.x = pointer.y * .009 - scrollState.value * .008;
      headRig.rotation.y = pointer.x * .046;
      headRig.rotation.x = -pointer.y * .02;
      headRig.position.y = Math.sin(t * 1.12) * .0035;
      eyes.forEach(({ rig, side }) => {
        rig.rotation.y = pointer.x * .034 + side * .004;
        rig.rotation.x = -pointer.y * .020;
      });
      camera.position.y = 1.56 - scrollState.value * .075;
      camera.position.x = .1 + scrollState.value * .055;
      camera.lookAt(.1, 1.77 - scrollState.value * .055, 0);
    } else {
      camera.lookAt(.1, 1.77, 0);
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
