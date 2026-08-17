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

function applyEditorialExpression(mesh){
  if(!mesh.morphTargetDictionary||!mesh.morphTargetInfluences)return [];
  const applied=[];
  const rules=[
    {rx:/squint|lid.?tight|eye.?squeeze|au[_ -]?0?7/i,value:.045},
    {rx:/brow.*(down|lower)|au[_ -]?0?4/i,value:.032},
    {rx:/smile|corner.*pull|au[_ -]?12/i,value:.015}
  ];
  for(const [name,index] of Object.entries(mesh.morphTargetDictionary)){
    for(const rule of rules){
      if(!rule.rx.test(name))continue;
      mesh.morphTargetInfluences[index]=Math.max(mesh.morphTargetInfluences[index]||0,rule.value);
      applied.push(name);break;
    }
  }
  return applied;
}

async function init(){
  const renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.82;renderer.outputColorSpace=THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x090b0a,.012);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.035).texture;room.dispose();pmrem.dispose();
  const camera=new THREE.PerspectiveCamera(27,1,.1,100);camera.position.set(.12,2.08,5.06);
  const portrait=new THREE.Group();portrait.rotation.y=-.115;scene.add(portrait);
  const gltf=await loadModel('./assets/rocketbox-male10.glb'),avatar=gltf.scene;portrait.add(avatar);

  let headBone=null,neckBone=null;const morphs=[];
  avatar.traverse(o=>{
    if(o.isBone){if(!headBone&&/head$/i.test(o.name))headBone=o;if(!neckBone&&/neck$/i.test(o.name))neckBone=o}
    if(!(o.isMesh||o.isSkinnedMesh))return;
    o.castShadow=true;o.receiveShadow=true;
    morphs.push(...applyEditorialExpression(o));
    mats(o).forEach(m=>{
      const id=`${m.name||''} ${m.map?.name||''} ${m.normalMap?.name||''}`.toLowerCase();
      if(m.map)m.map.anisotropy=Math.min(12,renderer.capabilities.getMaxAnisotropy());
      if(id.includes('body')){
        m.color?.set(0x1a201d);m.roughness=.7;m.metalness=.015;if('envMapIntensity'in m)m.envMapIntensity=.34;
        if(m.normalMap)m.normalScale?.set?.(.82,.82);
      }else if(id.includes('opacity')||id.includes('hair')){
        m.color?.set(0x090b0a);m.transparent=true;m.alphaTest=Math.max(m.alphaTest||0,.24);m.side=THREE.DoubleSide;m.depthWrite=true;
        if('roughness'in m)m.roughness=.62;if('envMapIntensity'in m)m.envMapIntensity=.25;
      }else if(id.includes('head')){
        m.color?.set(0xffffff);m.roughness=.6;m.metalness=0;if('envMapIntensity'in m)m.envMapIntensity=.38;
        if(m.normalMap)m.normalScale?.set?.(1.02,1.02);
      }else{
        m.color?.set(0xfaf7f3);if('roughness'in m)m.roughness=Math.max(.5,m.roughness??.55);if('envMapIntensity'in m)m.envMapIntensity=.42;
        if(m.normalMap)m.normalScale?.set?.(.9,.9);
      }
      m.needsUpdate=true;
    });
  });
  if(morphs.length)console.info('Portrait expression morphs',morphs);

  avatar.updateMatrixWorld(true);const b=new THREE.Box3().setFromObject(avatar),s=b.getSize(new THREE.Vector3());avatar.scale.setScalar(5.18/Math.max(s.y,1e-6));
  avatar.updateMatrixWorld(true);const sb=new THREE.Box3().setFromObject(avatar),c=sb.getCenter(new THREE.Vector3());avatar.position.x-=c.x;avatar.position.z-=c.z;avatar.position.y+=2.96-sb.max.y;avatar.updateMatrixWorld(true);portrait.position.set(.30,.02,0);

  const silver=new THREE.MeshPhysicalMaterial({color:0xd8dde2,metalness:.98,roughness:.13,clearcoat:.65,clearcoatRoughness:.09,envMapIntensity:1.35});
  const cushion=new THREE.MeshPhysicalMaterial({color:0x111412,roughness:.56,metalness:.06});
  const phones=new THREE.Group();phones.position.set(0,1.99,.19);phones.scale.setScalar(.61);portrait.add(phones);
  addTube(phones,[[-.39,.08,-.04],[-.49,.17,-.22],[-.39,.28,-.38],[0,.34,-.47],[.39,.28,-.38],[.49,.17,-.22],[.39,.08,-.04]],.023,silver,56);
  for(const side of[-1,1]){
    const cup=addMesh(phones,new THREE.CylinderGeometry(.105,.105,.068,44),silver,[side*.405,.07,.05]);cup.rotation.z=Math.PI/2;cup.rotation.y=side*.12;
    const pad=addMesh(phones,new THREE.CylinderGeometry(.084,.084,.073,44),cushion,[side*.405,.07,.05],[.95,1,.95]);pad.rotation.z=Math.PI/2;pad.rotation.y=side*.12;
    const y=addMesh(phones,new THREE.BoxGeometry(.046,.14,.041),silver,[side*.4,.2,-.01]);y.rotation.z=side*-.1;
  }

  scene.add(new THREE.HemisphereLight(0xf0eee9,0x0b0e0d,.5));
  const key=new THREE.DirectionalLight(0xfff3ea,2.55);key.position.set(-4.4,6.4,5.6);key.castShadow=true;key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0003;scene.add(key);
  const fill=new THREE.DirectionalLight(0xc8d7ef,.7);fill.position.set(4.8,2.7,4.5);scene.add(fill);
  const rim=new THREE.DirectionalLight(0xaec6e9,1.45);rim.position.set(3.8,5.2,-4.5);scene.add(rim);
  const accent=new THREE.PointLight(0xff7553,.28,7.5,2);accent.position.set(-2.6,1.5,3.1);scene.add(accent);

  const pointer={x:0,y:0,tx:0,ty:0},scroll={value:0,target:0};
  const headBase=headBone?.quaternion.clone(),neckBase=neckBone?.quaternion.clone(),euler=new THREE.Euler(),q=new THREE.Quaternion();
  if(finePointer&&!reduceMotion){
    mount.addEventListener('pointermove',e=>{const r=mount.getBoundingClientRect();pointer.tx=((e.clientX-r.left)/r.width-.5)*2;pointer.ty=((e.clientY-r.top)/r.height-.5)*2},{passive:true});
    mount.addEventListener('pointerleave',()=>{pointer.tx=0;pointer.ty=0});
  }
  const onScroll=()=>{const hero=document.querySelector('.hero');scroll.target=Math.min(1,Math.max(0,scrollY/Math.max(1,hero?.offsetHeight||innerHeight)))};onScroll();addEventListener('scroll',onScroll,{passive:true});

  function resize(){
    const r=mount.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    if(w<560){portrait.scale.setScalar(1.09);portrait.position.set(.12,.11,0);camera.position.set(.03,2.1,5.26)}
    else if(w<850){portrait.scale.setScalar(1.045);portrait.position.set(.22,.07,0);camera.position.set(.08,2.09,5.15)}
    else{portrait.scale.setScalar(1);portrait.position.set(.30,.02,0);camera.position.set(.12,2.08,5.06)}
  }
  resize();new ResizeObserver(resize).observe(mount);fallback?.classList.add('hidden');

  let last=performance.now();
  function render(now){
    const dt=Math.min(.04,(now-last)/1000);last=now;
    pointer.x+=(pointer.tx-pointer.x)*Math.min(1,dt*5);pointer.y+=(pointer.ty-pointer.y)*Math.min(1,dt*5);scroll.value+=(scroll.target-scroll.value)*Math.min(1,dt*3.1);
    if(!reduceMotion){
      portrait.rotation.y=-.115+pointer.x*.036+scroll.value*.05;portrait.rotation.x=pointer.y*.004-scroll.value*.004;
      if(headBone&&headBase){euler.set(-.018-pointer.y*.022,.035+pointer.x*.042,-pointer.x*.004,'YXZ');q.setFromEuler(euler).premultiply(headBase);headBone.quaternion.slerp(q,Math.min(1,dt*5.2))}
      if(neckBone&&neckBase){euler.set(-.005-pointer.y*.006,.012+pointer.x*.012,0,'YXZ');q.setFromEuler(euler).premultiply(neckBase);neckBone.quaternion.slerp(q,Math.min(1,dt*4))}
      camera.position.y=2.08-scroll.value*.065;camera.position.x=.12+scroll.value*.04;camera.lookAt(.13,2.18-scroll.value*.045,0);
    }else camera.lookAt(.13,2.18,0);
    renderer.render(scene,camera);requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}

init().catch(error=>{console.warn('Rocketbox portrait unavailable',error);fallback?.querySelector('strong')?.replaceChildren(document.createTextNode('Realtime portrait unavailable'))});
