/* ==========================================================================
   Flycode 极简轻量流光星网 (针对手机端极致优化，60fps 丝滑不卡顿、温润不刺眼)
   ========================================================================== */
(function initElegantCosmos() {
  const canvas = document.querySelector('#bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width, height;
  const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

  // 1. 精简柔和粒子群 (尺寸克制 1.2px~2.2px，透明度温润)
  let particles = [];
  // 2. 引力涟漪波 (单层细腻柔光圆环)
  let ripples = [];

  let pointer = { x: -1000, y: -1000, px: -1000, py: -1000 };

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
    initParticles();
  }

  function initParticles() {
    particles = [];
    // 手机端严格控制粒子数量在 24~28 个，电脑端 50 个，彻底杜绝掉帧和发热
    const count = isTouch ? 26 : 48;
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseX: Math.random() * width,
        baseY: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        size: Math.random() * 1.0 + 1.2, // 细腻小颗粒
        alpha: Math.random() * 0.25 + 0.25, // 克制柔和的透明度
        pulse: Math.random() * Math.PI * 2
      });
    }
  }

  window.addEventListener('resize', resize);
  resize();

  // 触发细腻的轻柔引力光环
  function triggerRipple(x, y) {
    if (!x || !y) return;
    ripples.push({
      x,
      y,
      radius: 4,
      maxRadius: isTouch ? 180 : 260,
      alpha: 0.6,
      speed: isTouch ? 5 : 7
    });

    // 轻柔推动周围粒子
    particles.forEach(p => {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist < 180 && dist > 0) {
        const force = (180 - dist) / 180 * (isTouch ? 5 : 8);
        p.vx += (dx / dist) * force;
        p.vy += (dy / dist) * force;
      }
    });
  }

  // 手机端与电脑端极速轻量事件监听
  window.addEventListener('pointerdown', (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
    triggerRipple(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener('pointermove', (e) => {
    pointer.px = pointer.x;
    pointer.py = pointer.y;
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  }, { passive: true });

  // 关键修复：松手/取消/移出窗口时重置指针坐标，
  // 否则手机端点击后 pointer 永远停留在点击处，粒子被持续吸引形成"残留引力团"
  function releasePointer() {
    pointer.x = -1000;
    pointer.y = -1000;
    pointer.px = -1000;
    pointer.py = -1000;
  }
  window.addEventListener('pointerup', releasePointer, { passive: true });
  window.addEventListener('pointercancel', releasePointer, { passive: true });
  window.addEventListener('touchend', releasePointer, { passive: true });
  window.addEventListener('blur', releasePointer);
  document.documentElement.addEventListener('mouseleave', releasePointer);

  let time = 0;
  let isAnimating = true;
  
  // Bug修复 #13: 页面不可见时暂停动画，节省电量
  document.addEventListener('visibilitychange', () => {
    isAnimating = !document.hidden;
  });
  
  function animate() {
    requestAnimationFrame(animate);
    
    // 页面不可见时跳过渲染
    if (!isAnimating) return;
    
    time += 0.015;
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    
    // 填充 Canvas 背景色（跟随主题），而不是 clearRect
    ctx.fillStyle = isDark ? '#06070d' : '#f8fafc';
    ctx.fillRect(0, 0, width, height);

    // 1. 绘制细腻柔和的引力涟漪 (无厚重阴影，极速渲染)
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.radius += r.speed;
      r.alpha = Math.max(0, 0.6 * (1 - r.radius / r.maxRadius));

      if (r.alpha <= 0.01 || r.radius >= r.maxRadius) {
        ripples.splice(i, 1);
        continue;
      }

      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.strokeStyle = isDark
        ? `rgba(168, 85, 247, ${r.alpha})`
        : `rgba(99, 102, 241, ${r.alpha * 0.8})`;
      ctx.lineWidth = isTouch ? 1.5 : 2;
      ctx.stroke();
    }

    // 2. 绘制温润粒子与微连线 (极度轻量，零卡顿)
    const lineDist = isTouch ? 75 : 105;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.96;
      p.vy *= 0.96;

      // 柔和微漂移
      p.x += (p.baseX - p.x) * 0.01 + Math.sin(time + p.pulse) * 0.25;
      p.y += (p.baseY - p.y) * 0.01 + Math.cos(time + p.pulse) * 0.25;

      const currentAlpha = p.alpha * (0.8 + 0.2 * Math.sin(time * 1.5 + p.pulse));

      // 绘制粒子
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = isDark
        ? `rgba(196, 181, 253, ${currentAlpha})`
        : `rgba(99, 102, 241, ${currentAlpha * 0.7})`;
      ctx.fill();

      // 粒子间优雅微细线
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const d = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (d < lineDist) {
          const alpha = (1 - d / lineDist) * (isDark ? 0.12 : 0.06);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = isDark ? `rgba(168, 85, 247, ${alpha})` : `rgba(99, 102, 241, ${alpha})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }
  }
  animate();
})();
