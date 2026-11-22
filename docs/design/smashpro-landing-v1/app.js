/*
 * SmashPro landing prototype v1. Static content only: no API calls, no
 * invented statistics. Level names and descriptions mirror matrix §1.2; in the
 * React page they come from GET /api/v1/skill-levels.
 */
(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.remove('no-js');

  const LEVELS = [
    { code: 'BEGINNER', name: 'Mới chơi', description: 'Mới làm quen; chủ yếu cố đưa cầu qua lưới; chưa giữ được cầu qua lại ổn định' },
    { code: 'WEAK', name: 'Yếu', description: 'Đánh qua lại được ở tốc độ chậm; kỹ thuật cơ bản chưa vững; di chuyển chưa hiệu quả, hay đứng sai vị trí' },
    { code: 'AVERAGE_MINUS', name: 'Trung bình yếu', description: 'Thực hiện được phông, bỏ nhỏ, đập cầu ở mức nhất định nhưng chưa kiểm soát lực và điểm rơi; dễ tự đánh hỏng khi đối phương tăng tốc' },
    { code: 'AVERAGE', name: 'Trung bình', description: 'Kỹ thuật cơ bản tương đối đều; duy trì pha cầu ổn định hơn; chơi đôi hiểu vị trí; độ ổn định chưa đồng đều giữa các kỹ thuật' },
    { code: 'AVERAGE_PLUS', name: 'Trung bình khá', description: 'Kỹ thuật vững, ít lỗi tự đánh hỏng; phối hợp đôi tốt; bắt đầu vận dụng chiến thuật có chủ đích' },
    { code: 'GOOD', name: 'Khá', description: 'Kỹ thuật toàn diện, độ ổn định cao; đọc trận đấu và điều chỉnh chiến thuật theo đối thủ; người chơi phong trào năng lực cao' },
    { code: 'EXCELLENT', name: 'Giỏi', description: 'Kỹ thuật chuyên sâu, chính xác ngay cả dưới áp lực; chủ động công thủ tốc độ cao; thường đã có thành tích thi đấu (bao gồm cả bán chuyên và chuyên nghiệp)' },
  ];

  /* ---------- sticky header state ---------- */
  const header = document.getElementById('site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- active nav link ---------- */
  const navLinks = [...document.querySelectorAll('.site-nav a')];
  const sections = navLinks.map(link => document.querySelector(link.getAttribute('href')));
  const navObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => {
        const active = link.getAttribute('href') === `#${entry.target.id}`;
        link.classList.toggle('active', active);
        if (active) link.setAttribute('aria-current', 'true'); else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach(section => section && navObserver.observe(section));

  /* ---------- reveal on scroll (staggered inside a group) ---------- */
  const reveals = [...document.querySelectorAll('.reveal')];
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach(el => el.classList.add('in'));
  } else {
    reveals.forEach(el => {
      const siblings = [...el.parentElement.children].filter(child => child.classList.contains('reveal'));
      el.style.setProperty('--d', `${siblings.indexOf(el) * 90}ms`);
    });
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: .18 });
    reveals.forEach(el => revealObserver.observe(el));
  }

  /* ---------- steps connector draws when visible ---------- */
  const steps = document.getElementById('steps');
  new IntersectionObserver(([entry], observer) => {
    if (!entry.isIntersecting) return;
    steps.style.setProperty('--progress', 1);
    observer.disconnect();
  }, { threshold: .4 }).observe(steps);

  /* ---------- hero parallax (pointer, desktop only) ---------- */
  const panel = document.getElementById('hero-panel');
  const court = document.getElementById('hero-court');
  if (!reduceMotion && window.matchMedia('(pointer: fine)').matches) {
    panel.addEventListener('pointermove', event => {
      const box = panel.getBoundingClientRect();
      const x = (event.clientX - box.left) / box.width - .5;
      const y = (event.clientY - box.top) / box.height - .5;
      court.style.transform = `translate(${x * -14}px, ${y * -10}px) rotate(${x * 1.5}deg)`;
    });
    panel.addEventListener('pointerleave', () => { court.style.transform = ''; });
  }
  if (reduceMotion) document.querySelectorAll('animateMotion').forEach(node => node.remove());

  /* ---------- seven-level ladder ---------- */
  const ladder = document.getElementById('ladder');
  const detail = document.getElementById('ladder-detail');
  let selected = 3; // AVERAGE, the middle of the ladder

  function renderDetail(animate) {
    const level = LEVELS[selected];
    detail.innerHTML = `<p class="level-name"><small>Bậc ${selected + 1}/7</small>${level.name}</p><p>${level.description}</p>`;
    if (animate && !reduceMotion) {
      detail.classList.remove('swap');
      void detail.offsetWidth;
      detail.classList.add('swap');
    }
  }

  function select(index, focus) {
    selected = index;
    [...ladder.children].forEach((rung, i) => {
      rung.setAttribute('aria-checked', String(i === index));
      rung.tabIndex = i === index ? 0 : -1;
    });
    if (focus) ladder.children[index].focus();
    renderDetail(true);
  }

  LEVELS.forEach((level, index) => {
    const rung = document.createElement('button');
    rung.type = 'button';
    rung.className = 'rung';
    rung.setAttribute('role', 'radio');
    rung.setAttribute('aria-label', `Bậc ${index + 1}: ${level.name}`);
    rung.style.setProperty('--h', `${30 + index * 11.5}%`);
    rung.style.setProperty('--i', index);
    rung.innerHTML = `<span class="rank">${index + 1}</span>`;
    rung.addEventListener('click', () => select(index, false));
    rung.addEventListener('keydown', event => {
      const delta = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
      if (event.key === 'Home') { event.preventDefault(); select(0, true); }
      else if (event.key === 'End') { event.preventDefault(); select(LEVELS.length - 1, true); }
      else if (delta) { event.preventDefault(); select((index + delta + LEVELS.length) % LEVELS.length, true); }
    });
    ladder.appendChild(rung);
  });
  select(selected, false);
  renderDetail(false);

  if (!reduceMotion) {
    new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) return;
      ladder.classList.add('grow');
      observer.disconnect();
    }, { threshold: .35 }).observe(ladder);
  }

  /* ---------- mobile sticky CTA: shown once the hero CTA scrolls away ---------- */
  const mobileCta = document.getElementById('mobile-cta');
  const heroCta = document.querySelector('[data-cta="hero-primary"]');
  const finalCta = document.querySelector('[data-cta="final"]');
  let heroVisible = true;
  let finalVisible = false;
  const updateMobileCta = () => {
    const show = !heroVisible && !finalVisible;
    mobileCta.classList.toggle('show', show);
    mobileCta.setAttribute('aria-hidden', String(!show));
    mobileCta.querySelectorAll('a').forEach(link => { link.tabIndex = show ? 0 : -1; });
  };
  new IntersectionObserver(([entry]) => { heroVisible = entry.isIntersecting; updateMobileCta(); }).observe(heroCta);
  new IntersectionObserver(([entry]) => { finalVisible = entry.isIntersecting; updateMobileCta(); }).observe(finalCta);
})();
