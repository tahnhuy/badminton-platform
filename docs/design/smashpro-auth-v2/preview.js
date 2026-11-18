/* Local, non-networked prototype. Does not create accounts or calculate levels. */
'use strict';
const skills = [
  ['Giao cầu', 'Giao cầu ngắn sát lưới và giao cầu cao sâu cuối sân.'],
  ['Phông cầu', 'Từ cuối sân đánh cầu cao sâu về sát cuối sân đối phương.'],
  ['Đập cầu', 'Đập cầu cắm, có lực và điều chỉnh được hướng.'],
  ['Bỏ nhỏ / cầu lưới', 'Bỏ nhỏ, ve, móc cầu sát mép lưới.'],
  ['Thủ cầu', 'Đỡ đập, hất cầu cao sâu thoát hiểm khi bị tấn công.'],
  ['Tạt cầu & phản tạt', 'Đánh cầu ngang lưới tốc độ nhanh, chủ động hoặc phản tạt khi bị ép.'],
  ['Trái tay', 'Đánh trái tay từ cuối sân qua lưới để thoát thế bị động.'],
  ['Bộ pháp', 'Di chuyển bao các góc sân và hồi về vị trí trung tâm.'],
  ['Phối hợp đánh đôi', 'Hiểu vị trí tấn công (trên–dưới) và phòng thủ (hai bên), biết bọc lót đồng đội.'],
];
const scale = ['Chưa làm được', 'Làm được khi cầu chậm/dễ', 'Ổn định khi đánh giao lưu', 'Ổn định cả khi bị ép tốc độ cao'];
const answers = new Map(); // Memory only. Reload clears prototype answers.
let skillIndex = 0;
const byId = id => document.getElementById(id);
function notice(message) {
  byId('preview-notice').querySelector('p').textContent = message;
  byId('preview-notice').hidden = false;
}
byId('preview-notice').querySelector('button').addEventListener('click', () => { byId('preview-notice').hidden = true; });
byId('preview-help').addEventListener('click', () => notice('Bản thiết kế v2 đang chờ duyệt. Ba màn được xem độc lập; khảo sát chỉ dựng bước 2. Không gửi dữ liệu, tạo tài khoản hoặc tính trình độ. Kết quả là minh họa cố định.'));
function showScreen(moveFocus = false) {
  const requested = location.hash.slice(1);
  const screen = ['sign-in', 'survey', 'result'].includes(requested) ? requested : 'sign-in';
  for (const section of document.querySelectorAll('[data-screen]')) section.hidden = section.dataset.screen !== screen;
  for (const link of document.querySelectorAll('[data-tab]')) {
    if (link.dataset.tab === screen) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  const names = { 'sign-in': 'Đăng nhập', survey: 'Khảo sát kỹ thuật', result: 'Kết quả minh họa' };
  document.title = `SmashPro — ${names[screen]} · Bản thiết kế v2`;
  if (moveFocus) {
    const heading = document.querySelector(`[data-screen="${screen}"] h1`);
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
}
window.addEventListener('hashchange', () => showScreen(true));
byId('register-preview-link').addEventListener('click', () => notice('Bạn đang xem riêng bước 2 của đăng ký để duyệt thiết kế. Các bước 1, 3, 4 và 5 chưa được dựng trong bản mẫu.'));
byId('sign-in-form').addEventListener('submit', event => {
  event.preventDefault();
  byId('sign-in-notice').textContent = 'Đây là bản mẫu giao diện, chưa kết nối đăng nhập. Thông tin không được gửi hoặc lưu.';
  byId('sign-in-notice').hidden = false;
});
byId('toggle-password').addEventListener('click', () => {
  const input = byId('password');
  const visible = input.type === 'password';
  input.type = visible ? 'text' : 'password';
  byId('toggle-password').setAttribute('aria-label', visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
  byId('toggle-password').setAttribute('aria-pressed', String(visible));
  byId('toggle-password').querySelector('use').setAttribute('href', `../smashpro-auth-v1/assets/icons.svg#${visible ? 'EyeOff' : 'Eye'}`);
});
function renderSkill(focusHeading = false) {
  const [name, description] = skills[skillIndex];
  byId('skill-title').textContent = name;
  byId('skill-description').textContent = description;
  byId('question-position').textContent = `KỸ NĂNG ${String(skillIndex + 1).padStart(2, '0')} / 09`;
  byId('skill-count').textContent = `Đã trả lời ${answers.size} / 9`;
  byId('skill-options').replaceChildren();
  scale.forEach((text, value) => {
    const label = document.createElement('label'); label.className = 'choice';
    const input = document.createElement('input'); input.type = 'radio'; input.name = 'skill-level'; input.value = String(value);
    input.checked = answers.get(skillIndex) === value;
    const indicator = document.createElement('span'); indicator.className = 'choice-indicator'; indicator.setAttribute('aria-hidden', 'true');
    const copy = document.createElement('span'); copy.className = 'choice-copy'; copy.textContent = text;
    input.addEventListener('change', () => { answers.set(skillIndex, value); updateProgress(); });
    label.append(input, indicator, copy); byId('skill-options').append(label);
  });
  updateProgress();
  if (focusHeading) { byId('skill-title').tabIndex = -1; byId('skill-title').focus({ preventScroll: true }); }
}
function updateProgress() {
  byId('skill-count').textContent = `Đã trả lời ${answers.size} / 9`;
  byId('skill-navigation').replaceChildren();
  skills.forEach(([name], index) => {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = String(index + 1).padStart(2, '0');
    button.setAttribute('aria-label', `${name}${answers.has(index) ? ' — đã trả lời' : ''}`);
    if (index === skillIndex) button.setAttribute('aria-current', 'true');
    if (answers.has(index)) { button.className = 'answered'; button.innerHTML = '<svg class="icon" aria-hidden="true"><use href="../smashpro-auth-v1/assets/icons.svg#Check"/></svg>'; }
    button.addEventListener('click', () => { skillIndex = index; renderSkill(true); });
    byId('skill-navigation').append(button);
  });
  byId('previous-skill').disabled = skillIndex === 0;
  byId('next-skill').disabled = !answers.has(skillIndex);
  byId('next-skill').querySelector('span').textContent = skillIndex === skills.length - 1 ? 'Hoàn tất phần kỹ thuật' : 'Kỹ năng tiếp theo';
  const activeButton = byId('skill-navigation').querySelector('[aria-current]');
  if (activeButton && byId('skill-navigation').scrollWidth > byId('skill-navigation').clientWidth) {
    byId('skill-navigation').scrollLeft = activeButton.offsetLeft - byId('skill-navigation').offsetLeft - 80;
  }
}
byId('previous-skill').addEventListener('click', () => { if (skillIndex > 0) { skillIndex--; renderSkill(true); } });
byId('next-skill').addEventListener('click', () => {
  if (!answers.has(skillIndex)) return;
  if (skillIndex < skills.length - 1) { skillIndex++; renderSkill(true); return; }
  if (answers.size < skills.length) {
    skillIndex = skills.findIndex((_, index) => !answers.has(index)); renderSkill(true);
    notice('Còn kỹ năng chưa trả lời. Bản mẫu đưa bạn đến mục còn thiếu.'); return;
  }
  notice('Bạn đã thử xong phần kỹ thuật. Bước tiếp theo trong luồng thật là Thực chiến & thể lực; màn này chưa dựng. Có thể xem kết quả minh họa bằng thanh chọn phía dưới.');
});
byId('skill-form').addEventListener('submit', event => event.preventDefault());
byId('find-match').addEventListener('click', () => notice('Đây là nút minh họa sau khi tạo tài khoản thành công. Bản mẫu không tạo tài khoản hoặc mở tính năng tìm trận thật.'));
renderSkill();
showScreen();

// Small pointer response, without a perpetual animation loop or touch listeners.
const hero = byId('vector-hero');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
let pointerFrame = 0;
let pointerPosition = null;
function resetScene() {
  cancelAnimationFrame(pointerFrame);
  pointerFrame = 0;
  pointerPosition = null;
  hero.style.removeProperty('--scene-x');
  hero.style.removeProperty('--scene-y');
  hero.style.removeProperty('--scene-angle');
}
hero.addEventListener('pointermove', event => {
  if (reduceMotion.matches || !finePointer.matches || event.pointerType !== 'mouse') return;
  pointerPosition = { x: event.clientX, y: event.clientY };
  if (pointerFrame) return;
  pointerFrame = requestAnimationFrame(() => {
    pointerFrame = 0;
    if (!pointerPosition) return;
    const box = hero.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (pointerPosition.x - box.left) / box.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (pointerPosition.y - box.top) / box.height * 2 - 1));
    hero.style.setProperty('--scene-x', `${x * 6}px`);
    hero.style.setProperty('--scene-y', `${y * 4}px`);
    hero.style.setProperty('--scene-angle', `${x * .6}deg`);
  });
});
hero.addEventListener('pointerleave', resetScene);
reduceMotion.addEventListener('change', resetScene);
finePointer.addEventListener('change', resetScene);
