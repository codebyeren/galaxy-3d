import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

const container = document.getElementById('container');
const scene = new THREE.Scene();

// ── Cameras & Renderers ────────────────────────────
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 500);
camera.position.set(8, 5, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.5;
container.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(innerWidth, innerHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
container.appendChild(labelRenderer.domElement);

// ── Controls ──────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.05;
controls.autoRotate = true; controls.autoRotateSpeed = 0.15;
controls.minDistance = 4; controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI * 0.85;
controls.target.set(0, 0, 0);

// ── Bloom via simple additive pass ────────────────
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(
  new THREE.Vector2(innerWidth, innerHeight), 0.15, 1.0, 0.92
));

// ── Lighting ──────────────────────────────────────
scene.add(new THREE.AmbientLight(0x0a0a20, 0.15));
const coreLight = new THREE.PointLight(0x88bbff, 80, 50, 1.5);
coreLight.position.set(0, 0, 0); scene.add(coreLight);
const warmLight = new THREE.PointLight(0xff6644, 30, 30, 2);
warmLight.position.set(2, 2, 0); scene.add(warmLight);

// ═══════════════════════════════════════════════════════
// 1. CRYSTAL NEON GALAXY CORE
// ═══════════════════════════════════════════════════════
const coreGroup = new THREE.Group(); scene.add(coreGroup);

// Inner bright point
const corePoint = new THREE.Mesh(
  new THREE.SphereGeometry(0.3, 32, 32),
  new THREE.MeshBasicMaterial({ color: 0xffffff })
);
coreGroup.add(corePoint);

// Crystal glow shell
const glowSphere = new THREE.Mesh(
  new THREE.SphereGeometry(2.5, 64, 64),
  new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `varying vec3 vN,vP;varying float vR;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);vR=length(position.xy)/2.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `varying vec3 vN,vP;varying float vR;uniform float uTime;void main(){vec3 vd=normalize(cameraPosition-vP);float f=1.-abs(dot(vd,vN));f=pow(f,3.5);float p=.92+.08*sin(uTime*1.1);float h=sin(vR*8.0+uTime*0.5)*0.5+0.5;vec3 c;c=0.5+0.5*cos(6.28319*(h+vec3(0.0,0.33,0.67)));c=mix(c,vec3(1.0,0.95,0.9),1.0-vR)*p;gl_FragColor=vec4(c,f*.35);}`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  })
);
coreGroup.add(glowSphere);

// Wavy multicolor data rings
const ringColors2 = [0x4488ff, 0xff4488, 0x44ff88];
for (let i = 0; i < 1; i++) {
  const radius = 1.5;
  const segments = 96;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(segments * 3), col = new Float32Array(segments * 3);
  for (let j = 0; j < segments; j++) {
    const a = (j / segments) * Math.PI * 2;
    const wave = Math.sin(a * 4 + i * 1.5) * 0.2 * (0.8 + i * 0.4);
    pos[j * 3] = Math.cos(a) * (radius + wave);
    pos[j * 3 + 1] = Math.sin(a * 3 + i * 2) * 0.15 + wave * 0.3;
    pos[j * 3 + 2] = Math.sin(a) * (radius + wave);
    const rc = new THREE.Color(ringColors2[i]);
    const rc2 = new THREE.Color(ringColors2[(i + 1) % 3]);
    const rc3 = rc.clone().lerp(rc2, j / segments);
    col[j * 3] = rc3.r; col[j * 3 + 1] = rc3.g; col[j * 3 + 2] = rc3.b;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.12, vertexColors: true, blending: THREE.AdditiveBlending,
    transparent: true, opacity: 0.35 + i * 0.08, depthWrite: false
  });
  const ring = new THREE.Points(geo, mat);
  ring.rotation.x = Math.PI * (0.15 + i * 0.06);
  ring.userData = { speed: 0.4 + i * 0.2, tilt: 0.15 + i * 0.06, wavePhase: 0 };
  coreGroup.add(ring);
}

// ═══════════════════════════════════════════════════════
// 2. SPIRAL ARMS (M51-style crystal neon highways)
// ═══════════════════════════════════════════════════════
function makeArms(count) {
  const p = new Float32Array(count * 3), c = new Float32Array(count * 3), s = new Float32Array(count);
  // 2 arms, rainbow gradient along each
  for (let i = 0; i < count; i++) {
    const arm = i % 2;
    const t = (i - arm) / count * 2;
    const r = 0.8 + Math.pow(t, 0.6) * 8.5;
    const angle = arm * Math.PI + r * 2.2 + t * 0.4;
    const scatter = (Math.random() - 0.5) * (0.3 + t * 0.5);
    const rad = r + (Math.random() - 0.5) * 0.15;
    p[i * 3] = Math.cos(angle + scatter) * rad * 1.5;
    p[i * 3 + 1] = (Math.random() - 0.5) * (0.2 + t * 0.5);
    p[i * 3 + 2] = Math.sin(angle + scatter) * rad;

    // Random color within warm-to-cool range
    const hue = 0.0 + Math.random() * 0.7 + arm * 0.05;
    const sat = 0.3 + Math.random() * 0.5;
    const lig = 0.5 + Math.random() * 0.4;
    const col = new THREE.Color().setHSL(hue % 1.0, sat, lig);
    c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b;
    s[i] = (0.3 + t * 0.3) * (0.4 + Math.random() * 0.6);
  }
  return { pos: p, col: c, siz: s };
}

let armParticles = null;
function renderArms(data) {
  if (armParticles) scene.remove(armParticles);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(data.pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(data.col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(data.siz, 1));
  armParticles = new THREE.Points(g, new THREE.PointsMaterial({
    size: 0.14, map: circleTex, vertexColors: true, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.95, sizeAttenuation: true
  }));
  scene.add(armParticles);
}

// ── Dust lanes as transparent circuit paths ──────
const dustGeo = new THREE.BufferGeometry();
const dcount = 8000;
const dpos = new Float32Array(dcount * 3), dcol = new Float32Array(dcount * 3);
for (let i = 0; i < dcount; i++) {
  const arm = i % 2;
  const t = ((i - arm) / dcount) * 2;
  const r = 1.5 + Math.pow(t, 0.7) * 15;
  const angle = arm * Math.PI + r * 1.8 + t * 0.3 + 0.4;
  const rad = r + (Math.random() - 0.5) * 0.3;
  dpos[i * 3] = Math.cos(angle) * rad;
  dpos[i * 3 + 1] = (Math.random() - 0.5) * 0.08;
  dpos[i * 3 + 2] = Math.sin(angle) * rad;
  const col = new THREE.Color().setHSL(0.65, 0.1, 0.03 + Math.random() * 0.04);
  dcol[i * 3] = col.r; dcol[i * 3 + 1] = col.g; dcol[i * 3 + 2] = col.b;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
dustGeo.setAttribute('color', new THREE.BufferAttribute(dcol, 3));
const dustMesh = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  size: 0.15, vertexColors: true, blending: THREE.NormalBlending,
  depthWrite: false, transparent: true, opacity: 0.25, sizeAttenuation: true
}));
scene.add(dustMesh);

// ═══════════════════════════════════════════════════════
// 3. DATA CLUSTERS (interactive spheres in arms)
// ═══════════════════════════════════════════════════════
const dataClusters = [];
const clusterInfos = [
  { name: 'NGC 5194', temp: 9800, mass: '2.3e6 M☉', age: '420 Myr' },
  { name: 'Star Nursery α', temp: 12500, mass: '5.1e4 M☉', age: '12 Myr' },
  { name: 'Pulsar Array ω', temp: 3400, mass: '8.7e3 M☉', age: '1.2 Gyr' },
  { name: 'Nebula Core γ', temp: 22000, mass: '1.5e5 M☉', age: '85 Myr' },
  { name: 'Dark Matter Lens', temp: 270, mass: '4.2e8 M☉', age: '13.7 Gyr' },
  { name: 'Neutron Field β', temp: 560000, mass: '3.1e3 M☉', age: '940 Myr' },
  { name: 'Gas Giant δ', temp: 1800, mass: '6.3e2 M☉', age: '2.1 Gyr' },
  { name: 'Exoplanet Belt ε', temp: 4200, mass: '9.8e0 M☉', age: '670 Myr' },
];

function createDataClusters() {
  clusterInfos.forEach((info, idx) => {
    const t = 0.15 + idx * 0.1;
    const r = 2.0 + t * 14;
    const arm = idx % 2;
    const angle = arm * Math.PI + r * 1.8 + t * 0.3 + (Math.random() - 0.5) * 0.5;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const y = (Math.random() - 0.5) * 0.5;

    // Glowing sphere
    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.12 + Math.random() * 0.08, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff5588 })
    );
    sphere.position.set(x, y, z);
    sphere.userData = { info, hovered: false, baseY: y, pulsePhase: Math.random() * 6.28 };
    scene.add(sphere);

    // Outer glow ring
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xff88aa, transparent: true, opacity: 0.2 })
    );
    glow.position.copy(sphere.position);
    scene.add(glow);

    // Label (CSS2D)
    const labelDiv = document.createElement('div');
    labelDiv.textContent = info.name;
    labelDiv.style.color = '#ffaacc';
    labelDiv.style.fontSize = '10px';
    labelDiv.style.fontFamily = 'monospace';
    labelDiv.style.background = 'rgba(0,0,20,0.6)';
    labelDiv.style.padding = '2px 6px';
    labelDiv.style.borderRadius = '4px';
    labelDiv.style.border = '1px solid rgba(255,100,150,0.3)';
    labelDiv.style.backdropFilter = 'blur(4px)';
    labelDiv.style.pointerEvents = 'none';
    labelDiv.style.transition = 'opacity 0.3s';
    labelDiv.style.opacity = '0.6';
    const label = new CSS2DObject(labelDiv);
    label.position.set(x, y - 0.35, z);
    scene.add(label);

    dataClusters.push({ sphere, glow, label, info, angleR: r, angleA: angle, speed: 0.01 + Math.random() * 0.02 });
  });
}

// ═══════════════════════════════════════════════════════
// 4. FLOATING UI PANELS (3D glass data panels)
// ═══════════════════════════════════════════════════════
function makeDataPanel(x, y, z, width, height, lines) {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 256);

  // Glass background
  ctx.fillStyle = 'rgba(0, 20, 40, 0.5)';
  ctx.strokeStyle = 'rgba(68, 136, 255, 0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(4, 4, 504, 248, 8); ctx.fill(); ctx.stroke();

  // Scan line overlay
  ctx.fillStyle = 'rgba(68, 136, 255, 0.04)';
  for (let i = 0; i < 256; i += 4) { ctx.fillRect(4, i, 504, 1); }

  // Header
  ctx.fillStyle = 'rgba(68, 136, 255, 0.8)';
  ctx.font = '14px monospace';
  ctx.fillText('▸ GALAXY DATA v3.12', 16, 28);

  // Data lines
  ctx.font = '11px monospace';
  ctx.fillStyle = 'rgba(136, 200, 255, 0.7)';
  lines.forEach((line, i) => {
    ctx.fillText(`  ${line[0]}: ${line[1]}`, 20, 52 + i * 18);
  });

  // Radar
  ctx.strokeStyle = 'rgba(68, 200, 255, 0.15)';
  ctx.lineWidth = 1;
  const rx = 440, ry = 80, rr = 40;
  ctx.beginPath(); ctx.arc(rx, ry, rr, 0, 6.28); ctx.stroke();
  ctx.beginPath(); ctx.arc(rx, ry, rr * 0.7, 0, 6.28); ctx.stroke();
  ctx.beginPath(); ctx.arc(rx, ry, rr * 0.4, 0, 6.28); ctx.stroke();
  // Radar sweep
  ctx.beginPath(); ctx.moveTo(rx, ry);
  const sa = Date.now() * 0.002 % 6.28;
  ctx.lineTo(rx + Math.cos(sa) * rr, ry + Math.sin(sa) * rr);
  ctx.strokeStyle = 'rgba(68, 200, 255, 0.4)'; ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
  mesh.position.set(x, y, z);

  const panelObj = { mesh, canvas, ctx, lines, angle: Date.now() * 0.0003 };
  scene.add(mesh);
  return panelObj;
}

const panels = [];
// Panel 1: Galaxy metrics (right side)
panels.push(makeDataPanel(6, 3, 0, 3.5, 1.8, [
  ['Rotation', '0.14 rad/Myr'],
  ['Arms', '2 (Grand Design)'],
  ['Stars', '156.4K tracked'],
  ['Age', '13.2 Gyr'],
  ['Clusters', '8 active'],
  ['Dark Matter', '84.3%'],
]));

// Panel 2: Spectral analysis (top right)
panels.push(makeDataPanel(4, 4.5, 6, 2.8, 1.2, [
  ['Spectrum', 'Sc-Bb (Blue)'],
  ['Magnitude', '-21.8'],
  ['Redshift', 'z=0.001'],
  ['Diameter', '142 kly'],
]));

// Panel 3: Real-time telemetry (bottom left-ish)
panels.push(makeDataPanel(-5, -2, 4, 3.0, 1.4, [
  ['Signal Rate', '9.4 TB/s'],
  ['Latency', '2.3 ms'],
  ['Packets', '12.7M/s'],
  ['Encryption', 'Quantum-256'],
]));

// ═══════════════════════════════════════════════════════
// 5. SATELLITE GALAXY + HOLOGRAPHIC BEAM
// ═══════════════════════════════════════════════════════
const satGroup = new THREE.Group(); scene.add(satGroup);
const satPos = new THREE.Vector3(8, 2, -10);

// Satellite galaxy body
const satCore = new THREE.Mesh(
  new THREE.SphereGeometry(0.4, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x88aaff })
);
satCore.position.copy(satPos);
satGroup.add(satCore);

const satGlow = new THREE.Mesh(
  new THREE.SphereGeometry(0.8, 16, 16),
  new THREE.MeshBasicMaterial({ color: 0x4466ff, transparent: true, opacity: 0.15 })
);
satGlow.position.copy(satPos);
satGroup.add(satGlow);

// Satellite particles
const satCount = 800;
const satP = new Float32Array(satCount * 3), satC = new Float32Array(satCount * 3);
for (let i = 0; i < satCount; i++) {
  const r = Math.random() * 1.5;
  const a = Math.random() * 6.28;
  satP[i * 3] = satPos.x + Math.cos(a) * r;
  satP[i * 3 + 1] = satPos.y + (Math.random() - 0.5) * 0.2;
  satP[i * 3 + 2] = satPos.z + Math.sin(a) * r;
  const co = new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.5, 0.4 + Math.random() * 0.4);
  satC[i * 3] = co.r; satC[i * 3 + 1] = co.g; satC[i * 3 + 2] = co.b;
}
const satGeo = new THREE.BufferGeometry();
satGeo.setAttribute('position', new THREE.BufferAttribute(satP, 3));
satGeo.setAttribute('color', new THREE.BufferAttribute(satC, 3));
const satMesh = new THREE.Points(satGeo, new THREE.PointsMaterial({
  size: 0.04, vertexColors: true, blending: THREE.AdditiveBlending,
  depthWrite: false, transparent: true
}));
satGroup.add(satMesh);

// Holographic connecting beam
const beamPoints = [];
for (let i = 0; i <= 40; i++) {
  const t = i / 40;
  const bx = satPos.x * t;
  const by = satPos.y * t + (1 - Math.cos(t * 6.28)) * 1.5;
  const bz = satPos.z * t;
  beamPoints.push(new THREE.Vector3(bx, by, bz));
}
const beamGeo = new THREE.BufferGeometry().setFromPoints(beamPoints);
const beamMat = new THREE.LineBasicMaterial({
  color: 0x4488ff, transparent: true, opacity: 0.15
});
const beamLine = new THREE.Line(beamGeo, beamMat);
scene.add(beamLine);

// Beam glow particles
const bcount = 200;
const bp = new Float32Array(bcount * 3), bc = new Float32Array(bcount * 3);
for (let i = 0; i < bcount; i++) {
  const t = i / bcount;
  bp[i * 3] = satPos.x * t + (Math.random() - 0.5) * 0.3;
  bp[i * 3 + 1] = satPos.y * t + (1 - Math.cos(t * 6.28)) * 1.5 + (Math.random() - 0.5) * 0.3;
  bp[i * 3 + 2] = satPos.z * t + (Math.random() - 0.5) * 0.3;
  const co = new THREE.Color().setHSL(0.6 + Math.random() * 0.1, 0.8, 0.4 + Math.random() * 0.4);
  bc[i * 3] = co.r; bc[i * 3 + 1] = co.g; bc[i * 3 + 2] = co.b;
}
const bGeo = new THREE.BufferGeometry();
bGeo.setAttribute('position', new THREE.BufferAttribute(bp, 3));
bGeo.setAttribute('color', new THREE.BufferAttribute(bc, 3));
const beamGlow = new THREE.Points(bGeo, new THREE.PointsMaterial({
  size: 0.04, vertexColors: true, blending: THREE.AdditiveBlending,
  depthWrite: false, transparent: true, opacity: 0.4
}));
scene.add(beamGlow);

// ═══════════════════════════════════════════════════════
// 6. BACKGROUND UNIVERSE
// ═══════════════════════════════════════════════════════
const bgCount = 5000;
const bgP = new Float32Array(bgCount * 3), bgC = new Float32Array(bgCount * 3);
for (let i = 0; i < bgCount; i++) {
  const r = 40 + Math.random() * 80;
  const th = Math.random() * 6.28, ph = Math.acos(2 * Math.random() - 1);
  bgP[i * 3] = Math.sin(ph) * Math.cos(th) * r;
  bgP[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * r;
  bgP[i * 3 + 2] = Math.cos(ph) * r;
  const co = new THREE.Color().setHSL(0.55 + Math.random() * 0.2, 0.2, 0.3 + Math.random() * 0.5);
  bgC[i * 3] = co.r; bgC[i * 3 + 1] = co.g; bgC[i * 3 + 2] = co.b;
}
const bgGeo = new THREE.BufferGeometry();
bgGeo.setAttribute('position', new THREE.BufferAttribute(bgP, 3));
bgGeo.setAttribute('color', new THREE.BufferAttribute(bgC, 3));
scene.add(new THREE.Points(bgGeo, new THREE.PointsMaterial({
  size: 0.08, vertexColors: true, blending: THREE.AdditiveBlending,
  depthWrite: false, transparent: true
})));

// ═══════════════════════════════════════════════════════
// 7. HOVER / CLICK INTERACTION
// ═══════════════════════════════════════════════════════
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let tooltip = document.createElement('div');
tooltip.style.cssText = 'position:fixed;z-index:100;background:rgba(0,10,30,0.9);border:1px solid rgba(68,136,255,0.3);border-radius:6px;padding:8px 12px;color:#aaccff;font:11px monospace;pointer-events:none;opacity:0;transition:opacity 0.2s;backdrop-filter:blur(8px);';
document.body.appendChild(tooltip);

renderer.domElement.addEventListener('mousemove', e => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
});

// Fullscreen modal for images
const imgModal = document.createElement('div');
imgModal.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.92);display:none;align-items:center;justify-content:center;cursor:pointer;';
imgModal.innerHTML = '<button id=imgClose style="position:absolute;top:20px;right:20px;z-index:201;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:rgba(0,0,0,0.5);color:#fff;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button><img id=imgFull style="max-width:90vw;max-height:90vh;border-radius:8px;">';
document.body.appendChild(imgModal);
const imgFull = document.getElementById('imgFull');
document.getElementById('imgClose').addEventListener('click', () => imgModal.style.display = 'none');
imgModal.addEventListener('click', e => { if (e.target === imgModal) imgModal.style.display = 'none'; });

renderer.domElement.addEventListener('click', e => {
  // Check floating images first
  const imgMouse = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  const imgRay = new THREE.Raycaster();
  imgRay.setFromCamera(imgMouse, camera);
  const imgHits = imgRay.intersectObjects(fltImages);
  if (imgHits.length > 0) {
    const dbId = imgHits[0].object.userData.dbId;
    const item = imgMap.get(dbId);
    if (item) { imgFull.src = durl(item.url); imgModal.style.display = 'flex'; }
    return;
  }
  // Then check data clusters
  const dm = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(dm, camera);
  const spheres = dataClusters.map(d => d.sphere);
  const hits = raycaster.intersectObjects(spheres);
  if (hits.length > 0) {
    const info = hits[0].object.userData.info;
    tooltip.innerHTML = `<b>${info.name}</b><br>Temp: ${info.temp}K<br>Mass: ${info.mass}<br>Age: ${info.age}`;
    tooltip.style.opacity = '1';
    tooltip.style.left = (e.clientX + 10) + 'px';
    tooltip.style.top = (e.clientY + 10) + 'px';
    setTimeout(() => { tooltip.style.opacity = '0'; }, 3000);
  }
});

// ── Resize ────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
  labelRenderer.setSize(innerWidth, innerHeight);
});

// ── Music Player ──────────────────────────────
const bgAudio = document.getElementById('bgAudio');
const musicBtn = document.getElementById('musicToggle');
let musicOn = false;
if (bgAudio && musicBtn) {
  bgAudio.volume = 0.25;
  musicBtn.addEventListener('click', () => {
    if (musicOn) { bgAudio.pause(); musicBtn.textContent = '🔇'; }
    else { bgAudio.play().catch(() => {}); musicBtn.textContent = '🔊'; }
    musicOn = !musicOn;
  });
  function startMusic() {
    if (!musicOn) { bgAudio.play().catch(() => {}); musicOn = true; musicBtn.textContent = '🔊'; }
    ['click','touchstart','keydown'].forEach(e => document.removeEventListener(e, startMusic));
  }
  ['click','touchstart','keydown'].forEach(e => document.addEventListener(e, startMusic, { once: true }));
}

// ═══════════════════════════════════════════════════════
// 8. INIT
// Create circle texture for round stars
const circleCanvas = document.createElement('canvas');
circleCanvas.width = 32; circleCanvas.height = 32;
const ctx = circleCanvas.getContext('2d');
const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
g.addColorStop(0, 'rgba(255,255,255,1)');
g.addColorStop(0.3, 'rgba(255,255,255,0.7)');
g.addColorStop(0.7, 'rgba(255,255,255,0.2)');
g.addColorStop(1, 'rgba(255,255,255,0)');
ctx.fillStyle = g;
ctx.fillRect(0, 0, 32, 32);
const circleTex = new THREE.CanvasTexture(circleCanvas);

renderArms(makeArms(45000));
createDataClusters();

// Hide loading
document.addEventListener('click', () => {
  const l = document.getElementById('loading');
  if (l) { l.style.transition = 'opacity 0.5s'; l.style.opacity = '0'; setTimeout(() => l.remove(), 500); }
}, { once: true });

setTimeout(() => {
  const l = document.getElementById('loading');
  if (l) { l.style.transition = 'opacity 0.5s'; l.style.opacity = '0'; setTimeout(() => l.remove(), 500); }
}, 4000);



// ── API Helpers ──────────────────────────────
const API = location.origin;
let authToken = null;
function ah() { return authToken ? { 'Authorization': 'Bearer ' + authToken } : {}; }
async function ag(p) { return (await fetch(API + p)).json(); }
async function ap(p, b) { const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ah() }, body: JSON.stringify(b) }); return r.json(); }
async function ad(p) { await fetch(API + p, { method: 'DELETE', headers: ah() }); }
async function au(file) { const f = new FormData(); f.append('image', file); const r = await fetch(API + '/api/images/upload', { method: 'POST', headers: ah(), body: f }); return r.json(); }

// ── Floating Images ─────────────────────────
const fltImages = [];

function loadTex(url) {
  return new Promise((res, rej) => new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, () => rej()));
}

function addFloatingImg(texture, dbId) {
  const asp = texture.image ? texture.image.width / texture.image.height : 1;
  const w = 2.8, h = w / asp;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, depthWrite: false }));
  const a = Math.random() * 6.28, r = 17 + Math.random() * 12, y = (Math.random() - 0.5) * 10;
  m.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
  m.lookAt(0, 0, 0);
  m.userData = { dbId, orbitR: r, orbitA: a, orbitY: y, spd: 0.01 + Math.random() * 0.03 };
  scene.add(m);
  fltImages.push(m);
}

const defImgs = [
  'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400',
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400',
  'https://images.unsplash.com/photo-1464802686167-b939a6910659?w=400',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400',
  'https://images.unsplash.com/photo-1506703719100-b0a86c48d3b5?w=400',
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400',
];

const imgMap = new Map();
function durl(u) { return u.startsWith('/') ? API + u : u; }

// Load images on startup
(async () => {
  try {
    const imgs = await ag('/api/images');
    if (imgs.length > 0) {
      for (const img of imgs) {
        try { const t = await loadTex(durl(img.url)); imgMap.set(img.id, { url: img.url, tex: t }); addFloatingImg(t, img.id); } catch(e) {}
      }
    } else {
      for (const url of defImgs) {
        try {
          const sv = authToken ? await ap('/api/images', { url }) : { id: 'l-' + Math.random().toString(36).slice(2), url };
          const t = await loadTex(url); imgMap.set(sv.id, { url: sv.url || url, tex: t }); addFloatingImg(t, sv.id);
        } catch(e) {}
      }
    }
  } catch(e) {
    for (const url of defImgs) {
      try { const t = await loadTex(url); const fid = 'l-' + Math.random().toString(36).slice(2); imgMap.set(fid, { url, tex: t }); addFloatingImg(t, fid); } catch(e) {}
    }
  }
})();

// Simple auth (stored in localStorage)
const storedToken = localStorage.getItem('glx_token');
if (storedToken) {
  fetch(API + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: storedToken }) })
    .then(r => { if (r.ok) authToken = storedToken; else localStorage.removeItem('glx_token'); })
    .catch(() => {});
}

// Upload via URL prompt (simple)
window.addEventListener('keydown', e => {
  if (e.key === 'u' && e.ctrlKey && authToken) {
    const url = prompt('Paste image URL:');
    if (url && url.trim()) {
      ap('/api/images', { url: url.trim() }).then(async sv => {
        if (sv.error) { alert(sv.error); return; }
        const t = await loadTex(durl(sv.url));
        imgMap.set(sv.id, { url: sv.url, tex: t }); addFloatingImg(t, sv.id);
      }).catch(e => {});
    }
  }
});
// Login: Ctrl+L
window.addEventListener('keydown', e => {
  if (e.key === 'l' && e.ctrlKey) {
    const pw = prompt('Admin password:');
    if (pw) {
      fetch(API + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
        .then(r => { if (r.ok) { authToken = pw; localStorage.setItem('glx_token', pw); alert('Admin unlocked! Ctrl+U to upload.'); } else alert('Wrong password!'); })
        .catch(() => alert('Connection failed'));
    }
  }
});

// ═══════════════════════════════════════════════════════
// ANIMATION LOOP
// ═══════════════════════════════════════════════════════
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const time = performance.now() * 0.001;

  controls.update();

  // Orbit floating images
  fltImages.forEach(m => {
    m.userData.orbitA += m.userData.spd * dt;
    m.position.x = Math.cos(m.userData.orbitA) * m.userData.orbitR;
    m.position.z = Math.sin(m.userData.orbitA) * m.userData.orbitR;
    m.position.y = m.userData.orbitY;
    m.lookAt(0, m.userData.orbitY * 0.3, 0);
  });


  // Core glow pulse
  glowSphere.material.uniforms.uTime.value = time;

  // Rotate data rings
  coreGroup.children.forEach(child => {
    if (child.isPoints && child.userData.speed) {
      child.userData.wavePhase += dt * child.userData.speed * 0.5;
      child.rotation.z += child.userData.speed * dt * 0.3;
      child.rotation.x = Math.PI * child.userData.tilt + Math.sin(time * 0.2 + child.userData.speed) * 0.15;
    }
  });

  // Rotate galaxy
  const speed = 0.3;
  if (armParticles) armParticles.rotation.y += speed * 0.06 * dt;
  if (dustMesh) dustMesh.rotation.y += speed * 0.06 * dt;

  // Data cluster animation
  dataClusters.forEach((dc, i) => {
    const pulse = 0.7 + 0.3 * Math.sin(time * 1.5 + dc.sphere.userData.pulsePhase);
    dc.sphere.scale.setScalar(pulse);
    dc.glow.scale.setScalar(pulse * 1.3);
    dc.sphere.position.y = dc.sphere.userData.baseY + Math.sin(time * 0.8 + i) * 0.08;
    dc.glow.position.y = dc.sphere.position.y;
    dc.label.position.y = dc.sphere.position.y - 0.35;

    // Orbit slowly
    dc.sphere.position.x = Math.cos(dc.angleA + time * dc.speed) * dc.angleR;
    dc.sphere.position.z = Math.sin(dc.angleA + time * dc.speed) * dc.angleR;
    dc.glow.position.x = dc.sphere.position.x;
    dc.glow.position.z = dc.sphere.position.z;
    dc.label.position.x = dc.sphere.position.x;
    dc.label.position.z = dc.sphere.position.z;
  });

  // Satellite rotation
  satGroup.rotation.y += 0.02 * dt;

  // Update panel canvases (radar sweep)
  panels.forEach(p => {
    const ctx = p.canvas.getContext('2d');
    // Redraw radar line
    ctx.fillStyle = 'rgba(0, 5, 15, 0.1)';
    ctx.fillRect(0, 0, 512, 256);
    // Quick partial redraw would be better, but for now just update texture
    p.mesh.material.map.needsUpdate = true;
  });

  // Tooltip follow (not clicked, just hover)
  if (tooltip.style.opacity !== '1') {
    const fm = new THREE.Vector2(mouse.x, mouse.y);
    raycaster.setFromCamera(fm, camera);
    const spheres = dataClusters.map(d => d.sphere);
    const hits = raycaster.intersectObjects(spheres);
    if (hits.length > 0) {
      const info = hits[0].object.userData.info;
      tooltip.innerHTML = `<span style="color:#ff88aa">◆</span> ${info.name}<br>${info.temp}K · ${info.mass}`;
      tooltip.style.opacity = '0.9';
      renderer.domElement.style.cursor = 'pointer';
    } else {
      tooltip.style.opacity = '0';
      renderer.domElement.style.cursor = 'default';
    }
  }

  composer.render();
  labelRenderer.render(scene, camera);
}
animate();
