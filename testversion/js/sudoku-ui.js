import { SUDOKU_SYMBOLS, isSudokuComplete, sudokuHint, validateSudokuEntry } from './sudoku.js?v=1.3.53';
import { recognizeSudokuInk, sudokuReferenceInk, SUDOKU_PAD } from './sudoku-recognition.js?v=1.3.53';
import { pointerSamples } from './drawing.js?v=1.3.53';

const cloneInk = (strokes) => strokes.map((stroke) => stroke.map((point) => ({ ...point })));
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const NS = 'http://www.w3.org/2000/svg';

export class SudokuGame {
  constructor(root, hooks = {}) {
    this.root = root;
    this.hooks = hooks;
    this.grid = root.querySelector('.sudoku-grid');
    this.canvas = root.querySelector('canvas');
    this.context = this.canvas.getContext('2d', { alpha: false });
    this.feedback = root.querySelector('.sudoku-feedback');
    this.submitButton = root.querySelector('.sudoku-submit');
    this.placeholder = root.querySelector('.sudoku-placeholder');
    this.selectionLabel = root.querySelector('.sudoku-selection');
    this.counter = root.querySelector('.sudoku-count');
    this.inkColor = '#3F8FB5';
    this.pointerId = null;
    this.locked = false;
    this.task = null;
    this.frame = 0;
    this.webkit = /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg/.test(navigator.userAgent);
    this.grid.addEventListener('click', (event) => {
      const button = event.target.closest('[data-sudoku-cell]');
      if (button) this.select(Number(button.dataset.sudokuCell));
    });
    this.submitButton.addEventListener('click', () => this.submit());
    this.canvas.addEventListener('pointerdown', (event) => this.pointerDown(event));
    this.canvas.addEventListener('pointermove', (event) => this.pointerMove(event));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => {
      this.canvas.addEventListener(name, (event) => this.pointerUp(event));
    });
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas);
  }

  setTask(task) {
    this.pointerId = null;
    this.task = task;
    this.puzzle = task.game;
    this.values = [...this.puzzle.givens];
    this.entries = Array(16).fill(null);
    this.drafts = Array.from({ length: 16 }, () => []);
    this.draftColors = Array.from({ length: 16 }, () => []);
    this.history = [];
    this.selected = this.values.indexOf(0);
    this.hintValue = null;
    this.conflicts = [];
    this.message = 'Tippe ein freies Feld. Schreib das fehlende Zeichen.';
    this.messageKind = '';
    this.locked = false;
    this.status = 'ready';
    const legend = this.root.querySelector('.sudoku-symbols');
    legend.replaceChildren(...SUDOKU_SYMBOLS[this.puzzle.mode].map((symbol) => {
      const item = document.createElement('span');
      item.textContent = symbol.label;
      item.title = symbol.name;
      item.setAttribute('aria-label', symbol.name);
      return item;
    }));
    this.render();
    requestAnimationFrame(() => this.resize());
  }

  setLocked(locked) {
    if (this.locked === locked) return;
    this.locked = locked;
    this.render();
  }

  setInkColor(color) { this.inkColor = color ?? '#3F8FB5'; }
  isDrawing() { return this.pointerId !== null; }
  hasInk() { return Boolean(this.task && (this.history.length || this.drafts.some((ink) => ink.length))); }
  canClear() { return Boolean(this.task && (this.drafts[this.selected]?.length || this.entries[this.selected])); }
  canUndo() { return Boolean(this.task && (this.drafts[this.selected]?.length || this.history.length)); }

  select(index) {
    if (this.locked || this.isDrawing() || this.puzzle.givens[index]) return;
    this.selected = index;
    this.hintValue = null;
    this.conflicts = [];
    this.message = 'Schreib dein Zeichen. Tippe dann auf „Einsetzen“.';
    this.messageKind = '';
    if (this.entries[index] && !this.drafts[index].length) {
      this.drafts[index] = cloneInk(this.entries[index].strokes);
      this.draftColors[index] = [...this.entries[index].colors];
    }
    this.render();
  }

  clear() {
    if (!this.task || this.locked || this.isDrawing() || this.selected < 0) return;
    const index = this.selected;
    if (this.values[index] && !this.puzzle.givens[index]) {
      this.history.push({ index, value: this.values[index], entry: this.entries[index] });
      this.values[index] = 0;
      this.entries[index] = null;
    }
    this.drafts[index] = [];
    this.draftColors[index] = [];
    this.hintValue = null;
    this.conflicts = [];
    this.message = 'Hier kannst du neu schreiben.';
    this.messageKind = '';
    this.render();
  }

  undo() {
    if (!this.task || this.locked || this.isDrawing()) return;
    if (this.drafts[this.selected]?.length) {
      this.drafts[this.selected].pop();
      this.draftColors[this.selected].pop();
    } else {
      const change = this.history.pop();
      if (!change) return;
      this.values[change.index] = change.value;
      this.entries[change.index] = change.entry;
      this.selected = change.index;
    }
    this.conflicts = [];
    this.hintValue = null;
    this.message = 'Versuch es noch einmal.';
    this.messageKind = '';
    this.render();
  }

  hint() {
    if (!this.task || this.locked || this.isDrawing()) return;
    const hint = sudokuHint(this.values);
    if (!hint) return;
    this.selected = hint.index;
    this.hintValue = hint.value;
    this.conflicts = [];
    const symbol = SUDOKU_SYMBOLS[this.puzzle.mode][hint.value - 1];
    const unit = hint.unit?.kind === 'row' ? 'Reihe' : hint.unit?.kind === 'column' ? 'Spalte' : hint.unit?.kind === 'box' ? 'Kästchen' : null;
    this.message = unit === 'Reihe' ? `In dieser Reihe fehlt ${symbol.label}.`
      : unit === 'Spalte' ? `In dieser Spalte fehlt ${symbol.label}.`
        : unit === 'Kästchen' ? `In diesem Kästchen fehlt ${symbol.label}.`
          : `Hier passt ${symbol.label}. Schreib es nach.`;
    this.messageKind = 'hint';
    this.render();
  }

  submit() {
    if (!this.task || this.locked || this.isDrawing() || this.selected < 0) return;
    const index = this.selected;
    const ink = this.drafts[index];
    const recognized = recognizeSudokuInk(ink, this.puzzle.mode);
    this.conflicts = [];
    if (!recognized.value) {
      this.message = recognized.reason === 'empty' ? 'Schreib zuerst ein Zeichen.' : 'Noch nicht erkannt. Nimm einen Strich zurück oder schreib neu.';
      this.messageKind = 'retry';
      this.render();
      return;
    }
    const validation = validateSudokuEntry(this.puzzle, this.values, index, recognized.value);
    if (!validation.accepted) {
      const symbol = SUDOKU_SYMBOLS[this.puzzle.mode][recognized.value - 1];
      this.conflicts = validation.conflicts;
      this.message = validation.reason === 'duplicate'
        ? `${symbol.label} steht hier schon. Schau auf die markierten Felder.`
        : `Ich erkenne ${symbol.label}. Prüfe Reihe, Spalte und Kästchen noch einmal.`;
      this.messageKind = 'retry';
      this.render();
      return;
    }
    this.history.push({ index, value: this.values[index], entry: this.entries[index] });
    this.values[index] = recognized.value;
    this.entries[index] = { strokes: cloneInk(ink), colors: [...this.draftColors[index]] };
    this.drafts[index] = [];
    this.draftColors[index] = [];
    this.hintValue = null;
    this.message = 'Prima! Das passt.';
    this.messageKind = 'success';
    this.status = isSudokuComplete(this.values) ? 'complete' : 'ready';
    if (this.status !== 'complete') this.selected = this.values.findIndex((value) => value === 0);
    this.render();
    if (this.status === 'complete') this.hooks.onComplete?.();
  }

  snapshot() {
    return this.task ? {
      mode: 'sudoku', symbols: this.puzzle.mode, status: this.status,
      values: [...this.values], givens: [...this.puzzle.givens], selected: this.selected,
      clueCount: this.puzzle.clueCount, filled: this.values.filter(Boolean).length,
      draftStrokes: this.drafts[this.selected]?.length ?? 0,
    } : null;
  }

  render() {
    if (!this.task) return;
    const symbols = SUDOKU_SYMBOLS[this.puzzle.mode];
    this.grid.replaceChildren(...this.values.map((value, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sudoku-cell';
      button.dataset.sudokuCell = index;
      button.classList.toggle('is-given', Boolean(this.puzzle.givens[index]));
      button.classList.toggle('is-selected', index === this.selected);
      button.classList.toggle('is-conflict', this.conflicts.includes(index));
      button.classList.toggle('is-alt-box', (Math.floor(index / 8) + Math.floor((index % 4) / 2)) % 2 === 1);
      button.disabled = this.locked || this.isDrawing() || Boolean(this.puzzle.givens[index]);
      button.setAttribute('aria-pressed', String(index === this.selected));
      button.setAttribute('aria-label', `Reihe ${Math.floor(index / 4) + 1}, Spalte ${index % 4 + 1}: ${value ? symbols[value - 1].name : 'leer'}${this.puzzle.givens[index] ? ', vorgegeben' : ''}`);
      if (this.entries[index]) {
        button.append(this.inkSvg(this.entries[index]));
      } else if (value) {
        button.textContent = symbols[value - 1].label;
      }
      return button;
    }));
    this.counter.textContent = `${this.values.filter(Boolean).length} / 16`;
    this.selectionLabel.textContent = `Dein Feld: Reihe ${Math.floor(this.selected / 4) + 1}, Spalte ${this.selected % 4 + 1}`;
    this.feedback.textContent = this.message;
    this.feedback.dataset.kind = this.messageKind;
    this.submitButton.disabled = this.locked || this.isDrawing() || !this.drafts[this.selected]?.length;
    this.drawPad();
    this.hooks.onChange?.();
  }

  inkSvg(entry) {
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    const points = entry.strokes.flat();
    const xs = points.map((p) => p.x * SUDOKU_PAD.width), ys = points.map((p) => p.y * SUDOKU_PAD.height);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const scale = Math.min(74 / Math.max(1, maxX - minX), 78 / Math.max(1, maxY - minY));
    entry.strokes.forEach((stroke, index) => {
      const path = document.createElementNS(NS, 'polyline');
      path.setAttribute('points', stroke.map((p) => `${50 + (p.x * SUDOKU_PAD.width - (minX + maxX) / 2) * scale},${50 + (p.y * SUDOKU_PAD.height - (minY + maxY) / 2) * scale}`).join(' '));
      path.setAttribute('stroke', entry.colors[index] ?? '#3F8FB5');
      svg.append(path);
    });
    return svg;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.dpr = dpr;
    this.drawPad();
  }

  drawPad() {
    if (!this.task || !this.canvas.width) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scale = Math.min(rect.width / SUDOKU_PAD.width, rect.height / SUDOKU_PAD.height);
    this.transform = { scale, x: (rect.width - SUDOKU_PAD.width * scale) / 2, y: (rect.height - SUDOKU_PAD.height * scale) / 2 };
    const ctx = this.context;
    ctx.setTransform(this.dpr ?? 1, 0, 0, this.dpr ?? 1, 0, 0);
    ctx.fillStyle = '#fffefa';
    ctx.fillRect(0, 0, rect.width, rect.height);
    ctx.translate(this.transform.x, this.transform.y);
    ctx.scale(scale, scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = '#E5DFD3';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(25, 170); ctx.lineTo(275, 170); ctx.stroke();
    const draw = (stroke, color, width, dash = []) => {
      if (!stroke.length) return;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash);
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * SUDOKU_PAD.width, stroke[0].y * SUDOKU_PAD.height);
      stroke.slice(1).forEach((point) => ctx.lineTo(point.x * SUDOKU_PAD.width, point.y * SUDOKU_PAD.height));
      if (stroke.length === 1) ctx.lineTo(stroke[0].x * SUDOKU_PAD.width + 0.01, stroke[0].y * SUDOKU_PAD.height);
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (this.hintValue) sudokuReferenceInk(this.puzzle.mode, this.hintValue).forEach((stroke) => draw(stroke, '#B9C6CC', 9));
    (this.drafts[this.selected] ?? []).forEach((stroke, index) => draw(stroke, this.draftColors[this.selected][index], 6));
    this.placeholder.hidden = Boolean(this.hintValue || this.drafts[this.selected]?.length);
  }

  point(event) {
    const rect = this.canvas.getBoundingClientRect();
    const t = this.transform;
    return {
      x: clamp((event.clientX - rect.x - t.x) / t.scale / SUDOKU_PAD.width, 0, 1),
      y: clamp((event.clientY - rect.y - t.y) / t.scale / SUDOKU_PAD.height, 0, 1),
    };
  }

  pointerDown(event) {
    if (!this.task || this.locked || this.isDrawing() || event.isPrimary === false || this.selected < 0 || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    this.drawPad();
    this.pointerId = event.pointerId;
    this.drafts[this.selected].push([this.point(event)]);
    this.draftColors[this.selected].push(this.inkColor);
    this.conflicts = [];
    this.canvas.setPointerCapture?.(event.pointerId);
    this.render();
  }

  pointerMove(event) {
    if (event.pointerId !== this.pointerId) return;
    event.preventDefault();
    const stroke = this.drafts[this.selected].at(-1);
    for (const sample of pointerSamples(event, this.webkit)) {
      const point = this.point(sample), last = stroke.at(-1);
      if (Math.hypot((point.x - last.x) * SUDOKU_PAD.width, (point.y - last.y) * SUDOKU_PAD.height) >= 0.8) stroke.push(point);
    }
    if (!this.frame) this.frame = requestAnimationFrame(() => { this.frame = 0; this.drawPad(); });
  }

  pointerUp(event) {
    if (event.pointerId !== this.pointerId) return;
    if (Number.isFinite(event.clientX) && event.type === 'pointerup') this.drafts[this.selected].at(-1).push(this.point(event));
    this.pointerId = null;
    if (this.canvas.hasPointerCapture?.(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
    this.render();
  }

  finishInterruptedStroke() {
    if (this.pointerId !== null) this.pointerUp({ pointerId: this.pointerId, type: 'pointercancel' });
  }
}
