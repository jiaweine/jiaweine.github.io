import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const mount=document.getElementById('avatar3d');
const fallback=document.getElementById('sceneFallback');
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer=matchMedia('(pointer:fine)').matches;
if(!mount) throw new Error('3D mount missing');

const loader=new GLTFLoader();
const loadModel=url=>new Promise((resolve,reject)=>loader.load(url,resolve,e=>{
  if(!fallback||!e.total)return;
  const p=Math.min(99,Math.round(e.loaded/e.total*100));
  fallback.querySelector('strong')?.replaceChildren(document.createTextNode(`Loading portrait ${p}%`));
},reject));

function addMesh(parent,geometry,material,pos=[0,0,0],scale=[1,1,1]){
  const m=new THREE.Mesh(geometry,material);m.position.set(...pos);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function addTube(parent,points,radius,material,segments=50){
  return addMesh(parent,new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,12,false),material);
}
function mats(object){return(Array.isArray(object.material)?object.material:[object.material]).filter(Boolean)}

async function init(){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.94;renderer.outputColorSpace=THREE.SRGBColorSpace;mount.appendChild(renderer.domElement);

  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x0b0d0c,.018);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.03).texture;room.dispose();pmrem.dispose();
  const camera=new THREE.PerspectiveCamera(25,1,.1,100);camera.position.set(.18,2.03,5.3);
  const portrait=new THREE.Group();portrait.rotation.y=-.055;scene.add(portrait);
  const gltf=await loadModel('./assets/rocketbox-male10.glb'),avatar=gltf.scene;portrait.add(avatar);

  let headBone=null,neckBone=null;
  avatar.traverse(o=>{
    if(o.isBone){if(!headBone&&/head$/i.test(o.name))headBone=o;if(!neckBone&&/neck$/i.test(o.name))neckBone=o}
    if(!(o.isMesh||o.isSkinnedMesh))return;o.castShadow=true;o.receiveShadow=true;
    mats(o).forEach(m=>{
      const id=`${m.name||''} ${m.map?.name||''} ${m.normalMap?.name||''}`.toLowerCase();
      if('envMapIntensity'in m)m.envMapIntensity=.72;if('roughness'in m)m.roughness=Math.max(.46,m.roughness??.55);if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());if(m.normalMap)m.normalScale?.set?.(.68,.68);
      if(id.includes('body')){m.color?.set(0x28312d);m.roughness=.74;m.metalness=.01}
      else if(id.includes('opacity')||id.includes('hair')){m.color?.set(0x0d100e);m.transparent=true;m.alphaTest=Math.max(m.alphaTest||0,.2);m.side=THREE.DoubleSide;m.depthWrite=true}
      else{m.color?.set(0xf1d3c4);m.roughness=Math.max(.52,m.roughness??.58)}
      m.needsUpdate=true;
    });
  });

  avatar.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(avatar),s=b.getSize(new THREE.Vector3());avatar.scale.setScalar(5.15/Math.max(s.y,1e-6));avatar.updateMatrixWorld(true);const sb=new THREE.Box3().setFromObject(avatar),c=sb.getCenter(new THREE.Vector3());avatar.position.x-=c.x;avatar.position.z-=c.z;avatar.position.y+=2.95-sb.max.y;avatar.updateMatrixWorld(true);portrait.position.set(.34,.04,0);

  const silver=new THREE.MeshPhysicalMaterial({color:0xdce0e4,metalness:.99,roughness:.1,clearcoat:.7,clearcoatRoughness:.08,envMapIntensity:1.55});
  const cushion=new THREE.MeshPhysicalMaterial({color:0x151817,roughness:.5,metalness:.08});
  const phones=new THREE.Group();phones.position.set(0,1.98,.18);phones.scale.setScalar(.72);portrait.add(phones);
  addTube(phones,[[-.39,.08,-.04],[-.49,.17,-.22],[-.39,.28,-.38],[0,.34,-.47],[.39,.28,-.38],[.49,.17,-.22],[.39,.08,-.04]],.026,silver,56);
  for(const side of[-1,1]){const cup=addMesh(phones,new THREE.CylinderGeometry(.108,.108,.073,44),silver,[side*.405,.07,.05]);cup.rotation.z=Math.PI/2;cup.rotation.y=side*.12;const pad=addMesh(phones,new THREE.CylinderGeometry(.087,.087,.078,44),cushion,[side*.405,.07,.05],[.95,1,.95]);pad.rotation.z=Math.PI/2;pad.rotation.y=side*.12;const y=addMesh(phones,new THREE.BoxGeometry(.05,.15,.045),silver,[side*.4,.2,-.01]);y.rotation.z=side*-.1}

  scene.add(new THREE.HemisphereLight(0xf2ece6,0x0f1210,.68));
  const key=new THREE.DirectionalLight(0xffddcf,3);key.position.set(-3.5,6.2,5.4);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0003;scene.add(key);
  const fill=new THREE.DirectionalLight(0xe4efec,1.05);fill.position.set(4.5,3.2,4.2);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xc7d9ff,1.8);rim.position.set(3.6,5,-4.2);scene.add(rim);
  const accent=new THREE.PointLight(0xff744f,1,7.5,2);accent.position.set(-2.4,1.7,3);scene.add(accent);

  const pointer={x:0,y:0,tx:0,ty:0},scroll={value:0,target:0},headBase=headBone?.quaternion.clone(),neckBase=neckBone?.quaternion.clone(),euler=new THREE.Euler(),q=new THREE.Quaternion();
  if(finePointer&&!reduceMotion){mount.addEventListener('pointermove',e=>{const r=mount.getBoundingClientRect();pointer.tx=((e.clientX-r.left)/r.width-.5)*2;pointer.ty=((e.clientY-r.top)/r.height-.5)*2},{passive:true});mount.addEventListener('pointerleave',()=>{pointer.tx=0;pointer.ty=0})}
  const onScroll=()=>{const hero=document.querySelector('.hero');scroll.target=Math.min(1,Math.max(0,scrollY/Math.max(1,hero?.offsetHeight||innerHeight)))};onScroll();addEventListener('scroll',onScroll,{passive:true});

  function resize(){const r=mount.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();if(w<560){portrait.scale.setScalar(1.03);portrait.position.set(.18,.1,0);camera.position.set(.08,2.08,5.8)}else if(w<850){portrait.scale.setScalar(1.01);portrait.position.set(.26,.07,0);camera.position.set(.12,2.05,5.52)}else{portrait.scale.setScalar(1);portrait.position.set(.34,.04,0);camera.position.set(.18,2.03,5.3)}}
  resize();new ResizeObserver(resize).observe(mount);fallback?.classList.add('hidden');

  let last=performance.now();function render(now){const dt=Math.min(.04,(now-last)/1000);last=now;pointer.x+=(pointer.tx-pointer.x)*Math.min(1,dt*5);pointer.y+=(pointer.ty-pointer.y)*Math.min(1,dt*5);scroll.value+=(scroll.target-scroll.value)*Math.min(1,dt*3.1);if(!reduceMotion){portrait.rotation.y=-.055+pointer.x*.024+scroll.value*.055;portrait.rotation.x=pointer.y*.004-scroll.value*.004;if(headBone&&headBase){euler.set(-pointer.y*.025,pointer.x*.05,-pointer.x*.006,'YXZ');q.setFromEuler(euler).premultiply(headBase);headBone.quaternion.slerp(q,Math.min(1,dt*5.4))}if(neckBone&&neckBase){euler.set(-pointer.y*.008,pointer.x*.015,0,'YXZ');q.setFromEuler(euler).premultiply(neckBase);neckBone.quaternion.slerp(q,Math.min(1,dt*4))}camera.position.y=2.03-scroll.value*.07;camera.position.x=.18+scroll.value*.05;camera.lookAt(.18,2.15-scroll.value*.05,0)}else camera.lookAt(.18,2.15,0);renderer.render(scene,camera);requestAnimationFrame(render)}requestAnimationFrame(render);
}

init().catch(error=>{console.warn('Rocketbox portrait unavailable',error);fallback?.querySelector('strong')?.replaceChildren(document.createTextNode('Realtime portrait unavailable'))});
