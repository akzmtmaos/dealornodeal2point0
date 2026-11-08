// ============================================
// Prize Board Selection
// ============================================
import { game, dom, MIN_CASE_COUNT, MAX_CASE_COUNT } from './game.js?v=106';
import { buildSchedule, logEvent } from './helpers.js?v=123';
import { renderAll } from './render.js?v=113';
import { flashBoard } from './toolbar.js?v=112';
import { resetEliminatedFlags, assignCases } from './init.js?v=110';

const PB_STORAGE_KEY = 'dnd_saved_boards';
const pbExportBtn = document.getElementById('pbExportBtn');
const pbImportBtn = document.getElementById('pbImportBtn');
const pbImportFile = document.getElementById('pbImportFile');
const pbPasteBtn = document.getElementById('pbPasteBtn');
const pbPastePanel = document.getElementById('pbPastePanel');
const pbPasteArea = document.getElementById('pbPasteArea');
const pbPasteLoadBtn = document.getElementById('pbPasteLoadBtn');
const pbPasteCancelBtn = document.getElementById('pbPasteCancelBtn');

function loadSavedBoards() {
  try {
    const saved = JSON.parse(localStorage.getItem(PB_STORAGE_KEY));
    if (Array.isArray(saved)) return saved;
  } catch (e) { /* check the legacy fallback key */ }
  try {
    const legacy = JSON.parse(localStorage.getItem('dnd_board_bg'));
    if (Array.isArray(legacy) && legacy.every(isValidSavedBoard)) {
      saveSavedBoards(legacy);
      localStorage.setItem('dnd_board_bg', 'default');
      return legacy;
    }
  } catch (e) { /* no legacy board data */ }
  return [];
}

function saveSavedBoards(list) {
  localStorage.setItem(PB_STORAGE_KEY, JSON.stringify(list));
}

/** A saved board entry is either an amount or a prize name (TRUCK, NOTHING). */
function isBoardValue(value) {
  if (typeof value === 'string') return value.trim() !== '';
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidSavedBoard(board) {
  return board && typeof board.name === 'string' && board.name.trim() &&
    Array.isArray(board.values) && board.values.length >= MIN_CASE_COUNT &&
    board.values.length <= MAX_CASE_COUNT &&
    board.values.every(isBoardValue);
}

function boardsMatch(first, second) {
  return first.name === second.name && first.values.length === second.values.length &&
    first.values.every((value, index) => value === second.values[index]);
}

function exportSavedBoards() {
  const boards = loadSavedBoards();
  if (!boards.length) {
    logEvent('There are no saved prize boards to export.');
    return;
  }
  const blob = new Blob([JSON.stringify({ version: 1, boards }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'deal-or-no-deal-prize-boards.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Accepts a saved export ({ boards: [...] }), a bare array, or a single board. */
function importBoardsFromJson(text) {
  const parsed = JSON.parse(text);
  const imported = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.boards)
      ? parsed.boards
      : (parsed && typeof parsed === 'object' ? [parsed] : null);
  if (!Array.isArray(imported) || !imported.length || !imported.every(isValidSavedBoard)) {
    throw new Error('Invalid prize board JSON');
  }
  const existing = loadSavedBoards();
  const additions = imported
    .map(board => ({ name: board.name.trim(), values: [...board.values] }))
    .filter(board => !existing.some(saved => boardsMatch(saved, board)));
  saveSavedBoards([...existing, ...additions]);
  renderPbList();
  logEvent(additions.length
    ? `Imported ${additions.length} prize board${additions.length === 1 ? '' : 's'}.`
    : 'Those prize boards are already saved.');
  return additions.length;
}

/** Puts a board straight on the table, without saving it to the list. */
function loadBoardValues(name, values) {
  game.caseCount = values.length;
  game.nextCaseCount = game.caseCount;
  dom.caseCountInput.value = game.caseCount;
  game.amounts = values.map(v => ({ value: v, eliminated: false }));
  game.schedule = buildSchedule(game.caseCount);
  resetEliminatedFlags();
  assignCases();
  renderAll();
  flashBoard();
  dom.pbSelectPanel.style.display = 'none';
  pbPastePanel.style.display = 'none';
  logEvent(`Loaded prize board: <b>${name}</b> (${values.length} values).`);
}

/** Pulls one board out of pasted JSON: a values array, a board, or an export. */
function parsePastedBoard(text) {
  const parsed = JSON.parse(text);
  if (Array.isArray(parsed) && parsed.every(isBoardValue) &&
      parsed.length >= MIN_CASE_COUNT && parsed.length <= MAX_CASE_COUNT) {
    return { name: 'Pasted board', values: [...parsed] };
  }
  const first = Array.isArray(parsed)
    ? parsed[0]
    : Array.isArray(parsed?.boards)
      ? parsed.boards[0]
      : parsed;
  if (first && typeof first === 'object' && Array.isArray(first.values)) {
    const values = first.values;
    const name = typeof first.name === 'string' && first.name.trim() ? first.name.trim() : 'Pasted board';
    if (values.length >= MIN_CASE_COUNT && values.length <= MAX_CASE_COUNT && values.every(isBoardValue)) {
      return { name, values: [...values] };
    }
  }
  throw new Error('Invalid prize board JSON');
}

function renderPbList() {
  const boards = loadSavedBoards();
  dom.pbList.innerHTML = '';
  if (boards.length === 0) {
    dom.pbList.innerHTML = '<div class="pb-empty">No saved boards yet.</div>';
    return;
  }
  boards.forEach((b, i) => {
    const item = document.createElement('div');
    item.className = 'pb-item';
    item.innerHTML = `<span><span class="pb-item-name">${b.name}</span><span class="pb-item-count">${b.values.length} values</span></span>`;
    const delBtn = document.createElement('button');
    delBtn.className = 'pb-item-delete';
    delBtn.textContent = '✕';
    delBtn.title = 'Delete';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const boards2 = loadSavedBoards();
      boards2.splice(i, 1);
      saveSavedBoards(boards2);
      renderPbList();
    });
    item.appendChild(delBtn);
    item.addEventListener('click', () => loadBoardValues(b.name, b.values));
    dom.pbList.appendChild(item);
  });
}

dom.pbSelectBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const visible = dom.pbSelectPanel.style.display !== 'none';
  dom.pbSelectPanel.style.display = visible ? 'none' : 'flex';
  if (!visible) renderPbList();
});

dom.closePbSelectBtn.addEventListener('click', () => {
  dom.pbSelectPanel.style.display = 'none';
  pbPastePanel.style.display = 'none';
});

pbExportBtn.addEventListener('click', exportSavedBoards);
pbImportBtn.addEventListener('click', () => pbImportFile.click());
pbImportFile.addEventListener('change', async () => {
  const file = pbImportFile.files[0];
  if (!file) return;
  try {
    importBoardsFromJson(await file.text());
  } catch (e) {
    logEvent('Could not import that file. Choose a valid prize-board export.');
  } finally {
    pbImportFile.value = '';
  }
});

// Pasting an export is quicker than saving a file and picking it again.
pbPasteBtn.addEventListener('click', () => {
  const open = pbPastePanel.style.display !== 'none';
  pbPastePanel.style.display = open ? 'none' : 'block';
  if (!open) pbPasteArea.focus();
});

pbPasteCancelBtn.addEventListener('click', () => {
  pbPasteArea.value = '';
  pbPastePanel.style.display = 'none';
});

pbPasteLoadBtn.addEventListener('click', () => {
  const text = pbPasteArea.value.trim();
  if (!text) {
    logEvent('Paste a prize-board JSON before loading.');
    pbPasteArea.focus();
    return;
  }
  try {
    const board = parsePastedBoard(text);
    pbPasteArea.value = '';
    loadBoardValues(board.name, board.values);
  } catch (e) {
    logEvent('Could not load that JSON. Paste a values array or {"name":"...","values":[...]}.');
  }
});

// Ctrl/Cmd+Enter loads straight from the textarea.
pbPasteArea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    pbPasteLoadBtn.click();
  }
});

dom.boardSaveBtn.addEventListener('click', () => {
  dom.pbSaveName.value = '';
  dom.pbSelectPanel.style.display = 'flex';
  renderPbList();
  dom.pbSaveName.focus();
});

dom.pbSaveConfirmBtn.addEventListener('click', () => {
  const name = dom.pbSaveName.value.trim();
  if (!name) {
    dom.pbSaveName.focus();
    return;
  }
  const currentValues = game.amounts.map(a => a.value);
  const boards = loadSavedBoards();
  boards.push({ name, values: currentValues });
  saveSavedBoards(boards);
  dom.pbSaveName.value = '';
  renderPbList();
  logEvent(`Saved prize board: <b>${name}</b> (${currentValues.length} values).`);
});

dom.pbSaveName.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') dom.pbSaveConfirmBtn.click();
});
