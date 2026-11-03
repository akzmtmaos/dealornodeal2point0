// ============================================
// Main — Entry Point
// Imports all modules and starts the game
// ============================================

// Import all modules (side effects wire up event listeners)
import './settings.js?v=115';
import './toolbar.js?v=111';
import './banker.js?v=115';
import './counter.js?v=107';
import './prize-board.js?v=111';
import './suggest.js?v=113';
import './randomizer2.js?v=2';
import './customization.js?v=121';

// Import init for startup
import { game, dom } from './game.js?v=106';
import { initValues, newGame } from './init.js?v=110';
import { initModels } from './models.js?v=2';
import { initWheel } from './wheel.js?v=9';
import { initColorController } from './color-controller.js?v=2';
import { renderGrid } from './render.js?v=111';

// ---- Go ----
dom.caseCountInput.value = dom.caseCountInput.defaultValue;
// Models load first so the very first grid render already has its pictures.
initModels();
initWheel();
// Colours first, so the very first paint is already in the chosen room.
initColorController();
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
