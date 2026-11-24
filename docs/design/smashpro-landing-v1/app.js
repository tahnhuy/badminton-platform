/*
 * SmashPro landing prototype v1. Static content only: no API calls, no
 * invented statistics. Level names and descriptions mirror matrix §1.2; in the
 * React page they come from GET /api/v1/skill-levels. The match card in the
 * hero is an illustration of the product, not real data.
 */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.remove('no-js');

  const LEVELS = [
    { name: 'Mới chơi', description: 'Mới làm quen; chủ yếu cố đưa cầu qua lưới; chưa giữ được cầu qua lại ổn định' },
    { name: 'Yếu', description: 'Đánh qua lại được ở tốc độ chậm; kỹ thuật cơ bản chưa vững; di chuyển chưa hiệu quả, hay đứng sai vị trí' },
    { name: 'Trung bình yếu', description: 'Thực hiện được phông, bỏ nhỏ, đập cầu ở mức nhất định nhưng chưa kiểm soát lực và điểm rơi; dễ tự đánh hỏng khi đối phương tăng tốc' },
    { name: 'Trung bình', description: 'Kỹ thuật cơ bản tương đối đều; duy trì pha cầu ổn định hơn; chơi đôi hiểu vị trí; độ ổn định chưa đồng đều giữa các kỹ thuật' },
    { name: 'Trung bình khá', description: 'Kỹ thuật vững, ít lỗi tự đánh hỏng; phối hợp đôi tốt; bắt đầu vận dụng chiến thuật có chủ đích' },
    { name: 'Khá', description: 'Kỹ thuật toàn diện, độ ổn định cao; đọc trận đấu và điều chỉnh chiến thuật theo đối thủ; người chơi phong trào năng lực cao' },
    { name: 'Giỏi', description: 'Kỹ thuật chuyên sâu, chính xác ngay cả dưới áp lực; chủ động công thủ tốc độ cao; thường đã có thành tích thi đấu (bao gồm cả bán chuyên và chuyên nghiệp)' },
  ];

  const header = document.getElementById('site-header');
  const hero = document.getElementById('top');
  const progress = document.getElementById('scroll-progress');

  /* ---------- header: transparent over the hero, frosted after it; scroll progress ---------- */
  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const heroBottom = hero.getBoundingClientRect().bottom;
      header.classList.toggle('on-dark', heroBottom > header.offsetHeight + 4);
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.setProperty('--p', max > 0 ? (scrollY / max).toFixed(4) : 0);
      ticking = false;
    });
  }
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);

  /* ---------- active nav link: none while the hero is in view ---------- */
  const navLinks = [...document.querySelectorAll('.site-nav a')];
  const targets = [hero, ...navLinks.map(link => document.querySelector(link.getAttribute('href')))];
  const setActive = id => navLinks.forEach(link => {
    const active = link.getAttribute('href') === `#${id}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
  });
  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) setActive(entry.target === hero ? null : entry.target.id); });
  }, { rootMargin: '-45% 0px -50% 0px' });
  targets.forEach(target => target && navObserver.observe(target));

  /* ---------- reveal on scroll (staggered inside a group) ---------- */
  const reveals = [...document.querySelectorAll('.reveal')];
  const steps = document.getElementById('steps');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('in'));
    steps.classList.add('play');
  } else {
    reveals.forEach(el => {
      const group = [...el.parentElement.children].filter(child => child.classList.contains('reveal'));
      el.style.setProperty('--d', `${group.indexOf(el) * 90}ms`);
    });
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .18 });
    reveals.forEach(el => revealObserver.observe(el));
    new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      steps.classList.add('play');
      observer.disconnect();
    }, { threshold: .35 }).observe(steps);
  }

  /* ---------- hero parallax + feature-card spotlight (fine pointers only) ---------- */
  const court = document.getElementById('hero-court');
  const finePointer = matchMedia('(pointer: fine)').matches;
  if (!reduceMotion && finePointer) {
    hero.addEventListener('pointermove', event => {
      const box = hero.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - .5;
      const y = (event.clientY - box.top) / box.height - .5;
      court.style.transform = `translate(${x * -16}px, ${y * -10}px) rotate(${x * 1.5}deg)`;
    });
    hero.addEventListener('pointerleave', () => { court.style.transform = ''; });
    document.querySelectorAll('.feature-card').forEach(card => {
      card.addEventListener('pointermove', event => {
        const box = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${event.clientX - box.left}px`);
        card.style.setProperty('--my', `${event.clientY - box.top}px`);
      });
    });
  }
  if (reduceMotion) document.querySelectorAll('animateMotion').forEach(node => node.remove());

  /* ---------- illustrative match card: the open slot fills, then resets ---------- */
  const card = document.getElementById('match-card');
  const status = document.getElementById('mc-status');
  const statusText = status.querySelector('.txt');
  function setFull(full) {
    card.classList.toggle('full', full);
    statusText.textContent = full ? 'Đủ người ✓' : 'Còn 1 chỗ';
    if (!reduceMotion) { status.classList.remove('swap'); void status.offsetWidth; status.classList.add('swap'); }
  }
  if (reduceMotion) {
    setFull(false);
  } else {
    setTimeout(() => {
      setFull(true);
      setInterval(() => {
        setFull(false);
        setTimeout(() => setFull(true), 2600);
      }, 7000);
    }, 4200);
  }

  /* ---------- seven-level ladder with names; plays a short demo once ---------- */
  const ladder = document.getElementById('ladder');
  const detail = document.getElementById('ladder-detail');
  const rungs = [];
  let selected = 3;
  let userTouched = false;

  function renderDetail(animate) {
    const level = LEVELS[selected];
    detail.innerHTML = `<p class="level-name"><small>Bậc ${selected + 1}/7</small>${level.name}</p><p>${level.description}</p>`;
    if (animate && !reduceMotion) { detail.classList.remove('swap'); void detail.offsetWidth; detail.classList.add('swap'); }
  }
  function select(index, { focus = false, animate = true } = {}) {
    selected = index;
    rungs.forEach((rung, i) => {
      rung.setAttribute('aria-checked', String(i === index));
      rung.tabIndex = i === index ? 0 : -1;
    });
    if (focus) rungs[index].focus();
    renderDetail(animate);
  }

  LEVELS.forEach((level, index) => {
    const wrap = document.createElement('div');
    wrap.className = 'rung-wrap';
    const rung = document.createElement('button');
    rung.type = 'button';
    rung.className = 'rung';
    rung.setAttribute('role', 'radio');
    rung.setAttribute('aria-label', `Bậc ${index + 1}: ${level.name}`);
    rung.style.setProperty('--h', `${28 + index * 10.5}%`);
    rung.style.setProperty('--i', index);
    rung.innerHTML = `<span class="rank">${index + 1}</span>`;
    const name = document.createElement('span');
    name.className = 'rung-name';
    name.setAttribute('aria-hidden', 'true');
    name.textContent = level.name;
    rung.addEventListener('click', () => { userTouched = true; select(index); });
    rung.addEventListener('keydown', event => {
      const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
      let next = null;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = LEVELS.length - 1;
      else if (delta) next = (index + delta + LEVELS.length) % LEVELS.length;
      if (next === null) return;
      event.preventDefault();
      userTouched = true;
      select(next, { focus: true });
    });
    wrap.append(rung, name);
    ladder.appendChild(wrap);
    rungs.push(rung);
  });
  select(selected, { animate: false });

  if (!reduceMotion) {
    ['pointerdown', 'focusin'].forEach(type => ladder.addEventListener(type, () => { userTouched = true; }));
    new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      ladder.classList.add('grow');
      // Short demo: walk up from level 1 to the middle, unless the visitor takes over.
      let step = 0;
      const demo = setInterval(() => {
        if (userTouched || step > 3) { clearInterval(demo); return; }
        select(step);
        step += 1;
      }, 520);
    }, { threshold: .4 }).observe(ladder);
  }

  /* ---------- mobile sticky CTA: shown once the hero CTA scrolls away ---------- */
  const mobileCta = document.getElementById('mobile-cta');
  let heroVisible = true;
  let finalVisible = false;
  const updateMobileCta = () => {
    const show = !heroVisible && !finalVisible;
    mobileCta.classList.toggle('show', show);
    mobileCta.setAttribute('aria-hidden', String(!show));
    mobileCta.querySelectorAll('a').forEach(link => { link.tabIndex = show ? 0 : -1; });
  };
  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; updateMobileCta(); })
    .observe(document.querySelector('[data-cta="hero-primary"]'));
  new IntersectionObserver(([entry]) => { finalVisible = entry.isIntersecting; updateMobileCta(); })
    .observe(document.querySelector('[data-cta="final"]'));
})();
