(() => {
  const shell = document.querySelector('[data-avatar-shell]');
  const stage = shell?.querySelector('.avatar-stage');
  if (!shell || !stage) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  const hero = shell.closest('.hero') || stage;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

  const assets = [
    { url: './assets/avatar/avatar.webm?v=video-hybrid-1', type: 'video/webm' },
    { url: './assets/avatar/avatar.mp4?v=video-hybrid-1', type: 'video/mp4' }
  ];

  const probe = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    try {
      const response = await fetch(url, { method: 'HEAD', cache: 'no-store', signal: controller.signal });
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  const initVideoMode = async () => {
    const results = await Promise.all(assets.map(async (asset) => ({ ...asset, ok: await probe(asset.url) })));
    const available = results.filter((asset) => asset.ok);
    if (!available.length) {
      stage.classList.add('video-avatar-fallback-mode');
      const topMeta = shell.querySelectorAll('.avatar-meta-top span');
      if (topMeta[1]) topMeta[1].textContent = 'MULTI-VIEW / VIDEO READY';
      return;
    }

    const backplate = document.createElement('div');
    backplate.className = 'va-video-backplate';
    backplate.setAttribute('aria-hidden', 'true');

    const wrap = document.createElement('div');
    wrap.className = 'va-video-shell';

    const video = document.createElement('video');
    video.className = 'va-video';
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.autoplay = !reduceMotion;
    video.preload = 'metadata';
    video.poster = './assets/digital-human.webp?v=video-hybrid-1';
    video.setAttribute('aria-label', 'Looping digital human portrait animation');

    available.forEach((asset) => {
      const source = document.createElement('source');
      source.src = asset.url;
      source.type = asset.type;
      video.appendChild(source);
    });

    wrap.appendChild(video);

    const light = document.createElement('div');
    light.className = 'va-video-light';
    light.setAttribute('aria-hidden', 'true');

    const hud = document.createElement('div');
    hud.className = 'va-video-hud';
    hud.setAttribute('aria-hidden', 'true');
    hud.innerHTML = '<div><div>POINTER ATTENTION / INERTIAL RESPONSE</div><div class="va-signal"></div></div><span>VIDEO LOOP · FACE PIXELS LOCKED</span>';

    stage.prepend(backplate, wrap, light);
    stage.appendChild(hud);

    const state = {
      x: 0, y: 0, tx: 0, ty: 0,
      energy: 0, targetEnergy: 0,
      focus: 0, targetFocus: 0,
      lastX: 0, lastY: 0, lastPointerTime: performance.now(),
      lastFrame: performance.now(), active: false
    };

    const activate = () => {
      stage.classList.add('video-avatar-active');
      const topMeta = shell.querySelectorAll('.avatar-meta-top span');
      const bottomMeta = shell.querySelectorAll('.avatar-meta-bottom span');
      if (topMeta[1]) topMeta[1].textContent = 'VIDEO LOOP / POINTER ATTENTION';
      if (bottomMeta[0]) bottomMeta[0].textContent = 'MOVE POINTER — PERSPECTIVE · LIGHT · DEPTH';
      if (bottomMeta[1]) bottomMeta[1].textContent = 'FACE PIXELS LOCKED';
      const chip = stage.querySelector('.live-chip span');
      if (chip) chip.textContent = 'VIDEO / LIVE';
      if (!reduceMotion) video.play().catch(() => {});
    };

    const fallback = () => {
      stage.classList.remove('video-avatar-active', 'is-video-tracking');
      video.pause();
    };

    video.addEventListener('canplay', activate, { once: true });
    video.addEventListener('error', fallback);

    if (finePointer && !reduceMotion) {
      hero.addEventListener('pointermove', (event) => {
        const rect = stage.getBoundingClientRect();
        const nx = clamp(((event.clientX - rect.left) / rect.width - .5) * 2, -1, 1);
        const ny = clamp(((event.clientY - rect.top) / rect.height - .5) * 2, -1, 1);

        const now = performance.now();
        const dt = Math.max(8, now - state.lastPointerTime);
        const dx = event.clientX - state.lastX;
        const dy = event.clientY - state.lastY;
        const velocity = Math.sqrt(dx * dx + dy * dy) / dt;

        state.tx = nx;
        state.ty = ny;
        state.targetEnergy = clamp(velocity / 1.35, 0, 1);

        // Face zone is slightly above center. Near-face pointer raises scale very subtly.
        const fx = nx;
        const fy = ny + .18;
        const dist = Math.sqrt(fx * fx + fy * fy);
        state.targetFocus = clamp(1 - dist / .72, 0, 1);

        state.active = true;
        state.lastX = event.clientX;
        state.lastY = event.clientY;
        state.lastPointerTime = now;
        stage.classList.add('is-video-tracking');
      }, { passive: true });

      hero.addEventListener('pointerleave', () => {
        state.active = false;
        state.tx = 0;
        state.ty = 0;
        state.targetFocus = 0;
        state.targetEnergy = 0;
        stage.classList.remove('is-video-tracking');
      }, { passive: true });
    }

    let visible = true;
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        if (!visible) video.pause();
        else if (!document.hidden && !reduceMotion) video.play().catch(() => {});
      }, { rootMargin: '140px' });
      observer.observe(stage);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) video.pause();
      else if (visible && !reduceMotion) video.play().catch(() => {});
    });

    const tick = (now) => {
      requestAnimationFrame(tick);
      const dt = Math.min(.04, Math.max(.001, (now - state.lastFrame) / 1000));
      state.lastFrame = now;

      if (reduceMotion) {
        stage.style.setProperty('--va-x', '0');
        stage.style.setProperty('--va-y', '0');
        stage.style.setProperty('--va-energy', '0');
        stage.style.setProperty('--va-focus', '0');
        return;
      }

      // Head/container motion stays deliberately slower than light/HUD response.
      state.x = damp(state.x, state.tx, state.active ? 4.1 : 2.4, dt);
      state.y = damp(state.y, state.ty, state.active ? 3.7 : 2.2, dt);
      state.energy = damp(state.energy, state.targetEnergy, state.active ? 9.5 : 4.2, dt);
      state.focus = damp(state.focus, state.targetFocus, 5.5, dt);
      state.targetEnergy *= Math.exp(-5.2 * dt);

      stage.style.setProperty('--va-x', state.x.toFixed(4));
      stage.style.setProperty('--va-y', state.y.toFixed(4));
      stage.style.setProperty('--va-energy', state.energy.toFixed(4));
      stage.style.setProperty('--va-focus', state.focus.toFixed(4));
    };

    requestAnimationFrame(tick);
    video.load();
  };

  initVideoMode().catch(() => {
    stage.classList.add('video-avatar-fallback-mode');
  });
})();
