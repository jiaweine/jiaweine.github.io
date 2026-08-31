(() => {
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  const header = document.querySelector('[data-header]');
  const role = document.querySelector('[data-role]');
  const roles = ['Multimodal AI', 'Search & Recommendation', 'Agent Post-Training', 'Harness Engineering'];
  let roleIndex = 0;

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
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 55}ms`;
      observer.observe(el);
    });
  } else {
    reveals.forEach((el) => el.classList.add('visible'));
  }

  const navLinks = [...document.querySelectorAll('.site-nav a[href^="#"]')];
  const sections = [...document.querySelectorAll('section[id]')];
  if ('IntersectionObserver' in window && navLinks.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!active) return;
      navLinks.forEach((link) => link.classList.toggle('active', link.getAttribute('href') === `#${active.target.id}`));
    }, { rootMargin: '-25% 0px -60%', threshold: [0, .12, .35] });
    sections.forEach((section) => sectionObserver.observe(section));
  }

  let ticking = false;
  const updateScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    root.style.setProperty('--scroll', Math.min(1, scrollY / max).toFixed(4));
    header?.classList.toggle('scrolled', scrollY > 24);

    const systems = document.querySelector('.systems-map');
    const mapLine = systems?.querySelector('.map-line');
    if (systems && mapLine) {
      const rect = systems.getBoundingClientRect();
      const progress = Math.max(0, Math.min(1, (innerHeight * .68 - rect.top) / (rect.height + innerHeight * .25)));
      mapLine.style.transform = `scaleY(${(.18 + progress * 3.1).toFixed(3)})`;
      mapLine.style.transformOrigin = 'top';
    }
    ticking = false;
  };
  addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(updateScroll);
      ticking = true;
    }
  }, { passive: true });
  updateScroll();

  if (role && !reduceMotion) {
    setInterval(() => {
      role.animate([{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(-5px)' }], { duration: 180, fill: 'forwards' }).finished.then(() => {
        roleIndex = (roleIndex + 1) % roles.length;
        role.textContent = roles[roleIndex];
        role.animate([{ opacity: 0, transform: 'translateY(5px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 280, fill: 'forwards' });
      }).catch(() => {});
    }, 2600);
  }

  if (finePointer && !reduceMotion) {
    addEventListener('pointermove', (event) => {
      root.style.setProperty('--mx', ((event.clientX / innerWidth) * 2 - 1).toFixed(3));
      root.style.setProperty('--my', ((event.clientY / innerHeight) * 2 - 1).toFixed(3));
    }, { passive: true });

    document.querySelectorAll('[data-tilt]').forEach((card) => {
      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - .5;
        const y = (event.clientY - rect.top) / rect.height - .5;
        card.style.transform = `perspective(900px) rotateX(${(-y * 2.2).toFixed(2)}deg) rotateY(${(x * 3.6).toFixed(2)}deg) translateZ(0)`;
      }, { passive: true });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });

    document.querySelectorAll('.magnetic').forEach((element) => {
      element.addEventListener('pointermove', (event) => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - (rect.left + rect.width / 2);
        const y = event.clientY - (rect.top + rect.height / 2);
        element.style.transform = `translate(${(x * .08).toFixed(2)}px, ${(y * .08).toFixed(2)}px)`;
      }, { passive: true });
      element.addEventListener('pointerleave', () => { element.style.transform = ''; });
    });
  }
})();
