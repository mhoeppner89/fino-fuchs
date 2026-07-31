import {
  adaptTaskToViewport,
  buildSession,
  CATEGORY_CONFIG,
  DIFFICULTIES,
  normalizeName,
} from './curriculum.js';
import {
  DrawingBoard,
  evaluateDrawing,
  passesDrawingCriteria,
} from './drawing.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

// Kept separate from future recorded audio. Browser voices vary too much
// between devices, so synthetic speech is disabled until recordings exist.
const SYNTHETIC_VOICE_ENABLED = false;

const elements = {
  screens: $$('.screen'),
  homeScreen: $('#home-screen'),
  practiceScreen: $('#practice-screen'),
  finishScreen: $('#finish-screen'),
  form: $('#session-form'),
  activityCards: $$('.activity-card'),
  optionPanels: $$('.option-panel'),
  childName: $('#child-name'),
  numberSet: $('#number-set'),
  numberSetField: $('#number-set-field'),
  numberSetHelp: $('#number-set-help'),
  letterSet: $('#letter-set'),
  letterSetField: $('#letter-set-field'),
  letterSetHelp: $('#letter-set-help'),
  startButton: $('#start-button'),
  soundButtons: $$('.sound-button'),
  exitButton: $('#exit-button'),
  previousTaskButton: $('#previous-task-button'),
  nextTaskButton: $('#next-task-button'),
  progressDots: $('#progress-dots'),
  progressText: $('#progress-text'),
  drawingCanvas: $('#drawing-canvas'),
  canvasHint: $('#canvas-hint'),
  clearButton: $('#clear-button'),
  undoButton: $('#undo-button'),
  showButton: $('#show-button'),
  finishSummary: $('#finish-summary'),
  repeatButton: $('#repeat-button'),
  homeButton: $('#home-button'),
  successOverlay: $('#success-overlay'),
  successText: $('#success-text'),
  confetti: $('.confetti'),
  exitModal: $('#exit-modal'),
  continueButton: $('#continue-button'),
  confirmExitButton: $('#confirm-exit-button'),
  toast: $('#toast'),
};

const state = {
  category: 'lines',
  difficulty: 'easy',
  sound: SYNTHETIC_VOICE_ENABLED,
  name: '',
  session: [],
  activeTask: null,
  index: 0,
  completed: 0,
  completedIndexes: new Set(),
  attempts: 0,
  currentSpeech: '',
  transitioning: false,
  screen: 'home',
  toastTimer: 0,
  autoCheckTimer: 0,
  previewTimer: 0,
  previewedStrokeIndex: null,
  taskToken: 0,
};

let germanVoice = null;

function chooseVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  germanVoice = voices.find((voice) => /^de(-|_)/i.test(voice.lang) && /female|anna|petra|katja|google/i.test(voice.name))
    ?? voices.find((voice) => /^de(-|_)/i.test(voice.lang))
    ?? null;
}

if (SYNTHETIC_VOICE_ENABLED && 'speechSynthesis' in window) {
  chooseVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', chooseVoice);
}

function speak(text, { interrupt = true } = {}) {
  state.currentSpeech = text;
  if (!SYNTHETIC_VOICE_ENABLED || !state.sound || !text || !('speechSynthesis' in window)) return;
  if (interrupt) window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 0.88;
  utterance.pitch = 1.04;
  utterance.volume = 1;
  if (germanVoice) utterance.voice = germanVoice;
  window.speechSynthesis.speak(utterance);
}

function stopSpeech() {
  if (SYNTHETIC_VOICE_ENABLED && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}

function updateSoundButtons() {
  elements.soundButtons.forEach((button) => {
    button.hidden = !SYNTHETIC_VOICE_ENABLED;
    button.classList.toggle('is-muted', !state.sound);
    button.setAttribute('aria-pressed', String(state.sound));
    button.setAttribute('aria-label', state.sound ? 'Ton ausschalten' : 'Ton einschalten');
  });
}

function toggleSound() {
  if (!SYNTHETIC_VOICE_ENABLED) return;
  state.sound = !state.sound;
  if (!state.sound) stopSpeech();
  updateSoundButtons();
  if (state.sound) speak(state.screen === 'practice' ? state.currentSpeech : 'Ton ist an.');
}

function showScreen(name) {
  const target = name === 'home' ? elements.homeScreen : name === 'practice' ? elements.practiceScreen : elements.finishScreen;
  elements.screens.forEach((screen) => {
    const active = screen === target;
    screen.hidden = !active;
    screen.classList.toggle('is-active', active);
  });
  state.screen = name;
  document.body.dataset.screen = name;
  if (name === 'practice') {
    requestAnimationFrame(() => board.resize());
  } else {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

function showToast(message, duration = 2800) {
  window.clearTimeout(state.toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  state.toastTimer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, duration);
}

function selectCategory(category, { announce = true, focusInput = false } = {}) {
  if (!CATEGORY_CONFIG[category]) return;
  state.category = category;
  elements.activityCards.forEach((card) => {
    const selected = card.dataset.category === category;
    card.classList.toggle('is-selected', selected);
    card.setAttribute('aria-pressed', String(selected));
  });
  elements.optionPanels.forEach((panel) => {
    const selected = panel.dataset.optionsFor === category;
    panel.hidden = !selected;
    panel.classList.toggle('is-visible', selected);
  });
  // Safari only opens its keyboard when focus happens in the tap itself.
  if (category === 'name' && focusInput) elements.childName.focus({ preventScroll: true });
  if (announce) speak(CATEGORY_CONFIG[category].speech);
}

function selectedSetMode(category) {
  const name = category === 'numbers' ? 'number-selection' : 'letter-selection';
  return $(`input[name="${name}"]:checked`)?.value ?? 'all';
}

function normalizeNumberSet(value) {
  return [...new Set(String(value ?? '').match(/[0-9]/g) ?? [])].join('');
}

function normalizeLetterSet(value) {
  return [...new Set([...String(value ?? '').normalize('NFC')].filter((character) => /[A-Za-zÄÖÜäöü]/.test(character)))].join('');
}

function updateCustomSetField(category, { focus = false } = {}) {
  const custom = selectedSetMode(category) === 'custom';
  const field = category === 'numbers' ? elements.numberSetField : elements.letterSetField;
  const input = category === 'numbers' ? elements.numberSet : elements.letterSet;
  const help = category === 'numbers' ? elements.numberSetHelp : elements.letterSetHelp;
  field.hidden = !custom;
  input.disabled = !custom;
  help.hidden = !custom;
  if (custom && focus) input.focus({ preventScroll: true });
}

function selectedOption() {
  if (state.category === 'numbers') return selectedSetMode('numbers') === 'custom' ? normalizeNumberSet(elements.numberSet.value) : 'all';
  if (state.category === 'letters') return selectedSetMode('letters') === 'custom' ? normalizeLetterSet(elements.letterSet.value) : 'all';
  return '';
}

function selectedDifficulty() {
  return $('input[name="difficulty"]:checked')?.value ?? 'easy';
}

function updateProgress() {
  elements.progressDots.innerHTML = '';
  state.session.forEach((_, index) => {
    const dot = document.createElement('span');
    if (state.completedIndexes.has(index)) dot.classList.add('is-complete');
    if (index === state.index) dot.classList.add('is-current');
    elements.progressDots.append(dot);
  });
  elements.progressText.textContent = `${Math.min(state.index + 1, state.session.length)} von ${state.session.length}`;
}

function clearAutoCheck() {
  window.clearTimeout(state.autoCheckTimer);
  state.autoCheckTimer = 0;
}

function clearPreview() {
  window.clearTimeout(state.previewTimer);
  state.previewTimer = 0;
}

function updateRoundControls() {
  const hasTask = Boolean(state.activeTask);
  const hasInk = board.hasInk();
  const disabled = state.transitioning || !hasTask;
  elements.previousTaskButton.disabled = disabled || state.index === 0;
  elements.nextTaskButton.disabled = disabled || state.index >= state.session.length - 1;
  elements.clearButton.disabled = disabled || !hasInk;
  elements.undoButton.disabled = disabled || !hasInk;
  elements.showButton.disabled = disabled;
}

async function previewCurrentStroke({ force = false } = {}) {
  if (state.transitioning || state.screen !== 'practice' || !state.activeTask) return false;
  const strokeIndex = board.nextGuideStrokeIndex();
  if (!force && state.previewedStrokeIndex === strokeIndex) return false;
  state.previewedStrokeIndex = strokeIndex;
  updateRoundControls();
  elements.showButton.disabled = true;
  await board.startDemo();
  if (!state.transitioning) updateRoundControls();
  return true;
}

function scheduleNextStrokePreview() {
  clearPreview();
  const taskToken = state.taskToken;
  const strokeIndex = board.nextGuideStrokeIndex();
  if (state.previewedStrokeIndex === strokeIndex) return;
  state.previewTimer = window.setTimeout(() => {
    state.previewTimer = 0;
    if (state.taskToken === taskToken && state.screen === 'practice' && !state.transitioning) previewCurrentStroke();
  }, 50);
}

function scheduleAutoCheck() {
  const task = state.activeTask;
  const strokes = board.getUserStrokes();
  const lastStroke = strokes.at(-1);
  if (state.transitioning || !task || !lastStroke || lastStroke.length < 2) return;

  clearAutoCheck();
  const taskToken = state.taskToken;
  state.autoCheckTimer = window.setTimeout(() => {
    state.autoCheckTimer = 0;
    if (state.taskToken === taskToken && state.screen === 'practice' && !state.transitioning) checkDrawing({ quietIncomplete: true });
  }, 90);
}

async function renderTask() {
  const sourceTask = state.session[state.index];
  if (!sourceTask) {
    finishSession('complete');
    return;
  }

  board.resize();
  const task = adaptTaskToViewport(sourceTask, board.getViewport());
  state.activeTask = task;

  state.attempts = 0;
  clearAutoCheck();
  clearPreview();
  state.transitioning = false;
  state.previewedStrokeIndex = null;
  state.taskToken += 1;
  const token = state.taskToken;
  updateProgress();
  elements.drawingCanvas.setAttribute('aria-label', `Zeichenfläche für ${task.title}. Zeichne mit Finger oder Stift.`);
  elements.canvasHint.classList.add('is-hidden');
  board.setTask(task, task.assist);
  updateRoundControls();

  const shouldDemo = task.assist === 'easy' || (state.index === 0 && task.assist === 'medium');
  if (shouldDemo) {
    window.setTimeout(async () => {
      if (token !== state.taskToken || state.screen !== 'practice' || board.hasInk()) return;
      await previewCurrentStroke();
    }, 320);
  }
}

function buildCurrentSession(viewport) {
  const cleanName = normalizeName(elements.childName.value);
  state.name = cleanName;
  state.difficulty = selectedDifficulty();
  return buildSession({
    category: state.category,
    difficulty: state.difficulty,
    option: selectedOption(),
    name: cleanName,
    viewport,
  });
}

function beginSession() {
  if (state.category === 'name') {
    const cleanName = normalizeName(elements.childName.value).replace(/[- ]/g, '');
    if (!cleanName) {
      showToast('Bitte zuerst einen Namen eingeben.');
      elements.childName.focus();
      return;
    }
  }

  if (['numbers', 'letters'].includes(state.category) && selectedSetMode(state.category) === 'custom' && !selectedOption()) {
    showToast(state.category === 'numbers' ? 'Bitte zuerst Zahlen eingeben.' : 'Bitte zuerst Buchstaben eingeben.');
    (state.category === 'numbers' ? elements.numberSet : elements.letterSet).focus();
    return;
  }

  state.index = 0;
  state.completed = 0;
  state.completedIndexes = new Set();
  state.attempts = 0;
  state.transitioning = false;
  state.session = [];
  state.activeTask = null;
  showScreen('practice');
  requestAnimationFrame(() => {
    board.resize();
    try {
      state.session = buildCurrentSession(board.getViewport());
    } catch (error) {
      console.error(error);
      showScreen('home');
      showToast('Diese Runde konnte nicht gestartet werden.');
      return;
    }
    renderTask();
  });
}

function passCriteria(result, assist, task, slack = 0) {
  const wordAdjustment = task.category === 'name' && task.id.startsWith('word-') ? 0.07 : 0;
  return passesDrawingCriteria(result, assist, { qualityAdjustment: wordAdjustment, slack });
}

const praise = ['Prima!', 'Super!', 'Toll gemacht!', 'Klasse!', 'Sehr gut!'];

function makeConfetti() {
  elements.confetti.innerHTML = '';
  const count = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 4 : 18;
  for (let i = 0; i < count; i += 1) {
    const piece = document.createElement('span');
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.25;
    const radius = 120 + Math.random() * 180;
    piece.style.setProperty('--x', `${Math.cos(angle) * radius}px`);
    piece.style.setProperty('--y', `${Math.sin(angle) * radius}px`);
    piece.style.setProperty('--r', `${Math.round(Math.random() * 540 - 270)}deg`);
    piece.style.animationDelay = `${Math.random() * 0.12}s`;
    elements.confetti.append(piece);
  }
}

function celebrate(message, { gentle = false } = {}) {
  clearAutoCheck();
  clearPreview();
  state.transitioning = true;
  updateRoundControls();
  elements.successText.textContent = message;
  makeConfetti();
  elements.successOverlay.hidden = false;
  navigator.vibrate?.(gentle ? 18 : [18, 25, 18]);
  speak(message);

  const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 320 : 650;
  window.setTimeout(() => {
    elements.successOverlay.hidden = true;
    state.completedIndexes.add(state.index);
    state.completed = state.completedIndexes.size;
    state.index += 1;
    if (state.index >= state.session.length) {
      finishSession();
    } else {
      renderTask();
    }
  }, delay);
}

function checkDrawing({ quietIncomplete = false } = {}) {
  if (state.transitioning || !state.activeTask) return null;
  const task = state.activeTask;
  const userStrokes = board.getUserStrokes();
  const result = evaluateDrawing(task.strokes, userStrokes, {
    ...board.evaluationOptions(),
    completionGroups: task.completionGroups,
  });
  const passed = passCriteria(result, task.assist, task);

  if (passed) {
    celebrate(praise[Math.floor(Math.random() * praise.length)]);
    return { passed: true, result };
  }

  // A partial multi-stroke drawing is progress, not a failed attempt. The
  // visible stage and Fino already point to the next missing part.
  if (quietIncomplete && !result.allRequired) {
    scheduleNextStrokePreview();
    return { passed: false, result, inProgress: true };
  }

  state.attempts += 1;
  const nearPass = state.attempts >= 3 && passCriteria(result, task.assist, task, 0.04);
  if (nearPass) {
    celebrate('Gut probiert!', { gentle: true });
    return { passed: true, result, gentle: true };
  }

  board.flashGuide();
  return { passed: false, result, quietIncomplete };
}

function finishSession() {
  if (state.screen === 'finish') return;
  clearAutoCheck();
  clearPreview();
  state.taskToken += 1;
  state.transitioning = false;
  elements.successOverlay.hidden = true;
  stopSpeech();
  const count = state.completed;
  const taskWord = count === 1 ? 'eine Aufgabe' : `${count} Aufgaben`;
  elements.finishSummary.textContent = `Du hast ${taskWord} geschafft.`;
  showScreen('finish');
  speak('Super geübt!');
}

function returnHome() {
  clearAutoCheck();
  clearPreview();
  state.taskToken += 1;
  state.transitioning = false;
  elements.successOverlay.hidden = true;
  elements.exitModal.hidden = true;
  stopSpeech();
  showScreen('home');
}

function openExitModal() {
  elements.exitModal.hidden = false;
  stopSpeech();
  window.setTimeout(() => elements.continueButton.focus(), 0);
}

function closeExitModal() {
  elements.exitModal.hidden = true;
  elements.exitButton.focus();
}

const board = new DrawingBoard(elements.drawingCanvas, {
  onInkChange(hasInk) {
    elements.canvasHint.classList.add('is-hidden');
    updateRoundControls();
  },
  onStrokeStart() {
    clearAutoCheck();
  },
  onStrokeEnd() {
    scheduleAutoCheck();
  },
});

elements.activityCards.forEach((card) => {
  card.addEventListener('click', () => selectCategory(card.dataset.category, { focusInput: true }));
});

if (SYNTHETIC_VOICE_ENABLED) {
  elements.soundButtons.forEach((button) => button.addEventListener('click', toggleSound));
}

elements.form.addEventListener('submit', (event) => {
  event.preventDefault();
  beginSession();
});

elements.childName.addEventListener('input', () => {
  const clean = normalizeName(elements.childName.value);
  if (elements.childName.value !== clean) elements.childName.value = clean;
});

$$('input[name="difficulty"]').forEach((input) => {
  input.addEventListener('change', () => {
    state.difficulty = input.value;
    speak(DIFFICULTIES[input.value].speech);
  });
});

$$('input[name="number-selection"], input[name="letter-selection"]').forEach((input) => {
  input.addEventListener('change', () => {
    const category = input.name === 'number-selection' ? 'numbers' : 'letters';
    updateCustomSetField(category);
    speak(input.nextElementSibling?.textContent ?? '');
  });
  input.addEventListener('click', () => {
    if (input.value !== 'custom') return;
    const category = input.name === 'number-selection' ? 'numbers' : 'letters';
    updateCustomSetField(category, { focus: true });
  });
});

elements.numberSet.addEventListener('input', () => {
  const clean = normalizeNumberSet(elements.numberSet.value);
  if (elements.numberSet.value !== clean) elements.numberSet.value = clean;
});

elements.letterSet.addEventListener('input', () => {
  const clean = normalizeLetterSet(elements.letterSet.value);
  if (elements.letterSet.value !== clean) elements.letterSet.value = clean;
});

elements.clearButton.addEventListener('click', () => {
  clearAutoCheck();
  clearPreview();
  state.previewedStrokeIndex = null;
  board.clear();
});

elements.showButton.addEventListener('click', async () => {
  await previewCurrentStroke({ force: true });
});

elements.undoButton.addEventListener('click', () => {
  clearAutoCheck();
  clearPreview();
  if (board.undoLastStroke()) {
    state.previewedStrokeIndex = null;
    scheduleNextStrokePreview();
  }
});

function goToTask(index) {
  if (state.transitioning || index < 0 || index >= state.session.length || index === state.index) return;
  clearAutoCheck();
  clearPreview();
  state.index = index;
  renderTask();
}

elements.previousTaskButton.addEventListener('click', () => goToTask(state.index - 1));
elements.nextTaskButton.addEventListener('click', () => goToTask(state.index + 1));

elements.exitButton.addEventListener('click', openExitModal);
elements.continueButton.addEventListener('click', closeExitModal);
elements.confirmExitButton.addEventListener('click', returnHome);
elements.exitModal.addEventListener('pointerdown', (event) => {
  if (event.target === elements.exitModal) closeExitModal();
});

elements.repeatButton.addEventListener('click', beginSession);
elements.homeButton.addEventListener('click', returnHome);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !elements.exitModal.hidden) closeExitModal();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopSpeech();
});

updateSoundButtons();
updateCustomSetField('numbers');
updateCustomSetField('letters');
selectCategory('lines', { announce: false });

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'drawing canvas uses normalized coordinates: origin top-left, x right, y down',
  screen: state.screen,
  category: state.category,
  selection: selectedOption(),
  progress: { completed: state.completed, current: state.index + 1, total: state.session.length, canGoBack: state.index > 0, canSkip: state.index < state.session.length - 1 },
  task: state.activeTask
    ? { id: state.activeTask.id, title: state.activeTask.title, expectedStrokes: state.activeTask.strokes.length, expectedStrokeColors: state.activeTask.strokeColors, layout: state.activeTask.layout, viewport: state.activeTask.viewport }
    : null,
  assist: state.activeTask?.assist ?? null,
  userStrokes: board.getUserStrokes().length,
  inkColors: board.getUserStrokeColors(),
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker registration failed:', error));
  });
}

if (new URLSearchParams(location.search).has('test')) {
  window.__fuchsschrift = {
    getState: () => ({
      category: state.category,
      difficulty: state.difficulty,
      index: state.index,
      completed: state.completed,
      task: state.activeTask?.id ?? null,
      assist: state.activeTask?.assist ?? null,
      screen: state.screen,
    }),
    getCurrentTask: () => {
      const task = state.activeTask;
      return task ? {
        id: task.id,
        strokes: task.strokes,
        completionGroups: task.completionGroups,
        strokeColors: task.strokeColors,
      } : null;
    },
    solveCurrent() {
      const task = state.activeTask;
      if (!task) return false;
      board.setUserStrokes(task.strokes);
      checkDrawing();
      return true;
    },
    failCurrent() {
      board.setUserStrokes([[{ x: 0.05, y: 0.05 }, { x: 0.95, y: 0.95 }, { x: 0.05, y: 0.95 }]]);
      return checkDrawing();
    },
    submitCurrent(strokes, { quietIncomplete = true } = {}) {
      board.setUserStrokes(strokes);
      return checkDrawing({ quietIncomplete });
    },
    evaluationSnapshot() {
      const task = state.activeTask;
      if (!task) return null;
      const result = evaluateDrawing(task.strokes, board.getUserStrokes(), {
        ...board.evaluationOptions(),
        completionGroups: task.completionGroups,
      });
      return {
        task: task.id,
        index: state.index,
        transitioning: state.transitioning,
        completion: result.completion,
        pathCoverage: result.pathCoverage,
      };
    },
    finish: () => finishSession(),
    board,
  };
}
