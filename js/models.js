// ============================================
// Custom Models — a picture square beside each briefcase
// ============================================
/* Each case can carry its own model picture, shown in a small square to the
   right of the briefcase. Nothing is set by default, so the squares start as
   empty placeholders; pictures are added from the 🖼️ button in the bottom dock,
   either by pasting an image link or by copying an image and pressing Ctrl+V on
   a row. Pasted images are shrunk to a thumbnail data URL so a full set still
   fits comfortably in localStorage. */
import { game, dom } from './game.js?v=101';
import { logEvent } from './helpers.js?v=120';

const STORAGE_KEY = 'dnd_model_images';
const THUMB_SIZE = 96;          // pasted pictures are cropped to this square
const STORE_BUDGET = 2_000_000; // rough character budget for all data URLs

let images = {};   // { [caseNumber]: url }
let enabled = false;

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    enabled = !!raw.enabled;
    images = raw.images && typeof raw.images === 'object' ? raw.images : {};
  } catch (e) {
    enabled = false;
    images = {};
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ enabled, images }));
  } catch (e) {
    logEvent('Could not save the model pictures — browser storage is full.');
  }
}

/** Picture assigned to a case, or null for the empty placeholder. */
export function getModelImage(n) {
  return images[String(n)] || null;
}

export function isModelsEnabled() {
  return enabled;
}

/** Turns the feature on/off, keeps the settings checkbox in step and repaints. */
export function setModelsEnabled(value) {
  enabled = !!value;
  game.customModels = enabled;
  if (dom.customModelsToggle) dom.customModelsToggle.checked = enabled;
  persist();
  document.dispatchEvent(new CustomEvent('dnd:models-changed'));
}

function setImage(n, url) {
  const key = String(n);
  if (!url) {
    delete images[key];
  } else {
    const total = Object.values(images).reduce((sum, v) => sum + String(v).length, 0);
    const previous = String(images[key] || '').length;
    if (total - previous + url.length > STORE_BUDGET) {
      logEvent('Picture skipped — the model pictures are out of storage space.');
      return;
    }
    images[key] = url;
  }
  persist();
  document.dispatchEvent(new CustomEvent('dnd:models-changed'));
  updateRow(n);
}

/* ---------- Panel ---------- */
/* One row per case: number, the square preview, an image-link field and a clear
   button. The rows are rebuilt from the current case count each time the panel
   opens, so changing the number of briefcases never leaves stale rows. */

function rowFor(n) {
  const row = document.createElement('div');
  row.className = 'model-row';
  row.dataset.case = n;
  row.innerHTML = `
    <span class="model-row-num">#${n}</span>
    <span class="model-preview" data-preview="${n}"></span>
    <input class="model-url" type="url" inputmode="url" placeholder="Paste an image link…" data-url="${n}">
    <button class="model-clear" type="button" title="Remove picture" data-clear="${n}">✕</button>
  `;
  const input = row.querySelector('input');
  input.value = getModelImage(n) || '';

  let debounce = null;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => setImage(n, input.value.trim()), 300);
  });

  // A copied image wins over an image link: crop it into a thumbnail.
  input.addEventListener('paste', (e) => {
    const item = e.clipboardData && [...e.clipboardData.items].find(i => i.type.startsWith('image/'));
    if (!item) return; // plain text paste falls through to the link handler
    e.preventDefault();
    const file = item.getAsFile();
    if (file) shrinkToThumbnail(file, (url) => setImage(n, url));
  });

  row.querySelector('[data-clear]').addEventListener('click', () => {
    input.value = '';
    setImage(n, null);
  });

  return row;
}

/** Redraws one row's square (and its link field) after a change. */
function updateRow(n) {
  if (!dom.modelsList) return;
  const row = dom.modelsList.querySelector(`.model-row[data-case="${n}"]`);
  if (!row) return;
  const url = getModelImage(n);
  const preview = row.querySelector('.model-preview');
  if (preview) {
    preview.style.backgroundImage = url ? `url("${url}")` : '';
    preview.classList.toggle('has-image', !!url);
  }
  const input = row.querySelector('input');
  if (input && url && url.startsWith('data:') && input.value !== url) input.value = '';
}

function buildRows() {
  if (!dom.modelsList) return;
  dom.modelsList.innerHTML = '';
  for (let n = 1; n <= game.caseCount; n++) {
    const row = rowFor(n);
    dom.modelsList.appendChild(row);
    updateRow(n);
    const preview = row.querySelector('.model-preview');
    const url = getModelImage(n);
    if (preview) {
      preview.style.backgroundImage = url ? `url("${url}")` : '';
      preview.classList.toggle('has-image', !!url);
    }
  }
}

function openPanel() {
  if (!dom.modelsPanel) return;
  // Opening the panel is the point of the feature, so it switches itself on.
  if (!enabled) setModelsEnabled(true);
  buildRows();
  dom.modelsPanel.style.display = 'flex';
}

function closePanel() {
  if (dom.modelsPanel) dom.modelsPanel.style.display = 'none';
}

/* ---------- Images ---------- */
/** Centre-crops a copied image to a small square data URL. */
function shrinkToThumbnail(file, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = THUMB_SIZE;
        canvas.height = THUMB_SIZE;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, THUMB_SIZE, THUMB_SIZE);
        done(canvas.toDataURL('image/jpeg', 0.82));
      } catch (e) {
        done(String(reader.result));
      }
    };
    img.onerror = () => done('');
    img.src = String(reader.result);
  };
  reader.onerror = () => done('');
  reader.readAsDataURL(file);
}

/* ---------- Wiring ---------- */
export function initModels() {
  load();
  game.customModels = enabled;
  if (dom.customModelsToggle) dom.customModelsToggle.checked = enabled;

  if (dom.modelsBtn) dom.modelsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (dom.modelsPanel.style.display === 'flex') closePanel();
    else openPanel();
  });
  if (dom.closeModelsBtn) dom.closeModelsBtn.addEventListener('click', closePanel);

  // Clicking anywhere outside the card closes it, like the other panels.
  document.addEventListener('click', (e) => {
    if (dom.modelsPanel.style.display !== 'flex') return;
    if (e.target === dom.modelsBtn) return;
    if (dom.modelsPanel.querySelector('.models-card').contains(e.target)) return;
    closePanel();
  });
}
