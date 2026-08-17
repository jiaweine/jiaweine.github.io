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
    }, { threshold: .12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i % 3, 2) * 55}ms`;
      observer.observe(el);
    });
  } else reveals.forEach((el) => el.classList.add('visible'));

  const topbar = document.querySelector('.topbar');
  const onScroll = () => topbar?.classList.toggle('scrolled', scrollY > 36);
  onScroll(); addEventListener('scroll', onScroll, { passive: true });

  const sections = [...document.querySelectorAll('section[id]')];
  const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
  if ('IntersectionObserver' in window) {
    const navObserver = new IntersectionObserver((entries) => {
      const active = entries.filter(e => e.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
      if (!active) return;
      navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${active.target.id}`));
    }, { rootMargin: '-25% 0px -60%', threshold: [0,.15,.35] });
    sections.forEach(s => navObserver.observe(s));
  }

  if (!reduceMotion && matchMedia('(pointer:fine)').matches) {
    document.querySelectorAll('.project').forEach((project) => {
      project.addEventListener('pointermove', (e) => {
        const r = project.getBoundingClientRect();
        const x = (e.clientX-r.left)/r.width-.5;
        project.style.setProperty('--pointer-x', x.toFixed(2));
      });
    });
  }
})();
