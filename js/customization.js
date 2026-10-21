// ============================================
// Customization Picker (case interior + board value backgrounds)
// ============================================
import { game, dom } from './game.js?v=100';
import { offerStripTickSound } from './sound.js?v=109';
import { formatNumber } from './helpers.js?v=101';
import { renderBoard } from './render.js?v=102';

/* ---------- Case Interior Background ---------- */
const BG_OPTIONS = [
  { id: 'default', label: 'Hex Pattern', class: '', swatch: 'linear-gradient(135deg,#000 0%,#161616 100%)' },
  { id: 'usgrid', label: 'US Style', class: 'interior-usgrid', swatch: 'linear-gradient(135deg,#4c525a 30%,#4a4342 30%,#4a4342 70%,#4c525a 70%)' },
];

let currentBgId = localStorage.getItem('dnd_interior_bg') || 'default';

/* ---------- Prize Board Value Background ---------- */
const BOARD_BG_OPTIONS = [
  { id: 'default', label: 'Classic Yellow', class: '', swatch: 'linear-gradient(180deg,#f4d258,#e2b63e)' },
  { id: 'blue', label: 'Blue', class: 'board-bg-blue', swatch: 'linear-gradient(180deg,#2f66ff,#1237b8)' },
  { id: 'gold', label: 'Gold', class: 'board-bg-gold', swatch: 'linear-gradient(180deg,#f7d874,#c99b2e)' },
  { id: 'red', label: 'Red', class: 'board-bg-red', swatch: 'linear-gradient(180deg,#e8505f,#a11f2e)' },
  { id: 'emerald', label: 'Emerald', class: 'board-bg-emerald', swatch: 'linear-gradient(180deg,#1fae6a,#0b6b3d)' },
  { id: 'dark', label: 'Dark', class: 'board-bg-dark', swatch: 'linear-gradient(180deg,#3a3f4a,#1e222b)' },
  { id: 'squares', label: 'Squares', class: 'board-bg-squares', swatch: 'repeating-linear-gradient(90deg,#fff8e0 0 10px,#d9a52e 10px 13px)' },
];

let currentBoardBgId = localStorage.getItem('dnd_board_bg') || 'default';

/** Returns the active prize-board background id ('default', 'squares', ...). */
export function getBoardBgId() {
  return currentBoardBgId;
}

/** Returns the active case-interior background id ('default', 'usgrid', ...). */
export function getInteriorBgId() {
  return currentBgId;
}

/* Squares style: split a text element into one square cell per character.
   Every prize uses the same width, expanding beyond seven cells when a board
   contains a larger value. Commas get no square. */
const SQ_FULL_WIDTH = 7;
function getBoardSquareWidth() {
  return Math.max(SQ_FULL_WIDTH, ...game.amounts.map(({ value }) =>
    formatNumber(value).replace(/,/g, '').length
  ));
}

export function wrapValueSquares(el, pad) {
  const text = el.textContent;
  el.textContent = '';
  const chars = [];
  for (const ch of text) {
    if (ch === ',') continue; // skip commas — no square needed
    chars.push(ch);
  }
  if (pad) {
    const width = getBoardSquareWidth() + (text.trimStart().startsWith('$') ? 1 : 0);
    while (chars.length < width) chars.unshift(' ');
  }
  for (const ch of chars) {
    const span = document.createElement('span');
    span.className = 'sq-char' + (ch === '.' ? ' sq-char-dim' : '') + (ch === ' ' ? ' sq-char-empty' : '');
    if (ch !== ' ') {
      const value = document.createElement('span');
      value.className = 'sq-char-value';
      value.textContent = ch;
      span.appendChild(value);
    }
    el.appendChild(span);
  }
}

/* ---------- Squares: Banker Offer tile ---------- */
/* In Squares mode the banker offer tile re-renders its plain amount text
   with the same square-grid cells the prize board uses: one yellow square
   per character ($ and commas included), blanks padded to the 7-slot board
   width — e.g. [ ][1][,][5][0][0]. A MutationObserver keeps the cells in
   sync with every writer of the tile (offer reveal, currency refresh, DEAL /
   NO DEAL, counter offer); the counter-offer markup keeps its normal design. */
const OFFER_SQUARES_TEXT = /^[0-9,$.\s]+$/;
/* Decision words keep their own cell layout in the strip:
   DEAL    -> [ ][ ][D][E][A][L][ ]  (centered)
   NO DEAL -> [N][O][ ][D][E][A][L]  (the word gap stays a blank cell) */
const OFFER_DECISION_CELLS = {
  DEAL: ['D', 'E', 'A', 'L'],
  NODEAL: ['N', 'O', ' ', 'D', 'E', 'A', 'L'],
};
const offerSquareObserver = new MutationObserver(() => renderOfferTileSquares());

/* ---------- Squares: reveal sweep ---------- */
/* The squares never rotate. On reveal a soft light line runs from the top of the
   strip to the bottom while every square spins through its own character run and
   lands on its own beat: 67,500 reads
   [ ] 0,1,...,9, , ,0 then blank
   [6] 0,1,...,9, , ,0,1,...,6
   [,] 0,1,...,9, , ,0,1,...,9, ,
   and so on. Letter states (DEAL / NO DEAL) spin A-Z instead. Every character
   change runs a light line down that one square and clicks once; the container
   itself never moves. */
const DIGIT_ALPHABET = '0123456789,';
const LETTER_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const REVEAL_TICK = 45;     // ms per spin step
const REVEAL_LIMIT = 3000;  // failsafe: always hand the tile back
const CELL_SWEEP_MS = 120;  // light line run per character change
const CELL_SWEEP_IMAGE = 'linear-gradient(180deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.9) 50%, rgba(255,255,255,0) 100%)';
let offerFlipRunning = false;

/** Runs the light line from the top of one square to its bottom. */
function sweepOfferCell(cell) {
  cell.animate([
    { backgroundImage: CELL_SWEEP_IMAGE, backgroundRepeat: 'no-repeat', backgroundSize: '100% 55%', backgroundPosition: 'center -80%' },
    { backgroundImage: CELL_SWEEP_IMAGE, backgroundRepeat: 'no-repeat', backgroundSize: '100% 55%', backgroundPosition: 'center 180%' },
  ], { duration: CELL_SWEEP_MS, easing: 'linear' });
}

/** Sweeps each square and clicks as its character changes while the strip spins. */
function animateOfferCells(tile) {
  const cells = [...tile.children].filter(el => el.classList.contains('offer-sq-char'));
  if (!cells.length) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const isWord = cells.some(cell => /[A-Za-z]/.test(cell.textContent));
  const alphabet = isWord ? LETTER_ALPHABET : DIGIT_ALPHABET;
  // A-Z is a longer run than 0-9, so letters spin a little faster to keep the
  // whole reveal around a second.
  const tick = isWord ? 30 : REVEAL_TICK;
  // Every square spins through one full pass before it may stop, so short runs
  // still read as a spin rather than a flicker.
  const firstLandStep = alphabet.length;
  const spinners = cells.map(cell => {
    let value = cell.querySelector('.sq-char-value');
    const target = value ? value.textContent : ' ';
    if (!value) {
      // Blank squares spin too, then empty out again when they land.
      value = document.createElement('span');
      value.className = 'sq-char-value';
      value.style.fontSize = '0.85em';
      value.style.padding = '4px 2px';
      cell.appendChild(value);
    }
    return { cell, value, target, spun: false };
  });

  offerFlipRunning = true;
  let step = 0;
  let remaining = spinners.length;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    clearInterval(timer);
    clearTimeout(failsafe);
    spinners.forEach(({ value, target }) => {
      if (target === ' ') value.remove();
      else value.textContent = target;
    });
    offerFlipRunning = false;
    // Re-sync in case something wrote to the tile while it was spinning.
    renderOfferTileSquares();
  };

  const timer = setInterval(() => {
    let changed = false;
    spinners.forEach(s => {
      if (s.spun) return;
      const ch = alphabet[step % alphabet.length];
      if (step >= firstLandStep) {
        const idx = alphabet.indexOf(s.target);
        // Blanks land one step later so they clear after the line passes; a
        // character outside the run (like '.') lands after a second pass.
        const landing = s.target === ' '
          ? step >= firstLandStep + 1
          : idx === -1
            ? step >= firstLandStep * 2
            : ch === s.target;
        if (landing) {
          if (s.target === ' ') s.value.remove();
          else s.value.textContent = s.target;
          s.spun = true;
          remaining--;
          changed = true;
          sweepOfferCell(s.cell);
          return;
        }
      }
      if (s.value.textContent !== ch) {
        s.value.textContent = ch;
        changed = true;
        sweepOfferCell(s.cell);
      }
    });
    // One click per strip change, not one per square.
    if (changed) offerStripTickSound(step);
    step++;
    if (remaining <= 0) finish();
  }, tick);

  const failsafe = setTimeout(finish, REVEAL_LIMIT);
}

/** Re-renders the offer tile's amount into per-character yellow squares (Squares mode).
 *  Before the first offer is revealed the tile has no text at all, but it still
 *  shows the same square strip filled with blank cells, so the squares container
 *  is on screen from the start of the game instead of appearing only on reveal. */
function renderOfferTileSquares() {
  const tile = dom.bankerOfferDisplay;
  if (!tile) return;
  if (offerFlipRunning) return; // the flip owns the cells until it finishes
  const text = tile.textContent.replace(/\s/g, '');
  const squaresMode = getBoardBgId() === 'squares';
  const isAmount = !!text && OFFER_SQUARES_TEXT.test(text);
  const decisionCells = OFFER_DECISION_CELLS[text];
  // Empty tile = no offer revealed yet: show the blank grid, not nothing.
  const showGrid = squaresMode && (isAmount || !!decisionCells || text === '');
  if (!showGrid) {
    // Leaving squares mode (or a state that is not an amount, decision word or
    // blank tile, e.g. the counter offer): restore the tile's normal look.
    const cells = [...tile.querySelectorAll('.offer-sq-char .sq-char-value')].map(v => v.textContent);
    if (tile.dataset.squaresApplied === '1') {
      delete tile.dataset.squaresApplied;
      tile.classList.remove('offer-squares');
      if (cells.length) tile.textContent = cells.join('');
    } else {
      tile.classList.remove('offer-squares');
    }
    return;
  }
  // Target cell row: amount, decision word, or seven blanks before the first
  // offer. Anything shorter than the 7-slot strip is centered, with the odd
  // blank on the left (55,500 -> [ ][5][5][,][5][0][0], 299 -> [ ][ ][2][9][9][ ][ ],
  // DEAL -> [ ][ ][D][E][A][L][ ]). Amounts of 7+ characters (like 1,000,000)
  // render at natural width with no padding.
  const chars = isAmount ? text.split('') : decisionCells ? [...decisionCells] : [];
  if (chars.length < SQ_FULL_WIDTH) {
    const padTotal = SQ_FULL_WIDTH - chars.length;
    const padLeft = Math.ceil(padTotal / 2);
    const padRight = padTotal - padLeft;
    for (let i = 0; i < padLeft; i++) chars.unshift(' ');
    for (let i = 0; i < padRight; i++) chars.push(' ');
  }
  // Skip the rebuild when the tile already shows exactly these cells — keeps the
  // observer from looping on its own mutations.
  const rendered = [...tile.children].filter(el => el.classList.contains('offer-sq-char'));
  const renderedChars = rendered.map(sp => {
    const value = sp.querySelector('.sq-char-value');
    return value ? value.textContent : ' ';
  });
  if (renderedChars.length === chars.length && renderedChars.join('') === chars.join('')) return;
  // Writers assign textContent, which wipes the cells before this runs, so the
  // grid left behind is remembered on the tile itself rather than read from DOM.
  const hadGrid = tile.dataset.squaresApplied === '1';
  tile.dataset.squaresApplied = '1';
  tile.classList.add('offer-squares');
  tile.textContent = '';
  tile.style.padding = '4px 2px';
  for (const ch of chars) {
    const span = document.createElement('span');
    span.className = 'offer-sq-char' + (ch === ' ' ? ' sq-char-empty' : '');
    if (ch !== ' ') {
      const value = document.createElement('span');
      value.className = 'sq-char-value';
      value.textContent = ch;
      span.appendChild(value);
      // Make font size a bit small in offer container
      value.style.fontSize = '0.85em';
      value.style.padding = '4px 2px';
    }
    tile.appendChild(span);
  }
  // A fresh amount or decision word sweeps the strip instead of flipping the
  // whole container.
  if (hadGrid && (isAmount || decisionCells)) animateOfferCells(tile);
}

/** Wires up the offer-tile squares sync. Called once at startup. */
export function initOfferTileSquares() {
  if (!dom.bankerOfferDisplay) return;
  offerSquareObserver.observe(dom.bankerOfferDisplay, { childList: true, characterData: true, subtree: true });
  renderOfferTileSquares();
}

function applyBoardBg(bgId) {
  const opt = BOARD_BG_OPTIONS.find(o => o.id === bgId);
  if (!opt) return;
  const changed = bgId !== currentBoardBgId;
  currentBoardBgId = bgId;
  localStorage.setItem('dnd_board_bg', bgId);
  const boardEl = dom.boardColLow ? dom.boardColLow.closest('.board') : document.getElementById('board');
  if (!boardEl) return;
  BOARD_BG_OPTIONS.forEach(o => { if (o.class) boardEl.classList.remove(o.class); });
  if (opt.class) boardEl.classList.add(opt.class);
  // Squares mode changes row markup (per-digit cells) — rebuild the tiles.
  if (changed) renderBoard();
  // Keep the offer tile in sync even when its own DOM didn't change.
  renderOfferTileSquares();
}

function renderBoardBgPicker() {
  dom.boardBgPickerGrid.innerHTML = '';
  BOARD_BG_OPTIONS.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'bg-option' + (opt.id === currentBoardBgId ? ' active' : '');
    div.innerHTML = `<div class="bg-option-swatch" style="background:${opt.swatch};"></div><div class="bg-option-label">${opt.label}</div>`;
    div.addEventListener('click', () => {
      applyBoardBg(opt.id);
      renderBoardBgPicker();
    });
    dom.boardBgPickerGrid.appendChild(div);
  });
}

function fitUsGridText(el) {
  const container = el.parentElement;
  if (!container) return;
  el.style.setProperty('font-size', '', 'important');
  const maxW = container.clientWidth;
  const maxH = container.clientHeight;
  if (!maxW || !maxH) return;
  // Measure the rendered box so both CSS scaleX and scaleY are included.
  const heightRatio = el.textContent.length >= 8 ? 0.8 : 0.72;
  const maxFontSize = 50;
  let lo = 10, hi = maxFontSize, best = maxFontSize;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    el.style.setProperty('font-size', mid + 'px', 'important');
    const rendered = el.getBoundingClientRect();
    if (rendered.width <= maxW * 0.995 && rendered.height <= maxH * heightRatio) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  el.style.setProperty('font-size', best + 'px', 'important');
  el.style.marginTop = '-2px';
}

/** Sizes a briefcase's amount text for the active interior background.
 *  Call after setting .amount-val content on a freshly built case. */
export function applyInteriorAmountStyling(el) {
  if (!el) return;
  if (currentBgId !== 'usgrid') {
    el.classList.toggle('big-val', el.textContent.length > 8);
  } else {
    fitUsGridText(el);
  }
}

function buildUsGridHTML() {
  const cols = 8, rows = 6;
  let html = '';
  // Top 2 rows: all blue cells
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < cols; c++) {
      html += '<div class="usgrid-cell blue"></div>';
    }
  }
  // Middle: blue cells on edges + single wide center container
  for (let r = 2; r < 4; r++) {
    html += '<div class="usgrid-cell blue"></div>';
    if (r === 2) html += '<div class="usgrid-center"></div>';
    html += '<div class="usgrid-cell blue"></div>';
  }
  // Bottom 2 rows: all blue cells
  for (let r = 4; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      html += '<div class="usgrid-cell blue"></div>';
    }
  }
  return html;
}

export function applyInteriorBg(bgId) {
  const opt = BG_OPTIONS.find(o => o.id === bgId);
  if (!opt) return;
  currentBgId = bgId;
  localStorage.setItem('dnd_interior_bg', bgId);
  document.querySelectorAll('.case-interior').forEach(el => {
    // Remove all interior classes and grid markup
    const briefcase = el.closest('.briefcase');
    BG_OPTIONS.forEach(o => { if (o.class) el.classList.remove(o.class); });
    if (briefcase) briefcase.classList.remove('interior-usgrid-active');
    el.querySelectorAll('.usgrid-row').forEach(r => r.remove());
    // Apply new class
    if (opt.class) el.classList.add(opt.class);
    // If US Grid, inject the grid cells and mark the briefcase
    if (bgId === 'usgrid') {
      el.insertAdjacentHTML('beforeend', buildUsGridHTML());
      if (briefcase) briefcase.classList.add('interior-usgrid-active');
      // Move amount-val inside the center container
      const center = el.querySelector('.usgrid-center');
      const amountVal = briefcase ? briefcase.querySelector('.amount-val') : null;
      if (center && amountVal) center.appendChild(amountVal);
    } else {
      // Move amount-val back to briefcase if it was in the center
      const amountVal = el.querySelector('.amount-val');
      if (amountVal && amountVal.parentElement !== el.closest('.briefcase')) {
        el.closest('.briefcase').appendChild(amountVal);
      }
    }
  });
}

function renderBgPicker() {
  dom.bgPickerGrid.innerHTML = '';
  BG_OPTIONS.forEach(opt => {
    const div = document.createElement('div');
    div.className = 'bg-option' + (opt.id === currentBgId ? ' active' : '');
    div.innerHTML = `<div class="bg-option-swatch" style="background:${opt.swatch};"></div><div class="bg-option-label">${opt.label}</div>`;
    div.addEventListener('click', () => {
      applyInteriorBg(opt.id);
      renderBgPicker();
    });
    dom.bgPickerGrid.appendChild(div);
  });
}

/* ---------- Customization tabs ---------- */
const custTabs = document.querySelectorAll('.cust-tab');
const custTabContents = {
  interior: document.getElementById('custTabContentInterior'),
  board: document.getElementById('custTabContentBoard'),
};
custTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    custTabs.forEach(t => t.classList.toggle('active', t === tab));
    const name = tab.dataset.tab;
    Object.entries(custTabContents).forEach(([key, el]) => {
      el.classList.toggle('active', key === name);
    });
  });
});

dom.bgPickerBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const visible = dom.bgPickerPanel.style.display !== 'none';
  dom.bgPickerPanel.style.display = visible ? 'none' : 'flex';
  if (!visible) {
    renderBgPicker();
    renderBoardBgPicker();
  }
});

dom.closeBgPickerBtn.addEventListener('click', () => {
  dom.bgPickerPanel.style.display = 'none';
});

// Apply saved backgrounds on page load
applyInteriorBg(currentBgId);
applyBoardBg(currentBoardBgId);
initOfferTileSquares();
