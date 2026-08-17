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
  return addMesh(parent, new THREE.TubeGeometry(curve, segments, radius, 10, false), material);
}

function makeHairAlphaTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#161616';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const rand = (seed) => {
    const x = Math.sin(seed * 1337.17) * 43758.5453;
    return x - Math.floor(x);
  };

  for (let i = 0; i < 110; i++) {
    const x = 4 + rand(i + 1) * 120;
    const drift = (rand(i + 31) - .5) * 22;
    ctx.beginPath();
    ctx.moveTo(x, -8);
    ctx.bezierCurveTo(
      x + drift * .3, 150,
      x - drift * .25, 330,
      x + drift, 520
    );
    const light = 145 + Math.floor(rand(i + 61) * 100);
    ctx.strokeStyle = `rgba(${light},${light},${light},${.25 + rand(i + 91) * .65})`;
    ctx.lineWidth = .45 + rand(i + 121) * 1.15;
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makeRibbonGeometry(points, width = .12, segments = 20) {
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
    const taper = Math.max(.2, Math.sin(Math.PI * (.08 + t * .84)));
    const half = width * taper * .5;

    vertices.push(
      p.x - side.x * half, p.y - side.y * half, p.z - side.z * half,
      p.x + side.x * half, p.y + side.y * half, p.z + side.z * half
    );
    normals.push(0, 0, 1, 0, 0, 1);
    uvs.push(0, t * 1.35, 1, t * 1.35);

    if (i < segments) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
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

    let xScale = .988;
    if (ny < .40) xScale *= .93 + ny * .14;
    if (ny > .50 && ny < .68) xScale *= 1.01;
    v.x = center.x + (v.x - center.x) * xScale;

    if (ny < .27 && front > .18) v.z += size.z * .010 * (1 - ny / .27);
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
  renderer.toneMappingExposure = .92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0d0c, .025);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .04).texture;
  room.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(27, 1, .1, 100);
  camera.position.set(.12, 1.48, 6.55);

  const portrait = new THREE.Group();
  portrait.position.set(.18, -.51, 0);
  portrait.rotation.y = -.075;
  scene.add(portrait);

  const headRig = new THREE.Group();
  portrait.add(headRig);

  const hairAlpha = makeHairAlphaTexture();
  const hairCardMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x151716,
    roughness: .38,
    metalness: .02,
    alphaMap: hairAlpha,
    transparent: true,
    alphaTest: .18,
    side: THREE.DoubleSide,
    depthWrite: true,
    clearcoat: .05,
    clearcoatRoughness: .65,
    envMapIntensity: .72
  });
  const hairScalpMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x121412,
    roughness: .42,
    metalness: .02,
    clearcoat: .05,
    clearcoatRoughness: .7,
    envMapIntensity: .7
  });
  const browMaterial = new THREE.MeshStandardMaterial({ color: 0x171815, roughness: .55 });
  const scleraMaterial = new THREE.MeshPhysicalMaterial({ color: 0xe8e2da, roughness: .3, clearcoat: .36, clearcoatRoughness: .12 });
  const irisMaterial = new THREE.MeshPhysicalMaterial({ color: 0x34231a, roughness: .18, clearcoat: .8, clearcoatRoughness: .08 });
  const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x080807 });
  const corneaMaterial = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .10, roughness: .04, transmission: .2, clearcoat: 1, clearcoatRoughness: .02 });
  const silver = new THREE.MeshPhysicalMaterial({ color: 0xd7dadd, metalness: .98, roughness: .13, clearcoat: .55, clearcoatRoughness: .12, envMapIntensity: 1.45 });
  const cushionMaterial = new THREE.MeshPhysicalMaterial({ color: 0x202321, metalness: .2, roughness: .35 });

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
    normalScale: new THREE.Vector2(.22, .22),
    roughness: .57,
    metalness: 0,
    clearcoat: .025,
    clearcoatRoughness: .86,
    sheen: .025,
    sheenColor: new THREE.Color(0xffd5c4),
    envMapIntensity: .70
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

  // The scan has open eye sockets. Fill them with actual eyeballs instead of hiding them with geometry.
  const eyes = [];
  for (const side of [-1, 1]) {
    const eyeRig = new THREE.Group();
    eyeRig.position.set(side * .255, 2.49, .645);
    headRig.add(eyeRig);

    addMesh(eyeRig, new THREE.SphereGeometry(.122, 40, 28), scleraMaterial, [0, 0, 0], [1, .82, .9]);
    const iris = addMesh(eyeRig, new THREE.SphereGeometry(.052, 30, 22), irisMaterial, [0, 0, .105], [1, .92, .38]);
    addMesh(eyeRig, new THREE.SphereGeometry(.022, 24, 18), pupilMaterial, [0, 0, .126], [1, 1, .35]);
    addMesh(eyeRig, new THREE.SphereGeometry(.124, 40, 28), corneaMaterial, [0, 0, .006], [1, .82, .9]);
    eyes.push({ rig: eyeRig, iris, side });
  }

  // Subtle sword brows. Keep them thin and above the sockets; no fake lower eyelid lines.
  makeTube(headRig, [[-.10,2.66,.724],[-.23,2.685,.755],[-.36,2.71,.735],[-.47,2.715,.675]], .012, browMaterial, 28);
  makeTube(headRig, [[.10,2.66,.724],[.23,2.685,.755],[.36,2.71,.735],[.47,2.715,.675]], .012, browMaterial, 28);

  // Compact scalp base. Hair cards provide the silhouette and strand breakup.
  const scalp = addMesh(headRig, new THREE.SphereGeometry(.72, 72, 44, 0, Math.PI * 2, 0, Math.PI * .52), hairScalpMaterial, [0, 2.55, -.04], [.90, .56, .79]);
  scalp.rotation.x = .025;

  const leftCards = [
    { w:.16, p:[[-.025,2.95,.24],[-.11,2.84,.43],[-.24,2.72,.53],[-.36,2.60,.55],[-.43,2.48,.50]] },
    { w:.15, p:[[-.06,2.94,.17],[-.18,2.83,.36],[-.31,2.70,.48],[-.43,2.54,.49],[-.50,2.36,.40]] },
    { w:.14, p:[[-.12,2.91,.10],[-.25,2.80,.27],[-.39,2.66,.36],[-.50,2.49,.34],[-.56,2.29,.24]] },
    { w:.13, p:[[-.18,2.86,.02],[-.32,2.76,.15],[-.47,2.62,.20],[-.57,2.43,.15],[-.61,2.22,.05]] },
    { w:.12, p:[[-.23,2.80,-.05],[-.38,2.72,.04],[-.52,2.58,.06],[-.62,2.40,-.01],[-.64,2.20,-.10]] },
    { w:.11, p:[[-.10,2.92,.30],[-.18,2.80,.50],[-.31,2.64,.61],[-.41,2.48,.62],[-.46,2.33,.55]] },
    { w:.10, p:[[-.20,2.84,.31],[-.31,2.71,.48],[-.44,2.57,.52],[-.52,2.39,.45],[-.55,2.24,.34]] },
    { w:.10, p:[[-.30,2.74,.18],[-.41,2.62,.30],[-.52,2.48,.31],[-.60,2.30,.22],[-.61,2.16,.13]] }
  ];

  for (const card of leftCards) {
    addHairRibbon(headRig, card.p, card.w, hairCardMaterial);
    addHairRibbon(headRig, card.p.map(([x, y, z]) => [-x, y, z]), card.w, hairCardMaterial);
  }

  // Narrow center seam: clearly middle-parted without a cartoon white scalp stripe.
  const partMaterial = new THREE.MeshStandardMaterial({ color: 0x5b4034, roughness: .85, transparent: true, opacity: .36 });
  makeTube(headRig, [[0,2.955,.245],[0,2.875,.35],[0,2.78,.40]], .006, partMaterial, 18);

  // Silver over-ear headphones resting around the neck, modeled as a U instead of a chest-level torus.
  makeTube(headRig, [[-.48,1.28,.34],[-.43,1.10,.48],[-.25,.98,.55],[0,.93,.58],[.25,.98,.55],[.43,1.10,.48],[.48,1.28,.34]], .034, silver, 56);
  for (const side of [-1, 1]) {
    const cup = addMesh(headRig, new THREE.CylinderGeometry(.12, .12, .085, 40), silver, [side * .49, 1.28, .36]);
    cup.rotation.z = Math.PI / 2;
    cup.rotation.y = side * .18;
    const cushion = addMesh(headRig, new THREE.CylinderGeometry(.098, .098, .09, 40), cushionMaterial, [side * .49, 1.28, .36], [.94, 1, .94]);
    cushion.rotation.z = Math.PI / 2;
    cushion.rotation.y = side * .18;
  }

  scene.add(new THREE.HemisphereLight(0xf1eae3, 0x111512, .92));
  const key = new THREE.DirectionalLight(0xffddcf, 2.75);
  key.position.set(-3.6, 5.8, 5.3);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = .5;
  key.shadow.camera.far = 18;
  key.shadow.bias = -.0003;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe7efed, 1.05);
  fill.position.set(4.8, 2.7, 3.6);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xcfe0ff, 1.65);
  rim.position.set(3.2, 4.4, -4.2);
  scene.add(rim);

  const accent = new THREE.PointLight(0xff744f, 1.45, 7.5, 2);
  accent.position.set(-2.8, .7, 3.0);
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
      portrait.scale.setScalar(.88);
      portrait.position.set(.31, -.45, 0);
      camera.position.set(.08, 1.54, 7.05);
    } else if (width < 850) {
      portrait.scale.setScalar(.95);
      portrait.position.set(.25, -.49, 0);
      camera.position.set(.10, 1.50, 6.75);
    } else {
      portrait.scale.setScalar(1);
      portrait.position.set(.18, -.51, 0);
      camera.position.set(.12, 1.48, 6.55);
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
      portrait.rotation.y = -.075 + pointer.x * .04 + scrollState.value * .09;
      portrait.rotation.x = pointer.y * .012 - scrollState.value * .01;
      headRig.rotation.y = pointer.x * .055;
      headRig.rotation.x = -pointer.y * .026;
      headRig.position.y = Math.sin(t * 1.14) * .0045;

      eyes.forEach(({ rig, side }) => {
        rig.rotation.y = pointer.x * .075 + side * .01;
        rig.rotation.x = -pointer.y * .05;
      });

      camera.position.y = 1.48 - scrollState.value * .09;
      camera.position.x = .12 + scrollState.value * .07;
      camera.lookAt(.12, 1.66 - scrollState.value * .07, 0);
    } else {
      camera.lookAt(.12, 1.66, 0);
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
