const mount = document.getElementById('avatar3d');
const fallback = document.getElementById('sceneFallback');
if (!mount) throw new Error('3D mount missing');

async function loadThree(){
  const sources = [
    'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.169.0/three.module.min.js',
    'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js',
    'https://unpkg.com/three@0.169.0/build/three.module.js'
  ];
  let last;
  for (const src of sources){
    try { return await import(src); } catch (err) { last = err; }
  }
  throw last || new Error('Unable to load Three.js');
}

try {
  const THREE = await loadThree();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;

  const renderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, 1, .1, 100);
  camera.position.set(.15, 1.35, 7.6);

  const root = new THREE.Group();
  root.position.set(-.05, -.46, 0);
  root.rotation.y = -.18;
  scene.add(root);

  const skin = new THREE.MeshStandardMaterial({ color:0xe7ad86, roughness:.72, metalness:0 });
  const skinWarm = new THREE.MeshStandardMaterial({ color:0xd89570, roughness:.78 });
  const hair = new THREE.MeshStandardMaterial({ color:0x171816, roughness:.32, metalness:.06 });
  const shirt = new THREE.MeshStandardMaterial({ color:0x242522, roughness:.58 });
  const shirt2 = new THREE.MeshStandardMaterial({ color:0x343531, roughness:.65 });
  const silver = new THREE.MeshStandardMaterial({ color:0xc9cdd0, roughness:.19, metalness:.92 });
  const dark = new THREE.MeshStandardMaterial({ color:0x1c1d1a, roughness:.52 });
  const deskMat = new THREE.MeshStandardMaterial({ color:0x6d513e, roughness:.78 });
  const keyMat = new THREE.MeshStandardMaterial({ color:0xe5e0d6, roughness:.62 });
  const screenMat = new THREE.MeshStandardMaterial({ color:0x171a18, emissive:0x283d32, emissiveIntensity:.5, roughness:.35 });

  const shadowify = (mesh) => { mesh.castShadow = true; mesh.receiveShadow = true; return mesh; };
  const sphere = (r, mat, pos, scale=[1,1,1], seg=40) => {
    const m = shadowify(new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(18,seg/2)), mat));
    m.position.set(...pos); m.scale.set(...scale); root.add(m); return m;
  };
  const box = (size, mat, pos, rot=[0,0,0]) => {
    const m=shadowify(new THREE.Mesh(new THREE.BoxGeometry(...size),mat)); m.position.set(...pos); m.rotation.set(...rot); root.add(m); return m;
  };

  const torso = sphere(1, shirt, [0,.55,-.05], [1.03,1.08,.64]);
  sphere(.3, skinWarm, [0,1.38,.03],[.8,.78,.7]);
  const head = sphere(1, skin, [0,2.22,.12],[.69,.84,.64],56);
  sphere(.18, skinWarm, [-.69,2.2,.1],[.55,.78,.38],28);
  sphere(.18, skinWarm, [.69,2.2,.1],[.55,.78,.38],28);

  sphere(.79, hair,[0,2.58,-.02],[.91,.62,.86],48);
  const hairLeft=sphere(.56,hair,[-.31,2.66,.22],[.80,.70,.75],42); hairLeft.rotation.z=-.20; hairLeft.rotation.y=.06;
  const hairRight=sphere(.56,hair,[.31,2.66,.22],[.80,.70,.75],42); hairRight.rotation.z=.20; hairRight.rotation.y=-.06;
  box([.16,.48,.20],hair,[-.47,2.47,.50],[0,0,-.35]);
  box([.16,.48,.20],hair,[.47,2.47,.50],[0,0,.35]);

  box([.34,.045,.055],dark,[-.27,2.26,.70],[0,0,-.07]);
  box([.34,.045,.055],dark,[.27,2.26,.70],[0,0,.07]);
  const eyeGeo=new THREE.SphereGeometry(.115,24,12);
  const eyeMat=new THREE.MeshStandardMaterial({color:0x24211f,roughness:.45});
  const eyeL=shadowify(new THREE.Mesh(eyeGeo,eyeMat)); eyeL.position.set(-.27,2.12,.735); eyeL.scale.set(1,.18,.15); root.add(eyeL);
  const eyeR=eyeL.clone(); eyeR.position.x=.27; root.add(eyeR);
  box([.055,.12,.05],skinWarm,[0,2.02,.75],[.12,0,0]);
  box([.23,.026,.045],new THREE.MeshStandardMaterial({color:0x995e54,roughness:.65}),[0,1.84,.72],[0,0,0]);

  const band=new THREE.Mesh(new THREE.TorusGeometry(.46,.045,14,64,Math.PI*1.48),silver);
  band.position.set(0,1.28,.31); band.rotation.set(1.32,0,.80); band.castShadow=true; root.add(band);
  const cupGeo=new THREE.CylinderGeometry(.13,.13,.16,28);
  const cupL=shadowify(new THREE.Mesh(cupGeo,silver)); cupL.rotation.z=Math.PI/2; cupL.position.set(-.46,1.27,.43); root.add(cupL);
  const cupR=cupL.clone(); cupR.position.x=.46; root.add(cupR);

  box([4.4,.18,1.42],deskMat,[.58,-.73,1.30],[0,0,0]);
  box([1.78,.10,.62],keyMat,[.08,-.54,1.67],[-.12,0,0]);
  for(let r=0;r<3;r++) for(let c=0;c<8;c++) box([.14,.035,.10],shirt2,[-.50+c*.15,-.48,1.48+r*.15],[-.12,0,0]);
  box([2.18,1.46,.10],dark,[1.70,.55,.93],[0,-.23,0]);
  const screen=box([1.92,1.20,.025],screenMat,[1.66,.57,.82],[0,-.23,0]);
  box([.12,.70,.12],silver,[1.66,-.50,.94],[0,-.23,0]);
  box([.72,.08,.36],silver,[1.68,-.77,.97],[0,-.23,0]);
  const codeMat=new THREE.MeshStandardMaterial({color:0xb6cab8,emissive:0x6fa077,emissiveIntensity:.72,roughness:.35});
  const codeAccent=new THREE.MeshStandardMaterial({color:0xe08b70,emissive:0xa6442d,emissiveIntensity:.5,roughness:.35});
  for(let i=0;i<6;i++){
    const w=[.92,.62,.78,1.04,.54,.86][i];
    const m=box([w,.035,.012],i===0?codeAccent:codeMat,[1.16+w*.05,.94-i*.16,.72],[0,-.23,0]);
    m.position.x += i%2 ? .18 : .02;
  }

  function cylinderBetween(a,b,r,mat){
    const geo=new THREE.CylinderGeometry(r,r,1,28);
    const mesh=shadowify(new THREE.Mesh(geo,mat)); root.add(mesh);
    const yAxis=new THREE.Vector3(0,1,0);
    const update=(from,to)=>{
      const dir=new THREE.Vector3().subVectors(to,from); const len=dir.length();
      mesh.position.copy(from).add(to).multiplyScalar(.5); mesh.scale.set(1,len,1);
      mesh.quaternion.setFromUnitVectors(yAxis,dir.clone().normalize());
    };
    update(a,b); return {mesh,update};
  }
  const shoulderL=new THREE.Vector3(-.75,.98,.18), shoulderR=new THREE.Vector3(.75,.98,.18);
  const handL=new THREE.Vector3(-.42,-.32,1.56), handR=new THREE.Vector3(.46,-.32,1.58);
  const armL=cylinderBetween(shoulderL,handL,.16,shirt2); const armR=cylinderBetween(shoulderR,handR,.16,shirt2);
  const palmL=sphere(.16,skin,handL.toArray(),[1.15,.55,1]); const palmR=sphere(.16,skin,handR.toArray(),[1.15,.55,1]);

  box([1.45,1.78,.22],shirt2,[0,.03,-.74],[0,0,0]);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(18,18),new THREE.ShadowMaterial({color:0x000000,opacity:.16}));
  floor.rotation.x=-Math.PI/2; floor.position.y=-.84; floor.receiveShadow=true; scene.add(floor);

  const hemi=new THREE.HemisphereLight(0xfff7e9,0x6d716b,2.1); scene.add(hemi);
  const key=new THREE.DirectionalLight(0xffead9,4.1); key.position.set(-4,7,6); key.castShadow=true; key.shadow.mapSize.set(1024,1024); key.shadow.bias=-.0005; scene.add(key);
  const rim=new THREE.DirectionalLight(0xb7c8cb,2.5); rim.position.set(5,2,-2); scene.add(rim);
  const warm=new THREE.PointLight(0xd65f3d,9,7); warm.position.set(-2,.5,3.4); scene.add(warm);

  const pointer={x:0,y:0,tx:0,ty:0};
  if (finePointer && !reduceMotion) {
    mount.addEventListener('pointermove',(e)=>{
      const r=mount.getBoundingClientRect(); pointer.tx=((e.clientX-r.left)/r.width-.5)*2; pointer.ty=((e.clientY-r.top)/r.height-.5)*2;
    },{passive:true});
    mount.addEventListener('pointerleave',()=>{pointer.tx=0;pointer.ty=0});
  }

  function resize(){
    const r=mount.getBoundingClientRect(); const w=Math.max(1,r.width),h=Math.max(1,r.height);
    renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix();
    const mobile=w<560; root.scale.setScalar(mobile?.78:(w<760?.9:1)); camera.position.z=mobile?8.5:7.6; camera.position.y=mobile?1.2:1.35;
  }
  resize(); new ResizeObserver(resize).observe(mount);
  fallback?.classList.add('hidden');

  let last=performance.now();
  function render(now){
    const dt=Math.min(.04,(now-last)/1000); last=now; const t=now*.001;
    pointer.x+=(pointer.tx-pointer.x)*Math.min(1,dt*5.5); pointer.y+=(pointer.ty-pointer.y)*Math.min(1,dt*5.5);
    if(!reduceMotion){
      root.rotation.y=-.18+pointer.x*.11; root.rotation.x=pointer.y*.045;
      head.rotation.y=pointer.x*.07; head.rotation.x=-pointer.y*.035;
      const tap=Math.sin(t*8.6); const tap2=Math.sin(t*8.6+Math.PI);
      const lEnd=new THREE.Vector3(-.42,-.32+tap*.035,1.56+Math.cos(t*8.6)*.018);
      const rEnd=new THREE.Vector3(.46,-.32+tap2*.035,1.58+Math.cos(t*8.6+Math.PI)*.018);
      armL.update(shoulderL,lEnd); armR.update(shoulderR,rEnd); palmL.position.copy(lEnd); palmR.position.copy(rEnd);
      torso.scale.y=1.08+Math.sin(t*1.6)*.008;
      const blink=(t%5.2)>4.93; eyeL.scale.y=blink?.035:.18; eyeR.scale.y=blink?.035:.18;
      screen.material.emissiveIntensity=.48+Math.sin(t*2.4)*.06;
    }
    renderer.render(scene,camera); requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
} catch (err) {
  console.warn('3D scene unavailable', err);
  fallback?.querySelector('small')?.replaceChildren(document.createTextNode('3D scene unavailable'));
}
