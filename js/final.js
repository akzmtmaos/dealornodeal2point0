// ============================================
// Final Decision
// ============================================
import { game, dom } from './game.js?v=101';
import { logEvent, fmt } from './helpers.js?v=120';
import { renderGrid, eliminateBoardValue } from './render.js?v=107';
import { revealCaseAnimated } from './center-stage.js?v=106';
import { endGame } from './end.js?v=115';

export function showFinalDecision() {
  game.state = 'finalDecision';
  renderGrid();
  let otherCase = null;
  for (let n = 1; n <= game.caseCount; n++) {
    if (n !== game.yourCase && !game.openedCases.has(n)) { otherCase = n; break; }
  }
  dom.finalSub.textContent = `Case #${otherCase} is the only other case left. Keep case #${game.yourCase}, or switch?`;
  dom.finalCases.innerHTML = '';

  const keepBtn = document.createElement('button');
  keepBtn.className = 'final-case-btn';
  keepBtn.innerHTML = `<span class="fc-num">#${game.yourCase}</span><span class="fc-tag">Keep Mine</span>`;
  keepBtn.addEventListener('click', () => resolveFinal(game.yourCase, otherCase));

  const switchBtn = document.createElement('button');
  switchBtn.className = 'final-case-btn';
  switchBtn.innerHTML = `<span class="fc-num">#${otherCase}</span><span class="fc-tag">Switch</span>`;
  switchBtn.addEventListener('click', () => resolveFinal(otherCase, otherCase));

  dom.finalCases.appendChild(keepBtn);
  dom.finalCases.appendChild(switchBtn);
  dom.finalBackdrop.classList.add('show');
}

function resolveFinal(chosenCase, otherCaseNum) {
  dom.finalBackdrop.classList.remove('show');
  game.state = 'revealing';
  renderGrid();
  // Playing it out to the end is judged on the two cases left: the one the
  // player ends up holding against the one they let go. Both values are already
  // fixed, so the verdict picks the reveal sting — the light one for a good No
  // Deal, the danger one for a bad one.
  const valueOfCase = (n) => game.amounts[game.caseAssignment[n - 1]].value;
  const keptCase = chosenCase;
  const droppedCase = chosenCase === game.yourCase ? otherCaseNum : game.yourCase;
  const finalSound = valueOfCase(keptCase) >= valueOfCase(droppedCase) ? 'good' : 'bad';
  revealCaseAnimated(game.yourCase, 'Your Case', (v1, i1) => {
    game.amounts[i1].eliminated = true;
    game.openedCases.add(game.yourCase);
    eliminateBoardValue(i1);
    logYourCaseReveal(game.yourCase, v1);
    renderGrid();
    const finalLabel = (otherCaseNum === chosenCase) ? 'Case #' + otherCaseNum + ' (Switched To)' : 'Case #' + otherCaseNum;
    setTimeout(() => {
      // The verdict rang on the case you were holding; this last reveal keeps its
      // own value-tier sting so the closing beat is never silent.
      revealCaseAnimated(otherCaseNum, finalLabel, (v2, i2) => {
        game.amounts[i2].eliminated = true;
        game.openedCases.add(otherCaseNum);
        eliminateBoardValue(i2);
        logUnopenedFinalCaseReveal(otherCaseNum, v2);
        const displayOtherCase = (chosenCase === game.yourCase) ? otherCaseNum : game.yourCase;
        endGame('played', chosenCase, displayOtherCase);
      }, true, null);
    }, 300);
  }, true, null, finalSound);
}

function logYourCaseReveal(caseNumber, value) {
  logEvent(`<b>Your Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`, 'deal');
}

function logUnopenedFinalCaseReveal(caseNumber, value) {
  logEvent(`<b>Unopened Final Case Revealed</b> — Case #${caseNumber} held <b>${fmt(value)}</b>.`);
}
