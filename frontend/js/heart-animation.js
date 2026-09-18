/* ============================================
   HEART ANIMATION JS — Mouse Parallax + Orbital Particles
   Lightweight, GPU-friendly, time-based
   ============================================ */

(function () {
  'use strict';

  // ── Reduced Motion Check ──
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (prefersReducedMotion.matches) return;

  // ── DOM References ──
  const scene = document.getElementById('heroHeartScene');
  const canvas = document.getElementById('orbitParticles');
  const heroCard = document.querySelector('.hero-card');
  if (!scene || !canvas) return;

  const ctx = canvas.getContext('2d');


  /* ================================================
     1. MOUSE PARALLAX (2–3° max)
     ================================================ */
  let targetRotX = 0;
  let targetRotY = 0;
  let currentRotX = 0;
  let currentRotY = 0;
  const MAX_ROTATION = 3; // degrees
  const LERP_FACTOR = 0.08;

  function handleMouseMove(e) {
    if (!heroCard) return;
    const rect = heroCard.getBoundingClientRect();
    // Normalized -1 to 1 relative to hero card center
    const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

    // Clamp
    targetRotY = Math.max(-1, Math.min(1, nx)) * MAX_ROTATION;
    targetRotX = Math.max(-1, Math.min(1, -ny)) * MAX_ROTATION; // invert Y for natural tilt
  }

  function handleMouseLeave() {
    targetRotX = 0;
    targetRotY = 0;
  }

  if (heroCard) {
    heroCard.addEventListener('mousemove', handleMouseMove, { passive: true });
    heroCard.addEventListener('mouseleave', handleMouseLeave, { passive: true });
  }


  /* ================================================
     2. ORBITAL PARTICLES (10–12 tiny quantum dots)
     ================================================ */
  const PARTICLE_COUNT = 12;
  const particles = [];

  // Ring orbital parameters matching the CSS rings
  const orbits = [
    { rx: 120, ry: 42, tiltX: 75, tiltY: 0, speed: 1 / 7, phase: 0 },
    { rx: 110, ry: 38, tiltX: 50, tiltY: 40, speed: 1 / 10, phase: 0 },
    { rx: 128, ry: 40, tiltX: 55, tiltY: -30, speed: -1 / 8, phase: 0 },
  ];

  function createParticles() {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const orbitIdx = i % orbits.length;
      particles.push({
        orbit: orbitIdx,
        angle: (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.5,
        speed: orbits[orbitIdx].speed * (0.8 + Math.random() * 0.4), // slight speed variation
        size: 1.2 + Math.random() * 1.0, // 1.2–2.2px
        opacity: 0.4 + Math.random() * 0.4, // 0.4–0.8
      });
    }
  }


  /* ================================================
     3. RENDER LOOP
     ================================================ */
  let canvasW = 0;
  let canvasH = 0;

  function resizeCanvas() {
    const rect = scene.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvasW = rect.width;
    canvasH = rect.height;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // Debounced resize
  let resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 150);
  });
  resizeCanvas();

  // Detect theme for particle colors
  function getParticleColor(opacity) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      return 'rgba(56, 189, 248, ' + opacity + ')'; // cyan
    }
    return 'rgba(37, 99, 235, ' + opacity + ')'; // blue
  }

  // 3D point projection (simplified — rotate + project)
  function projectPoint(angle, orbit) {
    const o = orbits[orbit];
    // Point on ellipse
    const ex = o.rx * Math.cos(angle);
    const ey = o.ry * Math.sin(angle);

    // Convert tilt angles to radians
    const ax = (o.tiltX * Math.PI) / 180;
    const ay = (o.tiltY * Math.PI) / 180;

    // Rotate around X axis
    const y1 = ey * Math.cos(ax);
    const z1 = ey * Math.sin(ax);

    // Rotate around Y axis
    const x2 = ex * Math.cos(ay) + z1 * Math.sin(ay);
    const z2 = -ex * Math.sin(ay) + z1 * Math.cos(ay);

    return {
      x: canvasW / 2 + x2,
      y: canvasH / 2 + y1,
      z: z2, // for depth ordering
    };
  }


  function render(time) {
    const t = time / 1000; // seconds

    // ── Parallax: Lerp toward target ──
    currentRotX += (targetRotX - currentRotX) * LERP_FACTOR;
    currentRotY += (targetRotY - currentRotY) * LERP_FACTOR;

    // Apply parallax transform to scene container (perspective is in CSS)
    scene.style.transform =
      'rotateX(' + currentRotX.toFixed(2) + 'deg) rotateY(' + currentRotY.toFixed(2) + 'deg)';

    // ── Draw particles ──
    ctx.clearRect(0, 0, canvasW, canvasH);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const angle = p.angle + t * p.speed * Math.PI * 2;
      const pt = projectPoint(angle, p.orbit);

      // Depth-based opacity and size
      const depthFactor = 0.5 + 0.5 * ((pt.z + 140) / 280); // normalize z to 0–1
      const drawOpacity = p.opacity * Math.max(0.3, depthFactor);
      const drawSize = p.size * (0.7 + 0.3 * depthFactor);

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, drawSize, 0, Math.PI * 2);
      ctx.fillStyle = getParticleColor(drawOpacity);
      ctx.fill();

      // Subtle glow for brighter particles
      if (drawOpacity > 0.5) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, drawSize * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = getParticleColor(drawOpacity * 0.15);
        ctx.fill();
      }
    }

    animFrameId = requestAnimationFrame(render);
  }

  let animFrameId;

  // ── Initialize ──
  createParticles();
  animFrameId = requestAnimationFrame(render);

  // ── Cleanup on page unload (prevent memory leaks) ──
  window.addEventListener('beforeunload', function () {
    if (animFrameId) cancelAnimationFrame(animFrameId);
  });

  // ── Pause when not visible (performance) ──
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (animFrameId) {
        cancelAnimationFrame(animFrameId);
        animFrameId = null;
      }
    } else {
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(render);
      }
    }
  });

  // ── Respond to reduced motion changes at runtime ──
  prefersReducedMotion.addEventListener('change', function (e) {
    if (e.matches) {
      if (animFrameId) cancelAnimationFrame(animFrameId);
      animFrameId = null;
      scene.style.transform = '';
      ctx.clearRect(0, 0, canvasW, canvasH);
    } else {
      if (!animFrameId) {
        animFrameId = requestAnimationFrame(render);
      }
    }
  });
})();
