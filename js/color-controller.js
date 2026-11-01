// ============================================
// Color Controller — the room's background and its two shelf colours
// ============================================
/* The shelves carry two colours: one for good news (a small amount knocked
   out) and one for bad news (a big one), with a third accent stripe flowing
   along the rails. Most of the choices here are palettes picked as whole
   rooms, so the background and both shelf colours always hold together; the
   last card hands over the paint pots and lets you choose any colour you like,
   MS Paint style. Picking one repaints the whole app. */
import { dom } from './game.js?v=106';
import { logEvent } from './helpers.js?v=120';

const STORAGE_KEY = 'dnd_color_theme';
const CUSTOM_KEY = 'dnd_color_custom';

export const THEMES = [
  {
    id: 'house',
    name: 'House Lights',
    good: '#ffd84d', bad: '#ff3b3b', accent: '#2b6fff',
    bg: 'radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(95,168,211,0.14), transparent 60%), ' +
        'radial-gradient(ellipse 900px 500px at 50% 110%, rgba(255,204,51,0.06), transparent 60%), #04060d',
  },
  {
    id: 'emerald',
    name: 'Emerald Room',
    good: '#5ce08e', bad: '#e2514a', accent: '#17b8a6',
    bg: 'radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(74,222,128,0.15), transparent 60%), ' +
        'radial-gradient(ellipse 900px 500px at 50% 110%, rgba(20,184,166,0.09), transparent 60%), #04120c',
  },
  {
    id: 'sunset',
    name: 'Sunset Deck',
    good: '#ffb347', bad: '#d94f6b', accent: '#7c5cff',
    bg: 'radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(255,140,80,0.17), transparent 60%), ' +
        'radial-gradient(ellipse 900px 500px at 50% 110%, rgba(124,92,255,0.12), transparent 60%), #120a12',
  },
  {
    id: 'ice',
    name: 'Ice Room',
    good: '#7fe3ff', bad: '#ff7a59', accent: '#4d9fff',
    bg: 'radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(127,227,255,0.16), transparent 60%), ' +
        'radial-gradient(ellipse 900px 500px at 50% 110%, rgba(77,159,255,0.10), transparent 60%), #050b14',
  },
  {
    id: 'arcade',
    name: 'Neon Arcade',
    good: '#ffe066', bad: '#ff4d8d', accent: '#00d1c1',
    bg: 'radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(255,77,141,0.16), transparent 60%), ' +
        'radial-gradient(ellipse 900px 500px at 50% 110%, rgba(0,209,193,0.10), transparent 60%), #0a0612',
  },
  {
    id: 'royal',
    name: 'Royal Table',
    good: '#f0c074', bad: '#c8537a', accent: '#6f6bff',
    bg: 'radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(142,91,255,0.18), transparent 60%), ' +
        'radial-gradient(ellipse 900px 500px at 50% 110%, rgba(240,192,116,0.07), transparent 60%), #0b0616',
  },
  {
    id: 'mono',
    name: 'Studio Mono',
    good: '#f2f4f7', bad: '#ff6b6b', accent: '#9aa2ae',
    bg: 'radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(242,244,247,0.09), transparent 60%), ' +
        'radial-gradient(ellipse 900px 500px at 50% 110%, rgba(154,162,174,0.08), transparent 60%), #0a0b0d',
  },
  {
    id: 'copper',
    name: 'Copper Club',
    good: '#e6b422', bad: '#b3402f', accent: '#d97b29',
    bg: 'radial-gradient(ellipse 1200px 600px at 50% -10%, rgba(230,180,34,0.14), transparent 60%), ' +
        'radial-gradient(ellipse 900px 500px at 50% 110%, rgba(217,123,41,0.09), transparent 60%), #120b06',
  },
];

const CUSTOM_ID = 'custom';

let activeId = THEMES[0].id;
/* The user's own three colours: the base of the room and the two shelf colours.
   The glows over the base are mixed from the shelf colours, so even a freely
   chosen set still looks like one room. */
let custom = { base: '#04060d', good: '#ffd84d', bad: '#ff3b3b' };

/* ---------- Colour maths ---------- */
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex({ r, g, b }) {
  const clamp = v => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

function rgbaOf(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Mixes two colours — used to soften the custom room's glows. */
function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return rgbToHex({ r: A.r + (B.r - A.r) * t, g: A.g + (B.g - A.g) * t, b: A.b + (B.b - A.b) * t });
}

/** The custom room's background: the chosen base, lit by both shelf colours. */
function customBackground() {
  return `radial-gradient(ellipse 1200px 600px at 50% -10%, ${rgbaOf(custom.good, 0.16)}, transparent 60%), ` +
         `radial-gradient(ellipse 900px 500px at 50% 110%, ${rgbaOf(custom.bad, 0.12)}, transparent 60%), ` +
         `${custom.base}`;
}

/* ---------- Applying a room ---------- */
function paint({ bg, good, bad, accent }) {
  const root = document.documentElement;
  root.style.setProperty('--app-bg', bg);
  root.style.setProperty('--shelf-a', good);
  root.style.setProperty('--shelf-b', bad);
  root.style.setProperty('--shelf-accent', accent);
}

function remember(id) {
  activeId = id;
  try { localStorage.setItem(STORAGE_KEY, id); } catch (e) { /* storage may be off */ }
  markActive();
}

/** Repaints the app in one of the ready-made palettes. */
export function applyTheme(id, announce) {
  const theme = THEMES.find(t => t.id === id) || THEMES[0];
  paint(theme);
  remember(theme.id);
  if (announce) logEvent(`🖌️ Colour set: <b>${theme.name}</b>.`);
}

/** Repaints the app in the colours picked by hand. The rail accent is the bad
 *  colour itself, so the flowing stripes show exactly the two colours chosen. */
export function applyCustomColors(announce) {
  paint({
    bg: customBackground(),
    good: custom.good,
    bad: custom.bad,
    accent: mix(custom.bad, custom.good, 0.35),
  });
  remember(CUSTOM_ID);
  syncCustomInputs();
  refreshCustomCard();
  try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom)); } catch (e) { /* ignore */ }
  if (announce) logEvent(`🖌️ Colour set: <b>Custom</b> (${custom.good} / ${custom.bad}).`);
}

export function getThemeId() {
  return activeId;
}

function markActive() {
  if (!dom.colorGrid) return;
  dom.colorGrid.querySelectorAll('.color-theme').forEach(el => {
    el.classList.toggle('active', el.dataset.theme === activeId);
  });
}

/* ---------- Panel pieces ---------- */
function shelfStrip(colors) {
  const bars = document.createElement('span');
  bars.className = 'color-theme-bars';
  colors.forEach(color => {
    const bar = document.createElement('span');
    bar.style.background = color;
    bars.appendChild(bar);
  });
  return bars;
}

function makeCard(id, name, bg, colors) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'color-theme';
  card.dataset.theme = id;
  card.title = name;

  const preview = document.createElement('span');
  preview.className = 'color-theme-preview';
  preview.style.background = bg;
  preview.appendChild(shelfStrip(colors));

  const label = document.createElement('span');
  label.className = 'color-theme-name';
  label.textContent = name;

  card.appendChild(preview);
  card.appendChild(label);
  return card;
}

/** Lays the ready-made rooms out, with the hand-mixed card last. */
function buildGrid() {
  if (!dom.colorGrid) return;
  dom.colorGrid.innerHTML = '';
  THEMES.forEach(theme => {
    const card = makeCard(theme.id, theme.name, theme.bg, [theme.good, theme.bad, theme.accent]);
    card.addEventListener('click', () => applyTheme(theme.id, true));
    dom.colorGrid.appendChild(card);
  });

  const customCard = makeCard(CUSTOM_ID, 'Custom paints', customBackground(), [custom.good, custom.bad, mix(custom.bad, custom.good, 0.35)]);
  customCard.addEventListener('click', () => applyCustomColors(false));
  dom.colorGrid.appendChild(customCard);
  markActive();
  refreshCustomCard();
}

/** Keeps the custom card's preview in step with the pickers. */
function refreshCustomCard() {
  if (!dom.colorGrid) return;
  const card = dom.colorGrid.querySelector('.color-theme[data-theme="custom"]');
  if (!card) return;
  const preview = card.querySelector('.color-theme-preview');
  if (preview) preview.style.background = customBackground();
  const bars = card.querySelectorAll('.color-theme-bars span');
  if (bars.length === 3) {
    bars[0].style.background = custom.good;
    bars[1].style.background = custom.bad;
    bars[2].style.background = mix(custom.bad, custom.good, 0.35);
  }
}

/** Pushes the stored custom colours into the three paint pots. */
function syncCustomInputs() {
  if (dom.customBgInput) dom.customBgInput.value = custom.base;
  if (dom.customGoodInput) dom.customGoodInput.value = custom.good;
  if (dom.customBadInput) dom.customBadInput.value = custom.bad;
  if (dom.customBgHex) dom.customBgHex.textContent = custom.base;
  if (dom.customGoodHex) dom.customGoodHex.textContent = custom.good;
  if (dom.customBadHex) dom.customBadHex.textContent = custom.bad;
}

function openPanel() {
  buildGrid();
  syncCustomInputs();
  dom.colorPanel.style.display = 'flex';
}

function closePanel() {
  dom.colorPanel.style.display = 'none';
}

export function initColorController() {
  if (!dom.colorBtn || !dom.colorPanel || !dom.colorGrid) return;

  try {
    const savedCustom = JSON.parse(localStorage.getItem(CUSTOM_KEY) || 'null');
    if (savedCustom && savedCustom.base && savedCustom.good && savedCustom.bad) custom = savedCustom;
  } catch (e) { /* keep the defaults */ }

  let saved = THEMES[0].id;
  try { saved = localStorage.getItem(STORAGE_KEY) || THEMES[0].id; } catch (e) { /* ignore */ }
  if (saved === CUSTOM_ID) applyCustomColors(false);
  else applyTheme(saved, false);

  // A picker writes on every move of the wheel, so the board follows live.
  [['customBgInput', 'base'], ['customGoodInput', 'good'], ['customBadInput', 'bad']].forEach(([key, field]) => {
    const input = dom[key];
    if (!input) return;
    input.addEventListener('input', () => {
      custom[field] = input.value;
      applyCustomColors(false);
    });
  });

  dom.colorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dom.colorPanel.style.display === 'flex') closePanel();
    else openPanel();
  });
  dom.closeColorBtn.addEventListener('click', closePanel);
}
