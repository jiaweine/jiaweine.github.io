import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const mount = document.getElementById('avatar3d');
const fallback = document.getElementById('sceneFallback');
if (!mount) throw new Error('3D mount missing');

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer:fine)').matches;
const loader = new GLTFLoader();

function addMesh(parent, geometry, material, position = [0, 0, 0], scale = [1, 1, 1]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.scale.set(...scale);
  item.castShadow = true;
  item.receiveShadow = true;
  parent.add(item);
  return item;
}

function addTube(parent, points, radius, material, segments = 46) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return addMesh(parent, new THREE.TubeGeometry(curve, segments, radius, 12, false), material);
}

function loadModel(url) {
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      resolve,
      (event) => {
        if (!fallback || !event.total) return;
        const value = Math.min(99, Math.round((event.loaded / event.total) * 100));
        fallback.querySelector('strong')?.replaceChildren(document.createTextNode(`Loading portrait ${value}%`));
      },
      reject
    );
  });
}

function eachMaterial(object, callback) {
  const mats = Array.isArray(object.material) ? object.material : [object.material];
  mats.filter(Boolean).forEach(callback);
}

async function init() {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .96;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0d0c, .022);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, .035).texture;
  room.dispose();
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(27, 1, .1, 100);
  camera.position.set(.20, 1.66, 7.20);

  const portrait = new THREE.Group();
  portrait.rotation.y = -.055;
  scene.add(portrait);

  const gltf = await loadModel('./assets/rocketbox-male10.glb');
  const avatar = gltf.scene;
  portrait.add(avatar);

  let headBone = null;
  let neckBone = null;
  const meshNames = [];
  const boneNames = [];

  avatar.traverse((object) => {
    if (object.isMesh || object.isSkinnedMesh) {
      meshNames.push(object.name);
      object.castShadow = true;
      object.receiveShadow = true;
      eachMaterial(object, (material) => {
        if ('envMapIntensity' in material) material.envMapIntensity = .78;
        if ('roughness' in material) material.roughness = Math.max(.34, material.roughness ?? .55);
        if (material.map) material.map.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        if (material.normalMap) material.normalScale?.set?.(.72, .72);
        if (material.transparent || material.alphaMap) {
          material.transparent = true;
          material.alphaTest = Math.max(material.alphaTest || 0, .18);
          material.depthWrite = true;
          material.side = THREE.DoubleSide;
        }
        material.needsUpdate = true;
      });
    }
    if (object.isBone) {
      boneNames.push(object.name);
      if (!headBone && /(^|[ _.-])head$/i.test(object.name)) headBone = object;
      if (!neckBone && /(^|[ _.-])neck$/i.test(object.name)) neckBone = object;
    }
  });

  // Normalize the complete character, then frame only the upper body with the camera.
  avatar.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(avatar);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const targetHeight = 5.15;
  const uniformScale = targetHeight / Math.max(initialSize.y, 1e-6);
  avatar.scale.setScalar(uniformScale);
  avatar.updateMatrixWorld(true);

  const scaledBox = new THREE.Box3().setFromObject(avatar);
  const scaledCenter = scaledBox.getCenter(new THREE.Vector3());
  avatar.position.x -= scaledCenter.x;
  avatar.position.z -= scaledCenter.z;
  avatar.position.y += 2.95 - scaledBox.max.y;
  avatar.updateMatrixWorld(true);

  // The Rocketbox source is a complete body; the camera crop creates a portrait rather than a mannequin viewer.
  portrait.position.set(.32, -.04, 0);

  const silver = new THREE.MeshPhysicalMaterial({
    color: 0xd9dde1,
    metalness: .98,
    roughness: .12,
    clearcoat: .62,
    clearcoatRoughness: .10,
    envMapIntensity: 1.45
  });
  const cushion = new THREE.MeshPhysicalMaterial({
    color: 0x171a19,
    metalness: .12,
    roughness: .46,
    clearcoat: .05
  });

  // Refined over-ear headphones: band stays behind the neck and the polished cups sit near the collarbone.
  const phones = new THREE.Group();
  phones.position.set(0, 1.46, .18);
  phones.scale.setScalar(.92);
  portrait.add(phones);
  addTube(phones, [
    [-.39, .10, -.05],
    [-.48, .18, -.20],
    [-.40, .29, -.34],
    [0, .35, -.42],
    [.40, .29, -.34],
    [.48, .18, -.20],
    [.39, .10, -.05]
  ], .024, silver, 56);

  for (const side of [-1, 1]) {
    const cup = addMesh(phones, new THREE.CylinderGeometry(.105, .105, .070, 42), silver, [side * .405, .095, .045]);
    cup.rotation.z = Math.PI / 2;
    cup.rotation.y = side * .13;
    const pad = addMesh(phones, new THREE.CylinderGeometry(.086, .086, .076, 42), cushion, [side * .405, .095, .045], [.95, 1, .95]);
    pad.rotation.z = Math.PI / 2;
    pad.rotation.y = side * .13;
    const yoke = addMesh(phones, new THREE.BoxGeometry(.05, .15, .045), silver, [side * .40, .21, -.01]);
    yoke.rotation.z = side * -.10;
  }

  // Portrait lighting: broad warm key, restrained cool fill, and a thin rim to separate dark hair from the page.
  scene.add(new THREE.HemisphereLight(0xf4eee7, 0x101310, .72));

  const key = new THREE.DirectionalLight(0xffddcf, 3.05);
  key.position.set(-3.8, 6.1, 5.7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = .5;
  key.shadow.camera.far = 18;
  key.shadow.bias = -.00028;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xe3eeeb, 1.12);
  fill.position.set(4.5, 2.8, 4.0);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xc9dcff, 1.82);
  rim.position.set(3.5, 5.1, -4.4);
  scene.add(rim);

  const accent = new THREE.PointLight(0xff744f, 1.25, 8, 2);
  accent.position.set(-2.6, 1.2, 3.2);
  scene.add(accent);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const scroll = { value: 0, target: 0 };
  const headBase = headBone?.quaternion.clone();
  const neckBase = neckBone?.quaternion.clone();
  const targetQ = new THREE.Quaternion();
  const euler = new THREE.Euler();

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
    scroll.target = Math.min(1, Math.max(0, scrollY / Math.max(1, hero?.offsetHeight || innerHeight)));
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
      portrait.scale.setScalar(.91);
      portrait.position.x = .22;
      camera.position.set(.10, 1.72, 7.65);
    } else if (width < 850) {
      portrait.scale.setScalar(.96);
      portrait.position.x = .27;
      camera.position.set(.14, 1.68, 7.40);
    } else {
      portrait.scale.setScalar(1);
      portrait.position.x = .32;
      camera.position.set(.20, 1.66, 7.20);
    }
  }

  resize();
  new ResizeObserver(resize).observe(mount);
  fallback?.classList.add('hidden');

  console.info('Rocketbox portrait ready', { meshNames, boneNames, headBone: headBone?.name, neckBone: neckBone?.name });

  let last = performance.now();
  function render(now) {
    const dt = Math.min(.04, (now - last) / 1000);
    last = now;
    const t = now * .001;

    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 5.0);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 5.0);
    scroll.value += (scroll.target - scroll.value) * Math.min(1, dt * 3.1);

    if (!reduceMotion) {
      portrait.rotation.y = -.055 + pointer.x * .025 + scroll.value * .07;
      portrait.rotation.x = pointer.y * .006 - scroll.value * .006;
      portrait.position.y = -.04 + Math.sin(t * 1.05) * .004;

      if (headBone && headBase) {
        euler.set(-pointer.y * .035, pointer.x * .065, -pointer.x * .008, 'YXZ');
        targetQ.setFromEuler(euler).premultiply(headBase);
        headBone.quaternion.slerp(targetQ, Math.min(1, dt * 5.8));
      }
      if (neckBone && neckBase) {
        euler.set(-pointer.y * .012, pointer.x * .020, 0, 'YXZ');
        targetQ.setFromEuler(euler).premultiply(neckBase);
        neckBone.quaternion.slerp(targetQ, Math.min(1, dt * 4.2));
      }

      camera.position.y = 1.66 - scroll.value * .10;
      camera.position.x = .20 + scroll.value * .08;
      camera.lookAt(.20, 1.82 - scroll.value * .08, 0);
    } else {
      camera.lookAt(.20, 1.82, 0);
    }

    renderer.render(scene, camera);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

init().catch((error) => {
  console.warn('Rocketbox portrait unavailable', error);
  fallback?.querySelector('strong')?.replaceChildren(document.createTextNode('Realtime portrait unavailable'));
});
