(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = [...document.querySelectorAll('.reveal')];

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: .1, rootMargin: '0px 0px -7% 0px' });

    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 45}ms`;
      observer.observe(el);
    });
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  const topbar = document.querySelector('.topbar');
  const updateTopbar = () => topbar?.classList.toggle('scrolled', scrollY > 28);
  updateTopbar();
  addEventListener('scroll', updateTopbar, { passive: true });

  const sections = [...document.querySelectorAll('section[id]')];
  const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!active) return;
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${active.target.id}`));
    }, { rootMargin: '-22% 0px -62%', threshold: [0, .15, .35] });
    sections.forEach((section) => navObserver.observe(section));
  }

  if (!reduceMotion && matchMedia('(pointer:fine)').matches) {
    document.querySelectorAll('.project').forEach((project) => {
      project.addEventListener('pointermove', (event) => {
        const rect = project.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        project.style.setProperty('--pointer-x', x.toFixed(3));
      }, { passive: true });
    });
  }
})();
