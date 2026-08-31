(() => {
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer:fine)').matches;
  const hero = document.querySelector('.hero');
  const heroCopy = document.querySelector('.hero-copy');

  if (hero && !hero.querySelector('.fx-network')) {
    const network = document.createElement('div');
    network.className = 'fx-network';
    network.setAttribute('aria-hidden', 'true');

    const points = [
      [8,18],[18,39],[31,22],[43,48],[55,16],[67,37],[79,20],[91,44],
      [14,70],[28,61],[47,77],[63,66],[75,82],[88,68]
    ];
    points.forEach(([x,y], i) => {
      const node = document.createElement('i');
      node.className = 'fx-node';
      node.style.left = `${x}%`;
      node.style.top = `${y}%`;
      node.style.animationDelay = `${-(i % 6) * .72}s`;
      network.appendChild(node);
    });

    const links = [[0,1],[1,2],[2,3],[3,5],[4,5],[5,6],[6,7],[1,8],[8,9],[9,10],[10,11],[11,12],[12,13],[5,11],[7,13]];
    links.forEach(([a,b], i) => {
      const [x1,y1] = points[a];
      const [x2,y2] = points[b];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx,dy);
      const angle = Math.atan2(dy,dx) * 180 / Math.PI;
      const line = document.createElement('span');
      line.className = 'fx-line';
      line.style.left = `${x1}%`;
      line.style.top = `${y1}%`;
      line.style.width = `${len}%`;
      line.style.transform = `rotate(${angle}deg)`;
      line.style.animationDelay = `${-(i % 5) * .9}s`;
      network.appendChild(line);
    });

    const scan = document.createElement('b');
    scan.className = 'fx-scan';
    network.appendChild(scan);
    hero.prepend(network);
  }

  if (heroCopy && !heroCopy.querySelector('.hero-instruments')) {
    const instruments = document.createElement('div');
    instruments.className = 'hero-instruments reveal';
    instruments.setAttribute('aria-label', 'Current research signals');
    const data = [
      ['01 / EVAL', 'INFERENCE · EVALUATION'],
      ['02 / FUSION', 'MULTIMODAL · REPRESENTATION'],
      ['03 / RUNTIME', 'AGENTS · VERIFICATION']
    ];
    instruments.innerHTML = data.map(([k,label], idx) => `
      <div class="instrument">
        <div class="instrument-head"><span>${k}</span><i></i></div>
        <strong>${label}</strong>
        <div class="instrument-bars" aria-hidden="true">${Array.from({length:8},(_,i)=>`<b style="height:${28 + ((i * 17 + idx * 13) % 66)}%"></b>`).join('')}</div>
      </div>`).join('');
    heroCopy.appendChild(instruments);
  }

  document.querySelectorAll('.section').forEach((section, i) => {
    if (!section.querySelector('.section-orbit')) {
      const orbit = document.createElement('div');
      orbit.className = 'section-orbit';
      orbit.setAttribute('aria-hidden', 'true');
      orbit.style.transform = `rotate(${i * 37}deg)`;
      section.appendChild(orbit);
    }
    if (!section.querySelector('.section-rail')) {
      const rail = document.createElement('div');
      rail.className = 'section-rail';
      rail.setAttribute('aria-hidden', 'true');
      rail.style.opacity = `${Math.max(.35,.8 - i * .08)}`;
      section.appendChild(rail);
    }
  });

  if (finePointer && !reduceMotion && !document.querySelector('.fx-cursor')) {
    const halo = document.createElement('div');
    halo.className = 'fx-cursor';
    halo.setAttribute('aria-hidden', 'true');
    document.body.appendChild(halo);
    let tx = innerWidth * .5, ty = innerHeight * .5, x = tx, y = ty;
    addEventListener('pointermove', (e) => { tx = e.clientX; ty = e.clientY; }, {passive:true});
    const loop = () => {
      x += (tx - x) * .10;
      y += (ty - y) * .10;
      document.documentElement.style.setProperty('--cursor-x', `${x.toFixed(1)}px`);
      document.documentElement.style.setProperty('--cursor-y', `${y.toFixed(1)}px`);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  if (!reduceMotion) {
    const visible = [...document.querySelectorAll('.hero-instruments.reveal')];
    requestAnimationFrame(() => visible.forEach(el => el.classList.add('visible')));
  } else {
    document.querySelectorAll('.hero-instruments.reveal').forEach(el => el.classList.add('visible'));
  }
})();
