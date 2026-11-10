// ============================================
// Helpers — formatting, logging, value checks
// ============================================
import { game, dom, STANDARD_VALUES } from './game.js?v=106';

/** A board entry that is a prize rather than an amount — TRUCK, NOTHING, ... —
 *  kept as text through the whole game. These get a single container on the
 *  board and take no part in the banker's arithmetic. */
export function isPrizeText(v) {
  return typeof v === 'string' && v.trim() !== '';
}

export function formatNumber(v) {
  if (isPrizeText(v)) return v;
  if (v < 1) return v.toFixed(2).replace(/^0(?=\.)/, '');
  return Math.round(v).toLocaleString('en-US');
}

export function fmt(v) {
  if (isPrizeText(v)) return v;
  return '$' + formatNumber(v);
}

/** Prize board + banker offer amounts — respects the board currency setting. */
export function fmtDisplayBoard(v) {
  if (isPrizeText(v)) return v;
  const n = formatNumber(v);
  return game.showCurrencyBoard ? '$' + n : n;
}

/** Briefcase amounts — respects the briefcase currency setting. */
export function fmtDisplayBriefcase(v) {
  if (isPrizeText(v)) return v;
  const n = formatNumber(v);
  return game.showCurrencyBriefcase ? '$' + n : n;
}

/** Reads a board value typed into the edit field. A blank or negative entry
 *  changes nothing (null); anything that is not a plain amount is kept as a
 *  prize name, so the board can hold entries like TRUCK or NOTHING. */
export function parsePrizeInput(raw) {
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return null;
  const numeric = text.replace(/[$,\s]/g, '');
  if (/^\d*\.?\d+$/.test(numeric)) {
    const n = parseFloat(numeric);
    return Number.isFinite(n) ? n : null;
  }
  return text;
}

/* A value wider than its case (10,000,000, or a prize name like NOTHING) would
   run past the case's value plate, so the type steps down until it fits. The
   case keeps its size — only the text shrinks. */
const CASE_VALUE_MIN_FONT = 3.5;
function fitCaseValue(el) {
  el.style.removeProperty('font-size');
  const text = el.textContent.trim();
  if (!text) return;
  if (!el.clientWidth) {
    // A case is filled before it is on the page, so there is nothing to measure
    // yet — try again once the grid has laid it out.
    if (!el.dataset.fitRetry) {
      el.dataset.fitRetry = '1';
      setTimeout(() => { delete el.dataset.fitRetry; if (el.isConnected) fitCaseValue(el); }, 0);
    }
    return;
  }
  const base = parseFloat(getComputedStyle(el).fontSize) || 8;
  let size = base;
  for (let i = 0; i < 8 && el.scrollWidth > el.clientWidth + 1; i++) {
    size = Math.max(CASE_VALUE_MIN_FONT, size * ((el.clientWidth - 2) / Math.max(el.scrollWidth, 1)) * 0.98);
    el.style.setProperty('font-size', size.toFixed(2) + 'px', 'important');
    if (size <= CASE_VALUE_MIN_FONT) break;
  }
}

export function setBriefcaseAmount(el, value) {
  el.replaceChildren();
  if (isPrizeText(value)) {
    el.appendChild(document.createTextNode(value));
    fitCaseValue(el);
    return;
  }
  if (game.showCurrencyBriefcase) {
    const currency = document.createElement('span');
    currency.className = 'briefcase-currency';
    currency.textContent = '$';
    el.appendChild(currency);
  }
  // Thousands breaks get their own element: the comma is set in a condensed
  // sans instead of the wide display face the digits use.
  const digits = formatNumber(value);
  digits.split(',').forEach((part, i) => {
    if (i) {
      const comma = document.createElement('span');
      comma.className = 'case-value-comma';
      comma.textContent = ',';
      el.appendChild(comma);
    }
    el.appendChild(document.createTextNode(part));
  });
  fitCaseValue(el);
}

/** Appends an entry to the bottom-right game log panel.
 *  Suppressed entirely while the "Enable Game Log" setting is off. */
export function logEvent(html, type) {
  if (game.gameLogEnabled === false) return;
  game.gameLog.push({ html, type });
  const entry = document.createElement('div');
  entry.className = 'game-log-entry' + (type ? ' log-' + type : '');
  entry.innerHTML = html;
  const empty = dom.gameLogList.querySelector('.game-log-empty');
  if (empty) empty.remove();
  dom.gameLogList.appendChild(entry);
  dom.gameLogList.scrollTop = dom.gameLogList.scrollHeight;
}

export function resetGameLog() {
  game.gameLog = [];
  if (game.gameLogEnabled === false) return;
  dom.gameLogList.innerHTML = '<div class="game-log-empty">No activity yet.</div>';
}

export function logYourCaseReveal(caseNumber, value) {
  logEvent(`<b>Your Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`, 'deal');
}

export function logUnopenedFinalCaseReveal(caseNumber, value) {
  logEvent(`<b>Unopened Final Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`);
}

export function triggerDangerFlash() {
  dom.dangerFlash.classList.remove('pulse', 'pulse-yellow');
  void dom.dangerFlash.offsetWidth;
  dom.dangerFlash.classList.add('pulse');
}

export function triggerYellowFlash() {
  dom.dangerFlash.classList.remove('pulse', 'pulse-yellow');
  void dom.dangerFlash.offsetWidth;
  dom.dangerFlash.classList.add('pulse-yellow');
}

/** Picks `n` dollar tiers spread across the classic 26-value ladder. */
export function getValuesForCount(n) {
  if (n >= STANDARD_VALUES.length) return STANDARD_VALUES.slice();
  if (n === 1) return [STANDARD_VALUES[0]];
  const values = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.round(i * (STANDARD_VALUES.length - 1) / (n - 1));
    values.push(STANDARD_VALUES[idx]);
  }
  return values;
}

/** Round schedule: first round opens ~25%, then each round opens one fewer until done. */
export function buildSchedule(count) {
  const totalOpens = count - 2;
  if (totalOpens <= 0) return [];
  const sched = [];
  sched.push(Math.max(1, Math.min(totalOpens, Math.round(totalOpens * 0.25))));
  let remaining = totalOpens - sched[0];
  while (remaining > 0) {
    const prev = sched[sched.length - 1];
    const next = Math.max(1, prev - 1);
    sched.push(Math.min(next, remaining));
    remaining -= sched[sched.length - 1];
  }
  return sched;
}

/** Staggered pyramid rows (7-6-7-6 pattern) for any case count, with a
 *  20-case override: 4-5-5-6 (top to bottom). */
export function getCaseGridRows(count) {
  if (count === 20) {
    return [
      { start: 17, count: 4, align: 'flush' }, // row 1: 17, 18, 19, 20 (matches row 4 alignment)
      { start: 12, count: 5, align: 'flush' }, // row 2: 12, 13, 14, 15, 16 (flush left, untouched)
      { start: 7, count: 5, align: 'flush' },  // row 3: 7, 8, 9, 10, 11 (matches row 4 alignment)
      { start: 1, count: 6, align: 'flush' },  // row 4: 1, 2, 3, 4, 5, 6 (flush left)
    ];
  }
  const rows = [];
  let remaining = count;
  let nextStart = count;
  let rowIdx = 0;
  while (remaining > 0) {
    const baseSize = (rowIdx % 2 === 0) ? 7 : 6;
    const rowCount = Math.min(baseSize, remaining);
    nextStart = nextStart - rowCount + 1;
    rows.push({ start: nextStart, count: rowCount });
    nextStart = nextStart - 1;
    remaining -= rowCount;
    rowIdx++;
  }
  return rows;
}

/** Row plan used while Custom Models is on: fewer cases per row so each case
 *  and its picture square fit without the shelf scrolling. Rows are as even as
 *  possible and still run from the highest case numbers at the top down. */
export function getModelGridRows(count, perRow) {
  const rows = [];
  const rowCount = Math.max(1, Math.ceil(count / Math.max(1, perRow)));
  const base = Math.floor(count / rowCount);
  const extra = count % rowCount;
  // The spare cases go to alternate rows (0, 2, 4, ...) so the shelves keep the
  // staggered 7-6-7-6 pyramid instead of two long rows on top: 26 cases become
  // 20-26 / 14-19 / 7-13 / 1-6.
  const extraRows = new Set();
  for (let i = 0; i < rowCount && extraRows.size < extra; i += 2) extraRows.add(i);
  for (let i = 1; i < rowCount && extraRows.size < extra; i += 2) extraRows.add(i);
  let nextStart = count;
  for (let i = 0; i < rowCount; i++) {
    const n = base + (extraRows.has(i) ? 1 : 0);
    if (n <= 0) continue;
    rows.push({ start: nextStart - n + 1, count: n });
    nextStart -= n;
  }
  return rows;
}

export function isBigValue(v) {
  return typeof v === 'number' && v >= 100000;
}

/** Check if v is the highest amount still in play (not eliminated). Prize names
 *  are not amounts, so they never count as the biggest thing left. */
export function isHighestRemaining(v) {
  if (typeof v !== 'number') return false;
  const remaining = game.amounts
    .filter(a => !a.eliminated && typeof a.value === 'number')
    .map(a => a.value);
  if (!remaining.length) return false;
  const maxVal = Math.max(...remaining);
  return v === maxVal;
}

export function isLowValue(v) {
  // Good-news tier: everything below the $100K danger line. A prize name has no
  // amount to judge, so it is never treated as bad news.
  return typeof v !== 'number' || v < 100000;
}

export function shuffleArr(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function remainingAmountValues() {
  return game.amounts.filter(a => !a.eliminated).map(a => a.value);
}
