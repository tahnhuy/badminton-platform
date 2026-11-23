/*
 * SmashPro prototype v3 — survey-first registration wizard and result screen.
 * Local, non-networked: "submitting" simulates the register request and scores
 * with engine.js (the server's job in the real app). The password is never
 * stored; answers survive a reload through sessionStorage, like AUTH-31.
 */
(() => {
  const { SURVEY, SCORING, LEVELS } = window.SmashProSurveyData;
  const { score } = window.SmashProEngine;
  const { EXAMPLES } = window.SmashProExamples;
  const SkillArt = window.SmashProSkillArt;

  const SPRITE = '../smashpro-auth-v1/assets/icons.svg#';
  const LOCAL_ICONS = new Set(['Clock', 'GraduationCap', 'RotateCcw', 'Pencil', 'User', 'Phone', 'Medal', 'Keyboard', 'Hand', 'TrendingUp']);
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="${LOCAL_ICONS.has(name) ? '#' : SPRITE}${name}"/></svg>`;
  const $ = id => document.getElementById(id);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !reduceMotion.matches;
  const wait = ms => new Promise(resolve => setTimeout(resolve, motionOK() ? ms : 0));
  const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const DRAFT_KEY = 'smashpro.registerDraft.v1';
  const RESULT_KEY = 'smashpro.surveyResult.v1';
  const store = {
    read(key) { try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; } },
    write(key, value) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable: keep working in memory */ } },
    remove(key) { try { sessionStorage.removeItem(key); } catch { /* ignore */ } },
  };

  const Q = SURVEY.questions;
  const STEPS = SURVEY.steps;
  const SKILL_IDS = STEPS[1].questionIds;
  const ALL_IDS = STEPS.flatMap(step => step.questionIds);
  const NUMBER = Object.fromEntries(ALL_IDS.map((id, index) => [id, index + 1]));
  const CRITERIA = {
    K: { name: 'Kỹ thuật', icon: 'Target', strength: 'Nền tảng cho những đường cầu tự tin.', improve: 'Luyện đều các kỹ thuật còn yếu để mở rộng lối chơi.' },
    R: { name: 'Độ ổn định giữ cầu', icon: 'Activity', strength: 'Giữ nhịp pha cầu, ít tự đánh hỏng.', improve: 'Tập đánh qua lại bền bỉ, hạn chế lỗi tự đánh hỏng.' },
    P: { name: 'Thể lực', icon: 'Zap', strength: 'Bền bỉ đến điểm cầu cuối cùng.', improve: 'Bền hơn để tận hưởng trọn vẹn mọi trận đấu.' },
    X: { name: 'Kinh nghiệm', icon: 'CalendarDays', strength: 'Tích lũy qua từng buổi ra sân.' },
  };

  const state = { step: 0, maxStep: 0, skillIndex: 0, answers: {}, account: { email: '', fullName: '', phone: '' }, busy: false };
  let autoAdvanceTimer = null;
  let pointerSelect = false;

  /* ---------- draft ---------- */
  function saveDraft() {
    store.write(DRAFT_KEY, { step: state.step, maxStep: state.maxStep, skillIndex: state.skillIndex, answers: state.answers, account: state.account });
  }
  function loadDraft() {
    const draft = store.read(DRAFT_KEY);
    if (!draft || typeof draft !== 'object') return false;
    Object.assign(state, { step: draft.step ?? 0, maxStep: draft.maxStep ?? 0, skillIndex: draft.skillIndex ?? 0, answers: draft.answers ?? {}, account: { ...state.account, ...(draft.account ?? {}) } });
    return Object.keys(state.answers).length > 0;
  }

  /* ---------- helpers ---------- */
  const isHidden = id => {
    const rule = Q[id].hiddenWhen;
    return Boolean(rule && state.answers[rule.questionId] === rule.optionCode);
  };
  const visibleIds = stepIndex => STEPS[stepIndex].questionIds.filter(id => !isHidden(id));
  const missingIds = stepIndex => visibleIds(stepIndex).filter(id => state.answers[id] === undefined);
  const stepComplete = stepIndex => stepIndex < 4 && missingIds(stepIndex).length === 0;
  const optionLabel = (id, value) => {
    if (Q[id].type === 'SKILL') return SURVEY.skillScale[value]?.label;
    const code = Q[id].type === 'BOOLEAN' ? String(value) : value;
    return Q[id].options.find(option => option.code === code)?.label;
  };

  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
  }

  function timeLeft() {
    let seconds = 0;
    for (let index = state.step; index < 4; index += 1) {
      for (const id of visibleIds(index)) if (state.answers[id] === undefined) seconds += Q[id].type === 'SKILL' ? 5 : 9;
    }
    seconds += 35;
    return seconds < 60 ? 'Dưới 1 phút' : `Còn khoảng ${Math.round(seconds / 60)} phút`;
  }

  /* ---------- rail & progress ---------- */
  function renderRail() {
    $('step-list').innerHTML = STEPS.map((step, index) => {
      const status = index === state.step ? 'current' : stepComplete(index) ? 'completed' : 'upcoming';
      const reachable = index <= state.maxStep && index !== state.step;
      const marker = status === 'completed' ? icon('Check') : String(index + 1).padStart(2, '0');
      const inner = `<span class="step-number">${marker}</span><span class="step-text"><strong>${step.title}</strong><small>${step.hint}</small></span>`;
      const sr = status === 'completed' ? '<span class="sr-only"> — đã hoàn thành</span>' : '';
      return `<li class="${status}"${index === state.step ? ' aria-current="step"' : ''}>${reachable ? `<button type="button" data-goto="${index}">${inner}${sr}</button>` : `<div>${inner}${sr}</div>`}</li>`;
    }).join('');
    $('mobile-bars').innerHTML = STEPS.map((_, index) => `<span class="${index < state.step || stepComplete(index) ? 'done' : index === state.step ? 'current' : ''}"></span>`).join('');
    $('mobile-step-label').textContent = `Bước ${state.step + 1}/5 · ${STEPS[state.step].title}`;
  }

  /* ---------- question markup ---------- */
  function optionVisual(id, option, index) {
    const question = Q[id];
    switch (question.visual) {
      case 'timeline': return `<span class="tl-node"></span>`;
      case 'dots': return `<span class="dots">${[0, 1, 2, 3].map(dot => `<i class="${dot < [0, 1, 3, 4][index] ? 'on' : ''}"></i>`).join('')}</span>`;
      case 'cards': return `<span class="opt-icon">${icon(option.icon)}</span>`;
      case 'rally': return `<span class="rally">${Array.from({ length: 6 }, (_, n) => `<i class="${n < option.count ? 'on' : ''}"></i>`).join('')}${option.code === '20_PLUS_ATTACKING' ? `<b>${icon('Zap')}</b>` : ''}</span>`;
      case 'energy': return `<span class="energy">${[0, 1, 2, 3, 4].map(n => `<i class="${n <= index ? 'on' : ''}"></i>`).join('')}</span>`;
      case 'medals': return `<span class="medal tier-${option.tier}">${option.tier === 0 ? '' : icon('Medal')}</span>`;
      case 'toggle': return `<span class="toggle-mark">${option.code === 'true' ? icon('RotateCcw') : icon('Check')}</span>`;
      default: return '';
    }
  }

  function questionMarkup(id) {
    const question = Q[id];
    const selected = question.type === 'BOOLEAN' ? (state.answers[id] === undefined ? undefined : String(state.answers[id])) : state.answers[id];
    const selIndex = question.options.findIndex(option => option.code === selected);
    const options = question.options.map((option, index) => `
      <label class="option${option.code === selected ? ' is-selected' : ''}">
        <input type="radio" name="${id}" value="${option.code}"${option.code === selected ? ' checked' : ''}>
        ${optionVisual(id, option, index)}
        <span class="opt-text">${question.visual === 'timeline' ? `<span class="tl-short">${option.short}</span><span class="tl-long">${option.label}</span>` : option.label}</span>
        <span class="opt-check">${icon('Check')}</span>
      </label>`).join('');
    const fieldset = `
      <fieldset class="question q-${question.visual}" data-qid="${id}" style="--sel:${selIndex}">
        <legend tabindex="-1"><span class="q-num">Câu ${NUMBER[id]}</span><span class="q-text">${question.text}</span></legend>
        ${question.description ? `<p class="q-desc">${question.description}</p>` : ''}
        <div class="options options-${question.visual}" style="--count:${question.options.length}">
          ${question.visual === 'timeline' ? '<span class="tl-track"><span class="tl-fill"></span></span>' : ''}${options}
        </div>
        <p class="q-missing">${icon('AlertCircle')} Bạn chưa chọn câu này</p>
      </fieldset>`;
    if (!question.hiddenWhen) return fieldset;
    return `<div class="reveal" data-reveal="${id}" data-open="${!isHidden(id)}"><div class="reveal-inner">${fieldset}</div></div>`;
  }

  /* ---------- technique step ---------- */
  function skillMarkup() {
    const id = SKILL_IDS[state.skillIndex];
    const question = Q[id];
    const value = state.answers[id];
    return `
      <div class="skill-stage">
        <div class="skill-nav" id="skill-nav">${SKILL_IDS.map((skillId, index) => {
          const done = state.answers[skillId] !== undefined;
          return `<button type="button" class="skill-dot${index === state.skillIndex ? ' current' : ''}${done ? ' done' : ''}" data-skill="${index}" aria-label="Kỹ năng ${index + 1}: ${Q[skillId].text}${done ? ', đã trả lời' : ''}"${index === state.skillIndex ? ' aria-current="true"' : ''}>
            <span class="dot-num">${done ? icon('Check') : index + 1}</span><span class="dot-name">${Q[skillId].text}</span></button>`;
        }).join('')}</div>
        <div class="skill-meta"><span>Kỹ năng ${String(state.skillIndex + 1).padStart(2, '0')} / 09</span><span>Đã trả lời ${SKILL_IDS.filter(skillId => state.answers[skillId] !== undefined).length} / 9</span></div>
        <div class="skill-card" id="skill-card" data-qid="${id}">
          <div class="skill-art-wrap">${SkillArt.render(question.art)}</div>
          <fieldset class="skill-body question" data-qid="${id}">
            <legend tabindex="-1" id="skill-title"><span class="q-num">Câu ${NUMBER[id]}</span><span class="q-text">${question.text}</span></legend>
            <p class="q-desc">${question.description}</p>
            <div class="scale">${SURVEY.skillScale.map(level => `
              <label class="scale-option${value === level.value ? ' is-selected' : ''}">
                <input type="radio" name="${id}" value="${level.value}"${value === level.value ? ' checked' : ''}>
                <span class="scale-meter">${[0, 1, 2].map(bar => `<i class="${bar < level.value ? 'on' : ''}"></i>`).join('')}</span>
                <span class="scale-text"><strong>${level.label}</strong><small>${level.hint}</small></span>
                <kbd>${level.value + 1}</kbd>
              </label>`).join('')}</div>
          </fieldset>
        </div>
        <div class="skill-footer">
          <button type="button" class="button ghost small" id="prev-skill"${state.skillIndex === 0 ? ' disabled' : ''}>${icon('ArrowLeft')}<span>Kỹ năng trước</span></button>
          <p class="skill-hint"><span class="hint-desktop">${icon('Keyboard')} Phím <kbd>1</kbd>–<kbd>4</kbd> để chọn nhanh</span><span class="hint-touch">${icon('Hand')} Vuốt ngang để chuyển kỹ năng</span></p>
          <button type="button" class="button ghost small" id="next-skill"${state.skillIndex === SKILL_IDS.length - 1 ? ' disabled' : ''}><span>Kỹ năng sau</span>${icon('ArrowRight')}</button>
        </div>
      </div>`;
  }

  function prepareArt(container) {
    if (motionOK()) return;
    container.querySelectorAll('animate, animateMotion').forEach(node => node.remove());
  }

  async function goToSkill(index, { focus = true } = {}) {
    if (index < 0 || index >= SKILL_IDS.length || index === state.skillIndex) return;
    clearTimeout(autoAdvanceTimer);
    const card = $('skill-card');
    const forward = index > state.skillIndex;
    if (card && motionOK()) {
      card.classList.add(forward ? 'out-left' : 'out-right');
      await wait(140);
    }
    state.skillIndex = index;
    saveDraft();
    $('step-body').innerHTML = skillMarkup();
    prepareArt($('step-body'));
    const fresh = $('skill-card');
    if (motionOK()) {
      fresh.classList.add(forward ? 'in-right' : 'in-left');
      requestAnimationFrame(() => requestAnimationFrame(() => fresh.classList.remove('in-right', 'in-left')));
    }
    $('skill-nav').querySelector('[aria-current]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: motionOK() ? 'smooth' : 'auto' });
    if (focus) $('skill-title').focus({ preventScroll: true });
    renderRail();
    $('time-left').querySelector('span').textContent = timeLeft();
  }

  function scheduleAdvance() {
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = setTimeout(() => {
      const after = SKILL_IDS.findIndex((id, index) => index > state.skillIndex && state.answers[id] === undefined);
      const any = after >= 0 ? after : SKILL_IDS.findIndex(id => state.answers[id] === undefined);
      if (any >= 0) goToSkill(any);
      else {
        toast('Đã xong 9 kỹ năng · bấm Tiếp tục');
        const next = $('next-button');
        next.classList.add('attention');
        next.focus({ preventScroll: true });
        setTimeout(() => next.classList.remove('attention'), 1600);
      }
    }, motionOK() ? 360 : 0);
  }

  /* ---------- account step ---------- */
  function reviewMarkup() {
    return STEPS.slice(0, 4).map((step, index) => {
      const ids = visibleIds(index);
      const answered = ids.filter(id => state.answers[id] !== undefined).length;
      const rows = index === 1
        ? `<li class="review-skills">${ids.map(id => `<span class="mini-meter" title="${Q[id].text}: ${optionLabel(id, state.answers[id]) ?? 'chưa chọn'}">${[0, 1, 2].map(bar => `<i class="${bar < (state.answers[id] ?? -1) ? 'on' : ''}"></i>`).join('')}<em>${Q[id].text}</em></span>`).join('')}</li>`
        : ids.map(id => `<li><span>${shortLabel(id)}</span><strong>${escapeHtml(optionLabel(id, state.answers[id]) ?? 'Chưa chọn')}</strong></li>`).join('');
      return `<section class="review-group">
        <header><span class="review-num">${String(index + 1).padStart(2, '0')}</span><h3>${step.title}</h3><span class="review-count${answered === ids.length ? ' ok' : ''}">${answered}/${ids.length}</span>
          <button type="button" class="link-button" data-goto="${index}">${icon('Pencil')} Sửa</button></header>
        <ul>${rows}</ul></section>`;
    }).join('');
  }
  function shortLabel(id) {
    return ({ yearsPlaying: 'Thời gian chơi', frequencyPerWeek: 'Buổi mỗi tuần', coaching: 'Học bài bản', returningAfterBreak: 'Quay lại sau nghỉ', rallyConsistency: 'Giữ cầu', stamina: 'Thể lực', tournamentAchievement: 'Thành tích' })[id];
  }

  function field(name, label, iconName, { type = 'text', autocomplete, optional = false, hint } = {}) {
    const value = state.account[name] ?? '';
    return `<div class="field" data-field="${name}">
      <label for="f-${name}">${label}${optional ? ' <span class="optional">(không bắt buộc)</span>' : ''}</label>
      <div class="input-wrap">${icon(iconName)}<input id="f-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}"${autocomplete ? ` autocomplete="${autocomplete}"` : ''} aria-describedby="e-${name}${hint ? ` h-${name}` : ''}">
      ${type === 'password' ? `<button type="button" class="reveal-pass" aria-label="Hiện mật khẩu" aria-pressed="false">${icon('Eye')}</button>` : ''}</div>
      ${hint ? `<p class="field-hint" id="h-${name}">${hint}</p>` : ''}
      <p class="field-error" id="e-${name}"></p></div>`;
  }

  function accountMarkup() {
    return `<div class="account-grid">
      <form class="account-form" id="account-form" novalidate>
        ${field('email', 'Email', 'Mail', { type: 'email', autocomplete: 'email', hint: 'Dùng để đăng nhập. Thử <code>taken@smashpro.vn</code> để xem lỗi email trùng.' })}
        ${field('password', 'Mật khẩu', 'LockKeyhole', { type: 'password', autocomplete: 'new-password' })}
        <ul class="policy" id="policy" aria-label="Yêu cầu mật khẩu">
          <li data-rule="length">${icon('Check')}<span>8–64 ký tự</span><span class="sr-only rule-state">Chưa đạt</span></li>
          <li data-rule="email">${icon('Check')}<span>Khác địa chỉ email</span><span class="sr-only rule-state">Chưa đạt</span></li>
        </ul>
        ${field('fullName', 'Họ và tên', 'User', { autocomplete: 'name' })}
        ${field('phone', 'Số điện thoại', 'Phone', { type: 'tel', autocomplete: 'tel', optional: true, hint: 'Chỉ chủ sân của booking bạn đặt mới thấy.' })}
      </form>
      <aside class="review" aria-label="Xem lại câu trả lời">
        <div class="review-head"><h2>Xem lại câu trả lời</h2><p>Khảo sát chỉ làm một lần. Kiểm tra trước khi tạo tài khoản.</p></div>
        <div id="review-list">${reviewMarkup()}</div>
      </aside></div>`;
  }

  function updatePolicy() {
    const password = $('f-password')?.value ?? '';
    const email = ($('f-email')?.value ?? '').trim().toLowerCase();
    const length = [...password.normalize('NFKC')].length;
    const rules = { length: length >= 8 && length <= 64, email: password.length > 0 && password.normalize('NFKC').toLowerCase() !== email };
    $('policy')?.querySelectorAll('li').forEach(item => {
      const ok = rules[item.dataset.rule];
      item.classList.toggle('ok', ok);
      item.querySelector('.rule-state').textContent = ok ? 'Đã đạt' : 'Chưa đạt';
    });
    return rules;
  }

  function setFieldError(name, message) {
    const wrap = document.querySelector(`[data-field="${name}"]`);
    if (!wrap) return;
    wrap.classList.toggle('has-error', Boolean(message));
    wrap.querySelector('input').setAttribute('aria-invalid', message ? 'true' : 'false');
    wrap.querySelector('.field-error').innerHTML = message ? `${icon('AlertCircle')}${message}` : '';
  }

  function validateAccount() {
    const email = $('f-email').value.trim();
    const fullName = $('f-fullName').value.trim();
    const phone = $('f-phone').value.trim();
    const rules = updatePolicy();
    const errors = {
      email: !email ? 'Vui lòng nhập email' : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Email chưa đúng định dạng' : '',
      password: !$('f-password').value ? 'Vui lòng nhập mật khẩu' : !rules.length ? 'Mật khẩu cần 8–64 ký tự' : !rules.email ? 'Mật khẩu không được trùng email' : '',
      fullName: !fullName ? 'Vui lòng nhập họ và tên' : fullName.length > 100 ? 'Họ và tên tối đa 100 ký tự' : '',
      phone: phone && !/^(0|\+84)\d{9,10}$/.test(phone.replace(/[\s.-]/g, '')) ? 'Số điện thoại chưa đúng định dạng' : '',
    };
    Object.entries(errors).forEach(([name, message]) => setFieldError(name, message));
    const first = Object.keys(errors).find(name => errors[name]);
    if (first) $(`f-${first}`).focus();
    return !first;
  }

  /* ---------- step rendering & transitions ---------- */
  function fillStep() {
    const step = STEPS[state.step];
    $('step-chip').textContent = `Bước ${String(state.step + 1).padStart(2, '0')} / 05`;
    $('step-eyebrow').textContent = step.eyebrow;
    $('step-heading').textContent = step.heading;
    $('step-lead').textContent = step.lead;
    $('step-alert').hidden = true;
    $('time-left').querySelector('span').textContent = timeLeft();
    const body = $('step-body');
    if (state.step === 1) body.innerHTML = skillMarkup();
    else if (state.step === 4) body.innerHTML = accountMarkup();
    else body.innerHTML = `<div class="question-list">${step.questionIds.map(questionMarkup).join('')}</div>`;
    prepareArt(body);
    if (state.step === 4) updatePolicy();
    $('back-button').disabled = state.step === 0;
    $('next-button').querySelector('span').textContent = state.step === 4 ? 'Tạo tài khoản' : state.step === 3 ? 'Đến bước cuối' : 'Tiếp tục';
    renderRail();
  }

  async function goToStep(index, { focus = true, force = false } = {}) {
    if ((index === state.step && !force) || index < 0 || index > 4) return;
    clearTimeout(autoAdvanceTimer);
    $('resume-banner').hidden = true;
    const pane = $('step-pane');
    const forward = index > state.step;
    if (motionOK()) {
      pane.className = `step-pane ${forward ? 'leave-fwd' : 'leave-back'}`;
      await wait(150);
    }
    if (state.step === 4 && index !== 4) captureAccount();
    state.step = index;
    state.maxStep = Math.max(state.maxStep, index);
    if (index === 1 && state.answers[SKILL_IDS[state.skillIndex]] !== undefined) {
      const firstOpen = SKILL_IDS.findIndex(id => state.answers[id] === undefined);
      if (firstOpen >= 0) state.skillIndex = firstOpen;
    }
    saveDraft();
    fillStep();
    if (motionOK()) {
      pane.className = `step-pane ${forward ? 'enter-fwd' : 'enter-back'}`;
      requestAnimationFrame(() => requestAnimationFrame(() => { pane.className = 'step-pane'; }));
    }
    window.scrollTo({ top: 0, behavior: motionOK() ? 'smooth' : 'auto' });
    if (focus) $('step-heading').focus({ preventScroll: true });
  }

  function showMissing(ids) {
    const alert = $('step-alert');
    alert.hidden = false;
    alert.innerHTML = `${icon('AlertCircle')}<span>${state.step === 1 ? `Còn ${ids.length} kỹ năng chưa chọn.` : `Còn ${ids.length} câu chưa trả lời.`} Hãy hoàn thành để tiếp tục.</span>`;
    if (state.step === 1) {
      goToSkill(SKILL_IDS.indexOf(ids[0]));
      return;
    }
    document.querySelectorAll('.question').forEach(fieldset => fieldset.classList.toggle('is-missing', ids.includes(fieldset.dataset.qid)));
    const first = document.querySelector(`.question[data-qid="${ids[0]}"]`);
    first.scrollIntoView({ block: 'center', behavior: motionOK() ? 'smooth' : 'auto' });
    first.querySelector('legend').focus({ preventScroll: true });
    if (motionOK()) { first.classList.add('shake'); setTimeout(() => first.classList.remove('shake'), 420); }
  }

  function captureAccount() {
    ['email', 'fullName', 'phone'].forEach(name => { const input = $(`f-${name}`); if (input) state.account[name] = input.value; });
  }

  async function onNext() {
    if (state.busy) return;
    if (state.step < 4) {
      const missing = missingIds(state.step);
      if (missing.length) { showMissing(missing); return; }
      goToStep(state.step + 1);
      return;
    }
    const incomplete = [0, 1, 2, 3].find(index => !stepComplete(index));
    if (incomplete !== undefined) { toast(`Bước ${incomplete + 1} còn câu chưa trả lời`); goToStep(incomplete); return; }
    if (!validateAccount()) return;
    captureAccount();
    await submit();
  }

  async function submit() {
    const button = $('next-button');
    state.busy = true;
    button.classList.add('loading');
    button.querySelector('span').textContent = 'Đang tạo tài khoản…';
    button.setAttribute('aria-busy', 'true');
    await new Promise(resolve => setTimeout(resolve, 900)); // simulated network round trip
    state.busy = false;
    button.classList.remove('loading');
    button.removeAttribute('aria-busy');
    button.querySelector('span').textContent = 'Tạo tài khoản';
    if (state.account.email.trim().toLowerCase() === 'taken@smashpro.vn') {
      setFieldError('email', 'Email này đã được sử dụng. Câu trả lời khảo sát vẫn được giữ nguyên.');
      $('f-email').focus();
      return;
    }
    const answers = { ...state.answers };
    if (answers.yearsPlaying === 'LESS_THAN_6M') delete answers.returningAfterBreak;
    const result = score(SURVEY, SCORING, LEVELS, answers);
    store.write(RESULT_KEY, { result, fullName: state.account.fullName.trim() });
    store.remove(DRAFT_KEY);
    location.hash = 'result';
  }

  /* ---------- answering ---------- */
  function onAnswer(event) {
    const input = event.target;
    if (input.type !== 'radio') return;
    const id = input.name;
    const question = Q[id];
    const value = question.type === 'SKILL' ? Number(input.value) : question.type === 'BOOLEAN' ? input.value === 'true' : input.value;
    state.answers[id] = value;
    const group = input.closest('.options, .scale');
    group.querySelectorAll('label').forEach(label => label.classList.toggle('is-selected', label.contains(input)));
    const fieldset = input.closest('.question');
    fieldset.classList.remove('is-missing');
    fieldset.style.setProperty('--sel', [...group.querySelectorAll('input')].indexOf(input));
    if (id === 'yearsPlaying') {
      const reveal = document.querySelector('[data-reveal="returningAfterBreak"]');
      const hide = value === 'LESS_THAN_6M';
      if (hide && state.answers.returningAfterBreak !== undefined) {
        delete state.answers.returningAfterBreak;
        reveal.querySelectorAll('input').forEach(radio => { radio.checked = false; radio.closest('label').classList.remove('is-selected'); });
      }
      reveal.dataset.open = String(!hide);
    }
    if (!missingIds(state.step).length) $('step-alert').hidden = true;
    saveDraft();
    renderRail();
    $('time-left').querySelector('span').textContent = timeLeft();
    if (question.type === 'SKILL') {
      const dot = document.querySelector(`.skill-dot[data-skill="${state.skillIndex}"]`);
      dot?.classList.add('done');
      document.querySelector('.skill-meta span:last-child').textContent = `Đã trả lời ${SKILL_IDS.filter(skillId => state.answers[skillId] !== undefined).length} / 9`;
      if (pointerSelect) scheduleAdvance();
    }
    pointerSelect = false;
  }

  /* ---------- result ---------- */
  function renderResult(saved) {
    const { result, fullName } = saved;
    const level = result.skillLevel;
    const firstName = fullName ? fullName.split(/\s+/).pop() : '';
    $('result-lead').innerHTML = `${firstName ? `${escapeHtml(firstName)}, bạn` : 'Bạn'} bắt đầu ở bậc <strong>${level.name}</strong>. Một điểm xuất phát — rất nhiều đồng đội phù hợp đang chờ bạn ra sân.`;
    $('ladder-count').textContent = `${level.rank} / 7 bậc`;
    $('ladder').innerHTML = LEVELS.map(item => `<div role="listitem" class="rung${item.rank <= level.rank ? ' filled' : ''}${item.rank === level.rank ? ' current' : ''}" style="--i:${item.rank}">
      <button type="button" data-level="${item.rank}" aria-pressed="${item.rank === level.rank}"><span class="bar">${item.rank === level.rank ? icon('Check') : ''}</span><span class="rung-name">${item.name}</span></button></div>`).join('');
    showLevelDetail(level.rank, level.rank);

    const cards = result.strengths.map(item => insightCard('strength', item.criterion));
    if (!cards.length) cards.push(`<article class="insight empty"><span class="insight-icon">${icon('Sparkles')}</span><p class="insight-kicker">Điểm mạnh</p><h3>Chưa có điểm mạnh nổi bật</h3><p>Cứ ra sân thường xuyên nhé — mỗi buổi chơi đều là một bước tiến.</p></article>`);
    cards.push(insightCard('improve', result.areaToImprove.criterion));
    $('insight-grid').innerHTML = cards.join('');

    const notes = result.guardrails.map(item => item.code === 'G1_BOTTLENECK'
      ? `<p>${icon('TrendingUp')}<span>Bạn được xếp ở bậc này vì <strong>${CRITERIA[item.criterion].name}</strong> đang là điểm yếu nhất. Cải thiện tiêu chí này là cách nhanh nhất để phát huy hết tiềm năng của bạn.</span></p>`
      : `<p>${icon('Clock')}<span>Người mới chơi dưới <strong>${item.cap.rank === 3 ? '6 tháng' : '1 năm'}</strong> được xếp tối đa ở bậc <strong>${item.cap.name}</strong>. Cứ tiếp tục ra sân, trình độ sẽ theo kịp bạn.</span></p>`);
    $('guardrail-note').hidden = !notes.length;
    $('guardrail-note').innerHTML = notes.join('');

    $('badge-rank').textContent = String(level.rank);
    $('hero-level').innerHTML = `${level.name}<span>.</span>`;
    $('find-match-label').textContent = `Tìm kèo trình độ ${level.name}`;
    renderRadar(result.components);
  }

  function insightCard(kind, criterion) {
    const info = CRITERIA[criterion];
    return `<article class="insight ${kind}"><span class="insight-icon">${icon(info.icon)}</span>
      <p class="insight-kicker">${kind === 'strength' ? 'Điểm mạnh' : 'Cùng cải thiện'}</p><h3>${info.name}</h3><p>${kind === 'strength' ? info.strength : info.improve}</p></article>`;
  }

  function showLevelDetail(rank, current) {
    const level = LEVELS[rank - 1];
    $('ladder').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.level) === rank)));
    $('ladder').querySelectorAll('.rung').forEach(rung => rung.classList.toggle('viewing', Number(rung.querySelector('button').dataset.level) === rank));
    $('ladder-detail').innerHTML = `<strong>${level.name}${rank === current ? ' · bậc của bạn' : ''}</strong><span>${level.description}</span>`;
  }

  function renderRadar(components) {
    const axes = [['K', 'Kỹ thuật'], ['R', 'Ổn định'], ['X', 'Kinh nghiệm'], ['P', 'Thể lực'], ['A', 'Thành tích'], ['T', 'Đào tạo']];
    const cx = 130; const cy = 112; const radius = 78;
    const point = (index, value) => {
      const angle = -Math.PI / 2 + (index * 2 * Math.PI) / axes.length;
      return [cx + Math.cos(angle) * radius * value, cy + Math.sin(angle) * radius * value];
    };
    const ring = value => axes.map((_, index) => point(index, value).join(',')).join(' ');
    const shape = axes.map(([key], index) => point(index, Math.max(0.04, components[key] / 100)).join(',')).join(' ');
    $('radar').innerHTML = `<title id="radar-title">Hồ sơ sáu tiêu chí</title>
      ${[0.25, 0.5, 0.75, 1].map(value => `<polygon class="radar-ring" points="${ring(value)}"/>`).join('')}
      ${axes.map((_, index) => `<line class="radar-axis" x1="${cx}" y1="${cy}" x2="${point(index, 1)[0]}" y2="${point(index, 1)[1]}"/>`).join('')}
      <polygon class="radar-shape" points="${shape}" style="transform-origin:${cx}px ${cy}px"/>
      ${axes.map(([key, label], index) => {
        const [x, y] = point(index, 1.24);
        return `<text class="radar-label" x="${x}" y="${y}" text-anchor="middle" dominant-baseline="middle">${label}</text><circle class="radar-dot" cx="${point(index, Math.max(0.04, components[key] / 100))[0]}" cy="${point(index, Math.max(0.04, components[key] / 100))[1]}" r="3"/>`;
      }).join('')}`;
  }

  function confetti() {
    if (!motionOK()) return;
    const canvas = $('confetti');
    const box = canvas.parentElement.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = box.width * ratio; canvas.height = box.height * ratio;
    const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
    const colors = ['#d4ed8b', '#ffffff', '#8fc46a', '#f2d675', '#b9e4c9'];
    const pieces = Array.from({ length: 110 }, () => ({
      x: box.width / 2 + (Math.random() - 0.5) * 60, y: box.height * 0.32,
      vx: (Math.random() - 0.5) * 9, vy: -Math.random() * 9 - 3, size: 4 + Math.random() * 5,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3, color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const start = performance.now();
    (function frame(now) {
      const t = now - start;
      ctx.clearRect(0, 0, box.width, box.height);
      pieces.forEach(p => {
        p.vy += 0.22; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t / 2200); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore();
      });
      if (t < 2200) requestAnimationFrame(frame); else ctx.clearRect(0, 0, box.width, box.height);
    })(start);
  }

  async function showResult() {
    const saved = store.read(RESULT_KEY);
    if (!saved?.result) { location.hash = ''; return; }
    $('wizard').hidden = true;
    document.querySelector('.mobile-progress').hidden = true;
    const view = $('result');
    view.hidden = false;
    view.classList.remove('revealed');
    renderResult(saved);
    window.scrollTo(0, 0);
    $('result-heading').focus({ preventScroll: true });
    await wait(60);
    view.classList.add('revealed');
    await wait(720);
    confetti();
  }

  function showWizard() {
    $('result').hidden = true;
    $('wizard').hidden = false;
    document.querySelector('.mobile-progress').hidden = false;
  }

  /* ---------- events ---------- */
  function bindEvents() {
    $('next-button').addEventListener('click', onNext);
    $('back-button').addEventListener('click', () => goToStep(state.step - 1));
    $('step-list').addEventListener('click', event => { const target = event.target.closest('[data-goto]'); if (target) goToStep(Number(target.dataset.goto)); });

    const body = $('step-body');
    body.addEventListener('change', onAnswer);
    body.addEventListener('pointerdown', event => { if (event.target.closest('.scale-option')) pointerSelect = true; });
    body.addEventListener('click', event => {
      const skill = event.target.closest('[data-skill]');
      if (skill) goToSkill(Number(skill.dataset.skill));
      if (event.target.closest('#prev-skill')) goToSkill(state.skillIndex - 1);
      if (event.target.closest('#next-skill')) goToSkill(state.skillIndex + 1);
      const goto = event.target.closest('.review [data-goto]');
      if (goto) goToStep(Number(goto.dataset.goto));
      const reveal = event.target.closest('.reveal-pass');
      if (reveal) {
        const input = reveal.parentElement.querySelector('input');
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        reveal.setAttribute('aria-pressed', String(show));
        reveal.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
        reveal.innerHTML = icon(show ? 'EyeOff' : 'Eye');
      }
    });
    body.addEventListener('input', event => {
      if (!event.target.closest('#account-form')) return;
      if (event.target.name !== 'password') state.account[event.target.name] = event.target.value;
      if (['password', 'email'].includes(event.target.name)) updatePolicy();
      setFieldError(event.target.name, '');
      saveDraft();
    });
    body.addEventListener('submit', event => { event.preventDefault(); onNext(); });

    // Swipe between skills (touch / pen).
    let swipe = null;
    body.addEventListener('pointerdown', event => { if (state.step === 1 && event.pointerType !== 'mouse' && event.target.closest('#skill-card')) swipe = { x: event.clientX, y: event.clientY }; });
    body.addEventListener('pointerup', event => {
      if (!swipe) return;
      const dx = event.clientX - swipe.x; const dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 60 && Math.abs(dy) < 45) { pointerSelect = false; goToSkill(state.skillIndex + (dx < 0 ? 1 : -1)); }
    });

    // Keyboard shortcuts on the technique step.
    document.addEventListener('keydown', event => {
      if (state.step !== 1 || $('wizard').hidden || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target.matches('input[type="text"], input[type="email"], textarea')) return;
      if (/^[1-4]$/.test(event.key)) {
        const radio = document.querySelector(`#skill-card input[value="${Number(event.key) - 1}"]`);
        if (radio) { radio.checked = true; radio.focus({ preventScroll: true }); pointerSelect = true; radio.dispatchEvent(new Event('change', { bubbles: true })); }
      } else if (!event.target.matches('input[type="radio"]') && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        goToSkill(state.skillIndex + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });

    $('resume-close').addEventListener('click', () => { $('resume-banner').hidden = true; });
    $('resume-reset').addEventListener('click', resetAll);
    $('ladder').addEventListener('click', event => { const button = event.target.closest('[data-level]'); if (button) showLevelDetail(Number(button.dataset.level), store.read(RESULT_KEY)?.result.skillLevel.rank); });
    $('find-match').addEventListener('click', () => toast(`Bản mẫu: mở /matchmaking lọc sẵn trình độ ${store.read(RESULT_KEY)?.result.skillLevel.name ?? ''}`));
    $('view-profile').addEventListener('click', () => toast('Bản mẫu: mở /profile — trình độ có nhãn "tạm thời" và link xem lại kết quả'));

    $('proto-toggle').addEventListener('click', () => {
      const menu = $('proto-menu'); const open = menu.hidden;
      menu.hidden = !open; $('proto-toggle').setAttribute('aria-expanded', String(open));
    });
    $('proto-examples').innerHTML = EXAMPLES.map(example => `<button type="button" data-example="${example.id}">${example.label}<small>S = ${example.expect.score}</small></button>`).join('');
    $('proto-examples').addEventListener('click', event => {
      const button = event.target.closest('[data-example]');
      if (!button) return;
      const example = EXAMPLES.find(item => item.id === Number(button.dataset.example));
      state.answers = { ...example.answers };
      const names = ['Trần Minh Khoa', 'Lê Thu Hà', 'Phạm Gia Bảo', 'Võ Thanh Tùng', 'Đặng Ngọc Anh', 'Huỳnh Quốc Việt'];
      state.account = { email: `demo${example.id}@smashpro.vn`, fullName: names[example.id - 1], phone: '' };
      state.maxStep = 4; state.skillIndex = 0;
      $('proto-menu').hidden = true; $('proto-toggle').setAttribute('aria-expanded', 'false');
      if (location.hash === '#result') history.replaceState(null, '', location.pathname); // no hashchange
      showWizard();
      goToStep(4, { focus: false, force: true }).then(() => toast('Đã điền ví dụ · nhập mật khẩu rồi bấm Tạo tài khoản'));
    });
    $('proto-reset').addEventListener('click', resetAll);

    window.addEventListener('hashchange', route);
    reduceMotion.addEventListener?.('change', () => { if (state.step === 1 && !$('wizard').hidden) fillStep(); });
  }

  function resetAll() {
    store.remove(DRAFT_KEY); store.remove(RESULT_KEY);
    Object.assign(state, { step: 0, maxStep: 0, skillIndex: 0, answers: {}, account: { email: '', fullName: '', phone: '' } });
    $('resume-banner').hidden = true;
    $('proto-menu').hidden = true;
    if (location.hash) location.hash = '';
    showWizard(); fillStep();
    $('step-heading').focus({ preventScroll: true });
  }

  function route() {
    if (location.hash === '#result') showResult();
    else { showWizard(); fillStep(); }
  }

  bindEvents();
  if (loadDraft()) $('resume-banner').hidden = false;
  route();
})();
