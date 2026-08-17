(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px' });
    reveals.forEach((node, index) => {
      node.style.transitionDelay = `${Math.min(index % 4, 3) * 55}ms`;
      observer.observe(node);
    });
  } else {
    reveals.forEach((node) => node.classList.add('visible'));
  }

  const glow = document.querySelector('.cursor-glow');
  if (glow && !reduceMotion && window.matchMedia('(pointer:fine)').matches) {
    let x = innerWidth * .5;
    let y = innerHeight * .35;
    let tx = x;
    let ty = y;
    window.addEventListener('pointermove', (event) => {
      tx = event.clientX;
      ty = event.clientY;
    }, { passive: true });
    const follow = () => {
      x += (tx - x) * .09;
      y += (ty - y) * .09;
      glow.style.left = `${x}px`;
      glow.style.top = `${y}px`;
      requestAnimationFrame(follow);
    };
    follow();
  }

  const stage = document.getElementById('scene');
  const avatar = document.getElementById('avatarScene');
  if (stage && avatar && !reduceMotion && window.matchMedia('(pointer:fine)').matches) {
    stage.addEventListener('pointermove', (event) => {
      const rect = stage.getBoundingClientRect();
      const nx = ((event.clientX - rect.left) / rect.width - .5) * 2;
      const ny = ((event.clientY - rect.top) / rect.height - .5) * 2;
      avatar.style.transform = `rotateX(${-ny * 3.2}deg) rotateY(${nx * 4.5}deg)`;
      stage.style.setProperty('--mx', `${(nx + 1) * 50}%`);
      stage.style.setProperty('--my', `${(ny + 1) * 50}%`);
    });
    stage.addEventListener('pointerleave', () => {
      avatar.style.transform = 'rotateX(0deg) rotateY(0deg)';
    });
  }

  const lines = [...document.querySelectorAll('.screen-code .code')];
  if (lines.length && !reduceMotion) {
    let tick = 0;
    setInterval(() => {
      tick = (tick + 1) % 4;
      lines.forEach((line, index) => {
        if (index === 4) return;
        line.style.opacity = index === tick ? '1' : '.68';
        line.style.transform = index === tick ? 'translateX(2px)' : 'translateX(0)';
        line.style.transition = 'opacity .28s ease, transform .28s ease';
      });
    }, 780);
  }

  const sections = [...document.querySelectorAll('main section[id]')];
  const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
  if (sections.length && navLinks.length && 'IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
      });
    }, { threshold: .18, rootMargin: '-30% 0px -58%' });
    sections.forEach((section) => navObserver.observe(section));
  }

  document.querySelectorAll('.project, .focus-card, .stack-card').forEach((card) => {
    card.addEventListener('pointerdown', () => card.classList.add('pressed'));
    card.addEventListener('pointerup', () => card.classList.remove('pressed'));
    card.addEventListener('pointerleave', () => card.classList.remove('pressed'));
  });
})();
