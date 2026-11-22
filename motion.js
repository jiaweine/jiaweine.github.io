(() => {
  'use strict';

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!finePointer || reducedMotion) return;

  const root = document.documentElement;
  const hero = document.querySelector('.hero');
  if (!hero) return;

  root.classList.add('motion-enabled');

  const make = (className, parent = document.body) => {
    const node = document.createElement('div');
    node.className = className;
    node.setAttribute('aria-hidden', 'true');
    parent.appendChild(node);
    return node;
  };

  const ambient = make('motion-ambient');
  const ring = make('motion-cursor-ring');
  const dot = make('motion-cursor-dot');
  const target = { x: innerWidth / 2, y: innerHeight / 2 };
  const ringPosition = { x: target.x, y: target.y };
  const lightPosition = { x: target.x, y: target.y };
  let pointerFrame = 0;
  let pointerActive = false;

  const moveTo = (element, x, y) => {
    element.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) translate(-50%,-50%)';
  };

  function animatePointer() {
    pointerFrame = 0;
    if (!pointerActive || document.hidden) return;

    ringPosition.x += (target.x - ringPosition.x) * 0.22;
    ringPosition.y += (target.y - ringPosition.y) * 0.22;
    lightPosition.x += (target.x - lightPosition.x) * 0.085;
    lightPosition.y += (target.y - lightPosition.y) * 0.085;

    moveTo(ring, ringPosition.x, ringPosition.y);
    moveTo(dot, target.x, target.y);
    moveTo(ambient, lightPosition.x, lightPosition.y);

    const remaining = Math.abs(target.x - ringPosition.x) +
      Math.abs(target.y - ringPosition.y) +
      Math.abs(target.x - lightPosition.x) +
      Math.abs(target.y - lightPosition.y);

    if (remaining > 0.35) pointerFrame = requestAnimationFrame(animatePointer);
  }

  const schedulePointer = () => {
    if (!pointerFrame) pointerFrame = requestAnimationFrame(animatePointer);
  };

  document.addEventListener('pointermove', event => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    target.x = event.clientX;
    target.y = event.clientY;
    if (!pointerActive) {
      ringPosition.x = target.x;
      ringPosition.y = target.y;
      lightPosition.x = target.x;
      lightPosition.y = target.y;
      pointerActive = true;
      root.classList.add('motion-pointer-active');
    }
    const hovered = event.target;
    root.classList.toggle('motion-over-link', Boolean(hovered.closest('a,button')));
    root.classList.toggle('motion-over-card', Boolean(hovered.closest('.project,.signal-card,.avatar-stage')));
    schedulePointer();
  }, { passive: true });

  document.addEventListener('pointerout', event => {
    if (event.relatedTarget) return;
    pointerActive = false;
    root.classList.remove('motion-pointer-active', 'motion-over-link', 'motion-over-card');
    if (pointerFrame) cancelAnimationFrame(pointerFrame);
    pointerFrame = 0;
  }, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      root.classList.remove('motion-pointer-active');
      pointerActive = false;
      if (pointerFrame) cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
    }
  });

  const surfaces = document.querySelectorAll('.signal-card, .project, .avatar-stage, .hero-stats > div');
  for (const surface of surfaces) {
    surface.addEventListener('pointermove', event => {
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
      surface.style.setProperty('--glow-x', (x * 100).toFixed(1) + '%');
      surface.style.setProperty('--glow-y', (y * 100).toFixed(1) + '%');
      if (surface.classList.contains('signal-card')) {
        surface.style.setProperty('--tilt-x', ((x - 0.5) * 3.4).toFixed(2) + 'deg');
        surface.style.setProperty('--tilt-y', ((0.5 - y) * 2.8).toFixed(2) + 'deg');
      }
    }, { passive: true });
    surface.addEventListener('pointerleave', () => {
      if (surface.classList.contains('signal-card')) {
        surface.style.setProperty('--tilt-x', '0deg');
        surface.style.setProperty('--tilt-y', '0deg');
      }
    });
  }

  const magnetic = document.querySelectorAll('.button, .header-link');
  for (const element of magnetic) {
    element.addEventListener('pointerenter', () => element.classList.remove('motion-releasing'));
    element.addEventListener('pointermove', event => {
      const rect = element.getBoundingClientRect();
      const horizontal = ((event.clientX - rect.left) / rect.width - .5) * 15;
      const vertical = ((event.clientY - rect.top) / rect.height - .5) * 11;
      element.style.setProperty('--mag-x', horizontal.toFixed(1) + 'px');
      element.style.setProperty('--mag-y', vertical.toFixed(1) + 'px');
    }, { passive: true });
    element.addEventListener('pointerleave', () => {
      element.classList.add('motion-releasing');
      element.style.setProperty('--mag-x', '0px');
      element.style.setProperty('--mag-y', '0px');
    });
    element.addEventListener('click', event => {
      const rect = element.getBoundingClientRect();
      const ripple = make('motion-ripple', element);
      ripple.style.left = (event.clientX ? event.clientX - rect.left : rect.width / 2) + 'px';
      ripple.style.top = (event.clientY ? event.clientY - rect.top : rect.height / 2) + 'px';
      ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
    });
  }

  const title = hero.querySelector('.hero-title-accent');
  hero.addEventListener('pointermove', event => {
    if (!title) return;
    const rect = hero.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    title.style.setProperty('--title-shift', (35 + ratio * 38).toFixed(1) + '%');
  }, { passive: true });

  // A restrained, canvas-based constellation follows the pointer inside the hero.
  const canvas = document.createElement('canvas');
  canvas.className = 'motion-field';
  canvas.setAttribute('aria-hidden', 'true');
  hero.prepend(canvas);
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    canvas.remove();
    return;
  }

  const field = { width: 0, height: 0, inside: false, x: 0, y: 0 };
  let nodes = [];
  let fieldVisible = true;
  let fieldFrame = 0;
  let lastDraw = 0;

  function resizeField() {
    const rect = hero.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    if (!width || !height) return;
    const dpr = Math.min(devicePixelRatio || 1, 1.6);
    field.width = width;
    field.height = height;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    let seed = 91753;
    const random = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const count = Math.min(58, Math.max(28, Math.round(width * height / 26000)));
    nodes = Array.from({ length: count }, () => ({
      x: .02 + random() * .96,
      y: .04 + random() * .89,
      phase: random() * Math.PI * 2,
      radius: .65 + random() * 1.2,
      drift: 7 + random() * 15
    }));
    if (fieldVisible) requestField();
  }

  function renderField(now) {
    fieldFrame = 0;
    if (!fieldVisible || document.hidden || innerWidth <= 720) return;
    if (now - lastDraw < 29) {
      fieldFrame = requestAnimationFrame(renderField);
      return;
    }
    lastDraw = now;
    const t = now * .00026;
    ctx.clearRect(0, 0, field.width, field.height);

    const points = nodes.map(node => {
      let x = node.x * field.width + Math.sin(t + node.phase) * node.drift;
      let y = node.y * field.height + Math.cos(t * .8 + node.phase) * node.drift * .65;
      let proximity = 0;
      if (field.inside) {
        const dx = field.x - x;
        const dy = field.y - y;
        const distance = Math.hypot(dx, dy);
        proximity = Math.max(0, 1 - distance / 235);
        x += dx * proximity * .085;
        y += dy * proximity * .085;
      }
      return { x, y, radius: node.radius, proximity };
    });

    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      for (let j = i + 1; j < points.length; j++) {
        const b = points[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist > 145) continue;
        const strength = (1 - dist / 145) * (0.065 + (a.proximity + b.proximity) * .12);
        ctx.strokeStyle = 'rgba(173,224,211,' + strength.toFixed(3) + ')';
        ctx.lineWidth = .7;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      const alpha = .16 + a.proximity * .46;
      ctx.fillStyle = 'rgba(201,240,225,' + alpha.toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(a.x, a.y, a.radius + a.proximity * .55, 0, Math.PI * 2);
      ctx.fill();
      if (a.proximity > .55) {
        ctx.strokeStyle = 'rgba(185,239,221,' + ((a.proximity - .5) * .20).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(a.x, a.y, 5 + a.proximity * 4, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    fieldFrame = requestAnimationFrame(renderField);
  }

  function requestField() {
    if (fieldVisible && !fieldFrame && innerWidth > 720 && !document.hidden) {
      fieldFrame = requestAnimationFrame(renderField);
    }
  }

  function stopField() {
    if (fieldFrame) cancelAnimationFrame(fieldFrame);
    fieldFrame = 0;
  }

  hero.addEventListener('pointermove', event => {
    const rect = hero.getBoundingClientRect();
    field.inside = true;
    field.x = event.clientX - rect.left;
    field.y = event.clientY - rect.top;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { field.inside = false; }, { passive: true });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      fieldVisible = entries.some(entry => entry.isIntersecting);
      if (fieldVisible) requestField();
      else stopField();
    }, { rootMargin: '80px' });
    observer.observe(hero);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopField();
    else requestField();
  });
  addEventListener('resize', () => {
    stopField();
    resizeField();
  }, { passive: true });

  resizeField();
  requestField();
})();
