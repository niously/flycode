/* ==========================================================================
   纯原生 WebGL 3D 交互全息水晶（保留原版建模结构，极致强化切面高反光与流光闪烁）
   ========================================================================== */
(function init3DWebGLCrystal() {
  const canvas = document.querySelector('#crystal-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const container = document.querySelector('#crystal-3d-wrapper');
  const width = container.clientWidth || 240;
  const height = container.clientHeight || 240;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  camera.position.z = 4.2;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;

  // 1. 生成极具反射质感的 360° 环境反射贴图（模拟真实摄影棚多重高光棚灯）
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  // 顶部主白光棚灯
  const envLightTop = new THREE.DirectionalLight(0xffffff, 8);
  envLightTop.position.set(0, 5, 2);
  envScene.add(envLightTop);
  // 左侧冷青霓虹灯
  const envLightCyan = new THREE.DirectionalLight(0x00f0ff, 6);
  envLightCyan.position.set(-4, 2, 2);
  envScene.add(envLightCyan);
  // 右侧紫红高光灯
  const envLightPink = new THREE.DirectionalLight(0xff00aa, 6);
  envLightPink.position.set(4, -2, 2);
  envScene.add(envLightPink);
  // 背面轮廓反光灯
  const envLightBack = new THREE.DirectionalLight(0x818cf8, 6);
  envLightBack.position.set(0, -3, -4);
  envScene.add(envLightBack);

  const envRt = pmremGenerator.fromScene(envScene);
  scene.environment = envRt.texture;

  // 2. 保持原版八面体钻石切角几何建模
  const geometry = new THREE.OctahedronGeometry(1.2, 0);

  // 3. 极致钻石反光材质：超低粗糙度 + 强折射率 + 超高清漆高光
  const material = new THREE.MeshPhysicalMaterial({
    roughness: 0.0,           // 绝对光滑镜面
    metalness: 0.25,          // 适度金属反光感
    transmission: 0.92,       // 透光折射
    thickness: 1.6,
    ior: 2.42,                // 真实钻石折射率，产生极强光线折射与切面反射
    reflectivity: 1.0,        // 100% 表面反射率
    clearcoat: 1.0,           // 表面覆盖一层极清亮的高光清漆层
    clearcoatRoughness: 0.0,  // 清漆层零粗糙度
    color: 0xffffff,
    emissive: 0x4f46e5,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.95,
    flatShading: true         // 关键：保留锋利的钻石切面明暗反光
  });

  const crystal = new THREE.Mesh(geometry, material);
  scene.add(crystal);

  // 4. 原版内层能量棱镜
  const innerGeo = new THREE.OctahedronGeometry(0.6, 0);
  const innerMat = new THREE.MeshPhysicalMaterial({
    roughness: 0.1,
    metalness: 0.3,
    color: 0xec4899,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.85,
    flatShading: true
  });
  const innerCore = new THREE.Mesh(innerGeo, innerMat);
  crystal.add(innerCore);

  // 5. 动态高亮度公转点光源（产生旋转时棱面瞬间闪烁的钻石反光）
  const pointLight1 = new THREE.PointLight(0x00ffff, 5, 25);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xff0066, 5, 25);
  scene.add(pointLight2);

  const pointLight3 = new THREE.PointLight(0xffffff, 6, 25);
  scene.add(pointLight3);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);

  // 交互控制：鼠标与手机触控
  let isDragging = false;
  let prevX = 0, prevY = 0;
  let vx = 0, vy = 0;

  function onPointerDown(x, y) {
    isDragging = true;
    prevX = x;
    prevY = y;
  }

  function onPointerMove(x, y) {
    if (!isDragging) return;
    const dx = x - prevX;
    const dy = y - prevY;
    crystal.rotation.y += dx * 0.015;
    crystal.rotation.x += dy * 0.015;
    vx = dx * 0.008;
    vy = dy * 0.008;
    prevX = x;
    prevY = y;
  }

  function onPointerUp() {
    isDragging = false;
  }

  container.addEventListener('mousedown', (e) => onPointerDown(e.clientX, e.clientY));
  window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
  window.addEventListener('mouseup', onPointerUp);

  container.addEventListener('touchstart', (e) => {
    if (e.touches.length > 0) onPointerDown(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
  }, { passive: true });
  window.addEventListener('touchend', onPointerUp);

  // 点击共振特效 (脉冲增亮)
  container.addEventListener('click', () => {
    material.emissiveIntensity = 1.6;
    material.color.setHex(0xa5b4fc);
    crystal.scale.set(1.2, 1.2, 1.2);
    setTimeout(() => {
      material.emissiveIntensity = 0.35;
      material.color.setHex(0xffffff);
      crystal.scale.set(1, 1, 1);
    }, 300);
  });

  let time = 0;
  function animate() {
    requestAnimationFrame(animate);
    time += 0.02;

    // 高光光源环绕公转 (制造极致的切面流光与反光闪烁)
    pointLight1.position.x = Math.sin(time) * 3.2;
    pointLight1.position.z = Math.cos(time) * 3.2;
    pointLight1.position.y = Math.cos(time * 0.7) * 2;

    pointLight2.position.x = -Math.sin(time * 0.8) * 3.2;
    pointLight2.position.z = -Math.cos(time * 0.8) * 3.2;
    pointLight2.position.y = Math.sin(time * 0.5) * 2;

    pointLight3.position.x = Math.cos(time * 1.2) * 2.8;
    pointLight3.position.y = Math.sin(time * 1.2) * 2.8;
    pointLight3.position.z = 2.8;

    // 优雅舒缓自转并带有物理惯性
    if (!isDragging) {
      crystal.rotation.y += 0.004 + vx;
      crystal.rotation.x += 0.002 + vy;
      vx *= 0.95;
      vy *= 0.95;
    }

    innerCore.rotation.y -= 0.012;
    innerCore.rotation.z += 0.008;

    renderer.render(scene, camera);
  }
  animate();
})();
