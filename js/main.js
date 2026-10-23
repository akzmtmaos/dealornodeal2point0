// ============================================
// Main — Entry Point
// Imports all modules and starts the game
// ============================================

// Import all modules (side effects wire up event listeners)
import './settings.js?v=114';
import './toolbar.js?v=111';
import './banker.js?v=111';
import './counter.js?v=107';
import './prize-board.js?v=111';
import './suggest.js?v=113';
import './randomizer2.js?v=2';
import './customization.js?v=121';

// Import init for startup
import { game, dom } from './game.js?v=101';
import { initValues, newGame } from './init.js?v=109';
import { initModels } from './models.js?v=1';
import { renderGrid } from './render.js?v=107';

// ---- Go ----
dom.caseCountInput.value = dom.caseCountInput.defaultValue;
// Models load first so the very first grid render already has its pictures.
initModels();
initValues();
newGame();

// Model pictures live in their own module; it asks for a repaint through this
// event so it never has to import the renderer back.
document.addEventListener('dnd:models-changed', () => renderGrid());

// How many cases fit per row with the picture squares depends on the width, so a
// resize re-plans the grid (never mid-reveal, which would cut the animation).
let modelResizeTimer = null;
window.addEventListener('resize', () => {
  if (!game.customModels) return;
  clearTimeout(modelResizeTimer);
  modelResizeTimer = setTimeout(() => {
    if (game.state !== 'revealing') renderGrid();
  }, 200);
});
