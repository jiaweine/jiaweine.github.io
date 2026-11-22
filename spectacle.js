(() => {
  'use strict';

  const hero = document.querySelector('.hero');
  const avatar = document.querySelector('.avatar-column');
  const stage = avatar?.querySelector('.avatar-stage');
  if (!hero || !stage) return;

  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerPreference = matchMedia('(hover: hover) and (pointer: fine)');
  if (motionPreference.matches) return;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const reducedLayout = () => innerWidth <= 720 || !pointerPreference.matches;
  const target = { x: .7, y: .48, inside: false };
  const smoothed = { x: .7, y: .48 };
  const make = (tag, className, parent) => {
    const element = document.createElement(tag);
    element.className = className;
    if (parent) parent.appendChild(element);
    return element;
  };

  // A small fixed chapter meter provides orientation during long scrolls.
  const chapters = [
    hero,
    document.getElementById('profile'),
    document.getElementById('work'),
    document.getElementById('systems'),
    document.querySelector('.principle-section')
  ].filter(Boolean);

  if (chapters.length > 1) {
    const meter = make('div', 'chapter-meter', document.body);
    meter.setAttribute('aria-hidden', 'true');
    const ticks = chapters.map(() => make('span', '', meter));
    let scrollFrame = 0;

    const updateChapter = () => {
      scrollFrame = 0;
      const pivot = innerHeight * .48;
      let active = 0;
      chapters.forEach((section, index) => {
        if (section.getBoundingClientRect().top <= pivot) active = index;
      });
      ticks.forEach((tick, index) => tick.classList.toggle('is-active', index === active));
    };

    addEventListener('scroll', () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(updateChapter);
    }, { passive: true });
    addEventListener('resize', updateChapter, { passive: true });
    updateChapter();
  }

  // Highlight the engineering method closest to the reading position.
  const milestones = [...document.querySelectorAll('.systems-map article')];
  if (milestones.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          milestones.forEach(item => item.classList.toggle('is-current', item === entry.target));
        }
      }
    }, { rootMargin: '-32% 0px -52% 0px', threshold: 0 });
    milestones.forEach(item => observer.observe(item));
  }

  if (reducedLayout()) return;

  // Depth is deliberately restrained so the video stays legible.
  hero.addEventListener('pointermove', event => {
    const rect = hero.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const nx = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const ny = clamp((event.clientY - rect.top) / rect.height, 0, 1);
    target.x = nx;
    target.y = ny;
    target.inside = true;
    const dx = (nx - .5) * 2;
    const dy = (ny - .5) * 2;
    hero.style.setProperty('--holo-x', (dx * 24).toFixed(1) + 'px');
    hero.style.setProperty('--holo-y', (dy * 17).toFixed(1) + 'px');
    hero.style.setProperty('--orbital-shift-x', (-dx * 7).toFixed(1) + 'px');
    hero.style.setProperty('--orbital-shift-y', (-dy * 5).toFixed(1) + 'px');
    avatar.style.setProperty('--avatar-tilt-x', (dx * 1.9).toFixed(2) + 'deg');
    avatar.style.setProperty('--avatar-tilt-y', (-dy * 1.5).toFixed(2) + 'deg');
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    target.inside = false;
    hero.style.setProperty('--holo-x', '0px');
    hero.style.setProperty('--holo-y', '0px');
    hero.style.setProperty('--orbital-shift-x', '0px');
    hero.style.setProperty('--orbital-shift-y', '0px');
    avatar.style.setProperty('--avatar-tilt-x', '0deg');
    avatar.style.setProperty('--avatar-tilt-y', '0deg');
  }, { passive: true });

  // Tapping a noninteractive part of the hero sends out a short light wave.
  hero.addEventListener('pointerdown', event => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (event.target.closest('a,button')) return;
    const rect = hero.getBoundingClientRect();
    const burst = make('span', 'hero-interaction-burst', hero);
    burst.setAttribute('aria-hidden', 'true');
    burst.style.left = (event.clientX - rect.left).toFixed(1) + 'px';
    burst.style.top = (event.clientY - rect.top).toFixed(1) + 'px';
    burst.addEventListener('animationend', () => burst.remove(), { once: true });
  });

  // Draw a luminous flow field at a capped frame rate and resolution.
  const canvas = make('canvas', 'spectacle-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    canvas.remove();
    return;
  }

  const field = { width: 0, height: 0, visible: true, frame: 0, last: 0 };
  let resizeFrame = 0;

  const stop = () => {
    if (field.frame) cancelAnimationFrame(field.frame);
    field.frame = 0;
  };

  const schedule = () => {
    if (!field.frame && field.visible && !document.hidden &&
        !motionPreference.matches && !reducedLayout()) {
      field.frame = requestAnimationFrame(draw);
    }
  };

  const resize = () => {
    resizeFrame = 0;
    stop();
    if (reducedLayout()) return;
    const rect = hero.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (!w || !h) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    field.width = w;
    field.height = h;
    schedule();
  };

  function draw(now) {
    field.frame = 0;
    if (!field.visible || document.hidden || reducedLayout() || motionPreference.matches) return;
    if (now - field.last < 32) {
      schedule();
      return;
    }
    field.last = now;
    const w = field.width, h = field.height;
    if (!w || !h) return;
    const tick = now * .00034;
    smoothed.x += (target.x - smoothed.x) * .06;
    smoothed.y += (target.y - smoothed.y) * .06;
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'screen';

    // Curves live primarily on the right side of the hero, behind the portrait.
    for (let i = 0; i < 12; i++) {
      const phase = tick * (1 + i * .025) + i * .54;
      const upper = h * (.16 + i * .052);
      const amp = 19 + i * 2;
      const opacity = .065 + (i % 3) * .019;
      const paint = ctx.createLinearGradient(w * .24, 0, w * 1.05, 0);
      paint.addColorStop(0, 'rgba(63,225,217,0)');
      paint.addColorStop(.39, 'rgba(86,213,215,' + opacity.toFixed(3) + ')');
      paint.addColorStop(.74, 'rgba(150,162,252,' + (opacity * 1.75).toFixed(3) + ')');
      paint.addColorStop(1, 'rgba(73,233,218,0)');
      ctx.strokeStyle = paint;
      ctx.lineWidth = i % 4 === 0 ? 1.6 : .72;
      ctx.beginPath();
      for (let step = 0; step <= 74; step++) {
        const px = w * (.17 + step / 74 * .9);
        const wave = Math.sin(px * .0072 + phase) * amp +
          Math.cos(px * .0039 - tick * .8 + i * .38) * 25;
        const pointerDist = Math.abs(px - smoothed.x * w);
        const influence = target.inside ?
          Math.exp(-pointerDist / Math.max(180, w * .25)) * (smoothed.y - .5) * 39 : 0;
        const py = upper + wave + influence;
        if (step === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    // A faint orbital signal responds to pointer position without covering type.
    if (target.inside) {
      const centerX = clamp(smoothed.x * w, w * .36, w * .92);
      const centerY = smoothed.y * h;
      for (let i = 0; i < 3; i++) {
        const radius = 65 + i * 54 + Math.sin(tick * 4 + i) * 5;
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radius * 1.35, radius, -.17, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(136,239,226,' + (.12 - i * .03).toFixed(3) + ')';
        ctx.lineWidth = .8;
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    schedule();
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      field.visible = entries.some(entry => entry.isIntersecting);
      if (field.visible) schedule();
      else stop();
    }, { rootMargin: '80px 0px' });
    observer.observe(hero);
  }
  const scheduleResize = () => {
    if (!resizeFrame) resizeFrame = requestAnimationFrame(resize);
  };
  addEventListener('resize', scheduleResize, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else schedule();
  });
  if (motionPreference.addEventListener) {
    motionPreference.addEventListener('change', () => {
      if (motionPreference.matches) stop();
      else scheduleResize();
    });
  }
  resize();
})();
