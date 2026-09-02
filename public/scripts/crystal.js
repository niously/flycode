/* ==========================================================================
   纯原生 WebGL 3D 交互全息水晶 (保持多面体钻石切面高反光原版设定)
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
  renderer.toneMappingExposure = 1.3;

  // 1. 动态生成反射环境贴图 (呈现真实钻石高光倒影)
  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  const envLight1 = new THREE.DirectionalLight(0x06b6d4, 4);
  envLight1.position.set(1, 1, 1);
  envScene.add(envLight1);
  const envLight2 = new THREE.DirectionalLight(0xf43f5e, 4);
  envLight2.position.set(-1, -1, -1);
  envScene.add(envLight2);
  const envLight3 = new THREE.DirectionalLight(0x8b5cf6, 5);
  envLight3.position.set(0, 2, -1);
  envScene.add(envLight3);

  const envRt = pmremGenerator.fromScene(envScene);
  scene.environment = envRt.texture;

  // 2. 完美钻石切角多面体 (Octahedron 强化锐利反光切面)
  const geometry = new THREE.OctahedronGeometry(1.2, 0);

  // 3. 顶级物理玻璃+钻石切面折射材质 (开启 flatShading 与超强高光)
  const material = new THREE.MeshPhysicalMaterial({
    roughness: 0.0,
    metalness: 0.1,
    transmission: 0.95,
    thickness: 1.8,
    ior: 2.4, // 钻石折射率，极强锐利反光
    reflectivity: 1.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.0,
    color: 0xffffff,
    emissive: 0x6366f1,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.95,
    flatShading: true // 开启切面锐利折射反光
  });

  const crystal = new THREE.Mesh(geometry, material);
  scene.add(crystal);

  // 4. 内层全息能量棱镜 (反向自转，增强内部多层深邃折射)
  const innerGeo = new THREE.OctahedronGeometry(0.6, 0);
  const innerMat = new THREE.MeshPhysicalMaterial({
    roughness: 0.1,
    metalness: 0.2,
    color: 0xec4899,
    emissive: 0xf43f5e,
    emissiveIntensity: 0.8,
    flatShading: true
  });
  const innerCore = new THREE.Mesh(innerGeo, innerMat);
  crystal.add(innerCore);

  // 5. 动态高光点光源 (围绕水晶公转，产生极度璀璨的高光切面闪烁)
  const pointLight1 = new THREE.PointLight(0x00f0ff, 4.5, 20);
  scene.add(pointLight1);

  const pointLight2 = new THREE.PointLight(0xff0077, 4.5, 20);
  scene.add(pointLight2);

  const pointLight3 = new THREE.PointLight(0xffffff, 5, 20);
  scene.add(pointLight3);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
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

  // 点击共振特效 (绝不停止旋转)
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
    pointLight1.position.x = Math.sin(time) * 3;
    pointLight1.position.z = Math.cos(time) * 3;
    pointLight1.position.y = Math.cos(time * 0.7) * 2;

    pointLight2.position.x = -Math.sin(time * 0.8) * 3;
    pointLight2.position.z = -Math.cos(time * 0.8) * 3;
    pointLight2.position.y = Math.sin(time * 0.5) * 2;

    pointLight3.position.x = Math.cos(time * 1.2) * 2.5;
    pointLight3.position.y = Math.sin(time * 1.2) * 2.5;
    pointLight3.position.z = 2.5;

    // 永远自转并带有物理惯性（降低桌面自转速度，更加优雅舒缓）
    if (!isDragging) {
      crystal.rotation.y += 0.0035 + vx;
      crystal.rotation.x += 0.0018 + vy;
      vx *= 0.95;
      vy *= 0.95;
    }

    innerCore.rotation.y -= 0.008;
    innerCore.rotation.z += 0.005;

    renderer.render(scene, camera);
  }
  animate();
})();
