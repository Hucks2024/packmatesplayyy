/* Packmates: the app's own map, for the first four scenes of the tour.
   Drawn in the page itself (SVG and HTML), not in 3D, so the map, the pins, the card and the words on it
   are sharp on every screen. js/tour.js calls update(u) every frame with the scroll (u, 0..1):

     1  pins pop onto an empty map                       u 0.00 – 0.13
     2  zoom into one pin, its card opens                u 0.13 – 0.29
     3  a thumb taps "I'm in", faces stack up 1, 2, 3, 4  u 0.29 – 0.45
     4  night falls, the clock spins to Saturday 8:00,
        and the layer fades to the 3D runners            u 0.45 – 0.58
     5  a big pin whose badge changes: coffee, walk, ball u 0.62 – 0.81 (over the 3D scenes) */

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const backOut = (t) => { const c = 1.9; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

let seed = 7311;
const rnd = () => {
  seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// The Packmates pin: a rounded teardrop in the brand gradient. Like the app, a meetup's pin shows its
// activity as an emoji in a white circle; without one it shows the three people of the logo.
let pinCount = 0;
export function pinSVG(cls = '', emoji = '') {
  const id = `pg${pinCount++}`;
  return `<svg class="${cls}" viewBox="0 0 100 130" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#8b5cf6"/><stop offset=".55" stop-color="#c026d3"/><stop offset="1" stop-color="#ec4899"/>
    </linearGradient></defs>
    <path d="M50 127C25 98 6.6 72 6.6 46 6.6 15 25 3 50 3s43.4 12 43.4 43c0 26-18.4 52-43.4 81z" fill="url(#${id})"/>
    ${emoji ? `<circle cx="50" cy="46" r="31" fill="#fff"/>
    <text x="50" y="47" text-anchor="middle" dominant-baseline="central" font-size="36"
      font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif">${emoji}</text>` : `<g fill="#fff">
      <circle cx="25.2" cy="53" r="4.4"/><rect x="17.3" y="60" width="15.9" height="18" rx="7"/>
      <circle cx="74.8" cy="53" r="4.4"/><rect x="66.9" y="60" width="15.9" height="18" rx="7"/>
      <circle cx="50" cy="44.5" r="5.8"/><rect x="39.8" y="53.5" width="20.4" height="23" rx="9"/>
    </g>`}
  </svg>`;
}

const FACES = [
  ['#d9a273', '#7c3aed', '#2a1d18'], ['#f2c9a5', '#ec4899', '#8a5a2c'], ['#a9714b', '#fbbf24', '#151318'],
  ['#f6d7bd', '#38bdf8', '#d7b46a'], ['#7a4b2f', '#34d399', '#151318'],
];
const faceSVG = ([skin, shirt, hair]) => `<svg viewBox="0 0 40 40" aria-hidden="true">
  <circle cx="20" cy="20" r="20" fill="${shirt}"/>
  <clipPath id="fc${pinCount}"><circle cx="20" cy="20" r="20"/></clipPath>
  <g clip-path="url(#fc${pinCount++})">
    <ellipse cx="20" cy="40" rx="13" ry="10" fill="${skin}" opacity=".9"/>
    <circle cx="20" cy="17" r="8.5" fill="${skin}"/>
    <path d="M11.3 15.5a8.7 8.7 0 0 1 17.4 0c-3-2.6-14.4-2.6-17.4 0z" fill="${hair}"/>
  </g></svg>`;

// The map itself: a made-up neighbourhood, 1600 x 1600, with a park in the middle.
function mapSVG() {
  const blocks = [];
  for (let y = 40; y < 1600; y += 150) for (let x = 40; x < 1600; x += 170) {
    if (rnd() < 0.12) continue;
    blocks.push(`<rect x="${x + rnd() * 10}" y="${y + rnd() * 10}" width="${120 + rnd() * 20}" height="${100 + rnd() * 18}" rx="14"/>`);
  }
  const trees = [];
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd());
    trees.push(`<circle cx="${(800 + Math.cos(a) * r * 170).toFixed(1)}" cy="${(760 + Math.sin(a) * r * 120).toFixed(1)}" r="${(7 + rnd() * 7).toFixed(1)}"/>`);
  }
  return `<svg class="mapui__map" viewBox="0 0 1600 1600" aria-hidden="true">
    <rect width="1600" height="1600" fill="#eceaf8"/>
    <g fill="#dedbf2">${blocks.join('')}</g>
    <path d="M-20 1040C240 960 420 1130 700 1080S1180 930 1620 1010V1110C1180 1030 980 1190 700 1180S240 1060-20 1140Z" fill="#bcd9f7"/>
    <g stroke="#fff" stroke-linecap="round" fill="none">
      <g stroke-width="34"><path d="M-20 590H1620"/><path d="M560-20V1620"/><path d="M-20 300L1620 380"/><path d="M1120-20L1180 1620"/></g>
      <g stroke-width="16"><path d="M-20 860H1620"/><path d="M300-20V1620"/><path d="M-20 1340H1620"/><path d="M850-20V560"/><path d="M1400-20V1620"/></g>
    </g>
    <rect x="610" y="620" width="400" height="290" rx="70" fill="#c6e6c9"/>
    <path d="M650 840C760 700 880 820 980 700" stroke="#e6d3c1" stroke-width="14" fill="none" stroke-linecap="round"/>
    <g fill="#9fd0a4">${trees.join('')}</g>
    <rect x="80" y="1180" width="180" height="130" rx="40" fill="#c6e6c9"/>
    <rect x="1230" y="160" width="150" height="120" rx="40" fill="#c6e6c9"/>
    <text x="810" y="900" text-anchor="middle" font-family="Open Sans, system-ui, sans-serif" font-weight="700" font-size="22" fill="#3f7a4a">The Park</text>
  </svg>`;
}

export function createMapUI(stage) {
  const el = document.createElement('div');
  el.className = 'mapui';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="mapui__plane">${mapSVG()}<div class="mapui__pins"></div></div>
    <div class="mapui__night"></div>
    <div class="mapui__clock">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="56" fill="#fff"/>
        <g stroke="#c4b5fd" stroke-width="4" stroke-linecap="round">${Array.from({ length: 12 }, (_, i) => `<line x1="60" y1="10" x2="60" y2="${i % 3 ? 16 : 20}" transform="rotate(${i * 30} 60 60)"/>`).join('')}</g>
        <line class="mapui__hour" x1="60" y1="60" x2="60" y2="32" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
        <line class="mapui__min" x1="60" y1="60" x2="60" y2="20" stroke="#7c3aed" stroke-width="4.5" stroke-linecap="round"/>
        <circle cx="60" cy="60" r="5" fill="#0f172a"/>
      </svg>
      <p class="mapui__time"><b>FRI</b> <span>21:00</span></p>
    </div>
    <div class="mapui__card">
      <div class="mapui__grab"></div>
      <p class="mapui__title">🏃 Saturday run</p>
      <p class="mapui__meta">8:00 · The Park</p>
      <div class="mapui__going"><div class="mapui__faces">${FACES.map((f) => `<span class="mapui__face">${faceSVG(f)}</span>`).join('')}</div><span class="mapui__count">Be the first</span></div>
      <div class="mapui__btn"><span class="mapui__btn-in">I'm in</span><span class="mapui__btn-done">You're in ✓</span></div>
      <svg class="mapui__thumb" viewBox="0 0 120 240" aria-hidden="true">
        <rect x="18" y="8" width="84" height="260" rx="42" fill="#e9b893"/>
        <rect x="34" y="20" width="52" height="56" rx="24" fill="#f7dccb"/>
        <path d="M30 120c20 8 40 8 60 0" stroke="#d39d78" stroke-width="4" fill="none" stroke-linecap="round"/>
      </svg>
    </div>
`;
  stage.insertBefore(el, stage.querySelector('.caps'));
  // scene 5's pin sits over the 3D scenes, so it lives outside the map layer
  const badge = document.createElement('div');
  badge.className = 'mapui__badge';
  badge.setAttribute('aria-hidden', 'true');
  // one pin for each of coffee, a walk and a kickabout, the same pin the map uses; they swap as you scroll
  badge.innerHTML = ['☕', '🚶', '⚽'].map((e) => `<span class="mapui__swap">${pinSVG('mapui__badge-pin', e)}</span>`).join('');
  stage.insertBefore(badge, stage.querySelector('.caps'));

  const plane = el.querySelector('.mapui__plane');
  const night = el.querySelector('.mapui__night');
  const clock = el.querySelector('.mapui__clock');
  const hourHand = el.querySelector('.mapui__hour'), minHand = el.querySelector('.mapui__min');
  const timeDay = el.querySelector('.mapui__time b'), timeText = el.querySelector('.mapui__time span');
  const card = el.querySelector('.mapui__card');
  const faces = [...el.querySelectorAll('.mapui__face')];
  const count = el.querySelector('.mapui__count');
  const btn = el.querySelector('.mapui__btn');
  const thumb = el.querySelector('.mapui__thumb');
  const emojis = [...badge.querySelectorAll('.mapui__swap')];

  // the pins: the run in the park, and the other meetups around it, popping in from the middle outwards
  const TARGET = { x: 800, y: 735 };
  const spots = [{ ...TARGET, target: true }];
  for (let tries = 0; spots.length < 30 && tries < 2000; tries++) {
    const x = 120 + rnd() * 1360, y = 120 + rnd() * 1360;
    if (y > 980 && y < 1200) continue;                                   // not in the river
    if (spots.every((s) => Math.hypot(s.x - x, s.y - y) > 165)) spots.push({ x, y });
  }
  spots.sort((a, b) => Math.hypot(a.x - 800, a.y - 780) - Math.hypot(b.x - 800, b.y - 780));
  const pinBox = el.querySelector('.mapui__pins');
  const ACTIVITIES = ['☕', '🚶', '⚽', '🧘', '🎲', '🚴', '🏊', '🎾', '🍕', '🎨', '🥾', '🏀'];
  const pins = spots.map((s, i) => {
    const p = document.createElement('div');
    p.className = 'mapui__pin' + (s.target ? ' is-target' : '');
    p.style.left = `${s.x}px`;
    p.style.top = `${s.y}px`;
    p.innerHTML = (s.target ? '<span class="mapui__ring"></span>' : '') + pinSVG('', s.target ? '🏃' : ACTIVITIES[i % ACTIVITIES.length]);
    pinBox.appendChild(p);
    return { el: p, at: 0.015 + (i / spots.length) * 0.1, last: '' };
  });

  let W = 1, H = 1, base = 1, last = {};
  const set = (node, key, prop, value) => {
    if (last[key] === value) return;
    last[key] = value;
    node.style.setProperty(prop, value);
  };
  const toggle = (node, key, cls, on) => {
    if (last[key] === on) return;
    last[key] = on;
    node.classList.toggle(cls, on);
  };

  function resize(w, h) {
    W = w; H = h;
    base = Math.max(W, H) * 1.12 / 1600;
    last = {};
  }

  function update(u) {
    const cover = 1 - smooth(0.535, 0.575, u);
    set(el, 'o', 'opacity', cover.toFixed(3));
    toggle(el, 'off', 'is-off', cover <= 0.001);
    // scene 5's badge lives in this layer too, over the 3D scenes
    const b = smooth(0.62, 0.64, u) * (1 - smooth(0.795, 0.815, u));
    set(badge, 'b', 'opacity', b.toFixed(3));
    set(badge, 'bs', 'transform', `translateX(-50%) scale(${(0.6 + 0.4 * backOut(clamp((u - 0.62) / 0.03))).toFixed(3)})`);
    const which = u < 0.69 ? 0 : u < 0.75 ? 1 : 2;
    emojis.forEach((e, i) => toggle(e, `e${i}`, 'is-on', i === which));
    if (cover <= 0.001) return;

    // 1 and 2: the whole map, then in to the run's pin
    const narrow = W / H < 0.9;
    const z = smooth(0.13, 0.22, u);
    const k = base * lerp(1, narrow ? 2.4 : 2.1, z);
    const focusX = lerp(800, TARGET.x, z), focusY = lerp(800, TARGET.y, z);
    const sx = lerp(0.5, narrow ? 0.5 : 0.4, z) * W, sy = lerp(0.5, narrow ? 0.5 : 0.42, z) * H;
    set(plane, 'p', 'transform', `translate3d(${(sx - focusX * k).toFixed(1)}px, ${(sy - focusY * k).toFixed(1)}px, 0) scale(${k.toFixed(4)})`);
    const grow = 1 / Math.pow(k / base, 0.65);             // pins don't grow as much as the map does
    pins.forEach((p, i) => {
      const pop = backOut(clamp((u - p.at) / 0.02));
      const big = i === 0 ? 1 + 0.5 * z : 1;
      const v = `translate(-50%, -100%) scale(${(Math.max(0, pop) * grow * big).toFixed(3)})`;
      if (v !== p.last) { p.last = v; p.el.style.transform = v; }
    });
    toggle(el, 'zoomed', 'is-zoomed', z > 0.5);

    // 2 and 3: the card, the thumb, the faces
    const up = smooth(0.2, 0.25, u);
    set(card, 'c', 'transform', `translateY(${((1 - up) * 120).toFixed(1)}%)`);
    set(card, 'co', 'opacity', up.toFixed(3));
    const tIn = smooth(0.305, 0.335, u) * (1 - smooth(0.36, 0.385, u));
    const press = Math.sin(clamp((u - 0.338) / 0.016) * Math.PI);
    set(thumb, 't', 'transform', `translate(${((1 - tIn) * 90).toFixed(1)}%, ${((1 - tIn) * 120).toFixed(1)}%) rotate(-24deg) scale(${(1 - 0.07 * press).toFixed(3)})`);
    set(thumb, 'to', 'opacity', tIn.toFixed(3));
    set(btn, 'bp', 'transform', `scale(${(1 - 0.04 * press).toFixed(3)})`);
    const done = u >= 0.348;
    toggle(btn, 'done', 'is-done', done);
    const n = !done ? 0 : u < 0.49 ? 1 + Math.floor(clamp((u - 0.36) / 0.08) * 3.999) : 5;
    faces.forEach((f, i) => toggle(f, `f${i}`, 'is-on', i < n));
    const label = n ? `${n} going` : 'Be the first';
    if (last.n !== label) { last.n = label; count.textContent = label; }
    // the faces grow into the five people running, as the map gives way to the park
    set(card, 'fs', '--grow', (1 + 0.9 * smooth(0.53, 0.57, u)).toFixed(3));

    // 4: night falls, the clock runs to Saturday 8:00, morning comes
    const dark = smooth(0.452, 0.475, u) * (1 - smooth(0.505, 0.53, u));
    set(night, 'n', 'opacity', (dark * 0.72).toFixed(3));
    const cl = smooth(0.455, 0.47, u) * (1 - smooth(0.535, 0.55, u));
    set(clock, 'cl', 'opacity', cl.toFixed(3));
    set(clock, 'cs', 'transform', `translate(-50%, -50%) scale(${(0.7 + 0.3 * backOut(clamp((u - 0.455) / 0.02))).toFixed(3)})`);
    const mins = 21 * 60 + Math.round(660 * smooth(0.47, 0.525, u));
    minHand.setAttribute('transform', `rotate(${(mins % 60) * 6} 60 60)`);
    hourHand.setAttribute('transform', `rotate(${((mins / 60) % 12) * 30} 60 60)`);
    const day = mins >= 24 * 60 ? 'SAT' : 'FRI';
    const text = `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
    if (last.day !== day) { last.day = day; timeDay.textContent = day; }
    if (last.time !== text) { last.time = text; timeText.textContent = text; }
    toggle(clock, 'ready', 'is-time', mins >= 21 * 60 + 660);
  }

  return { el, resize, update };
}
