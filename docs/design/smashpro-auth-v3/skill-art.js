/*
 * Vector illustrations for the nine technique questions (prototype v3).
 * Side view (court, net, player, shuttle path) or top view for footwork and
 * doubles positioning. Paths use pathLength="1" so CSS can "draw" them; SMIL
 * animateMotion moves the shuttle. app.js strips the SMIL nodes when the user
 * prefers reduced motion, leaving a complete static drawing.
 */
(function (root) {
  let uid = 0;
  const FLOOR = 128;

  function figure(x, { lean = 0, jump = 0, crouch = 0, mirror = false, racketUp = true } = {}) {
    const feet = FLOOR - jump;
    const hip = feet - 24 + crouch;
    const shoulder = hip - 20;
    const head = shoulder - 9;
    const dir = mirror ? -1 : 1;
    const hand = racketUp ? [x + 10 * dir, shoulder - 14] : [x + 14 * dir, shoulder + 6];
    const racketTip = racketUp ? [hand[0] + 4 * dir, hand[1] - 14] : [hand[0] + 14 * dir, hand[1] - 4];
    return `<g class="figure" transform="rotate(${lean} ${x} ${feet})">
      <circle cx="${x}" cy="${head}" r="6"/>
      <path d="M${x} ${shoulder} L${x} ${hip} M${x} ${hip} L${x - 8} ${feet} M${x} ${hip} L${x + 9} ${feet} M${x} ${shoulder + 3} L${hand[0]} ${hand[1]} M${x} ${shoulder + 4} L${x - 9 * dir} ${shoulder + 14}"/>
      <path class="racket" d="M${hand[0]} ${hand[1]} L${racketTip[0]} ${racketTip[1]}"/>
      <ellipse class="racket-head" cx="${racketTip[0]}" cy="${racketTip[1]}" rx="4.5" ry="6" transform="rotate(${racketUp ? 15 * dir : 70 * dir} ${racketTip[0]} ${racketTip[1]})"/>
    </g>`;
  }

  function court() {
    return `<path class="floor" d="M14 ${FLOOR} H306"/>
      <path class="court-fill" d="M14 ${FLOOR} H306 L296 ${FLOOR + 10} H24 Z"/>
      <path class="net" d="M160 ${FLOOR} V86"/><path class="net-band" d="M156 86 H164"/>
      <path class="net-mesh" d="M157 92 H163 M157 99 H163 M157 106 H163 M157 113 H163 M157 120 H163"/>`;
  }

  function shot(d, { delay = 0.35, dur = 1.4, ghost = false, label } = {}) {
    const id = `traj-${++uid}`;
    return `<path id="${id}" class="traj${ghost ? ' ghost' : ''}" d="${d}" pathLength="1" style="--delay:${delay}s"/>
      ${ghost ? '' : `<g class="shuttle"><circle r="4.2"/><path d="M-3 -2 L-9 -6 M-3 2 L-9 6 M-4 0 L-11 0"/>
        <animateMotion dur="${dur}s" begin="${delay}s;${id}-loop.end+1.2s" id="${id}-loop" rotate="auto" fill="freeze"><mpath href="#${id}"/></animateMotion></g>`}
      ${label ? `<text class="art-label" x="${label[0]}" y="${label[1]}">${label[2]}</text>` : ''}`;
  }

  function landing(x) { return `<ellipse class="landing" cx="${x}" cy="${FLOOR - 1}" rx="10" ry="2.6"/>`; }

  const SIDE = {
    service: () => `${court()}${figure(58)}${shot('M72 98 Q130 58 186 126', { label: [178, 118, 'ngắn'] })}${shot('M72 98 Q186 -12 298 126', { delay: 1.2, ghost: true, label: [262, 116, 'cao sâu'] })}${landing(186)}${landing(298)}`,
    clear: () => `${court()}${figure(40, { jump: 8 })}${shot('M52 58 Q172 -34 298 126', { dur: 1.6 })}${landing(296)}`,
    smash: () => `${court()}${figure(92, { jump: 16, lean: 6 })}${shot('M104 34 L222 126', { dur: 0.8 })}${landing(222)}`,
    net: () => `${court()}${figure(126, { lean: 14, racketUp: false })}${shot('M144 104 Q158 74 174 126', { dur: 1 })}${landing(174)}`,
    defense: () => `${court()}${figure(62, { crouch: 8, racketUp: false })}${shot('M262 28 L84 108', { ghost: true, delay: 0.1 })}${shot('M78 106 Q178 -24 296 126', { delay: 0.6, dur: 1.6 })}${landing(296)}`,
    drive: () => `${court()}${figure(108, { racketUp: false })}${shot('M124 82 L300 94', { dur: 0.7 })}`,
    backhand: () => `${court()}${figure(44, { mirror: true, lean: -8 })}${shot('M36 66 Q160 6 272 126', { dur: 1.5, label: [22, 40, 'trái tay'] })}${landing(272)}`,
  };

  const TOP = {
    footwork: () => {
      const id = `fw-${++uid}`;
      const points = [[78, 30], [242, 30], [78, 80], [242, 80], [78, 130], [242, 130]];
      return `<rect class="top-court" x="60" y="16" width="200" height="128" rx="4"/>
        <path class="top-line" d="M60 58 H260 M160 16 V144 M60 120 H260"/>
        ${points.map(([x, y]) => `<path class="traj ghost" d="M160 80 L${x} ${y}" pathLength="1"/><circle class="target" cx="${x}" cy="${y}" r="5"/>`).join('')}
        <circle class="base" cx="160" cy="80" r="7"/>
        <path id="${id}" d="M160 80 L78 30 L160 80 L242 30 L160 80 L242 130 L160 80 L78 130 L160 80" fill="none" stroke="none"/>
        <circle class="mover" r="6"><animateMotion dur="5.6s" begin="0.3s" repeatCount="indefinite"><mpath href="#${id}"/></animateMotion></circle>
        <text class="art-label" x="160" y="158" text-anchor="middle">bao 6 góc sân · hồi về trung tâm</text>`;
    },
    doubles: () => `<rect class="top-court" x="70" y="22" width="180" height="120" rx="4"/>
      <path class="net-top" d="M62 22 H258"/><path class="top-line" d="M70 50 H250 M160 50 V142"/>
      <g class="player-a"><circle r="11" cx="160" cy="52"><animate attributeName="cx" values="160;118;118;160;160" keyTimes="0;.2;.5;.7;1" dur="5s" repeatCount="indefinite"/><animate attributeName="cy" values="52;88;88;52;52" keyTimes="0;.2;.5;.7;1" dur="5s" repeatCount="indefinite"/></circle></g>
      <g class="player-b"><circle r="11" cx="160" cy="116"><animate attributeName="cx" values="160;202;202;160;160" keyTimes="0;.2;.5;.7;1" dur="5s" repeatCount="indefinite"/><animate attributeName="cy" values="116;88;88;116;116" keyTimes="0;.2;.5;.7;1" dur="5s" repeatCount="indefinite"/></circle></g>
      <text class="art-label" x="160" y="160" text-anchor="middle">tấn công trên–dưới ⇄ phòng thủ hai bên</text>`,
  };

  function render(name) {
    const body = SIDE[name] ? SIDE[name]() : TOP[name]();
    const view = SIDE[name] ? '0 0 320 150' : '0 0 320 166';
    return `<svg class="skill-art" viewBox="${view}" aria-hidden="true">${body}</svg>`;
  }

  root.SmashProSkillArt = { render };
})(window);
