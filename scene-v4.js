import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const mount = document.getElementById('avatar3d');
const fallback = document.getElementById('sceneFallback');
if (!mount) throw new Error('3D mount missing');

const BASE = 'https://raw.githubusercontent.com/mrdoob/three.js/r169/examples/models/gltf/LeePerrySmith/';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer:fine)').matches;
const gltfLoader = new GLTFLoader();
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin('anonymous');

const loadGLTF = (url) => new Promise((resolve, reject) => gltfLoader.load(url, resolve, undefined, reject));
const loadTexture = (url) => new Promise((resolve, reject) => textureLoader.load(url, resolve, undefined, reject));

function mesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function tube(parent, points, radius, material, segments = 30) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return mesh(parent, new THREE.TubeGeometry(curve, segments, radius, 8, false), material);
}

function createHairAlpha() {
  const canvas = document.createElement('canvas');
  canvas.width = 192;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#050505';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const random = (seed) => {
    const value = Math.sin(seed * 999.71) * 43758.5453;
    return value - Math.floor(value);
  };
  for (let i = 0; i < 300; i++) {
    const x = random(i + 3) * canvas.width;
    const drift = (random(i + 53) - .5) * 18;
    const alpha = .22 + random(i + 91) * .76;
    const light = 145 + Math.floor(random(i + 131) * 105);
    ctx.beginPath();
    ctx.moveTo(x, -10);
    ctx.bezierCurveTo(x + drift * .28, 150, x - drift * .20, 340, x + drift, 522);
    ctx.strokeStyle = `rgba(${light},${light},${light},${alpha})`;
    ctx.lineWidth = .24 + random(i + 177) * .72;
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(7, 1.15);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function ribbon(points, width = .075, segments = 26) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const positions = [], normals = [], uvs = [], indices = [];
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();
  const front = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const p = curve.getPointAt(t);
    curve.getTangentAt(Math.min(.999, t), tangent).normalize();
    side.crossVectors(tangent, front).normalize();
    if (side.lengthSq() < .01) side.set(1, 0, 0);
    const taper = Math.max(.12, Math.sin(Math.PI * (.04 + t * .92)));
    const half = width * taper * .5;
    positions.push(
      p.x - side.x * half, p.y - side.y * half, p.z - side.z * half,
      p.x + side.x * half, p.y + side.y * half, p.z + side.z * half
    );
    normals.push(0, 0, 1, 0, 0, 1);
    uvs.push(0, t * 1.7, 1, t * 1.7);
    if (i < segments) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function hairCard(parent, points, width, material) {
  const card = mesh(parent, ribbon(points, width), material);
  card.renderOrder = 4;
  return card;
}

function sculptFace(source) {
  const geometry = source.clone();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const attr = geometry.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < attr.count; i++) {
    v.fromBufferAttribute(attr, i);
    const ny = (v.y - box.min.y) / Math.max(size.y, 1e-5);
    const front = (v.z - center.z) / Math.max(size.z * .5, 1e-5);
    let sx = .994;
    if (ny < .45) sx *= .91 + ny * .20;
    if (ny > .50 && ny < .68) sx *= 1.015;
    v.x = center.x + (v.x - center.x) * sx;
    if (ny < .28 && front > .18) v.z += size.z * .012 * (1 - ny / .28);
    attr.setXYZ(i, v.x, v.y, v.z);
  }
  attr.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

async function init() {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0d0c, .023);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .04).texture;
  room.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(27, 1, .1, 100);
  camera.position.set(.1, 1.56, 6.48);
  const portrait = new THREE.Group();
  portrait.position.set(.17, -.38, 0);
  portrait.rotation.y = -.06;
  scene.add(portrait);
  const head = new THREE.Group();
  portrait.add(head);

  const alpha = createHairAlpha();
  const hairMaterial = new THREE.MeshStandardMaterial({
    color: 0x090a09,
    roughness: .84,
    alphaMap: alpha,
    transparent: true,
    alphaTest: .115,
    side: THREE.DoubleSide,
    depthWrite: true
  });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xd9dcdf, metalness: .98, roughness: .13, clearcoat: .5, clearcoatRoughness: .12, envMapIntensity: 1.4 });
  const cushion = new THREE.MeshPhysicalMaterial({ color: 0x171a18, metalness: .12, roughness: .45 });

  const [model, colorMap, normalMap] = await Promise.all([
    loadGLTF(`${BASE}LeePerrySmith.glb`),
    loadTexture(`${BASE}Map-COL.jpg`),
    loadTexture(`${BASE}Infinite-Level_02_Tangent_SmoothUV.jpg`).catch(() => null)
  ]);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  if (normalMap) normalMap.colorSpace = THREE.NoColorSpace;
  const skin = new THREE.MeshPhysicalMaterial({
    color: 0xfff3ed,
    map: colorMap,
    normalMap,
    normalScale: new THREE.Vector2(.16, .16),
    roughness: .63,
    metalness: 0,
    clearcoat: .01,
    clearcoatRoughness: .94,
    sheen: .01,
    sheenColor: new THREE.Color(0xffd6c7),
    envMapIntensity: .58
  });

  const scan = model.scene.clone(true);
  scan.traverse((object) => {
    if (!object.isMesh) return;
    object.geometry = sculptFace(object.geometry);
    object.material = skin;
    object.castShadow = true;
    object.receiveShadow = true;
  });
  scan.updateMatrixWorld(true);
  const sourceBox = new THREE.Box3().setFromObject(scan);
  const sourceSize = sourceBox.getSize(new THREE.Vector3());
  scan.scale.setScalar(2.63 / Math.max(sourceSize.y, 1e-5));
  scan.updateMatrixWorld(true);
  const finalBox = new THREE.Box3().setFromObject(scan);
  const center = finalBox.getCenter(new THREE.Vector3());
  scan.position.x -= center.x;
  scan.position.y += 1.99 - center.y;
  scan.position.z -= center.z + .03;
  head.add(scan);

  const crown = mesh(
    head,
    new THREE.SphereGeometry(.82, 96, 60, 0, Math.PI * 2, 0, Math.PI * .47),
    hairMaterial,
    [0, 2.69, .17],
    [.94, .70, .92]
  );
  crown.rotation.x = .012;
  crown.renderOrder = 3;

  const cards = [
    { w:.095, p:[[-.016,3.16,.37],[-.07,3.05,.50],[-.17,2.93,.59],[-.28,2.80,.60],[-.38,2.64,.53]] },
    { w:.088, p:[[-.048,3.15,.29],[-.13,3.03,.44],[-.25,2.90,.54],[-.37,2.75,.52],[-.47,2.57,.42]] },
    { w:.082, p:[[-.090,3.12,.21],[-.19,3.01,.36],[-.32,2.87,.44],[-.44,2.71,.41],[-.53,2.52,.31]] },
    { w:.076, p:[[-.145,3.08,.13],[-.26,2.98,.25],[-.40,2.84,.30],[-.51,2.67,.25],[-.58,2.48,.16]] },
    { w:.070, p:[[-.205,3.02,.06],[-.32,2.94,.16],[-.46,2.80,.18],[-.56,2.63,.11],[-.61,2.45,.03]] },
    { w:.075, p:[[-.080,3.14,.43],[-.14,3.03,.56],[-.25,2.89,.65],[-.35,2.74,.65],[-.42,2.58,.57]] },
    { w:.068, p:[[-.175,3.07,.37],[-.27,2.96,.50],[-.39,2.82,.54],[-.48,2.66,.48],[-.53,2.51,.38]] },
    { w:.062, p:[[-.275,2.98,.25],[-.37,2.87,.36],[-.48,2.74,.37],[-.55,2.58,.29],[-.58,2.44,.20]] }
  ];
  for (const card of cards) {
    hairCard(head, card.p, card.w, hairMaterial);
    hairCard(head, card.p.map(([x, y, z]) => [-x, y, z]), card.w, hairMaterial);
  }
  const part = new THREE.MeshStandardMaterial({ color: 0x62483e, roughness: .96, transparent: true, opacity: .18 });
  tube(head, [[0,3.17,.40],[0,3.08,.49],[0,2.98,.54],[0,2.89,.52]], .003, part, 20);

  tube(head, [[-.44,1.38,.28],[-.54,1.48,.04],[-.43,1.58,-.17],[0,1.63,-.25],[.43,1.58,-.17],[.54,1.48,.04],[.44,1.38,.28]], .025, silver, 58);
  for (const side of [-1, 1]) {
    const cup = mesh(head, new THREE.CylinderGeometry(.084, .084, .070, 40), silver, [side * .455, 1.37, .33]);
    cup.rotation.z = Math.PI / 2;
    cup.rotation.y = side * .16;
    const pad = mesh(head, new THREE.CylinderGeometry(.068, .068, .076, 40), cushion, [side * .455, 1.37, .33], [.94, 1, .94]);
    pad.rotation.z = Math.PI / 2;
    pad.rotation.y = side * .16;
    const yoke = mesh(head, new THREE.BoxGeometry(.052, .15, .043), silver, [side * .45, 1.49, .29]);
    yoke.rotation.z = side * -.10;
  }

  scene.add(new THREE.HemisphereLight(0xf2ebe4, 0x111512, .84));
  const key = new THREE.DirectionalLight(0xffded1, 2.45);
  key.position.set(-3.6, 5.8, 5.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -.0003;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xe7efed, .88);
  fill.position.set(4.8, 2.7, 3.6);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.45);
  rim.position.set(3.2, 4.4, -4.2);
  scene.add(rim);
  const accent = new THREE.PointLight(0xff744f, 1.12, 7.5, 2);
  accent.position.set(-2.8, .8, 3);
  scene.add(accent);

  const pointer = { x:0, y:0, tx:0, ty:0 };
  const scroll = { value:0, target:0 };
  if (finePointer && !reduceMotion) {
    mount.addEventListener('pointermove', (event) => {
      const rect = mount.getBoundingClientRect();
      pointer.tx = ((event.clientX - rect.left) / rect.width - .5) * 2;
      pointer.ty = ((event.clientY - rect.top) / rect.height - .5) * 2;
    }, { passive:true });
    mount.addEventListener('pointerleave', () => { pointer.tx = 0; pointer.ty = 0; });
  }
  const updateScroll = () => {
    const hero = document.querySelector('.hero');
    scroll.target = Math.min(1, Math.max(0, scrollY / Math.max(1, hero?.offsetHeight || innerHeight)));
  };
  updateScroll();
  addEventListener('scroll', updateScroll, { passive:true });

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
      camera.position.set(.1, 1.56, 6.48);
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
    scroll.value += (scroll.target - scroll.value) * Math.min(1, dt * 3.2);
    if (!reduceMotion) {
      portrait.rotation.y = -.06 + pointer.x * .038 + scroll.value * .08;
      portrait.rotation.x = pointer.y * .009 - scroll.value * .008;
      head.rotation.y = pointer.x * .045;
      head.rotation.x = -pointer.y * .019;
      head.position.y = Math.sin(t * 1.12) * .0035;
      camera.position.y = 1.56 - scroll.value * .075;
      camera.position.x = .1 + scroll.value * .055;
      camera.lookAt(.1, 1.77 - scroll.value * .055, 0);
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
