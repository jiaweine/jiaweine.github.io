(() => {
  const shell = document.querySelector('[data-avatar-shell]');
  const stage = shell?.querySelector('.avatar-stage');
  if (!shell || !stage) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  stage.classList.add('avatar-multiview');

  const rig = document.createElement('div');
  rig.className = 'mv-rig';
  rig.setAttribute('aria-hidden', 'true');

  const halo = document.createElement('div');
  halo.className = 'mv-depth-halo';
  halo.setAttribute('aria-hidden', 'true');

  const views = [
    ['left-profile', true],
    ['left-45', true],
    ['front', false],
    ['right-45', true],
    ['right-profile', true]
  ].map(([name, sprite], index) => {
    const el = document.createElement('div');
    el.className = `mv-view${index === 2 ? ' is-active' : ''}`;
    el.dataset.view = name;
    if (sprite) el.dataset.sprite = '1';
    rig.appendChild(el);
    return el;
  });

  const meter = document.createElement('div');
  meter.className = 'mv-angle-meter';
  meter.setAttribute('aria-hidden', 'true');
  meter.innerHTML = '<div class="mv-angle-readout">0° / FRONT</div><div class="mv-angle-track"></div><div class="mv-angle-labels"><span>-90°</span><span>-45°</span><span>0°</span><span>+45°</span><span>+90°</span></div>';

  stage.prepend(halo, rig);
  stage.appendChild(meter);

  const topMeta = shell.querySelectorAll('.avatar-meta-top span');
  const bottomMeta = shell.querySelectorAll('.avatar-meta-bottom span');
  if (topMeta[1]) topMeta[1].textContent = 'MULTI-VIEW / POINTER DRIVEN';
  if (bottomMeta[0]) bottomMeta[0].textContent = 'MOVE POINTER — HEAD TURN · DEPTH · LIGHT';
  if (bottomMeta[1]) bottomMeta[1].textContent = '5 VIEW ATTENTION RIG';
  const chip = stage.querySelector('.live-chip span');
  if (chip) chip.textContent = 'MULTI-VIEW / LIVE';

  const hero = shell.closest('.hero') || stage;
  const state = {
    x: 0,
    y: 0,
    tx: 0,
    ty: 0,
    frame: 2,
    active: false,
    last: performance.now()
  };
  const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const frameFor = (x) => {
    if (x < -.72) return 0;
    if (x < -.22) return 1;
    if (x <= .22) return 2;
    if (x <= .72) return 3;
    return 4;
  };

  const labels = ['LEFT PROFILE', 'LEFT 45°', 'FRONT', 'RIGHT 45°', 'RIGHT PROFILE'];
  const readout = meter.querySelector('.mv-angle-readout');

  const setFrame = (next) => {
    if (next === state.frame) return;
    views[state.frame]?.classList.remove('is-active');
    state.frame = next;
    views[state.frame]?.classList.add('is-active');
  };

  if (finePointer && !reduceMotion) {
    hero.addEventListener('pointermove', (event) => {
      if (stage.classList.contains('video-avatar-active')) return;
      const r = stage.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      state.tx = clamp((event.clientX - cx) / (r.width * .72), -1, 1);
      state.ty = clamp((event.clientY - cy) / (r.height * .7), -1, 1);
      state.active = true;
      stage.classList.add('is-tracking');
    }, { passive: true });

    hero.addEventListener('pointerleave', () => {
      state.active = false;
      state.tx = 0;
      state.ty = 0;
      stage.classList.remove('is-tracking');
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
    if (document.hidden || !visible || reduceMotion || stage.classList.contains('video-avatar-active')) {
      state.last = now;
      return;
    }

    const dt = Math.min(.04, Math.max(.001, (now - state.last) / 1000));
    state.last = now;
    const idleX = state.active ? 0 : Math.sin(now * .0003) * .045;
    const idleY = state.active ? 0 : Math.sin(now * .00022 + 1.3) * .022;
    state.x = damp(state.x, state.tx + idleX, state.active ? 5.8 : 2.7, dt);
    state.y = damp(state.y, state.ty + idleY, state.active ? 5.2 : 2.5, dt);

    const frame = frameFor(state.x);
    setFrame(frame);

    const angle = Math.round(state.x * 82);
    stage.style.setProperty('--mv-x', state.x.toFixed(4));
    stage.style.setProperty('--mv-y', state.y.toFixed(4));
    stage.style.setProperty('--mv-angle', (state.x * 100).toFixed(2));
    if (readout) readout.textContent = `${angle > 0 ? '+' : ''}${angle}° / ${labels[frame]}`;
  };

  requestAnimationFrame(tick);

  // Video-first enhancement: when avatar.webm / avatar.mp4 exists, it replaces
  // the five-view rig automatically. Until then the multiview system remains live.
  if (!document.querySelector('link[data-video-avatar-style]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = './video-avatar.css?v=video-hybrid-1';
    link.dataset.videoAvatarStyle = '1';
    document.head.appendChild(link);
  }
  import('./video-avatar.js?v=video-hybrid-1').catch(() => {});
})();
