/* ============================================================
   CELEBRATION EFFECTS — Confetti + Glow + Particles
   ============================================================ */

const CelebrationFX = (() => {
  let canvas, ctx;

  function ensureCanvas() {
    if (canvas) return;
    canvas = document.createElement('canvas');
    canvas.id = 'fx-canvas';
    Object.assign(canvas.style, {
      position: 'fixed', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '9999'
    });
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
  }

  /* ---- Confetti ---- */
  function confetti(x, y, count = 40) {
    ensureCanvas();
    const colors = ['#c4724a','#4a8c6a','#c49234','#5a7fa8','#d4783e','#7aaa5a'];
    const particles = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
      const speed = 3 + Math.random() * 5;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 2,
        w: 4 + Math.random() * 4, h: 3 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360, spin: (Math.random() - 0.5) * 12,
        gravity: 0.12 + Math.random() * 0.06, life: 1, decay: 0.012 + Math.random() * 0.008
      });
    }
    animateParticles(particles, p => {
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
      p.vx *= 0.99; p.rotation += p.spin; p.life -= p.decay;
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
  }

  /* ---- Rising sparkles ---- */
  function sparkles(x, y, count = 14) {
    ensureCanvas();
    const particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x + (Math.random() - 0.5) * 80, y: y + Math.random() * 20,
        vy: -(1.5 + Math.random() * 2.5), vx: (Math.random() - 0.5) * 1.2,
        r: 1.5 + Math.random() * 2.5, life: 1,
        decay: 0.015 + Math.random() * 0.01,
        color: Math.random() > 0.5 ? '#c4724a' : '#c49234'
      });
    }
    animateParticles(particles, p => {
      p.x += p.vx; p.y += p.vy; p.life -= p.decay;
      p.vx += (Math.random() - 0.5) * 0.1;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.fill();
      // Glow
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.life * 2.5, 0, Math.PI * 2);
      ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life * 0.2); ctx.fill();
    });
  }

  /* ---- Shared animation loop ---- */
  function animateParticles(particles, drawFn) {
    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const alive = [];
      for (const p of particles) {
        if (p.life > 0) { drawFn(p); alive.push(p); }
      }
      if (alive.length > 0) { particles.length = 0; particles.push(...alive); requestAnimationFrame(frame); }
      else { ctx.clearRect(0, 0, canvas.width, canvas.height); }
    }
    requestAnimationFrame(frame);
  }

  /* ---- Glow pulse on element ---- */
  function glowPulse(el) {
    if (!el) return;
    el.classList.add('fx-glow');
    el.addEventListener('animationend', () => el.classList.remove('fx-glow'), { once: true });
  }

  /* ---- Success checkmark overlay ---- */
  function checkmark(x, y) {
    const el = document.createElement('div');
    el.className = 'fx-check';
    el.innerHTML = `<svg viewBox="0 0 40 40" width="48" height="48"><circle cx="20" cy="20" r="18" fill="#4a8c6a" opacity="0.15"/><path d="M12 20l6 6 11-12" fill="none" stroke="#4a8c6a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><animate attributeName="stroke-dashoffset" from="30" to="0" dur="0.4s" fill="freeze"/><set attributeName="stroke-dasharray" to="30"/></path></svg>`;
    Object.assign(el.style, {
      position: 'fixed', left: (x - 24) + 'px', top: (y - 24) + 'px',
      zIndex: '10000', pointerEvents: 'none', animation: 'fxCheckPop 0.6s var(--ease) forwards'
    });
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 700);
  }

  /* ---- Combo: all effects together ---- */
  function celebrate(targetEl) {
    if (!targetEl) return;
    const rect = targetEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    glowPulse(targetEl);
    confetti(cx, cy, 35);
    sparkles(cx, cy - 30, 12);
    checkmark(cx, cy - 40);
  }

  return { confetti, sparkles, glowPulse, checkmark, celebrate };
})();
