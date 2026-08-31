const shell = document.querySelector('[data-avatar-shell]');
const stage = shell?.querySelector('.avatar-stage');

if (shell && stage) {
  stage.classList.remove('webgl-ready');
  stage.classList.add('avatar-safe-25d');

  const oldCanvas = stage.querySelector('#avatar3d');
  if (oldCanvas) oldCanvas.replaceChildren();

  const oldFallback = stage.querySelector('.avatar-fallback');
  if (oldFallback) oldFallback.style.display = 'none';

  if (!stage.querySelector('.avatar-depth-back')) {
    const depth = document.createElement('div');
    depth.className = 'avatar-depth-back';
    depth.setAttribute('aria-hidden', 'true');

    const aura = document.createElement('div');
    aura.className = 'avatar-depth-aura';
    aura.setAttribute('aria-hidden', 'true');

    const shadow = document.createElement('div');
    shadow.className = 'avatar-soft-shadow';
    shadow.setAttribute('aria-hidden', 'true');

    const wrap = document.createElement('div');
    wrap.className = 'avatar-photo-wrap';

    const img = document.createElement('img');
    img.className = 'avatar-photo-safe';
    img.src = './assets/digital-human.webp?v=25d-safe-2';
    img.alt = 'Digital portrait of Jiawei Wang wearing white headphones';
    img.width = 768;
    img.height = 1024;
    img.decoding = 'async';
    img.fetchPriority = 'high';
    wrap.appendChild(img);

    const light = document.createElement('div');
    light.className = 'avatar-light-field';
    light.setAttribute('aria-hidden', 'true');

    const sheen = document.createElement('div');
    sheen.className = 'avatar-sheen';
    sheen.setAttribute('aria-hidden', 'true');

    stage.prepend(depth, aura, shadow, wrap, light, sheen);
  }

  const topMeta = shell.querySelectorAll('.avatar-meta-top span');
  const bottomMeta = shell.querySelectorAll('.avatar-meta-bottom span');
  if (topMeta[1]) topMeta[1].textContent = '2.5D DEPTH / INERTIA';
  if (bottomMeta[0]) bottomMeta[0].textContent = 'MOVE POINTER — DEPTH · LIGHT · INERTIA';
  if (bottomMeta[1]) bottomMeta[1].textContent = 'FACE PIXELS LOCKED';
  const live = stage.querySelector('.live-chip span');
  if (live) live.textContent = '2.5D / INTERACTIVE';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

  const state = {
    x: 0, y: 0,
    tx: 0, ty: 0,
    lightX: 0, lightY: 0,
    attention: 0,
    attentionTarget: 0,
    speed: 0,
    active: false,
    lastFrame: performance.now(),
    lastPointerAt: performance.now(),
    lastPointerX: 0,
    lastPointerY: 0
  };

  if (finePointer && !reduceMotion) {
    stage.addEventListener('pointerenter', () => {
      state.active = true;
      state.attentionTarget = 1;
      stage.classList.add('is-pointer');
    }, { passive: true });

    stage.addEventListener('pointermove', (event) => {
      const r = stage.getBoundingClientRect();
      const now = performance.now();
      const nx = clamp(((event.clientX - r.left) / r.width - 0.5) * 2, -1, 1);
      const ny = clamp(((event.clientY - r.top) / r.height - 0.5) * 2, -1, 1);
      const elapsed = Math.max(16, now - state.lastPointerAt) / 1000;
      const instantSpeed = Math.hypot(nx - state.lastPointerX, ny - state.lastPointerY) / elapsed;

      state.speed = Math.max(state.speed, clamp(instantSpeed, 0, 9));
      state.tx = nx;
      state.ty = ny;
      state.lastPointerX = nx;
      state.lastPointerY = ny;
      state.lastPointerAt = now;
    }, { passive: true });

    stage.addEventListener('pointerleave', () => {
      state.active = false;
      state.attentionTarget = 0;
      state.tx = 0;
      state.ty = 0;
      stage.classList.remove('is-pointer');
    }, { passive: true });
  }

  let visible = true;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    }, { rootMargin: '140px' });
    io.observe(stage);
  }

  const tick = (now) => {
    requestAnimationFrame(tick);
    if (document.hidden || !visible || reduceMotion) {
      state.lastFrame = now;
      return;
    }

    const dt = Math.min(0.04, Math.max(0.001, (now - state.lastFrame) / 1000));
    state.lastFrame = now;

    state.attention = damp(state.attention, state.attentionTarget, state.active ? 6.5 : 2.2, dt);
    state.speed = damp(state.speed, 0, 4.6, dt);

    // Fast pointer motion drives light first; the portrait deliberately lags so the face never feels twitchy.
    const responsiveness = 1 - clamp(state.speed / 9, 0, 0.52);
    const targetX = state.tx * responsiveness;
    const targetY = state.ty * responsiveness;

    state.x = damp(state.x, targetX, state.active ? 5.0 : 2.7, dt);
    state.y = damp(state.y, targetY, state.active ? 5.0 : 2.7, dt);
    state.lightX = damp(state.lightX, state.tx, 10.5, dt);
    state.lightY = damp(state.lightY, state.ty, 10.5, dt);

    const t = now * 0.001;
    const idleMix = 1 - state.attention;
    const idleX = Math.sin(t * 0.24) * 0.024 * idleMix;
    const idleY = Math.sin(t * 0.19 + 1.2) * 0.016 * idleMix;
    const breath = (0.5 + 0.5 * Math.sin(t * 1.08)) * idleMix;
    const x = state.x + idleX;
    const y = state.y + idleY;

    stage.style.setProperty('--px', x.toFixed(4));
    stage.style.setProperty('--py', y.toFixed(4));
    stage.style.setProperty('--lx', state.lightX.toFixed(4));
    stage.style.setProperty('--ly', state.lightY.toFixed(4));
    stage.style.setProperty('--attention', state.attention.toFixed(4));
    stage.style.setProperty('--speed', clamp(state.speed / 9, 0, 1).toFixed(4));
    stage.style.setProperty('--breath', breath.toFixed(4));
    stage.style.setProperty('--scroll-depth', clamp(scrollY / Math.max(innerHeight, 1), 0, 1).toFixed(4));
  };

  requestAnimationFrame(tick);
}
