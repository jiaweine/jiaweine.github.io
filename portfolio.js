(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveals = [...document.querySelectorAll('.reveal')];

  const revealAnchorTarget = () => {
    if (!location.hash) return;
    let target = null;
    try { target = document.querySelector(location.hash); } catch (_) { return; }
    if (!target) return;
    if (target.classList.contains('reveal')) target.classList.add('visible');
    target.querySelectorAll?.('.reveal').forEach((el) => el.classList.add('visible'));
  };

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

    requestAnimationFrame(() => requestAnimationFrame(revealAnchorTarget));
    addEventListener('hashchange', () => requestAnimationFrame(revealAnchorTarget), { passive: true });
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  const topbar = document.querySelector('.topbar');
  const sections = [...document.querySelectorAll('section[id]')];
  const navLinks = [...document.querySelectorAll('.nav a[href^="#"]')];
  let ticking = false;

  const updateChrome = () => {
    topbar?.classList.toggle('scrolled', scrollY > 28);
    if (sections.length && navLinks.length) {
      const probe = innerHeight * .32;
      let current = sections[0];
      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= probe) current = section;
      });
      navLinks.forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === `#${current.id}`);
      });
    }
    ticking = false;
  };

  const requestChromeUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(updateChrome);
  };
  updateChrome();
  addEventListener('scroll', requestChromeUpdate, { passive: true });
  addEventListener('resize', requestChromeUpdate, { passive: true });

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
