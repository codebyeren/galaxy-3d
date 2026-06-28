import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const container = document.getElementById('container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.3, 200);
camera.position.set(0, 14, 22);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 0.4, 0.6, 0.9);
composer.addPass(bloomPass);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.06;
controls.autoRotate = true; controls.autoRotateSpeed = 0.2;
controls.minDistance = 4; controls.maxDistance = 60;
controls.maxPolarAngle = Math.PI * 0.8;
controls.target.set(0, 0, 0); controls.update();

scene.add(new THREE.AmbientLight(0x0a0a20, 0.2));
const coreLight = new THREE.PointLight(0xffddbb, 80, 35, 1.8);
coreLight.position.set(0, 0, 0); scene.add(coreLight);

// ═══════════════════════════════════════════════════════
// GALAXY CORE
// ═══════════════════════════════════════════════════════
const coreGroup = new THREE.Group(); scene.add(coreGroup);

const coreGeo = new THREE.SphereGeometry(0.55, 32, 32);
const coreMesh = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
coreGroup.add(coreMesh);

const coreGlowGeo = new THREE.SphereGeometry(2.2, 32, 32);
const coreGlowMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uC1: { value: new THREE.Color('#ffe8cc') }, uC2: { value: new THREE.Color('#ff9944') }, uC3: { value: new THREE.Color('#3311aa') } },
  vertexShader: `varying vec3 vN,vP;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec3 vN,vP;uniform float uTime;uniform vec3 uC1,uC2,uC3;void main(){vec3 vd=normalize(cameraPosition-vP);float f=1.-abs(dot(vd,vN));f=pow(f,2.8);float p=.9+.1*sin(uTime*1.3);float r=length(vP.xz)/2.2;vec3 c=mix(mix(uC1,uC2,f),uC3,r*.5)*p;gl_FragColor=vec4(c,f*.7);}`,
  transparent: true, depthWrite: false
});
coreGroup.add(new THREE.Mesh(coreGlowGeo, coreGlowMat));

// Inner warm glow disk
const innerDiskGeo = new THREE.RingGeometry(0.4, 3.5, 96);
const innerDiskMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 vUv;uniform float uTime;void main(){float d=abs(vUv.x-.5)*2.;float a=smoothstep(0.,.12,d)*smoothstep(1.,.65,d);a*=.4+.12*sin(uTime+vUv.x*15.);gl_FragColor=vec4(1.,.82,.45,a*.45);}`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide
});
const innerDisk = new THREE.Mesh(innerDiskGeo, innerDiskMat);
innerDisk.rotation.x = Math.PI * 0.5; coreGroup.add(innerDisk);

// ═══════════════════════════════════════════════════════
// SPIRAL ARMS — clean, structured, beautiful
// ═══════════════════════════════════════════════════════

function generateCleanSpiral(count, arms, tightness) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const siz = new Float32Array(count);
  const perArm = Math.floor(count / arms);

  for (let arm = 0; arm < arms; arm++) {
    const baseAngle = (arm / arms) * Math.PI * 2;

    for (let j = 0; j < perArm; j++) {
      const i = arm * perArm + j;
      // Radius follows arm from inner to outer
      const t = j / perArm; // 0..1 along arm
      const r = 1.5 + t * 18;

      // Logarithmic spiral
      const spiral = r * tightness;
      // Gaussian scatter perpendicular to arm (tight near core, wider at edges)
      const scatter = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      const scatterWidth = 0.15 + t * 0.55;
      const angle = baseAngle + spiral + scatter * scatterWidth;

      // Radial scatter (small)
      const rScatter = (Math.random() - 0.5) * 0.3;
      const radius = r + rScatter;

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      // Very flat disk near center, slightly thicker at edges
      const y = (Math.random() - 0.5) * (0.08 + t * 0.25) * (1 - t * 0.7);

      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;

      // Color: warm white → yellow → blue-white → cool blue
      const color = new THREE.Color();
      if (t < 0.04) color.setHSL(0.14, 0.2, 0.98);
      else if (t < 0.15) color.setHSL(0.12 + Math.random() * 0.04, 0.4, 0.88 + Math.random() * 0.12);
      else if (t < 0.4) color.setHSL(0.1 + Math.random() * 0.06, 0.5, 0.7 + Math.random() * 0.25);
      else if (t < 0.7) color.setHSL(0.55 + Math.random() * 0.1, 0.5, 0.55 + Math.random() * 0.35);
      else color.setHSL(0.58 + Math.random() * 0.08, 0.4, 0.4 + Math.random() * 0.3);

      col[i * 3] = color.r; col[i * 3 + 1] = color.g; col[i * 3 + 2] = color.b;
      siz[i] = (1 - t * 0.6) * (Math.random() * 2 + 0.6);
    }
  }
  return { positions: pos, colors: col, sizes: siz };
}

let galaxyStars = null;
function createGalaxyMesh(data) {
  if (galaxyStars) scene.remove(galaxyStars);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(data.sizes, 1));
  const mat = new THREE.PointsMaterial({
    size: 0.07, vertexColors: true, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.85, sizeAttenuation: true
  });
  galaxyStars = new THREE.Points(geo, mat);
  scene.add(galaxyStars);
}

// ═══════════════════════════════════════════════════════
// DUST LANDS — smooth, dark bands along arms
// ═══════════════════════════════════════════════════════

let dustMesh = null;
function generateDustBands(count, arms, tightness) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const perArm = Math.floor(count / arms);

  for (let arm = 0; arm < arms; arm++) {
    const baseAngle = (arm / arms) * Math.PI * 2;
    // Dust trails behind the star arm
    const dustOffset = -0.25;

    for (let j = 0; j < perArm; j++) {
      const i = arm * perArm + j;
      const t = j / perArm;
      const r = 1.2 + t * 17;
      const spiral = r * tightness + dustOffset;
      const scatter = (Math.random() + Math.random()) / 2 - 0.5;
      const angle = baseAngle + spiral + scatter * 0.8;
      const radius = r + (Math.random() - 0.5) * 0.6;
      const y = (Math.random() - 0.5) * 0.15;

      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(angle) * radius;

      // Dark warm brown/grey
      const c = new THREE.Color().setHSL(0.07 + Math.random() * 0.04, 0.2, 0.06 + Math.random() * 0.05);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
  }
  return { positions: pos, colors: col };
}

function createDustMeshFn(data) {
  if (dustMesh) scene.remove(dustMesh);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.2, vertexColors: true, blending: THREE.NormalBlending,
    depthWrite: false, transparent: true, opacity: 0.45, sizeAttenuation: true
  });
  dustMesh = new THREE.Points(geo, mat);
  scene.add(dustMesh);
}

// ═══════════════════════════════════════════════════════
// NEBULA CLOUDS — soft glowing patches
// ═══════════════════════════════════════════════════════

let nebula = null;
function generateNebulaClouds(count, arms, tightness) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const clouds = [
    { arm: 0, t: 0.35, color: '#ff6699', spread: 0.4 },
    { arm: 1, t: 0.55, color: '#6699ff', spread: 0.5 },
    { arm: 2, t: 0.4, color: '#9966ff', spread: 0.35 },
    { arm: 3, t: 0.6, color: '#ff8844', spread: 0.45 },
    { arm: 0, t: 0.7, color: '#44aaff', spread: 0.35 },
    { arm: 2, t: 0.7, color: '#ff4477', spread: 0.3 },
  ];
  const perCloud = Math.floor(count / clouds.length);

  for (let ci = 0; ci < clouds.length; ci++) {
    const cloud = clouds[ci];
    const baseAngle = (cloud.arm / arms) * Math.PI * 2;
    const centerR = 1.5 + cloud.t * 18;
    const centerAngle = baseAngle + centerR * tightness;

    for (let j = 0; j < perCloud; j++) {
      const i = ci * perCloud + j;
      const r = centerR + (Math.random() - 0.5) * 2.5;
      const a = centerAngle + (Math.random() - 0.5) * cloud.spread;
      const y = (Math.random() - 0.5) * 1.2;

      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r;

      const c = new THREE.Color(cloud.color).multiplyScalar(0.5 + Math.random() * 0.5);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
  }
  return { positions: pos, colors: col };
}

function createNebulaMesh(data) {
  if (nebula) scene.remove(nebula);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  // Use large sprites for gaseous look
  const mat = new THREE.PointsMaterial({
    size: 0.55, vertexColors: true, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.28, sizeAttenuation: true
  });
  nebula = new THREE.Points(geo, mat);
  scene.add(nebula);
}

// ═══════════════════════════════════════════════════════
// HALO — subtle sphere of old stars
// ═══════════════════════════════════════════════════════

function createHalo() {
  const count = 2500;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 5 + Math.pow(Math.random(), 0.5) * 28;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.35;
    pos[i * 3 + 2] = Math.cos(phi) * r;
    const c = new THREE.Color().setHSL(0.08 + Math.random() * 0.05, 0.25, 0.2 + Math.random() * 0.2);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.15, vertexColors: true, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.35, sizeAttenuation: true
  });
  scene.add(new THREE.Points(geo, mat));
}

// ═══════════════════════════════════════════════════════
// BACKGROUND UNIVERSE
// ═══════════════════════════════════════════════════════

function createUniverse() {
  const count = 3500;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 55 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    pos[i * 3 + 2] = Math.cos(phi) * r;
    const c = new THREE.Color().setHSL(0.55 + Math.random() * 0.25, 0.3, 0.35 + Math.random() * 0.55);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.2, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
  })));

  // Distant galaxies
  for (let g = 0; g < 6; g++) {
    const gc = 150;
    const gPos = new Float32Array(gc * 3);
    const gCol = new Float32Array(gc * 3);
    const cx = (Math.random() - 0.5) * 70, cy = (Math.random() - 0.5) * 35, cz = (Math.random() - 0.5) * 70;
    for (let i = 0; i < gc; i++) {
      const gr = Math.random() * 2.5;
      const ga = Math.random() * Math.PI * 2;
      gPos[i * 3] = cx + Math.cos(ga) * gr;
      gPos[i * 3 + 1] = cy + (Math.random() - 0.5) * 0.25;
      gPos[i * 3 + 2] = cz + Math.sin(ga) * gr;
      const gc2 = new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 0.35, 0.25 + Math.random() * 0.35);
      gCol[i * 3] = gc2.r; gCol[i * 3 + 1] = gc2.g; gCol[i * 3 + 2] = gc2.b;
    }
    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    gGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
    scene.add(new THREE.Points(gGeo, new THREE.PointsMaterial({
      size: 0.1, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    })));
  }
}

// ═══════════════════════════════════════════════════════
// FLOATING IMAGES
// ═══════════════════════════════════════════════════════

const floatingImages = [];

function createFloatingImage(texture, dbId) {
  const aspect = texture.image ? texture.image.width / texture.image.height : 1;
  const w = 3.5, h = w / aspect;
  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  const angle = Math.random() * Math.PI * 2;
  const radius = 22 + Math.random() * 10;
  const height = (Math.random() - 0.5) * 8;
  mesh.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  mesh.lookAt(0, 0, 0); mesh.rotateY((Math.random() - 0.5) * 0.5);
  mesh.userData = { dbId, orbitRadius: radius, orbitAngle: angle, orbitHeight: height, orbitSpeed: 0.015 + Math.random() * 0.04 };
  scene.add(mesh); floatingImages.push(mesh);
  return mesh;
}

function loadImageTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, (t) => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); }, undefined, () => reject(new Error('Failed: ' + url)));
  });
}

// ═══════════════════════════════════════════════════════
// API + AUTH
// ═══════════════════════════════════════════════════════

const API_BASE = window.location.origin;
let authToken = null;

function authHeader() { return authToken ? { 'Authorization': `Bearer ${authToken}` } : {}; }
async function apiGet(path) { const r = await fetch(API_BASE + path); return r.json(); }
async function apiPost(path, body) { const r = await fetch(API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(body) }); return r.json(); }
async function apiDelete(path) { await fetch(API_BASE + path, { method: 'DELETE', headers: authHeader() }); }
async function apiUpload(file) { const f = new FormData(); f.append('image', file); const r = await fetch(API_BASE + '/api/images/upload', { method: 'POST', headers: authHeader(), body: f }); return r.json(); }

// Auth overlay
const authOverlay = document.getElementById('authOverlay');
const authPassword = document.getElementById('authPassword');
const adminView = document.getElementById('adminView');

document.getElementById('authSubmit').addEventListener('click', async () => {
  const pw = authPassword.value;
  if (!pw) { document.getElementById('authError').textContent = 'Vui lòng nhập mật khẩu'; return; }
  try {
    const res = await fetch(API_BASE + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    if (res.ok) { authToken = pw; localStorage.setItem('galaxy_token', pw); authOverlay.classList.add('hidden'); adminView.style.display = 'block'; updateModeBadge(); }
    else { document.getElementById('authError').textContent = '❌ Sai mật khẩu!'; }
  } catch (_) { document.getElementById('authError').textContent = '❌ Không kết nối được server'; }
});

document.getElementById('authSkip').addEventListener('click', () => { authOverlay.classList.add('hidden'); adminView.style.display = 'none'; });
authPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') document.getElementById('authSubmit').click(); });

const stored = localStorage.getItem('galaxy_token');
if (stored) {
  authToken = stored;
  fetch(API_BASE + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: stored }) })
    .then(r => { if (r.ok) { authOverlay.classList.add('hidden'); adminView.style.display = 'block'; updateModeBadge(); } else { authToken = null; localStorage.removeItem('galaxy_token'); } })
    .catch(() => {});
}

// ═══════════════════════════════════════════════════════
// IMAGE PANEL
// ═══════════════════════════════════════════════════════

let showFloatingImages = true;
function updateFloatingImagesVisibility() { floatingImages.forEach(m => { m.visible = showFloatingImages; }); }

const imagePanel = document.getElementById('imagePanel');
const imageGrid = document.getElementById('imageGrid');
const openPanelBtn = document.getElementById('openPanelBtn');

function closeImagePanel() { imagePanel.classList.add('hidden'); openPanelBtn.style.display = 'flex'; }
function openImagePanel() { imagePanel.classList.remove('hidden'); openPanelBtn.style.display = 'none'; }
document.getElementById('closePanel').addEventListener('click', closeImagePanel);
openPanelBtn.addEventListener('click', openImagePanel);

document.getElementById('toggleImagesBtn').addEventListener('click', () => {
  showFloatingImages = !showFloatingImages;
  updateFloatingImagesVisibility();
  document.getElementById('toggleImagesBtn').textContent = showFloatingImages ? '🖼 Ẩn/Hiện ảnh' : '🖼 Đang ẩn';
});

const imageMap = new Map();
const defaultImages = [
  'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&q=80',
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=80',
  'https://images.unsplash.com/photo-1502481851512-e9e2529bfbf9?w=400&q=80',
  'https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=400&q=80',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80',
  'https://images.unsplash.com/photo-1506703719100-b0a86c48d3b5?w=400&q=80',
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&q=80',
];

function getDisplayUrl(url) { return url.startsWith('/') ? API_BASE + url : url; }

function renderImageGrid() {
  imageGrid.innerHTML = '';
  imageMap.forEach((item, dbId) => {
    const card = document.createElement('div'); card.className = 'image-card';
    card.innerHTML = `<img src="${getDisplayUrl(item.url)}" loading="lazy"><button class="delete-btn" data-id="${dbId}">✕</button>`;
    card.addEventListener('click', (e) => { if (!e.target.classList.contains('delete-btn')) showFullscreen(getDisplayUrl(item.url)); });
    card.querySelector('.delete-btn').addEventListener('click', (e) => { e.stopPropagation(); removeImage(dbId); });
    imageGrid.appendChild(card);
  });
}

async function addImage(url) {
  if (!url.trim()) return;
  try {
    const saved = await apiPost('/api/images', { url: url.trim() });
    if (saved.error) { alert(saved.error); return; }
    const texture = await loadImageTexture(getDisplayUrl(saved.url));
    imageMap.set(saved.id, { url: saved.url, texture }); createFloatingImage(texture, saved.id);
    renderImageGrid(); renderMobileImageGrid();
  } catch (err) { alert('Lỗi: ' + err.message); }
}

async function removeImage(dbId) {
  const item = imageMap.get(dbId); if (!item) return;
  item.texture.dispose();
  const meshIdx = floatingImages.findIndex(m => m.userData.dbId === dbId);
  if (meshIdx >= 0) { const m = floatingImages[meshIdx]; m.geometry.dispose(); m.material.dispose(); scene.remove(m); floatingImages.splice(meshIdx, 1); }
  imageMap.delete(dbId);
  await apiDelete('/api/images/' + dbId);
  renderImageGrid(); renderMobileImageGrid();
}

function showFullscreen(url) {
  const existing = document.getElementById('imageModal'); if (existing) existing.remove();
  const modal = document.createElement('div'); modal.id = 'imageModal';
  modal.innerHTML = `<div class="close-modal">✕</div><img src="${url}">`;
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.classList.contains('close-modal')) modal.remove(); });
  document.body.appendChild(modal);
}

document.getElementById('imageUpload').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      const saved = await apiUpload(file); if (saved.error) { alert(saved.error); continue; }
      const texture = await loadImageTexture(getDisplayUrl(saved.url));
      imageMap.set(saved.id, { url: saved.url, texture }); createFloatingImage(texture, saved.id);
    } catch (_) {}
  }
  renderImageGrid(); renderMobileImageGrid(); e.target.value = '';
});

document.getElementById('addImage').addEventListener('click', () => { const inp = document.getElementById('imageUrl'); addImage(inp.value); inp.value = ''; });
document.getElementById('imageUrl').addEventListener('keydown', (e) => { if (e.key === 'Enter') { addImage(e.target.value); e.target.value = ''; } });

// ═══════════════════════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════════════════════

const armsSlider = document.getElementById('arms');
const spiralSlider = document.getElementById('spiral');
const countSlider = document.getElementById('count');
const speedSlider = document.getElementById('speed');

function rebuildGalaxy() {
  const arms = parseInt(armsSlider.value);
  const spiral = parseFloat(spiralSlider.value);
  const count = parseInt(countSlider.value);
  document.getElementById('armsVal').textContent = arms;
  document.getElementById('spiralVal').textContent = spiral;
  document.getElementById('countVal').textContent = (count / 1000).toFixed(0) + 'K';
  document.getElementById('speedVal').textContent = parseFloat(speedSlider.value);
  createGalaxyMesh(generateCleanSpiral(count, arms, spiral));
  createDustMeshFn(generateDustBands(Math.floor(count * 0.5), arms, spiral));
  createNebulaMesh(generateNebulaClouds(Math.floor(count * 0.15), arms, spiral));
}

armsSlider.addEventListener('input', rebuildGalaxy);
spiralSlider.addEventListener('input', rebuildGalaxy);
countSlider.addEventListener('input', rebuildGalaxy);
speedSlider.addEventListener('input', () => { document.getElementById('speedVal').textContent = parseFloat(speedSlider.value); });

document.getElementById('resetBtn').addEventListener('click', () => { camera.position.set(0, 14, 22); controls.target.set(0, 0, 0); controls.update(); });
document.getElementById('autoRotateBtn').addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  document.getElementById('autoRotateBtn').textContent = controls.autoRotate ? '⏸ Dừng xoay' : '▶ Tự động xoay';
});

// Raycaster
const raycaster = new THREE.Raycaster(); const mousePos = new THREE.Vector2();
renderer.domElement.addEventListener('click', (e) => {
  mousePos.x = (e.clientX / container.clientWidth) * 2 - 1;
  mousePos.y = -(e.clientY / container.clientHeight) * 2 + 1;
  raycaster.setFromCamera(mousePos, camera);
  const intersects = raycaster.intersectObjects(floatingImages);
  if (intersects.length > 0) { const dbId = intersects[0].object.userData.dbId; const item = imageMap.get(dbId); if (item) showFullscreen(getDisplayUrl(item.url)); }
});

window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight); composer.setSize(container.clientWidth, container.clientHeight);
});

// Mode badge
const modeBadge = document.getElementById('modeBadge');
function updateModeBadge() { modeBadge.textContent = window.innerWidth <= 768 ? '📱 USER' : (authToken ? '🖥 ADMIN' : '🖥 USER'); }
updateModeBadge(); window.addEventListener('resize', updateModeBadge);

// Mobile gallery
function renderMobileImageGrid() {
  const grid = document.getElementById('mobileImageGrid'); if (!grid) return; grid.innerHTML = '';
  imageMap.forEach((item) => {
    const card = document.createElement('div'); card.className = 'image-card';
    card.innerHTML = `<img src="${getDisplayUrl(item.url)}" loading="lazy">`;
    card.addEventListener('click', () => showFullscreen(getDisplayUrl(item.url))); grid.appendChild(card);
  });
}

document.getElementById('mobileGalleryBtn').addEventListener('click', () => document.getElementById('mobileGallery').classList.add('open'));
document.getElementById('mobileGalleryClose').addEventListener('click', () => document.getElementById('mobileGallery').classList.remove('open'));
document.getElementById('mobileAutoRotateBtn').addEventListener('click', () => { controls.autoRotate = !controls.autoRotate; document.getElementById('mobileAutoRotateBtn').textContent = controls.autoRotate ? '⏸' : '▶'; });
document.getElementById('mobileResetBtn').addEventListener('click', () => { camera.position.set(0, 14, 22); controls.target.set(0, 0, 0); controls.update(); });
document.getElementById('mobileZoomInBtn').addEventListener('click', () => camera.position.multiplyScalar(0.85));
document.getElementById('mobileZoomOutBtn').addEventListener('click', () => camera.position.multiplyScalar(1.15));

let lastPinchDist = 0;
renderer.domElement.addEventListener('touchstart', (e) => { if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; lastPinchDist = Math.sqrt(dx * dx + dy * dy); } }, { passive: true });
renderer.domElement.addEventListener('touchmove', (e) => { if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX; const dy = e.touches[0].clientY - e.touches[1].clientY; const dist = Math.sqrt(dx * dx + dy * dy); camera.position.multiplyScalar(1 + (lastPinchDist - dist) * 0.002); lastPinchDist = dist; } }, { passive: true });

setTimeout(() => { const tip = document.getElementById('tooltip'); if (tip) tip.style.opacity = '0'; }, 12000);

// ═══════════════════════════════════════════════════════
// 🎵 MUSIC PLAYER (YouTube - Tìm Em)
// ═══════════════════════════════════════════════════════

const YT_VIDEO_ID = 'Kw0oQruXy0E';
let player = null, musicPlaying = true;

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('youtubePlayer', {
    videoId: YT_VIDEO_ID,
    playerVars: { autoplay: 1, controls: 0, loop: 1, playlist: YT_VIDEO_ID, mute: 0, modestbranding: 1, rel: 0 },
    events: {
      onReady() { player.playVideo(); player.unMute(); },
      onError() { document.getElementById('musicToggle').textContent = '❌'; }
    }
  });
};

document.getElementById('musicToggle').addEventListener('click', () => {
  if (!player) return;
  if (musicPlaying) { player.pauseVideo(); }
  else { player.playVideo(); }
  musicPlaying = !musicPlaying;
  const btn = document.getElementById('musicToggle');
  btn.textContent = musicPlaying ? '🔊' : '🔇';
  btn.classList.toggle('muted', !musicPlaying);
});

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════

createUniverse();
createHalo();
const initData = generateCleanSpiral(10000, 4, 2.5);
createGalaxyMesh(initData);
createDustMeshFn(generateDustBands(5000, 4, 2.5));
createNebulaMesh(generateNebulaClouds(1500, 4, 2.5));
closeImagePanel();

(async () => {
  try {
    const images = await apiGet('/api/images');
    if (images.length > 0) {
      for (const img of images) {
        try { const t = await loadImageTexture(getDisplayUrl(img.url)); imageMap.set(img.id, { url: img.url, texture: t }); createFloatingImage(t, img.id); } catch (_) {}
      }
    } else {
      for (const url of defaultImages) {
        try {
          const saved = authToken ? await apiPost('/api/images', { url }) : { id: 'local-' + Math.random().toString(36).slice(2), url };
          const t = await loadImageTexture(url); imageMap.set(saved.id, { url: saved.url || url, texture: t }); createFloatingImage(t, saved.id);
        } catch (_) {}
      }
    }
  } catch (_) {
    for (const url of defaultImages) {
      try { const t = await loadImageTexture(url); const fid = 'local-' + Math.random().toString(36).slice(2); imageMap.set(fid, { url, texture: t }); createFloatingImage(t, fid); } catch (_) {}
    }
  }
  renderImageGrid(); renderMobileImageGrid();
})();

// ═══════════════════════════════════════════════════════
// ANIMATION
// ═══════════════════════════════════════════════════════

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);
  const time = performance.now() * 0.001;
  controls.update();
  const speed = parseFloat(speedSlider.value);

  floatingImages.forEach(mesh => {
    mesh.userData.orbitAngle += mesh.userData.orbitSpeed * speed * dt;
    mesh.position.x = Math.cos(mesh.userData.orbitAngle) * mesh.userData.orbitRadius;
    mesh.position.z = Math.sin(mesh.userData.orbitAngle) * mesh.userData.orbitRadius;
    mesh.position.y = mesh.userData.orbitHeight;
    mesh.lookAt(0, mesh.userData.orbitHeight * 0.5, 0);
  });

  coreGlowMat.uniforms.uTime.value = time;
  innerDiskMat.uniforms.uTime.value = time;
  coreMesh.rotation.y += 0.06 * dt;

  if (galaxyStars) galaxyStars.rotation.y += speed * 0.06 * dt;
  if (dustMesh) dustMesh.rotation.y += speed * 0.06 * dt;
  if (nebula) nebula.rotation.y += speed * 0.05 * dt;

  composer.render();
}

animate();
