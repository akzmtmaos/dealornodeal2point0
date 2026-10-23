// ============================================
// Randomizer Beta Test 2 — highlight picks on the grid
// ============================================
/* The original dice button still opens the read-only elimination-order panel.
   This one works the other way round: instead of printing a list, it marks the
   briefcases themselves so you just follow the glow — one case at a time.

   - Before your case is chosen, one case is marked as the suggested pick.
   - While a round is on, only the next case to open is marked. Open it and the
     mark moves straight on to the following one, until the round is done.
   - The mark follows the game: it clears while the banker is on the line, the
     offer/decision is on the strip, or the game is over. */
import { game, dom } from './game.js?v=101';

const PICK_CLASS = 'rand-2-pick';
const YOUR_CASE_CLASS = 'rand-2-your-case';

let active = false;
let pick = null;     // the single case marked "open this one next"
let yourPick = null; // the case marked as the suggested "your case"

/** Cases left to open this round (same count the offer strip shows). */
function neededOpens() {
  return Math.max(0, (game.schedule[game.roundIndex] || 0) - game.openedInRound);
}

/** Every case that is still face down and not already yours. */
function openCandidates() {
  const list = [];
  for (let n = 1; n <= game.caseCount; n++) {
    if (game.openedCases.has(n)) continue;
    if (n === game.yourCase) continue;
    list.push(n);
  }
  return list;
}

function shuffled(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function clearMarks() {
  dom.caseGrid.querySelectorAll('.' + PICK_CLASS + ', .' + YOUR_CASE_CLASS).forEach(el => {
    el.classList.remove(PICK_CLASS, YOUR_CASE_CLASS);
  });
}

function mark(n, cls) {
  const btn = dom.caseGrid.querySelector(`.briefcase[data-num="${n}"]`);
  if (btn) btn.classList.add(cls);
}

/** A case can only stay marked while it is still face down and not yours. */
function stillOpen(n) {
  return n !== null && n !== game.yourCase && !game.openedCases.has(n);
}

/** Forgets both marks so the next render draws a fresh suggestion. */
function reroll() {
  pick = null;
  yourPick = null;
}

/** Repaints the grid. Cheap enough to call on every render. */
export function refreshRandomizer2() {
  if (!dom.caseGrid) return;
  clearMarks();
  if (!active) return;
  if (game.state === 'ended' || game.state === 'finalDecision') {
    active = false;
    dom.randomizer2Btn.classList.remove('active');
    reroll();
    return;
  }

  // Still choosing your case: point at one, and keep pointing at it until the
  // player picks (or it is somehow gone).
  if (game.yourCase === null) {
    pick = null;
    if (!stillOpen(yourPick)) {
      const pool = shuffled(openCandidates());
      yourPick = pool.length ? pool[0] : null;
    }
    if (yourPick !== null) mark(yourPick, YOUR_CASE_CLASS);
    return;
  }
  yourPick = null;

  // A round is only being played while cases can be opened; the banker call and
  // the reveal are not the time for suggestions.
  if (game.state !== 'playing' && game.state !== 'revealing') {
    pick = null;
    return;
  }
  if (neededOpens() <= 0) {
    pick = null;
    return;
  }

  // One case at a time: keep the current mark until it is opened, then move on.
  if (!stillOpen(pick)) {
    const pool = shuffled(openCandidates());
    pick = pool.length ? pool[0] : null;
  }
  if (pick !== null) mark(pick, PICK_CLASS);
}

dom.randomizer2Btn.addEventListener('click', () => {
  active = !active;
  dom.randomizer2Btn.classList.toggle('active', active);
  reroll();
  refreshRandomizer2();
});
