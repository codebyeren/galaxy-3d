import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ── Scene, Camera, Renderer ──────────────────────────
const container = document.getElementById('container');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(55, container.clientWidth / container.clientHeight, 0.5, 200);
camera.position.set(0, 12, 28);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
container.appendChild(renderer.domElement);

// ── Post Processing (Bloom) ──────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(container.clientWidth, container.clientHeight),
  0.6,  // strength
  0.4,  // radius
  0.85  // threshold
);
composer.addPass(bloomPass);

// ── Orbit Controls ───────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.3;
controls.minDistance = 5;
controls.maxDistance = 80;
controls.maxPolarAngle = Math.PI * 0.75;
controls.target.set(0, 0, 0);
controls.update();

// ── Lighting ─────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x1a1a3a, 0.6));

const sunLight = new THREE.PointLight(0xffeedd, 60, 60, 1.5);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);

const blueLight = new THREE.PointLight(0x4466ff, 12, 30, 2);
blueLight.position.set(0, 2, 0);
scene.add(blueLight);

// ── Galaxy Core ──────────────────────────────────────
const coreGeo = new THREE.SphereGeometry(1.2, 32, 32);
const coreMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });
const core = new THREE.Mesh(coreGeo, coreMat);
scene.add(core);

const coreGlowGeo = new THREE.SphereGeometry(2.0, 32, 32);
const coreGlowMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColor1: { value: new THREE.Color(0xffaa44) },
    uColor2: { value: new THREE.Color(0xff4400) }
  },
  vertexShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vPosition = worldPos.xyz;
      vNormal = normalize(mat3(modelMatrix) * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float uTime;
    uniform vec3 uColor1;
    uniform vec3 uColor2;
    void main() {
      vec3 viewDir = normalize(cameraPosition - vPosition);
      float fresnel = 1.0 - abs(dot(viewDir, vNormal));
      fresnel = pow(fresnel, 3.5);
      float pulse = 0.85 + 0.15 * sin(uTime * 2.0);
      vec3 color = mix(uColor1, uColor2, fresnel) * pulse;
      float alpha = fresnel * 0.7;
      gl_FragColor = vec4(color, alpha);
    }
  `,
  transparent: true,
  depthWrite: false
});
const coreGlow = new THREE.Mesh(coreGlowGeo, coreGlowMat);
scene.add(coreGlow);

// ── Galaxy Particle System ───────────────────────────
let galaxyParticles = null;
let galaxyData = { positions: [], colors: [], sizes: [] };

function generateGalaxy(starCount, arms, spiralTightness) {
  const positions = new Float32Array(starCount * 3);
  const colors = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  for (let i = 0; i < starCount; i++) {
    // Random radius with concentration toward center
    const r = Math.pow(Math.random(), 0.55) * 18 + 0.3;

    // Spiral angle
    const armIndex = i % arms;
    const armAngle = (armIndex / arms) * Math.PI * 2;
    const spiralAngle = r * spiralTightness;

    // Random scatter
    const scatterAngle = (Math.random() - 0.5) * (0.6 + r * 0.08);
    const scatterRadius = (Math.random() - 0.5) * (0.3 + r * 0.06);

    const angle = armAngle + spiralAngle + scatterAngle;
    const radius = r + scatterRadius;

    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = (Math.random() - 0.5) * (0.4 + r * 0.03) * (1.0 - r / 20);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    // Color: warm near center, cool at edges
    const t = r / 18;
    const color = new THREE.Color();
    if (t < 0.15) {
      color.setHSL(0.12, 1, 0.95 - t * 0.5);
    } else if (t < 0.4) {
      color.setHSL(0.15 + t * 0.15, 0.8, 0.85 - t * 0.6);
    } else {
      color.setHSL(0.55 + t * 0.15, 0.9, 0.75 - t * 0.5);
    }

    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    // Size variation
    sizes[i] = Math.random() * 2.5 + 0.4;
  }

  return { positions, colors, sizes };
}

function createGalaxyMesh(data) {
  if (galaxyParticles) scene.remove(galaxyParticles);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(data.colors, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(data.sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 0.08,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true
  });

  galaxyParticles = new THREE.Points(geo, mat);
  scene.add(galaxyParticles);
  galaxyData = data;
}

// ── Background Stars ─────────────────────────────────
function createBackgroundStars() {
  const count = 3000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    // Spread on a sphere
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = 50 + Math.random() * 30;

    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
    positions[i * 3 + 2] = Math.cos(phi) * r;

    const c = new THREE.Color().setHSL(Math.random() * 0.2 + 0.55, 0.5, 0.5 + Math.random() * 0.4);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    transparent: true
  });

  scene.add(new THREE.Points(geo, mat));
}

// ── Floating Images in 3D Space ──────────────────────
const floatingImages = [];
const imageTextures = [];

function createFloatingImage(texture) {
  const aspect = texture.image ? texture.image.width / texture.image.height : 1;
  const w = 3;
  const h = w / aspect;

  const geo = new THREE.PlaneGeometry(w, h);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(geo, mat);

  // Place at random position in orbit around galaxy
  const angle = Math.random() * Math.PI * 2;
  const radius = 22 + Math.random() * 15;
  const height = (Math.random() - 0.5) * 12;

  mesh.position.set(
    Math.cos(angle) * radius,
    height,
    Math.sin(angle) * radius
  );

  // Face the center
  mesh.lookAt(0, 0, 0);
  mesh.rotateY((Math.random() - 0.5) * 0.5);

  mesh.userData = {
    orbitRadius: radius,
    orbitAngle: angle,
    orbitHeight: height,
    orbitSpeed: 0.02 + Math.random() * 0.06,
    texture: texture
  };

  scene.add(mesh);
  floatingImages.push(mesh);
  return mesh;
}

// ── Load Image from URL ──────────────────────────────
function loadImageTexture(url) {
  return new Promise((resolve, reject) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        imageTextures.push({ url, texture });
        resolve(texture);
      },
      undefined,
      () => reject(new Error('Failed to load: ' + url))
    );
  });
}

// ── UI Logic ─────────────────────────────────────────
let showFloatingImages = true;

function updateFloatingImagesVisibility() {
  floatingImages.forEach(m => { m.visible = showFloatingImages; });
}

// ── Image Panel ──────────────────────────────────────
const imagePanel = document.getElementById('imagePanel');
const imageGrid = document.getElementById('imageGrid');
const openPanelBtn = document.getElementById('openPanelBtn');
const closePanel = document.getElementById('closePanel');
const toggleImagesBtn = document.getElementById('toggleImagesBtn');

function closeImagePanel() {
  imagePanel.classList.add('hidden');
  openPanelBtn.style.display = 'flex';
}

function openImagePanel() {
  imagePanel.classList.remove('hidden');
  openPanelBtn.style.display = 'none';
}

closePanel.addEventListener('click', closeImagePanel);
openPanelBtn.addEventListener('click', openImagePanel);

toggleImagesBtn.addEventListener('click', () => {
  showFloatingImages = !showFloatingImages;
  updateFloatingImagesVisibility();
  toggleImagesBtn.textContent = showFloatingImages ? '🖼 Ẩn/Hiện ảnh' : '🖼 Đang ẩn (bấm để hiện)';
});

// Default space images URLs
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

function renderImageGrid() {
  imageGrid.innerHTML = '';
  imageTextures.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `
      <img src="${item.url}" loading="lazy">
      <button class="delete-btn" data-idx="${idx}">✕</button>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) return;
      showFullscreen(item.url);
    });
    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeImage(idx);
    });
    imageGrid.appendChild(card);
  });
}

async function addImage(url) {
  if (!url.trim()) return;
  try {
    const texture = await loadImageTexture(url.trim());
    createFloatingImage(texture);
    renderImageGrid();
  } catch (err) {
    alert('Không tải được ảnh: ' + err.message);
  }
}

function removeImage(idx) {
  const { url, texture } = imageTextures[idx];
  texture.dispose();

  // Remove corresponding floating mesh
  const meshIdx = floatingImages.findIndex(m => m.userData.texture === texture);
  if (meshIdx >= 0) {
    const mesh = floatingImages[meshIdx];
    mesh.geometry.dispose();
    mesh.material.dispose();
    scene.remove(mesh);
    floatingImages.splice(meshIdx, 1);
  }

  imageTextures.splice(idx, 1);
  renderImageGrid();
}

// Fullscreen modal
function showFullscreen(url) {
  const existing = document.getElementById('imageModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'imageModal';
  modal.innerHTML = `
    <div class="close-modal">✕</div>
    <img src="${url}">
  `;
  modal.addEventListener('click', (e) => {
    if (e.target === modal || e.target.classList.contains('close-modal')) {
      modal.remove();
    }
  });
  document.body.appendChild(modal);
}

// Upload handler
document.getElementById('imageUpload').addEventListener('change', (e) => {
  const files = e.target.files;
  for (const file of files) {
    const reader = new FileReader();
    reader.onload = (ev) => addImage(ev.target.result);
    reader.readAsDataURL(file);
  }
  e.target.value = '';
});

document.getElementById('addImage').addEventListener('click', () => {
  const input = document.getElementById('imageUrl');
  addImage(input.value);
  input.value = '';
});

document.getElementById('imageUrl').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    addImage(e.target.value);
    e.target.value = '';
  }
});

// ── Controls ─────────────────────────────────────────
const armsSlider = document.getElementById('arms');
const spiralSlider = document.getElementById('spiral');
const countSlider = document.getElementById('count');
const speedSlider = document.getElementById('speed');
const resetBtn = document.getElementById('resetBtn');
const autoRotateBtn = document.getElementById('autoRotateBtn');

function rebuildGalaxy() {
  const arms = parseInt(armsSlider.value);
  const spiral = parseFloat(spiralSlider.value);
  const count = parseInt(countSlider.value);

  document.getElementById('armsVal').textContent = arms;
  document.getElementById('spiralVal').textContent = spiral;
  document.getElementById('countVal').textContent = (count / 1000).toFixed(0) + 'K';
  document.getElementById('speedVal').textContent = parseFloat(speedSlider.value);

  const data = generateGalaxy(count, arms, spiral);
  createGalaxyMesh(data);
}

armsSlider.addEventListener('input', rebuildGalaxy);
spiralSlider.addEventListener('input', rebuildGalaxy);
countSlider.addEventListener('input', rebuildGalaxy);

speedSlider.addEventListener('input', () => {
  document.getElementById('speedVal').textContent = parseFloat(speedSlider.value);
});

resetBtn.addEventListener('click', () => {
  camera.position.set(0, 12, 28);
  controls.target.set(0, 0, 0);
  controls.update();
});

autoRotateBtn.addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  autoRotateBtn.textContent = controls.autoRotate ? '⏸ Dừng xoay' : '▶ Tự động xoay';
});

// ── Raycaster for clicking floating images ───────────
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

renderer.domElement.addEventListener('click', (event) => {
  mouse.x = (event.clientX / container.clientWidth) * 2 - 1;
  mouse.y = -(event.clientY / container.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(floatingImages);

  if (intersects.length > 0) {
    const obj = intersects[0].object;
    const texData = imageTextures.find(t => t.texture === obj.userData.texture);
    if (texData) showFullscreen(texData.url);
  }
});

// ── Resize Handler ───────────────────────────────────
function handleResize() {
  camera.aspect = container.clientWidth / container.clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(container.clientWidth, container.clientHeight);
  composer.setSize(container.clientWidth, container.clientHeight);
}
window.addEventListener('resize', handleResize);

// ── Fade tooltip ─────────────────────────────────────
setTimeout(() => {
  const tip = document.getElementById('tooltip');
  if (tip) tip.style.opacity = '0';
}, 12000);

// ── Mode detection & badge ───────────────────────────
const isMobile = window.innerWidth <= 768;
const modeBadge = document.getElementById('modeBadge');
modeBadge.textContent = isMobile ? '📱 USER' : '🖥 ADMIN';

window.addEventListener('resize', () => {
  const mobileNow = window.innerWidth <= 768;
  modeBadge.textContent = mobileNow ? '📱 USER' : '🖥 ADMIN';
});

// ── Sync mobile gallery grid ─────────────────────────
function renderMobileImageGrid() {
  const grid = document.getElementById('mobileImageGrid');
  if (!grid) return;
  grid.innerHTML = '';
  imageTextures.forEach((item, idx) => {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.innerHTML = `<img src="${item.url}" loading="lazy">`;
    card.addEventListener('click', () => showFullscreen(item.url));
    grid.appendChild(card);
  });
}

// Override renderImageGrid to also update mobile
const originalRenderImageGrid = renderImageGrid;
renderImageGrid = function() {
  originalRenderImageGrid();
  renderMobileImageGrid();
};

// ── Mobile UI handlers ───────────────────────────────
document.getElementById('mobileGalleryBtn').addEventListener('click', () => {
  document.getElementById('mobileGallery').classList.add('open');
});

document.getElementById('mobileGalleryClose').addEventListener('click', () => {
  document.getElementById('mobileGallery').classList.remove('open');
});

document.getElementById('mobileAutoRotateBtn').addEventListener('click', () => {
  controls.autoRotate = !controls.autoRotate;
  const btn = document.getElementById('mobileAutoRotateBtn');
  btn.textContent = controls.autoRotate ? '⏸' : '▶';
});

document.getElementById('mobileResetBtn').addEventListener('click', () => {
  camera.position.set(0, 12, 28);
  controls.target.set(0, 0, 0);
  controls.update();
});

document.getElementById('mobileZoomInBtn').addEventListener('click', () => {
  camera.position.multiplyScalar(0.85);
});

document.getElementById('mobileZoomOutBtn').addEventListener('click', () => {
  camera.position.multiplyScalar(1.15);
});

// ── Touch events for mobile ──────────────────────────
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
    const delta = lastPinchDist - dist;
    camera.position.multiplyScalar(1 + delta * 0.002);
    lastPinchDist = dist;
  }
}, { passive: true });

// ── Init ─────────────────────────────────────────────
createBackgroundStars();
rebuildGalaxy();
closeImagePanel();

// Load default images
(async () => {
  for (const url of defaultImages) {
    try {
      const tex = await loadImageTexture(url);
      createFloatingImage(tex);
    } catch (_) { /* skip failed images */ }
  }
  renderImageGrid();
  renderMobileImageGrid();
})();

// ── Animation Loop ───────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.1);
  const time = performance.now() * 0.001;

  controls.update();

  // Animate floating images orbiting galaxy
  const speed = parseFloat(speedSlider.value);
  floatingImages.forEach(mesh => {
    mesh.userData.orbitAngle += mesh.userData.orbitSpeed * speed * dt;
    mesh.position.x = Math.cos(mesh.userData.orbitAngle) * mesh.userData.orbitRadius;
    mesh.position.z = Math.sin(mesh.userData.orbitAngle) * mesh.userData.orbitRadius;
    mesh.position.y = mesh.userData.orbitHeight;
    mesh.lookAt(0, mesh.userData.orbitHeight * 0.5, 0);
  });

  // Update core glow
  coreGlow.material.uniforms.uTime.value = time;
  core.rotation.y += 0.1 * dt;

  // Rotate galaxy
  if (galaxyParticles) {
    galaxyParticles.rotation.y += speed * 0.1 * dt;
  }

  composer.render();
}

animate();
