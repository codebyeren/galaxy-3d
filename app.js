import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ── Scene ─────────────────────────────────────────
const container = document.getElementById('container');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.3, 200);
camera.position.set(0, 14, 22);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.4, 0.6, 0.9));

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
// CORE
// ═══════════════════════════════════════════════════════
const coreGroup = new THREE.Group(); scene.add(coreGroup);
const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
coreGroup.add(coreMesh);

const coreGlowMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uC1: { value: new THREE.Color('#ffe8cc') }, uC2: { value: new THREE.Color('#ff9944') }, uC3: { value: new THREE.Color('#3311aa') } },
  vertexShader: `varying vec3 vN,vP;void main(){vec4 w=modelMatrix*vec4(position,1.);vP=w.xyz;vN=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec3 vN,vP;uniform float uTime;uniform vec3 uC1,uC2,uC3;void main(){vec3 vd=normalize(cameraPosition-vP);float f=1.-abs(dot(vd,vN));f=pow(f,2.8);float p=.9+.1*sin(uTime*1.3);float r=length(vP.xz)/2.2;vec3 c=mix(mix(uC1,uC2,f),uC3,r*.5)*p;gl_FragColor=vec4(c,f*.7);}`,
  transparent: true, depthWrite: false
});
coreGroup.add(new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 32), coreGlowMat));

const innerDiskMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader: `varying vec2 vUv;uniform float uTime;void main(){float d=abs(vUv.x-.5)*2.;float a=smoothstep(0.,.12,d)*smoothstep(1.,.65,d);a*=.4+.12*sin(uTime+vUv.x*15.);gl_FragColor=vec4(1.,.82,.45,a*.45);}`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide
});
const innerDisk = new THREE.Mesh(new THREE.RingGeometry(0.4, 3.5, 96), innerDiskMat);
innerDisk.rotation.x = Math.PI * 0.5; coreGroup.add(innerDisk);

// ═══════════════════════════════════════════════════════
// SPIRAL ARMS
// ═══════════════════════════════════════════════════════
function generateCleanSpiral(count, arms, tightness) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), siz = new Float32Array(count);
  const perArm = Math.floor(count / arms);
  for (let arm = 0; arm < arms; arm++) {
    const baseAngle = (arm / arms) * Math.PI * 2;
    for (let j = 0; j < perArm; j++) {
      const i = arm * perArm + j, t = j / perArm, r = 1.5 + t * 18;
      const spiral = r * tightness;
      const scatter = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      const angle = baseAngle + spiral + scatter * (0.15 + t * 0.55);
      const radius = r + (Math.random() - 0.5) * 0.3;
      pos[i * 3] = Math.cos(angle) * radius;
      pos[i * 3 + 1] = (Math.random() - 0.5) * (0.08 + t * 0.25) * (1 - t * 0.7);
      pos[i * 3 + 2] = Math.sin(angle) * radius;
      const c = new THREE.Color();
      if (t < 0.04) c.setHSL(0.14, 0.2, 0.98);
      else if (t < 0.15) c.setHSL(0.13, 0.4, 0.9 + Math.random() * 0.1);
      else if (t < 0.4) c.setHSL(0.12, 0.5, 0.7 + Math.random() * 0.28);
      else if (t < 0.7) c.setHSL(0.58, 0.5, 0.55 + Math.random() * 0.35);
      else c.setHSL(0.6, 0.4, 0.4 + Math.random() * 0.3);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
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
  galaxyStars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.07, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85, sizeAttenuation: true }));
  scene.add(galaxyStars);
}

// ═══════════════════════════════════════════════════════
// DUST
// ═══════════════════════════════════════════════════════
let dustMesh = null;
function generateDustBands(count, arms, tightness) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
  const perArm = Math.floor(count / arms);
  for (let arm = 0; arm < arms; arm++) {
    const baseAngle = (arm / arms) * Math.PI * 2;
    for (let j = 0; j < perArm; j++) {
      const i = arm * perArm + j, t = j / perArm, r = 1.2 + t * 17;
      const angle = baseAngle + r * tightness - 0.25 + ((Math.random() + Math.random()) / 2 - 0.5) * 0.8;
      pos[i * 3] = Math.cos(angle) * (r + (Math.random() - 0.5) * 0.6);
      pos[i * 3 + 1] = (Math.random() - 0.5) * 0.15;
      pos[i * 3 + 2] = Math.sin(angle) * (r + (Math.random() - 0.5) * 0.6);
      const c = new THREE.Color().setHSL(0.08, 0.2, 0.06 + Math.random() * 0.05);
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
  dustMesh = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.2, vertexColors: true, blending: THREE.NormalBlending, depthWrite: false, transparent: true, opacity: 0.45, sizeAttenuation: true }));
  scene.add(dustMesh);
}

// ═══════════════════════════════════════════════════════
// NEBULA
// ═══════════════════════════════════════════════════════
let nebula = null;
function generateNebulaClouds(count, arms, tightness) {
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
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
    const cloud = clouds[ci], baseAngle = (cloud.arm / arms) * Math.PI * 2;
    const cR = 1.5 + cloud.t * 18, cA = baseAngle + cR * tightness;
    for (let j = 0; j < perCloud; j++) {
      const i = ci * perCloud + j;
      pos[i * 3] = Math.cos(cA + (Math.random() - 0.5) * cloud.spread) * (cR + (Math.random() - 0.5) * 2.5);
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1.2;
      pos[i * 3 + 2] = Math.sin(cA + (Math.random() - 0.5) * cloud.spread) * (cR + (Math.random() - 0.5) * 2.5);
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
  nebula = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.55, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.28, sizeAttenuation: true }));
  scene.add(nebula);
}

// ═══════════════════════════════════════════════════════
// HALO
// ═══════════════════════════════════════════════════════
function createHalo() {
  const n = 2500, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 5 + Math.pow(Math.random(), 0.5) * 28, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    p[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    p[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * r * 0.35;
    p[i * 3 + 2] = Math.cos(ph) * r;
    const cl = new THREE.Color().setHSL(0.08, 0.25, 0.2 + Math.random() * 0.2);
    c[i * 3] = cl.r; c[i * 3 + 1] = cl.g; c[i * 3 + 2] = cl.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.15, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35, sizeAttenuation: true })));
}

// ═══════════════════════════════════════════════════════
// UNIVERSE
// ═══════════════════════════════════════════════════════
function createUniverse() {
  const n = 3500, p = new Float32Array(n * 3), c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const r = 55 + Math.random() * 50, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    p[i * 3] = Math.sin(ph) * Math.cos(th) * r;
    p[i * 3 + 1] = Math.sin(ph) * Math.sin(th) * r;
    p[i * 3 + 2] = Math.cos(ph) * r;
    const cl = new THREE.Color().setHSL(0.55 + Math.random() * 0.25, 0.3, 0.35 + Math.random() * 0.55);
    c[i * 3] = cl.r; c[i * 3 + 1] = cl.g; c[i * 3 + 2] = cl.b;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.2, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  for (let gi = 0; gi < 6; gi++) {
    const gn = 150, gp = new Float32Array(gn * 3), gc = new Float32Array(gn * 3);
    const cx = (Math.random() - 0.5) * 70, cy = (Math.random() - 0.5) * 35, cz = (Math.random() - 0.5) * 70;
    for (let i = 0; i < gn; i++) {
      const gr = Math.random() * 2.5, ga = Math.random() * Math.PI * 2;
      gp[i * 3] = cx + Math.cos(ga) * gr; gp[i * 3 + 1] = cy + (Math.random() - 0.5) * 0.25; gp[i * 3 + 2] = cz + Math.sin(ga) * gr;
      const gcl = new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 0.35, 0.25 + Math.random() * 0.35);
      gc[i * 3] = gcl.r; gc[i * 3 + 1] = gcl.g; gc[i * 3 + 2] = gcl.b;
    }
    const gg = new THREE.BufferGeometry();
    gg.setAttribute('position', new THREE.BufferAttribute(gp, 3));
    gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
    scene.add(new THREE.Points(gg, new THREE.PointsMaterial({ size: 0.1, vertexColors: true, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  }
}

// ═══════════════════════════════════════════════════════
// FLOATING IMAGES
// ═══════════════════════════════════════════════════════
const floatingImages = [];
function createFloatingImage(texture, dbId) {
  const aspect = texture.image ? texture.image.width / texture.image.height : 1;
  const w = 3.5, h = w / aspect;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, transparent: true, depthWrite: false })
  );
  const angle = Math.random() * Math.PI * 2, radius = 22 + Math.random() * 10, height = (Math.random() - 0.5) * 8;
  mesh.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  mesh.lookAt(0, 0, 0); mesh.rotateY((Math.random() - 0.5) * 0.5);
  mesh.userData = { dbId, orbitRadius: radius, orbitAngle: angle, orbitHeight: height, orbitSpeed: 0.015 + Math.random() * 0.04 };
  scene.add(mesh); floatingImages.push(mesh);
}

function loadImageTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url, t => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); }, undefined, () => reject(new Error('Failed')));
  });
}

// ═══════════════════════════════════════════════════════
// API + AUTH
// ═══════════════════════════════════════════════════════
const API_BASE = location.origin;
let authToken = null;
function ah() { return authToken ? { 'Authorization': `Bearer ${authToken}` } : {}; }
async function apiGet(path) { return (await fetch(API_BASE + path)).json(); }
async function apiPost(path, body) { return (await fetch(API_BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', ...ah() }, body: JSON.stringify(body) })).json(); }
async function apiDelete(path) { await fetch(API_BASE + path, { method: 'DELETE', headers: ah() }); }
async function apiUpload(file) { const f = new FormData(); f.append('image', file); return (await fetch(API_BASE + '/api/images/upload', { method: 'POST', headers: ah(), body: f })).json(); }

// ── Auth ─────────────────────────────────────────
const authPassword = document.getElementById('authPassword');
const authError = document.getElementById('authError');
document.getElementById('authSubmit').addEventListener('click', async () => {
  const pw = authPassword.value;
  if (!pw) { authError.textContent = 'Nhập mật khẩu'; return; }
  const r = await fetch(API_BASE + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
  if (r.ok) { authToken = pw; localStorage.setItem('galaxy_token', pw); authError.textContent = '✅ Đã mở khóa'; authError.style.color = '#8f8'; }
  else { authError.textContent = '❌ Sai mật khẩu'; authError.style.color = '#f55'; }
});
document.getElementById('authSkip').addEventListener('click', () => { authToken = null; localStorage.removeItem('galaxy_token'); authError.textContent = '👁 Chế độ xem'; authError.style.color = '#888'; });
authPassword.addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('authSubmit').click(); });

const stored = localStorage.getItem('galaxy_token');
if (stored) {
  fetch(API_BASE + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: stored }) })
    .then(r => { if (r.ok) { authToken = stored; authError.textContent = '✅ Đã mở khóa'; authError.style.color = '#8f8'; } else { authToken = null; localStorage.removeItem('galaxy_token'); } })
    .catch(() => {});
}

// ═══════════════════════════════════════════════════════
// IMAGES
// ═══════════════════════════════════════════════════════
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

function gdu(url) { return url.startsWith('/') ? API_BASE + url : url; }

function renderImageGrid() {
  const grid = document.getElementById('imageGrid');
  grid.innerHTML = '';
  imageMap.forEach((item, dbId) => {
    const card = document.createElement('div'); card.className = 'image-card';
    card.innerHTML = `<img src="${gdu(item.url)}" loading="lazy"><button class="delete-btn" data-id="${dbId}">✕</button>`;
    card.addEventListener('click', e => { if (!e.target.classList.contains('delete-btn')) showFullscreen(gdu(item.url)); });
    card.querySelector('.delete-btn').addEventListener('click', e => { e.stopPropagation(); removeImage(dbId); });
    grid.appendChild(card);
  });
}

function renderMobileImageGrid() {
  const grid = document.getElementById('mobileImageGrid'); if (!grid) return; grid.innerHTML = '';
  imageMap.forEach(item => {
    const card = document.createElement('div'); card.className = 'image-card';
    card.innerHTML = `<img src="${gdu(item.url)}" loading="lazy">`;
    card.addEventListener('click', () => showFullscreen(gdu(item.url))); grid.appendChild(card);
  });
}

async function addImage(url) {
  if (!url.trim()) return;
  try {
    const saved = await apiPost('/api/images', { url: url.trim() });
    if (saved.error) { alert(saved.error); return; }
    const t = await loadImageTexture(gdu(saved.url));
    imageMap.set(saved.id, { url: saved.url, texture: t }); createFloatingImage(t, saved.id);
    renderImageGrid(); renderMobileImageGrid();
  } catch (err) { alert('Lỗi: ' + err.message); }
}

async function removeImage(dbId) {
  const item = imageMap.get(dbId); if (!item) return;
  item.texture.dispose();
  const mi = floatingImages.findIndex(m => m.userData.dbId === dbId);
  if (mi >= 0) { const m = floatingImages[mi]; m.geometry.dispose(); m.material.dispose(); scene.remove(m); floatingImages.splice(mi, 1); }
  imageMap.delete(dbId);
  await apiDelete('/api/images/' + dbId);
  renderImageGrid(); renderMobileImageGrid();
}

function showFullscreen(url) {
  const modal = document.getElementById('imageModal');
  modal.classList.remove('hidden');
  modal.querySelector('img').src = url;
  modal.onclick = e => { if (e.target === modal || e.target.classList.contains('modal-close')) modal.classList.add('hidden'); };
}

document.getElementById('imageUpload').addEventListener('change', async e => {
  for (const file of e.target.files) {
    try {
      const saved = await apiUpload(file); if (saved.error) { alert(saved.error); continue; }
      const t = await loadImageTexture(gdu(saved.url));
      imageMap.set(saved.id, { url: saved.url, texture: t }); createFloatingImage(t, saved.id);
    } catch (_) {}
  }
  renderImageGrid(); renderMobileImageGrid(); e.target.value = '';
});

document.getElementById('addImage').addEventListener('click', () => { const inp = document.getElementById('imageUrl'); addImage(inp.value); inp.value = ''; });
document.getElementById('imageUrl').addEventListener('keydown', e => { if (e.key === 'Enter') { addImage(e.target.value); e.target.value = ''; } });

document.getElementById('toggleImagesBtn').addEventListener('click', () => {
  const show = floatingImages[0] && !floatingImages[0].visible;
  floatingImages.forEach(m => m.visible = show);
  document.getElementById('toggleImagesBtn').textContent = show ? '🖼 Ẩn' : '🖼 Hiện';
});

// ═══════════════════════════════════════════════════════
// UI PANELS
// ═══════════════════════════════════════════════════════

// Admin panel toggle
const adminPanel = document.getElementById('adminPanel');
document.getElementById('adminToggle').addEventListener('click', () => {
  adminPanel.classList.toggle('open');
  adminPanel.classList.remove('hidden');
});

// Gallery panel toggle (mobile)
const galleryPanel = document.getElementById('galleryPanel');
document.getElementById('galleryToggle').addEventListener('click', () => {
  galleryPanel.classList.toggle('open');
  galleryPanel.classList.remove('hidden');
});

// Help overlay
const helpOverlay = document.getElementById('helpOverlay');
document.getElementById('helpBtn').addEventListener('click', () => helpOverlay.classList.remove('hidden'));
document.getElementById('helpClose').addEventListener('click', () => helpOverlay.classList.add('hidden'));
document.getElementById('helpBg').addEventListener('click', () => helpOverlay.classList.add('hidden'));

// ═══════════════════════════════════════════════════════
// CONTROLS
// ═══════════════════════════════════════════════════════
const armsSlider = document.getElementById('arms'), spiralSlider = document.getElementById('spiral');
const countSlider = document.getElementById('count'), speedSlider = document.getElementById('speed');

function rebuildGalaxy() {
  const arms = parseInt(armsSlider.value), spiral = parseFloat(spiralSlider.value), count = parseInt(countSlider.value);
  document.getElementById('armsVal').textContent = arms;
  document.getElementById('spiralVal').textContent = spiral;
  document.getElementById('countVal').textContent = (count / 1000).toFixed(0) + 'K';
  document.getElementById('speedVal').textContent = parseFloat(speedSlider.value);
  createGalaxyMesh(generateCleanSpiral(count, arms, spiral));
  createDustMeshFn(generateDustBands(Math.floor(count * 0.5), arms, spiral));
  createNebulaMesh(generateNebulaClouds(Math.floor(count * 0.15), arms, spiral));
}

armsSlider.addEventListener('input', rebuildGalaxy); spiralSlider.addEventListener('input', rebuildGalaxy);
countSlider.addEventListener('input', rebuildGalaxy);
speedSlider.addEventListener('input', () => { document.getElementById('speedVal').textContent = parseFloat(speedSlider.value); });

document.getElementById('resetBtn').addEventListener('click', () => { camera.position.set(0, 14, 22); controls.target.set(0, 0, 0); controls.update(); });
document.getElementById('autoRotateBtn').addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  document.getElementById('autoRotateBtn').textContent = controls.autoRotate ? '⏸ Dừng' : '▶ Xoay';
});

// Raycaster
const raycaster = new THREE.Raycaster(), mousePos = new THREE.Vector2();
renderer.domElement.addEventListener('click', e => {
  mousePos.x = (e.clientX / innerWidth) * 2 - 1; mousePos.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mousePos, camera);
  const hits = raycaster.intersectObjects(floatingImages);
  if (hits.length > 0) { const dbId = hits[0].object.userData.dbId; const item = imageMap.get(dbId); if (item) showFullscreen(gdu(item.url)); }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
});

// ═══════════════════════════════════════════════════════
// ── Music Player ─────────────────────────────────────
const bgAudio = document.getElementById('bgAudio');
let musicOn = false;
const musicBtn = document.getElementById('musicToggle');

bgAudio.volume = 0.3;

musicBtn.addEventListener('click', () => {
  if (musicOn) { bgAudio.pause(); musicOn = false; }
  else { bgAudio.play().catch(() => {}); musicOn = true; }
  musicBtn.textContent = musicOn ? '🔊' : '🔇';
  musicBtn.classList.toggle('muted', !musicOn);
});

function startMusic() {
  if (!musicOn) { bgAudio.play().catch(() => {}); musicOn = true; musicBtn.textContent = '🔊'; musicBtn.classList.remove('muted'); }
  ['click','touchstart','keydown'].forEach(e => document.removeEventListener(e, startMusic));
}
['click','touchstart','keydown'].forEach(e => document.addEventListener(e, startMusic, { once: true }));

// ═══════════════════════════════════════════════════════
// LOADING
// ═══════════════════════════════════════════════════════
const loading = document.getElementById('loading');
function hideLoading() {
  loading.classList.add('hidden');
  ['click','touchstart','keydown'].forEach(e => removeEventListener(e, hideLoading));
}
['click','touchstart','keydown'].forEach(e => addEventListener(e, hideLoading, { once: true }));
setTimeout(() => hideLoading(), 8000);

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
createUniverse();
createHalo();
const initData = generateCleanSpiral(10000, 4, 2.5);
createGalaxyMesh(initData);
createDustMeshFn(generateDustBands(5000, 4, 2.5));
createNebulaMesh(generateNebulaClouds(1500, 4, 2.5));

(async () => {
  try {
    const images = await apiGet('/api/images');
    if (images.length > 0) {
      for (const img of images) {
        try { const t = await loadImageTexture(gdu(img.url)); imageMap.set(img.id, { url: img.url, texture: t }); createFloatingImage(t, img.id); } catch (_) {}
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
  document.getElementById('colorLegend').style.opacity = '1';
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
  floatingImages.forEach(m => {
    m.userData.orbitAngle += m.userData.orbitSpeed * speed * dt;
    m.position.x = Math.cos(m.userData.orbitAngle) * m.userData.orbitRadius;
    m.position.z = Math.sin(m.userData.orbitAngle) * m.userData.orbitRadius;
    m.position.y = m.userData.orbitHeight;
    m.lookAt(0, m.userData.orbitHeight * 0.5, 0);
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
