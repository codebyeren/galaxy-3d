import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ── Scene, Camera, Renderer ──────────────────────────
const container = document.getElementById('container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.3, 200);
camera.position.set(0, 10, 24);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

// ── Post Processing ─────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(container.clientWidth, container.clientHeight),
  0.5, 0.5, 0.9
);
composer.addPass(bloomPass);

// ── Orbit Controls ───────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.25;
controls.minDistance = 4;
controls.maxDistance = 60;
controls.maxPolarAngle = Math.PI * 0.8;
controls.target.set(0, 0, 0);
controls.update();

// ── Lighting ─────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x0a0a20, 0.3));
const coreLight = new THREE.PointLight(0xffddbb, 100, 40, 1.8);
coreLight.position.set(0, 0, 0);
scene.add(coreLight);

// ═══════════════════════════════════════════════════════
// REALISTIC GALAXY SYSTEM
// ═══════════════════════════════════════════════════════

// ── Galaxy Core ──────────────────────────────────────
const coreGroup = new THREE.Group();
scene.add(coreGroup);

// Central bright core
const coreGeo = new THREE.SphereGeometry(0.6, 32, 32);
const coreMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });
const core = new THREE.Mesh(coreGeo, coreMat);
coreGroup.add(core);

// Glowing core shader
const coreGlowGeo = new THREE.SphereGeometry(2.5, 32, 32);
const coreGlowMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(0xffcc88) },
    uColor2: { value: new THREE.Color(0xff6600) },
    uColor3: { value: new THREE.Color(0x3300aa) }
  },
  vertexShader: `
    varying vec3 vNormal; varying vec3 vPosition;
    void main() {
      vec4 wp = modelMatrix * vec4(position,1.0);
      vPosition = wp.xyz;
      vNormal = normalize(mat3(modelMatrix)*normal);
      gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
    }`,
  fragmentShader: `
    varying vec3 vNormal; varying vec3 vPosition;
    uniform float uTime; uniform vec3 uColor1,uColor2,uColor3;
    void main() {
      vec3 vd = normalize(cameraPosition-vPosition);
      float f = 1.0-abs(dot(vd,vNormal));
      f = pow(f,3.0);
      float p = 0.88+0.12*sin(uTime*1.5);
      float r = length(vPosition.xz)/2.5;
      vec3 c = mix(mix(uColor1,uColor2,f),uColor3,r*0.6)*p;
      gl_FragColor=vec4(c,f*0.75);
    }`,
  transparent: true, depthWrite: false
});
const coreGlow = new THREE.Mesh(coreGlowGeo, coreGlowMat);
coreGroup.add(coreGlow);

// Accretion disk ring
const diskGeo = new THREE.RingGeometry(0.5, 4.5, 128);
const diskMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    varying vec2 vUv; uniform float uTime;
    void main() {
      float d = abs(vUv.x-0.5)*2.0;
      float alpha = smoothstep(0.0,0.15,d)*smoothstep(1.0,0.7,d);
      alpha *= 0.3+0.15*sin(uTime+vUv.x*20.0);
      gl_FragColor=vec4(1.0,0.85,0.55,alpha*0.5);
    }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide
});
const disk = new THREE.Mesh(diskGeo, diskMat);
disk.rotation.x = Math.PI * 0.45;
coreGroup.add(disk);

// ── Main Spiral Arms (Stars) ─────────────────────────
function generateGalaxy(starCount, arms, tightness) {
  const pos = new Float32Array(starCount * 3);
  const col = new Float32Array(starCount * 3);
  const siz = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    // Use power distribution so there's density near core AND outer regions
    const r = Math.pow(Math.random(), 0.45) * 20 + 0.2;
    const armIndex = i % arms;
    const armBase = (armIndex / arms) * Math.PI * 2;

    // Logarithmic spiral: tighter near core, spreads out
    const spiral = r * tightness;
    const armOffset = (armIndex % 2 === 0) ? 0 : 0.3; // alternate arm offsets

    // Scatter: more near core, less at edges (tight structure)
    const scatterA = (Math.random() - 0.5) * (0.3 + r * 0.04);
    const scatterR = (Math.random() - 0.5) * (0.2 + r * 0.03);

    // Off-arm density (some stars between arms)
    const offArm = (Math.random() < 0.08) ? (Math.random() - 0.5) * Math.PI * 0.6 : 0;

    const angle = armBase + spiral + armOffset + scatterA + offArm;
    const radius = r + scatterR;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    // Flatter disk, slight warp
    const y = (Math.random() - 0.5) * (0.25 + r * 0.015) * (1.0 - Math.min(r / 22, 0.95));
    // Add slight warp at edges
    const warp = Math.sin(angle * 2 + r * 0.3) * r * 0.04;
    const finalY = y + warp;

    pos[i * 3] = x;
    pos[i * 3 + 1] = finalY;
    pos[i * 3 + 2] = z;

    // Realistic star color distribution
    const t = r / 20;
    const color = new THREE.Color();

    if (t < 0.04) {
      // Core: very hot white/blue-white
      color.setHSL(0.15, 0.3, 0.95 + Math.random() * 0.05);
    } else if (t < 0.12) {
      // Inner: hot yellow-white to blue-white
      color.setHSL(0.12 + Math.random() * 0.1, 0.5, 0.85 + Math.random() * 0.15);
    } else if (t < 0.35) {
      // Middle: yellow to orange (like our sun)
      color.setHSL(0.08 + Math.random() * 0.12, 0.7, 0.65 + Math.random() * 0.3);
    } else if (t < 0.65) {
      // Outer: blue-white young stars in spiral arms
      color.setHSL(0.55 + Math.random() * 0.15, 0.6, 0.55 + Math.random() * 0.4);
    } else {
      // Edge: dim red/brown dwarfs
      color.setHSL(0.05 + Math.random() * 0.08, 0.4, 0.3 + Math.random() * 0.3);
    }

    col[i * 3] = color.r;
    col[i * 3 + 1] = color.g;
    col[i * 3 + 2] = color.b;

    // Size: mostly small, few large bright ones
    const brightness = 1.0 - t;
    siz[i] = (Math.random() < 0.9) ? Math.random() * 1.8 + 0.3 : Math.random() * 4 + 2;
    siz[i] *= brightness;
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
    size: 0.06, vertexColors: true, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.95, sizeAttenuation: true
  });
  galaxyStars = new THREE.Points(geo, mat);
  scene.add(galaxyStars);
}

// ── Dust Lanes ───────────────────────────────────────
let dustLanes = null;
function generateDust(starCount, arms, tightness) {
  const pos = new Float32Array(starCount * 3);
  const col = new Float32Array(starCount * 3);
  const siz = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    const r = Math.pow(Math.random(), 0.5) * 18 + 0.5;
    const armIndex = i % arms;
    const armBase = (armIndex / arms) * Math.PI * 2;
    // Dust between arms (offset by half arm width)
    const spiral = r * tightness + Math.PI / arms;
    const scatterA = (Math.random() - 0.5) * 0.5;
    const scatterR = (Math.random() - 0.5) * 0.4;
    const angle = armBase + spiral + scatterA;
    const radius = r + scatterR;

    pos[i * 3] = Math.cos(angle) * radius;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 0.3;
    pos[i * 3 + 2] = Math.sin(angle) * radius;

    // Dark brown/grey
    const c = new THREE.Color().setHSL(0.08, 0.15, 0.08 + Math.random() * 0.06);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    siz[i] = Math.random() * 3 + 1;
  }
  return { positions: pos, colors: col, sizes: siz };
}

function createDustMesh(data) {
  if (dustLanes) scene.remove(dustLanes);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.12, vertexColors: true, blending: THREE.NormalBlending,
    depthWrite: false, transparent: true, opacity: 0.35, sizeAttenuation: true
  });
  dustLanes = new THREE.Points(geo, mat);
  scene.add(dustLanes);
}

// ── Nebula Clouds ────────────────────────────────────
let nebulaParticles = null;
function generateNebula(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const siz = new Float32Array(count);

  const nebulaColors = [
    new THREE.Color('#ff4488'), // pink
    new THREE.Color('#4488ff'), // blue
    new THREE.Color('#44ff88'), // green
    new THREE.Color('#ff8844'), // orange
    new THREE.Color('#8844ff'), // purple
  ];

  for (let i = 0; i < count; i++) {
    // Place nebula in specific regions of spiral arms
    const r = 3 + Math.random() * 14;
    const clusterAngle = Math.random() * Math.PI * 2;
    const clusterSpread = 0.6;

    const angle = clusterAngle + (Math.random() - 0.5) * clusterSpread;
    const radius = r + (Math.random() - 0.5) * 2;

    pos[i * 3] = Math.cos(angle) * radius;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 1.5;
    pos[i * 3 + 2] = Math.sin(angle) * radius;

    const c = nebulaColors[Math.floor(Math.random() * nebulaColors.length)].clone();
    c.multiplyScalar(0.6 + Math.random() * 0.4);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    siz[i] = Math.random() * 6 + 2;
  }
  return { positions: pos, colors: col, sizes: siz };
}

function createNebulaMesh(data) {
  if (nebulaParticles) scene.remove(nebulaParticles);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(data.sizes, 1));
  const mat = new THREE.PointsMaterial({
    size: 0.35, vertexColors: true, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.25, sizeAttenuation: true
  });
  nebulaParticles = new THREE.Points(geo, mat);
  scene.add(nebulaParticles);
}

// ── Halo (old globular cluster stars) ────────────────
function createHalo() {
  const count = 4000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Spherical distribution weighted toward center
    const r = 4 + Math.pow(Math.random(), 0.6) * 30;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    // Flatten slightly
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r * 0.4;
    pos[i * 3 + 2] = Math.cos(phi) * r;

    // Old, red stars
    const c = new THREE.Color().setHSL(0.08 + Math.random() * 0.05, 0.3, 0.25 + Math.random() * 0.25);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.12, vertexColors: true, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.4, sizeAttenuation: true
  });
  scene.add(new THREE.Points(geo, mat));
}

// ── Background Universe ──────────────────────────────
function createUniverse() {
  const count = 5000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = 55 + Math.random() * 50;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    pos[i * 3 + 2] = Math.cos(phi) * r;

    const hue = Math.random() < 0.7 ? 0.55 + Math.random() * 0.2 : Math.random();
    const c = new THREE.Color().setHSL(hue, 0.3, 0.4 + Math.random() * 0.5);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.18, vertexColors: true, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true
  });
  scene.add(new THREE.Points(geo, mat));

  // Add a few distant galaxies (small spiral-like clusters)
  for (let g = 0; g < 8; g++) {
    const gCount = 200;
    const gPos = new Float32Array(gCount * 3);
    const gCol = new Float32Array(gCount * 3);
    const cx = (Math.random() - 0.5) * 80;
    const cy = (Math.random() - 0.5) * 40;
    const cz = (Math.random() - 0.5) * 80;

    for (let i = 0; i < gCount; i++) {
      const gr = Math.random() * 3 + 0.5;
      const ga = Math.random() * Math.PI * 2;
      gPos[i * 3] = cx + Math.cos(ga) * gr;
      gPos[i * 3 + 1] = cy + (Math.random() - 0.5) * 0.3;
      gPos[i * 3 + 2] = cz + Math.sin(ga) * gr;
      const gc = new THREE.Color().setHSL(0.5 + Math.random() * 0.2, 0.4, 0.3 + Math.random() * 0.4);
      gCol[i * 3] = gc.r; gCol[i * 3 + 1] = gc.g; gCol[i * 3 + 2] = gc.b;
    }

    const gGeo = new THREE.BufferGeometry();
    gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    gGeo.setAttribute('color', new THREE.BufferAttribute(gCol, 3));
    const gMat = new THREE.PointsMaterial({
      size: 0.1, vertexColors: true, blending: THREE.AdditiveBlending,
      depthWrite: false, transparent: true
    });
    scene.add(new THREE.Points(gGeo, gMat));
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
  mesh.lookAt(0, 0, 0);
  mesh.rotateY((Math.random() - 0.5) * 0.5);
  mesh.userData = { dbId, orbitRadius: radius, orbitAngle: angle, orbitHeight: height, orbitSpeed: 0.015 + Math.random() * 0.04 };
  scene.add(mesh);
  floatingImages.push(mesh);
  return mesh;
}

// ═══════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════

const API_BASE = window.location.origin;
let authToken = null;

function authHeader() {
  return authToken ? { 'Authorization': `Bearer ${authToken}` } : {};
}

async function apiGet(path) { const r = await fetch(API_BASE + path); return r.json(); }
async function apiPost(path, body) {
  const r = await fetch(API_BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeader() }, body: JSON.stringify(body)
  });
  return r.json();
}
async function apiDelete(path) {
  await fetch(API_BASE + path, { method: 'DELETE', headers: authHeader() });
}
async function apiUpload(file) {
  const f = new FormData(); f.append('image', file);
  const r = await fetch(API_BASE + '/api/images/upload', { method: 'POST', headers: authHeader(), body: f });
  return r.json();
}

// ═══════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════

const authOverlay = document.getElementById('authOverlay');
const authPassword = document.getElementById('authPassword');
const authSubmit = document.getElementById('authSubmit');
const authSkip = document.getElementById('authSkip');
const authError = document.getElementById('authError');
const adminView = document.getElementById('adminView');

authSubmit.addEventListener('click', async () => {
  const pw = authPassword.value;
  if (!pw) { authError.textContent = 'Vui lòng nhập mật khẩu'; return; }
  try {
    const res = await fetch(API_BASE + '/api/auth', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw })
    });
    if (res.ok) {
      authToken = pw;
      localStorage.setItem('galaxy_token', pw);
      authOverlay.classList.add('hidden');
      adminView.style.display = 'block';
    } else {
      authError.textContent = '❌ Sai mật khẩu!';
    }
  } catch (_) { authError.textContent = '❌ Không kết nối được server'; }
});

authSkip.addEventListener('click', () => {
  authOverlay.classList.add('hidden');
  adminView.style.display = 'none';
});

authPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') authSubmit.click(); });

// Check stored token
const stored = localStorage.getItem('galaxy_token');
if (stored) {
  authToken = stored;
  // Verify
  fetch(API_BASE + '/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: stored }) })
    .then(r => { if (r.ok) { authOverlay.classList.add('hidden'); adminView.style.display = 'block'; } else { authToken = null; localStorage.removeItem('galaxy_token'); } })
    .catch(() => {});
}

// ═══════════════════════════════════════════════════════
// IMAGE PANEL LOGIC
// ═══════════════════════════════════════════════════════

let showFloatingImages = true;
function updateFloatingImagesVisibility() { floatingImages.forEach(m => { m.visible = showFloatingImages; }); }

const imagePanel = document.getElementById('imagePanel');
const imageGrid = document.getElementById('imageGrid');
const openPanelBtn = document.getElementById('openPanelBtn');
const closePanel = document.getElementById('closePanel');
const toggleImagesBtn = document.getElementById('toggleImagesBtn');

function closeImagePanel() { imagePanel.classList.add('hidden'); openPanelBtn.style.display = 'flex'; }
function openImagePanel() { imagePanel.classList.remove('hidden'); openPanelBtn.style.display = 'none'; }
closePanel.addEventListener('click', closeImagePanel);
openPanelBtn.addEventListener('click', openImagePanel);

toggleImagesBtn.addEventListener('click', () => {
  showFloatingImages = !showFloatingImages;
  updateFloatingImagesVisibility();
  toggleImagesBtn.textContent = showFloatingImages ? '🖼 Ẩn/Hiện ảnh' : '🖼 Đang ẩn';
});

// Image data
const imageMap = new Map();
const defaultImages = [
  'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=400&q=80',
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&q=80',
  'https://images.unsplash.com/photo-1502481851512-e9e2529bfbf9?w=400&q=80',
  'https://images.unsplash.com/photo-1543722530-d2c3201371e7?w=400&q=80',
  'https://images.unsplash.com/photo-1464802686167-b939a6910659?w=400&q=80',
  'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80',
  'https://images.unsplash.com/photo-1506703719100-b0a86c48d3b5?w=400&q=80',
  'https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&q=80',
];

function getDisplayUrl(url) { return url.startsWith('/') ? API_BASE + url : url; }

function renderImageGrid() {
  imageGrid.innerHTML = '';
  imageMap.forEach((item, dbId) => {
    const card = document.createElement('div');
    card.className = 'image-card';
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
    imageMap.set(saved.id, { url: saved.url, texture });
    createFloatingImage(texture, saved.id);
    renderImageGrid(); renderMobileImageGrid();
  } catch (err) { alert('Lỗi: ' + err.message); }
}

async function removeImage(dbId) {
  const item = imageMap.get(dbId);
  if (!item) return;
  item.texture.dispose();
  const meshIdx = floatingImages.findIndex(m => m.userData.dbId === dbId);
  if (meshIdx >= 0) {
    const mesh = floatingImages[meshIdx];
    mesh.geometry.dispose(); mesh.material.dispose(); scene.remove(mesh);
    floatingImages.splice(meshIdx, 1);
  }
  imageMap.delete(dbId);
  await apiDelete('/api/images/' + dbId);
  renderImageGrid(); renderMobileImageGrid();
}

function showFullscreen(url) {
  const existing = document.getElementById('imageModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'imageModal';
  modal.innerHTML = `<div class="close-modal">✕</div><img src="${url}">`;
  modal.addEventListener('click', (e) => { if (e.target === modal || e.target.classList.contains('close-modal')) modal.remove(); });
  document.body.appendChild(modal);
}

function loadImageTexture(url) {
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(url,
      (t) => { t.colorSpace = THREE.SRGBColorSpace; resolve(t); },
      undefined, () => reject(new Error('Failed: ' + url))
    );
  });
}

// Upload handler
document.getElementById('imageUpload').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    try {
      const saved = await apiUpload(file);
      if (saved.error) { alert(saved.error); continue; }
      const texture = await loadImageTexture(getDisplayUrl(saved.url));
      imageMap.set(saved.id, { url: saved.url, texture });
      createFloatingImage(texture, saved.id);
    } catch (_) {}
  }
  renderImageGrid(); renderMobileImageGrid(); e.target.value = '';
});

document.getElementById('addImage').addEventListener('click', () => {
  const inp = document.getElementById('imageUrl'); addImage(inp.value); inp.value = '';
});
document.getElementById('imageUrl').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { addImage(e.target.value); e.target.value = ''; }
});

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
  createGalaxyMesh(generateGalaxy(count, arms, spiral));
  createDustMesh(generateDust(Math.floor(count * 0.4), arms, spiral));
}

armsSlider.addEventListener('input', rebuildGalaxy);
spiralSlider.addEventListener('input', rebuildGalaxy);
countSlider.addEventListener('input', rebuildGalaxy);
speedSlider.addEventListener('input', () => { document.getElementById('speedVal').textContent = parseFloat(speedSlider.value); });

document.getElementById('resetBtn').addEventListener('click', () => { camera.position.set(0, 10, 24); controls.target.set(0, 0, 0); controls.update(); });
document.getElementById('autoRotateBtn').addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  document.getElementById('autoRotateBtn').textContent = controls.autoRotate ? '⏸ Dừng xoay' : '▶ Tự động xoay';
});

// ── Raycaster ────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
renderer.domElement.addEventListener('click', (event) => {
  mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
  mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(floatingImages);
  if (intersects.length > 0) {
    const dbId = intersects[0].object.userData.dbId;
    const item = imageMap.get(dbId);
    if (item) showFullscreen(getDisplayUrl(item.url));
  }
});

// ── Resize ───────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = container.clientWidth / container.clientHeight; camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  composer.setSize(container.clientWidth, container.clientHeight);
});

// ── Mode badge ───────────────────────────────────────
const modeBadge = document.getElementById('modeBadge');
function updateModeBadge() {
  const mobile = window.innerWidth <= 768;
  modeBadge.textContent = mobile ? '📱 USER' : (authToken ? '🖥 ADMIN' : '🖥 USER');
}
updateModeBadge();
window.addEventListener('resize', updateModeBadge);

// ── Mobile Gallery ───────────────────────────────────
function renderMobileImageGrid() {
  const grid = document.getElementById('mobileImageGrid');
  if (!grid) return;
  grid.innerHTML = '';
  imageMap.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `<img src="${getDisplayUrl(item.url)}" loading="lazy">`;
    card.addEventListener('click', () => showFullscreen(getDisplayUrl(item.url)));
    grid.appendChild(card);
  });
}

// ── Mobile UI ────────────────────────────────────────
document.getElementById('mobileGalleryBtn').addEventListener('click', () => document.getElementById('mobileGallery').classList.add('open'));
document.getElementById('mobileGalleryClose').addEventListener('click', () => document.getElementById('mobileGallery').classList.remove('open'));
document.getElementById('mobileAutoRotateBtn').addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  document.getElementById('mobileAutoRotateBtn').textContent = controls.autoRotate ? '⏸' : '▶';
});
document.getElementById('mobileResetBtn').addEventListener('click', () => { camera.position.set(0, 10, 24); controls.target.set(0, 0, 0); controls.update(); });
document.getElementById('mobileZoomInBtn').addEventListener('click', () => camera.position.multiplyScalar(0.85));
document.getElementById('mobileZoomOutBtn').addEventListener('click', () => camera.position.multiplyScalar(1.15));

// Pinch zoom
let lastPinchDist = 0;
renderer.domElement.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    lastPinchDist = Math.sqrt(dx * dx + dy * dy);
  }
}, { passive: true });
renderer.domElement.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2) {
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    camera.position.multiplyScalar(1 + (lastPinchDist - dist) * 0.002);
    lastPinchDist = dist;
  }
}, { passive: true });

// ── Tooltip fade ─────────────────────────────────────
setTimeout(() => { const tip = document.getElementById('tooltip'); if (tip) tip.style.opacity = '0'; }, 12000);

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════

createUniverse();
createHalo();
createNebulaMesh(generateNebula(3000));
const initialData = generateGalaxy(15000, 4, 2.5);
createGalaxyMesh(initialData);
createDustMesh(generateDust(6000, 4, 2.5));
closeImagePanel();

(async () => {
  try {
    const images = await apiGet('/api/images');
    if (images.length > 0) {
      for (const img of images) {
        try {
          const texture = await loadImageTexture(getDisplayUrl(img.url));
          imageMap.set(img.id, { url: img.url, texture });
          createFloatingImage(texture, img.id);
        } catch (_) {}
      }
    } else {
      for (const url of defaultImages) {
        try {
          const saved = authToken ? await apiPost('/api/images', { url }) : { id: 'local-' + Math.random().toString(36).slice(2), url };
          const texture = await loadImageTexture(url);
          imageMap.set(saved.id, { url: saved.url || url, texture });
          createFloatingImage(texture, saved.id);
        } catch (_) {}
      }
    }
  } catch (_) {
    for (const url of defaultImages) {
      try {
        const texture = await loadImageTexture(url);
        const fakeId = 'local-' + Math.random().toString(36).slice(2);
        imageMap.set(fakeId, { url, texture });
        createFloatingImage(texture, fakeId);
      } catch (_) {}
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

  coreGlow.material.uniforms.uTime.value = time;
  disk.material.uniforms.uTime.value = time;
  core.rotation.y += 0.08 * dt;

  if (galaxyStars) galaxyStars.rotation.y += speed * 0.08 * dt;
  if (dustLanes) dustLanes.rotation.y += speed * 0.08 * dt;
  if (nebulaParticles) nebulaParticles.rotation.y += speed * 0.06 * dt;

  composer.render();
}

animate();
