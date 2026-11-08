// ============================================
// Wheel Decider — a two-wedge wheel for Deal or No Deal
// ============================================
/* A tie-breaker, not a game rule. The wheel is split into DEAL and NO DEAL, but
   not evenly: the DEAL slice is sized by the banker's actual offer against what
   is still on the board. A stingy 25%-of-the-board offer leaves a sliver, a
   near-fair one takes most of the wheel. The round number never enters into it —
   only the dollars the banker put on the table. With no offer made, the wheel is
   an honest 50/50 instead of guessing one. The spin is weighted by the slices,
   so the wheel's odds are the odds you actually get, and the disc is aimed into
   the winning slice. */
import { game, dom } from './game.js?v=106';
import { logEvent, fmt } from './helpers.js?v=123';

const SPIN_MS = 4200;          // how long the disc coasts
const EXTRA_TURNS = 5;         // full turns before it settles, so the spin has travel
const HALF_JITTER = 20;        // degrees either side of a slice centre, inside the slice
const LABEL_RADIUS = 60;       // where the DEAL / NO DEAL words sit, in px from the hub
const DEAL_MIN_SHARE = 0.04;   // an insulting offer: a sliver of wheel
const DEAL_MAX_SHARE = 0.95;   // an offer above the board average: almost all of it
const SHARE_CURVE = 1.6;       // low offers stay tiny, fair offers open right up

let rotation = 0;              // accumulated disc rotation, in degrees
let spinning = false;
let spinTimer = null;
let spinEndTimer = null;
let spinToken = 0;

/** The offer the wheel measures against. Only real offers count: the one on the
 *  table while the banker's screen is up, or the one he already made this round
 *  (so the wheel keeps reading that same offer after you decline). Anything else
 *  — no offer yet, or a fresh round — is `none`, and the wheel goes even. */
function currentOffer() {
  const onTheTable = !!(dom.offerBackdrop && dom.offerBackdrop.classList.contains('show')) && game.lastOffer > 0;
  if (onTheTable) return { amount: game.lastOffer, source: 'live' };

  const last = game.offerHistory[game.offerHistory.length - 1];
  if (last && last.round === game.roundIndex + 1 && last.amount > 0) {
    return { amount: last.amount, source: 'round' };
  }

  return { amount: 0, source: 'none' };
}

/** How much of the wheel DEAL owns right now: the offer measured against the
 *  average of the amounts still in play. The curve is monotonic, so a smaller
 *  offer always means a smaller slice than a bigger one: 25% of the board is a
 *  11% sliver, half the board is ~33%, a near-fair offer takes ~70%. */
function dealShareNow() {
  const remaining = game.amounts.filter(a => !a.eliminated).map(a => a.value);
  // Prize names count as nothing, exactly like they do in the banker's offer, so
  // the slice keeps matching the number on the table.
  const ev = remaining.length
    ? remaining.reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0) / remaining.length
    : 0;
  const offer = currentOffer();
  const even = { share: 0.5, ratio: 0, offer: 0, source: 'none', ev };
  if (offer.source === 'none' || !(ev > 0)) return even;

  const ratio = offer.amount / ev;
  const shaped = Math.pow(ratio, SHARE_CURVE);
  const share = Math.min(DEAL_MAX_SHARE, Math.max(DEAL_MIN_SHARE, shaped));
  return { share, ratio, offer: offer.amount, source: offer.source, ev };
}

/** Puts one word in the middle of its slice, upright in the disc's frame. A
 *  thin slice gets a smaller word pushed out towards the rim, where the arc is
 *  long enough to hold it. */
function placeLabel(el, angleDeg, sliceDeg) {
  const thin = sliceDeg < 34;
  const radius = thin ? LABEL_RADIUS + 18 : LABEL_RADIUS;
  el.style.transform =
    `translate(-50%,-50%) rotate(${angleDeg}deg) translateY(-${radius}px) rotate(${-angleDeg}deg)`;
  el.style.fontSize = thin ? '0.62rem' : '1rem';
  el.style.letterSpacing = thin ? '0.04em' : '0.12em';
}

/** Repaints the wedges and labels for the offer in front of the player. */
function applyWheel() {
  const { share, ratio, offer, source } = dealShareNow();
  const dealDeg = share * 360;
  const dealMid = dealDeg / 2;
  const noDealMid = dealDeg + (360 - dealDeg) / 2;

  dom.wheelDisc.style.background =
    `conic-gradient(from 0deg,` +
    ` #eecb63 0deg ${dealMid}deg,` +
    ` #d9ab41 ${dealMid}deg ${dealDeg}deg,` +
    ` #a83a32 ${dealDeg}deg ${noDealMid}deg,` +
    ` #8a2a25 ${noDealMid}deg 360deg)`;

  placeLabel(dom.wheelDealLabel, dealMid, dealDeg);
  placeLabel(dom.wheelNoDealLabel, noDealMid, 360 - dealDeg);

  dom.wheelOdds.textContent = source === 'none'
    ? 'No offer on the table · even odds'
    : `${fmt(offer)} offer · ${Math.round(ratio * 100)}% of the board · Deal ${Math.round(
        share * 100
      )}%`;
}

function openPanel() {
  applyWheel();
  dom.wheelPanel.style.display = 'flex';
}

function closePanel() {
  dom.wheelPanel.style.display = 'none';
}

/** Spins the disc and, when it stops, reports whichever slice sits under the
 *  pointer. The pointer is the top of the disc (screen angle 0), so the slice it
 *  covers is the one whose own angle A satisfies A + rotation ≡ 0. */
function spin() {
  if (spinning) return;
  spinning = true;
  dom.wheelSpinBtn.disabled = true;
  dom.wheelResult.className = 'wheel-result spinning';
  dom.wheelResult.textContent = 'Spinning…';

  // The slice the player can see must be the slice being decided, even if the
  // panel was left open across a round change, so repaint before snapshotting.
  applyWheel();
  const { share } = dealShareNow();
  const dealDeg = share * 360;
  const deal = Math.random() < share;
  const centre = deal ? dealDeg / 2 : dealDeg + (360 - dealDeg) / 2;
  const room = (deal ? dealDeg : 360 - dealDeg) / 2 - 5;
  const jitter = (Math.random() * 2 - 1) * Math.min(HALF_JITTER, Math.max(0, room));
  const target = centre + jitter;

  const targetMod = ((360 - target) % 360 + 360) % 360;
  const currentMod = ((rotation % 360) + 360) % 360;
  const delta = ((targetMod - currentMod) % 360 + 360) % 360;
  const from = rotation;
  rotation += 360 * EXTRA_TURNS + delta;

  // Stepped by a timer rather than a CSS transition: the coast has to look the
  // same everywhere, including previews where the document's animation clock is
  // not advancing. easeOutQuint gives the fast launch and long glide.
  const token = ++spinToken;
  const settle = () => {
    if (token !== spinToken) return;    // a newer spin already took over
    spinToken++;                        // and this one must only settle once
    clearInterval(spinTimer);
    clearTimeout(spinEndTimer);
    spinTimer = null;
    spinEndTimer = null;
    dom.wheelDisc.style.transform = `rotate(${rotation}deg)`;
    landed(deal);
  };

  clearInterval(spinTimer);
  clearTimeout(spinEndTimer);
  const startedAt = performance.now();
  spinTimer = setInterval(() => {
    const p = Math.min(1, (performance.now() - startedAt) / SPIN_MS);
    const eased = 1 - Math.pow(1 - p, 5);
    dom.wheelDisc.style.transform = `rotate(${from + (rotation - from) * eased}deg)`;
    if (p >= 1) settle();
  }, 16);
  // Safety net: browsers throttle interval ticks (background tab, frozen
  // rendering), and a spin must always come to rest and report its verdict.
  spinEndTimer = setTimeout(settle, SPIN_MS + 150);
}

function landed(deal) {
  spinning = false;
  dom.wheelSpinBtn.disabled = false;
  dom.wheelResult.className = 'wheel-result ' + (deal ? 'deal' : 'no-deal');
  dom.wheelResult.textContent = deal ? 'Deal 🤝' : 'No Deal 🙅';
  logEvent(`🎡 Wheel Decider landed on <b>${deal ? 'DEAL' : 'NO DEAL'}</b>.`);
}

export function initWheel() {
  // A page cached from an older build may not have the panel's pieces yet.
  if (!dom.wheelBtn || !dom.wheelPanel || !dom.wheelDisc || !dom.wheelOdds) return;

  dom.wheelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dom.wheelPanel.style.display === 'flex') closePanel();
    else openPanel();
  });
  dom.closeWheelBtn.addEventListener('click', closePanel);
  dom.wheelSpinBtn.addEventListener('click', spin);
}
