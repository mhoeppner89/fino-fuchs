import {
  buildSession,
  CATEGORY_CONFIG,
  DIFFICULTIES,
  normalizeName,
} from './curriculum.js';
import {
  DrawingBoard,
  evaluateDrawing,
  feedbackForEvaluation,
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
  startButton: $('#start-button'),
  soundButtons: $$('.sound-button'),
  exitButton: $('#exit-button'),
  progressDots: $('#progress-dots'),
  progressText: $('#progress-text'),
  mentorMessage: $('#mentor-message'),
  listenButton: $('#listen-button'),
  taskMode: $('#task-mode'),
  taskTitle: $('#task-title'),
  referenceChip: $('#reference-chip'),
  drawingCanvas: $('#drawing-canvas'),
  canvasHint: $('#canvas-hint'),
  clearButton: $('#clear-button'),
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
  index: 0,
  completed: 0,
  attempts: 0,
  currentSpeech: '',
  transitioning: false,
  screen: 'home',
  toastTimer: 0,
  autoCheckTimer: 0,
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
  elements.listenButton.hidden = !SYNTHETIC_VOICE_ENABLED;
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

function selectCategory(category, { announce = true } = {}) {
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
  if (category === 'name') {
    window.setTimeout(() => elements.childName.focus({ preventScroll: true }), 120);
  }
  if (announce) speak(CATEGORY_CONFIG[category].speech);
}

function selectedOption() {
  if (state.category === 'numbers') return $('input[name="number-range"]:checked')?.value ?? '1-3';
  if (state.category === 'letters') return $('input[name="letter-group"]:checked')?.value ?? 'straight';
  return '';
}

function selectedDifficulty() {
  return $('input[name="difficulty"]:checked')?.value ?? 'easy';
}

function updateProgress() {
  elements.progressDots.innerHTML = '';
  state.session.forEach((_, index) => {
    const dot = document.createElement('span');
    if (index < state.index) dot.classList.add('is-complete');
    if (index === state.index) dot.classList.add('is-current');
    elements.progressDots.append(dot);
  });
  elements.progressText.textContent = `${Math.min(state.index + 1, state.session.length)} von ${state.session.length}`;
}

function modeLabel(assist) {
  if (assist === 'easy') return 'Mit klarer Spur';
  if (assist === 'medium') return 'Mit feiner Spur';
  return 'Mit zarter Spur';
}

function setMentorMessage(message, { announce = false } = {}) {
  elements.mentorMessage.textContent = message;
  state.currentSpeech = message;
  if (announce) speak(message);
}

function clearAutoCheck() {
  window.clearTimeout(state.autoCheckTimer);
  state.autoCheckTimer = 0;
}

function scheduleAutoCheck() {
  const task = state.session[state.index];
  const strokes = board.getUserStrokes();
  const lastStroke = strokes.at(-1);
  if (state.transitioning || !task || !lastStroke || lastStroke.length < 2) return;

  clearAutoCheck();
  const taskToken = state.taskToken;
  state.autoCheckTimer = window.setTimeout(() => {
    state.autoCheckTimer = 0;
    if (state.taskToken === taskToken && state.screen === 'practice' && !state.transitioning) checkDrawing({ quietIncomplete: true });
  }, 260);
}

async function renderTask() {
  const task = state.session[state.index];
  if (!task) {
    finishSession('complete');
    return;
  }

  state.attempts = 0;
  clearAutoCheck();
  state.transitioning = false;
  state.taskToken += 1;
  const token = state.taskToken;
  updateProgress();
  elements.taskMode.textContent = modeLabel(task.assist);
  elements.taskTitle.textContent = task.title;
  elements.referenceChip.textContent = task.label;
  elements.referenceChip.setAttribute('aria-label', `Vorlage ${task.label}`);
  elements.clearButton.disabled = false;
  elements.showButton.disabled = false;
  elements.canvasHint.classList.add('is-hidden');
  board.setTask(task, task.assist);
  setMentorMessage(task.speech);
  speak(task.speech);

  const shouldDemo = task.assist === 'easy' || (state.index === 0 && task.assist === 'medium');
  if (shouldDemo) {
    window.setTimeout(async () => {
      if (token !== state.taskToken || state.screen !== 'practice') return;
      await board.startDemo();
      if (token === state.taskToken && !board.hasInk()) {
        setMentorMessage('Jetzt du.');
        speak('Jetzt du.');
      }
    }, 320);
  }
}

function buildCurrentSession() {
  const cleanName = normalizeName(elements.childName.value);
  state.name = cleanName;
  state.difficulty = selectedDifficulty();
  return buildSession({
    category: state.category,
    difficulty: state.difficulty,
    option: selectedOption(),
    name: cleanName,
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

  try {
    state.session = buildCurrentSession();
  } catch (error) {
    console.error(error);
    showToast('Diese Runde konnte nicht gestartet werden.');
    return;
  }
  state.index = 0;
  state.completed = 0;
  state.attempts = 0;
  state.transitioning = false;
  showScreen('practice');
  requestAnimationFrame(() => renderTask());
}

function passCriteria(result, assist, task, slack = 0) {
  const criteria = {
    easy: { score: 0.52, coverage: 0.45, precision: 0.35, completion: 0.55 },
    medium: { score: 0.56, coverage: 0.49, precision: 0.40, completion: 0.60 },
    hard: { score: 0.60, coverage: 0.53, precision: 0.46, completion: 0.65 },
  }[assist];
  const wordAdjustment = task.category === 'name' && task.id.startsWith('word-') ? 0.07 : 0;
  return result.hasInk
    && result.score >= criteria.score - wordAdjustment - slack
    && result.coverage >= criteria.coverage - wordAdjustment - slack
    && result.precision >= criteria.precision - wordAdjustment - slack
    && result.completion >= criteria.completion - wordAdjustment - slack;
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
  state.transitioning = true;
  elements.successText.textContent = message;
  makeConfetti();
  elements.successOverlay.hidden = false;
  navigator.vibrate?.(gentle ? 18 : [18, 25, 18]);
  speak(message);

  const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 320 : 650;
  window.setTimeout(() => {
    elements.successOverlay.hidden = true;
    state.completed += 1;
    state.index += 1;
    if (state.index >= state.session.length) {
      finishSession();
    } else {
      renderTask();
    }
  }, delay);
}

function checkDrawing({ quietIncomplete = false } = {}) {
  if (state.transitioning || !state.session[state.index]) return;
  const task = state.session[state.index];
  const userStrokes = board.getUserStrokes();
  const result = evaluateDrawing(task.strokes, userStrokes, board.evaluationOptions());
  const passed = passCriteria(result, task.assist, task);

  if (passed) {
    elements.clearButton.disabled = true;
    elements.showButton.disabled = true;
    celebrate(praise[Math.floor(Math.random() * praise.length)]);
    return;
  }

  // A partial multi-stroke drawing is normal. It is still evaluated after
  // every pen lift, but stays quiet until the child has had a chance to add
  // the expected parts. A complete drawing in fewer strokes can pass above.
  if (quietIncomplete && userStrokes.length < task.strokes.length) return;

  state.attempts += 1;
  const nearPass = state.attempts >= 3 && passCriteria(result, task.assist, task, 0.04);
  if (nearPass) {
    elements.clearButton.disabled = true;
    elements.showButton.disabled = true;
    celebrate('Gut probiert!', { gentle: true });
    return;
  }

  const feedback = feedbackForEvaluation(result);
  setMentorMessage(feedback, { announce: true });
  board.flashGuide();
}

function finishSession() {
  if (state.screen === 'finish') return;
  clearAutoCheck();
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
  },
  onStrokeStart() {
    clearAutoCheck();
  },
  onStrokeEnd() {
    scheduleAutoCheck();
  },
});

elements.activityCards.forEach((card) => {
  card.addEventListener('click', () => selectCategory(card.dataset.category));
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

$$('input[name="number-range"], input[name="letter-group"]').forEach((input) => {
  input.addEventListener('change', () => speak(input.nextElementSibling?.textContent ?? ''));
});

elements.clearButton.addEventListener('click', () => {
  board.clear();
  setMentorMessage('Noch einmal. Du schaffst das.', { announce: true });
});

elements.showButton.addEventListener('click', async () => {
  if (state.transitioning) return;
  setMentorMessage('Schau gut hin.', { announce: true });
  elements.showButton.disabled = true;
  await board.startDemo();
  if (!state.transitioning) elements.showButton.disabled = false;
});

if (SYNTHETIC_VOICE_ENABLED) {
  elements.listenButton.addEventListener('click', () => {
    const task = state.session[state.index];
    if (task) {
      setMentorMessage(task.speech);
      speak(task.speech);
    }
  });
}

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
selectCategory('lines', { announce: false });

window.render_game_to_text = () => JSON.stringify({
  coordinateSystem: 'drawing canvas uses normalized coordinates: origin top-left, x right, y down',
  screen: state.screen,
  category: state.category,
  progress: { completed: state.completed, current: state.index + 1, total: state.session.length },
  task: state.session[state.index]
    ? { id: state.session[state.index].id, title: state.session[state.index].title, expectedStrokes: state.session[state.index].strokes.length }
    : null,
  assist: state.session[state.index]?.assist ?? null,
  userStrokes: board.getUserStrokes().length,
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
      task: state.session[state.index]?.id ?? null,
      assist: state.session[state.index]?.assist ?? null,
      screen: state.screen,
    }),
    solveCurrent() {
      const task = state.session[state.index];
      if (!task) return false;
      board.setUserStrokes(task.strokes);
      checkDrawing();
      return true;
    },
    failCurrent() {
      board.setUserStrokes([[{ x: 0.05, y: 0.05 }, { x: 0.95, y: 0.95 }, { x: 0.05, y: 0.95 }]]);
      checkDrawing();
    },
    finish: () => finishSession(),
    board,
  };
}
