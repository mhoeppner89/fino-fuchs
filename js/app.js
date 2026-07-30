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
  timerChip: $('#timer-chip'),
  timerText: $('#timer-text'),
  mentorMessage: $('#mentor-message'),
  listenButton: $('#listen-button'),
  taskMode: $('#task-mode'),
  taskTitle: $('#task-title'),
  referenceChip: $('#reference-chip'),
  drawingCanvas: $('#drawing-canvas'),
  canvasHint: $('#canvas-hint'),
  clearButton: $('#clear-button'),
  showButton: $('#show-button'),
  doneButton: $('#done-button'),
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
  sound: true,
  name: '',
  session: [],
  index: 0,
  completed: 0,
  attempts: 0,
  currentSpeech: '',
  secondsRemaining: 300,
  timerId: 0,
  deadline: 0,
  timeExpired: false,
  transitioning: false,
  screen: 'home',
  toastTimer: 0,
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

if ('speechSynthesis' in window) {
  chooseVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', chooseVoice);
}

function speak(text, { interrupt = true } = {}) {
  state.currentSpeech = text;
  if (!state.sound || !text || !('speechSynthesis' in window)) return;
  if (interrupt) window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 0.88;
  utterance.pitch = 1.04;
  utterance.volume = 1;
  if (germanVoice) utterance.voice = germanVoice;
  window.speechSynthesis.speak(utterance);
}

function updateSoundButtons() {
  elements.soundButtons.forEach((button) => {
    button.classList.toggle('is-muted', !state.sound);
    button.setAttribute('aria-pressed', String(state.sound));
    button.setAttribute('aria-label', state.sound ? 'Ton ausschalten' : 'Ton einschalten');
  });
}

function toggleSound() {
  state.sound = !state.sound;
  if (!state.sound && 'speechSynthesis' in window) window.speechSynthesis.cancel();
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

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

function updateTimer() {
  elements.timerText.textContent = formatTime(state.secondsRemaining);
  elements.timerChip.setAttribute('aria-label', `${state.secondsRemaining} Sekunden verbleiben`);
  elements.timerChip.classList.toggle('is-ending', state.secondsRemaining <= 30);
}

function stopTimer() {
  window.clearInterval(state.timerId);
  state.timerId = 0;
}

function startTimer() {
  stopTimer();
  state.secondsRemaining = 300;
  state.deadline = Date.now() + 300_000;
  state.timeExpired = false;
  updateTimer();
  state.timerId = window.setInterval(() => {
    state.secondsRemaining = Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
    updateTimer();
    if (state.secondsRemaining <= 0) {
      stopTimer();
      state.timeExpired = true;
      if (!state.transitioning && board.activePointerId === null) finishSession('time');
    }
  }, 250);
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
  if (assist === 'easy') return 'Mit dicker Spur';
  if (assist === 'medium') return 'Mit feiner Spur';
  return 'Jetzt allein';
}

function setMentorMessage(message, { announce = false } = {}) {
  elements.mentorMessage.textContent = message;
  state.currentSpeech = message;
  if (announce) speak(message);
}

async function renderTask() {
  const task = state.session[state.index];
  if (!task) {
    finishSession('complete');
    return;
  }

  state.attempts = 0;
  state.transitioning = false;
  state.taskToken += 1;
  const token = state.taskToken;
  updateProgress();
  elements.taskMode.textContent = modeLabel(task.assist);
  elements.taskTitle.textContent = task.title;
  elements.referenceChip.textContent = task.label;
  elements.referenceChip.setAttribute('aria-label', `Vorlage ${task.label}`);
  elements.doneButton.disabled = true;
  elements.clearButton.disabled = false;
  elements.showButton.disabled = false;
  elements.canvasHint.classList.toggle('is-hidden', task.assist !== 'hard');
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
  startTimer();
  requestAnimationFrame(() => renderTask());
}

function passCriteria(result, assist, task) {
  const criteria = {
    easy: { score: 0.50, coverage: 0.40, precision: 0.28 },
    medium: { score: 0.44, coverage: 0.34, precision: 0.24 },
    hard: { score: 0.38, coverage: 0.27, precision: 0.20 },
  }[assist];
  const wordAdjustment = task.category === 'name' && task.id.startsWith('word-') ? 0.07 : 0;
  return result.hasInk
    && result.score >= criteria.score - wordAdjustment
    && result.coverage >= criteria.coverage - wordAdjustment
    && result.precision >= criteria.precision - wordAdjustment;
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
  state.transitioning = true;
  elements.successText.textContent = message;
  makeConfetti();
  elements.successOverlay.hidden = false;
  navigator.vibrate?.(gentle ? 18 : [18, 25, 18]);
  speak(message);

  const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 420 : 1050;
  window.setTimeout(() => {
    elements.successOverlay.hidden = true;
    state.completed += 1;
    state.index += 1;
    if (state.index >= state.session.length || state.timeExpired) {
      finishSession(state.timeExpired ? 'time' : 'complete');
    } else {
      renderTask();
    }
  }, delay);
}

function checkDrawing() {
  if (state.transitioning || !state.session[state.index]) return;
  const task = state.session[state.index];
  const result = evaluateDrawing(task.strokes, board.getUserStrokes(), board.evaluationOptions());
  state.attempts += 1;
  const passed = passCriteria(result, task.assist, task);
  const generousPass = state.attempts >= 3 && result.hasInk && result.coverage > 0.16 && result.precision > 0.12;

  if (passed || generousPass) {
    elements.doneButton.disabled = true;
    elements.clearButton.disabled = true;
    elements.showButton.disabled = true;
    const message = generousPass && !passed ? 'Gut probiert!' : praise[Math.floor(Math.random() * praise.length)];
    celebrate(message, { gentle: generousPass && !passed });
    return;
  }

  const feedback = feedbackForEvaluation(result);
  setMentorMessage(feedback, { announce: true });
  board.flashGuide();
  elements.doneButton.disabled = !board.hasInk();
}

function finishSession(reason = 'complete') {
  if (state.screen === 'finish') return;
  stopTimer();
  state.taskToken += 1;
  state.transitioning = false;
  elements.successOverlay.hidden = true;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  const count = state.completed;
  const taskWord = count === 1 ? 'eine Aufgabe' : `${count} Aufgaben`;
  elements.finishSummary.textContent = reason === 'time'
    ? `Fünf Minuten sind um. Du hast ${taskWord} geschafft.`
    : `Du hast ${taskWord} geschafft.`;
  showScreen('finish');
  speak('Super geübt!');
}

function returnHome() {
  stopTimer();
  state.taskToken += 1;
  state.transitioning = false;
  state.timeExpired = false;
  elements.successOverlay.hidden = true;
  elements.exitModal.hidden = true;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  showScreen('home');
}

function openExitModal() {
  elements.exitModal.hidden = false;
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  window.setTimeout(() => elements.continueButton.focus(), 0);
}

function closeExitModal() {
  elements.exitModal.hidden = true;
  elements.exitButton.focus();
}

const board = new DrawingBoard(elements.drawingCanvas, {
  onInkChange(hasInk) {
    elements.doneButton.disabled = !hasInk || state.transitioning;
    elements.canvasHint.classList.toggle('is-hidden', hasInk || state.session[state.index]?.assist !== 'hard');
  },
  onStrokeEnd() {
    if (state.timeExpired && !state.transitioning) finishSession('time');
  },
});

elements.activityCards.forEach((card) => {
  card.addEventListener('click', () => selectCategory(card.dataset.category));
});

elements.soundButtons.forEach((button) => button.addEventListener('click', toggleSound));

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

elements.doneButton.addEventListener('click', checkDrawing);

elements.listenButton.addEventListener('click', () => {
  const task = state.session[state.index];
  if (task) {
    setMentorMessage(task.speech);
    speak(task.speech);
  }
});

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
  if (document.hidden && 'speechSynthesis' in window) window.speechSynthesis.cancel();
});

updateSoundButtons();
selectCategory('lines', { announce: false });
updateTimer();

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
      secondsRemaining: state.secondsRemaining,
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
    finish: () => finishSession('complete'),
    board,
  };
}
