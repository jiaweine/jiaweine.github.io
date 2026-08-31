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

    const shadow = document.createElement('div');
    shadow.className = 'avatar-soft-shadow';
    shadow.setAttribute('aria-hidden', 'true');

    const wrap = document.createElement('div');
    wrap.className = 'avatar-photo-wrap';

    const img = document.createElement('img');
    img.className = 'avatar-photo-safe';
    img.src = './assets/digital-human.webp?v=25d-safe-1';
    img.alt = 'Digital portrait of Jiawei Wang wearing white headphones';
    img.width = 768;
    img.height = 1024;
    img.decoding = 'async';
    img.fetchPriority = 'high';
    wrap.appendChild(img);

    const light = document.createElement('div');
    light.className = 'avatar-light-field';
    light.setAttribute('aria-hidden', 'true');

    stage.prepend(depth, shadow, wrap, light);
  }

  const topMeta = shell.querySelectorAll('.avatar-meta-top span');
  const bottomMeta = shell.querySelectorAll('.avatar-meta-bottom span');
  if (topMeta[1]) topMeta[1].textContent = 'STABLE 2.5D PORTRAIT';
  if (bottomMeta[0]) bottomMeta[0].textContent = 'MOVE POINTER — SOFT DEPTH ONLY';
  if (bottomMeta[1]) bottomMeta[1].textContent = 'NO BLINK · NO FACE WARP';
  const live = stage.querySelector('.live-chip span');
  if (live) live.textContent = '2.5D / STABLE';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  const state = { x: 0, y: 0, tx: 0, ty: 0, last: performance.now(), active: false };
  const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

  if (finePointer && !reduceMotion) {
    stage.addEventListener('pointerenter', () => {
      state.active = true;
      stage.classList.add('is-pointer');
    }, { passive: true });

    stage.addEventListener('pointermove', (event) => {
      const r = stage.getBoundingClientRect();
      state.tx = Math.max(-1, Math.min(1, ((event.clientX - r.left) / r.width - 0.5) * 2));
      state.ty = Math.max(-1, Math.min(1, ((event.clientY - r.top) / r.height - 0.5) * 2));
    }, { passive: true });

    stage.addEventListener('pointerleave', () => {
      state.active = false;
      state.tx = 0;
      state.ty = 0;
      stage.classList.remove('is-pointer');
    }, { passive: true });
  }

  let visible = true;
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
    }, { rootMargin: '120px' });
    io.observe(stage);
  }

  const tick = (now) => {
    requestAnimationFrame(tick);
    if (document.hidden || !visible || reduceMotion) {
      state.last = now;
      return;
    }
    const dt = Math.min(0.04, Math.max(0.001, (now - state.last) / 1000));
    state.last = now;

    state.x = damp(state.x, state.tx, state.active ? 6.8 : 3.1, dt);
    state.y = damp(state.y, state.ty, state.active ? 6.8 : 3.1, dt);

    const idle = state.active ? 0 : Math.sin(now * 0.00032) * 0.055;
    const idleY = state.active ? 0 : Math.sin(now * 0.00027 + 1.1) * 0.035;
    const x = state.x + idle;
    const y = state.y + idleY;

    stage.style.setProperty('--px', x.toFixed(4));
    stage.style.setProperty('--py', y.toFixed(4));
    stage.style.setProperty('--depth-x', (x * 0.72).toFixed(4));
    stage.style.setProperty('--depth-y', (y * 0.72).toFixed(4));
  };

  requestAnimationFrame(tick);
}
