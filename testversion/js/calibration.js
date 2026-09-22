import { buildReviewSession, EXERCISE_BANKS } from './curriculum.js?v=1.3.47';

const STORAGE_KEY = 'fino-calibration-dataset-v1';
const ATTEMPTS_PER_TARGET = 5;
const CANVAS_BACKGROUND = [255, 252, 247];
const VERSION = '1.3.47';
const $ = (selector) => document.querySelector(selector);
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const elements = {
  scope: $('#scope-select'),
  mode: $('#mode-select'),
  guide: $('#guide-toggle'),
  export: $('#export-button'),
  copy: $('#copy-button'),
  reset: $('#reset-button'),
  saveIndicator: $('#save-indicator'),
  dataNote: $('#data-note'),
  category: $('#target-category'),
  label: $('#target-label'),
  name: $('#target-name'),
  counter: $('#target-counter'),
  previous: $('#previous-button'),
  next: $('#next-button'),
  strokeStrip: $('#stroke-strip'),
  canvas: $('#calibration-canvas'),
  canvasBadge: $('#canvas-badge'),
  canvasHelp: $('#canvas-help'),
  attemptCount: $('#attempt-count'),
  attemptStatus: $('#attempt-status'),
  discard: $('#discard-button'),
  finishWhole: $('#finish-whole-button'),
  labelPanel: $('#label-panel'),
  yes: $('#yes-button'),
  no: $('#no-button'),
  reasonField: $('#reason-field'),
  reason: $('#reason-select'),
  progressTotal: $('#progress-total'),
  progressFill: $('#progress-meter-fill'),
  progressStats: $('#progress-stats'),
  targetList: $('#target-list'),
};

const state = {
  scope: 'glyphs',
  mode: 'stroke',
  guideVisible: true,
  targetIndex: 0,
  strokeIndex: 0,
  activePointerId: null,
  activeStroke: null,
  activeStartedAt: 0,
  activePointerType: 'pen',
  wholeStrokes: [],
  pending: null,
  viewport: { width: 900, height: 620, dpr: 1 },
};

const targetSets = {
  glyphs: buildReviewSession({ assist: 'easy' }).map((task) => ({ ...task, calibrationCategory: task.category })),
  shapes: EXERCISE_BANKS.shapes.map((task) => ({ ...task, calibrationCategory: task.category })),
};
targetSets.all = [...targetSets.glyphs, ...targetSets.shapes];
for (const option of elements.scope.options) {
  option.textContent = option.textContent.replace(/\(\d+\)$/, `(${targetSets[option.value].length})`);
}

const dataset = loadDataset();

function loadDataset() {
  const fallback = { schema: 'fino-calibration-v1', appVersion: VERSION, createdAt: new Date().toISOString(), attempts: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!parsed || parsed.schema !== fallback.schema || !Array.isArray(parsed.attempts)) return fallback;
    return { ...fallback, ...parsed, attempts: parsed.attempts.filter((attempt) => attempt && attempt.targetId && attempt.label) };
  } catch {
    return fallback;
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...dataset,
      updatedAt: new Date().toISOString(),
      ui: { scope: state.scope, mode: state.mode, guideVisible: state.guideVisible, targetIndex: state.targetIndex, strokeIndex: state.strokeIndex },
    }));
    elements.saveIndicator.textContent = 'lokal gespeichert';
    elements.saveIndicator.style.color = '';
  } catch (error) {
    elements.saveIndicator.textContent = 'Export nötig';
    elements.saveIndicator.style.color = 'var(--red)';
    elements.dataNote.textContent = 'Der lokale Speicher ist voll. Exportiere jetzt eine JSON-Datei; die Aufnahme bleibt bis dahin im Arbeitsspeicher.';
    console.warn('Calibration data could not be persisted:', error);
  }
}

function activeTargets() {
  return targetSets[state.scope] ?? targetSets.glyphs;
}

function currentTarget() {
  return activeTargets()[state.targetIndex] ?? activeTargets()[0];
}

function targetById(id) {
  return targetSets.all.find((target) => target.id === id) ?? null;
}

function currentTargetAttempts(target = currentTarget(), mode = state.mode) {
  if (!target) return [];
  return dataset.attempts.filter((attempt) => attempt.targetId === target.id && attempt.mode === mode);
}

function currentStrokeAttempts(target = currentTarget(), strokeIndex = state.strokeIndex) {
  return currentTargetAttempts(target, 'stroke').filter((attempt) => attempt.strokeIndex === strokeIndex);
}

function firstOpenStroke(target) {
  if (!target?.strokes?.length) return 0;
  const index = target.strokes.findIndex((_, strokeIndex) => currentStrokeAttempts(target, strokeIndex).length < ATTEMPTS_PER_TARGET);
  return index >= 0 ? index : Math.max(0, target.strokes.length - 1);
}

function targetCompletion(target, mode = state.mode) {
  const count = currentTargetAttempts(target, mode).length;
  const total = mode === 'whole' ? ATTEMPTS_PER_TARGET : target.strokes.length * ATTEMPTS_PER_TARGET;
  return { count: Math.min(total, count), total };
}

function rounded(value, decimals = 4) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function compactPoint(point) {
  return [rounded(point.x), rounded(point.y), rounded(point.pressure ?? 0.5, 3), rounded(point.time ?? 0, 1)];
}

function expandPoint(point) {
  return { x: Number(point[0]) || 0, y: Number(point[1]) || 0, pressure: Number(point[2]) || .5, time: Number(point[3]) || 0 };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function routeLength(route) {
  return route.reduce((sum, point, index) => index ? sum + distance(route[index - 1], point) : sum, 0);
}

function minDistanceToRoute(point, route) {
  if (!route?.length) return Infinity;
  if (route.length === 1) return distance(point, route[0]);
  let best = Infinity;
  for (let index = 1; index < route.length; index += 1) {
    const a = route[index - 1];
    const b = route[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const squared = dx * dx + dy * dy;
    const t = squared ? clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / squared, 0, 1) : 0;
    best = Math.min(best, distance(point, { x: a.x + dx * t, y: a.y + dy * t }));
  }
  return best;
}

function minDistanceToRoutes(point, routes) {
  return Math.min(...routes.map((route) => minDistanceToRoute(point, route)));
}

function sampleRoute(route, count = 80) {
  if (!route?.length) return [];
  if (route.length === 1) return [route[0]];
  const total = routeLength(route);
  if (!total) return [route[0]];
  const samples = [];
  for (let index = 0; index < count; index += 1) {
    let remaining = total * (index / Math.max(1, count - 1));
    for (let segment = 1; segment < route.length; segment += 1) {
      const start = route[segment - 1];
      const end = route[segment];
      const length = distance(start, end);
      if (remaining <= length || segment === route.length - 1) {
        const ratio = length ? clamp(remaining / length, 0, 1) : 0;
        samples.push({ x: start.x + (end.x - start.x) * ratio, y: start.y + (end.y - start.y) * ratio });
        break;
      }
      remaining -= length;
    }
  }
  return samples;
}

function allPoints(strokes) {
  return strokes.flatMap((stroke) => stroke.map((point) => ({ x: point.x, y: point.y })));
}

function totalLength(strokes) {
  return strokes.reduce((sum, stroke) => sum + routeLength(stroke), 0);
}

function directionCosine(expected, actual) {
  if (!expected?.length || !actual?.length || expected.length === 1 || actual.length === 1) return null;
  const a = expected.at(-1);
  const b = expected[0];
  const c = actual.at(-1);
  const d = actual[0];
  const ex = a.x - b.x;
  const ey = a.y - b.y;
  const ux = c.x - d.x;
  const uy = c.y - d.y;
  const expectedMagnitude = Math.hypot(ex, ey);
  const actualMagnitude = Math.hypot(ux, uy);
  if (expectedMagnitude < 1e-9 || actualMagnitude < 1e-9) return null;
  return (ex * ux + ey * uy) / (expectedMagnitude * actualMagnitude);
}

function deriveFeatures(target, mode, strokeIndex, strokes) {
  const expectedRoutes = mode === 'whole'
    ? target.strokes.map((route) => route.map((point) => ({ x: point.x, y: point.y })))
    : [target.strokes[strokeIndex].map((point) => ({ x: point.x, y: point.y }))];
  const actualRoutes = strokes.map((stroke) => stroke.map((point) => ({ x: point.x, y: point.y })));
  const expectedSamples = expectedRoutes.flatMap((route) => sampleRoute(route));
  const actualPoints = allPoints(actualRoutes);
  const targetDistances = expectedSamples.map((point) => minDistanceToRoutes(point, actualRoutes));
  const userDistances = actualPoints.map((point) => minDistanceToRoutes(point, expectedRoutes));
  const targetMse = targetDistances.length ? targetDistances.reduce((sum, value) => sum + value ** 2, 0) / targetDistances.length : null;
  const userMse = userDistances.length ? userDistances.reduce((sum, value) => sum + value ** 2, 0) / userDistances.length : null;
  const sortedUser = [...userDistances].sort((a, b) => a - b);
  const percentile = (values, fraction) => values.length ? values[Math.min(values.length - 1, Math.floor(values.length * fraction))] : null;
  const expectedLength = totalLength(expectedRoutes);
  const actualLength = totalLength(actualRoutes);
  const direction = mode === 'stroke' ? directionCosine(expectedRoutes[0], actualRoutes[0]) : null;
  const distancesAt = (radius) => expectedSamples.length
    ? expectedSamples.filter((point) => minDistanceToRoutes(point, actualRoutes) <= radius).length / expectedSamples.length
    : 0;
  return {
    pointCount: actualPoints.length,
    strokeCount: actualRoutes.length,
    expectedLength: rounded(expectedLength),
    actualLength: rounded(actualLength),
    lengthRatio: expectedLength ? rounded(actualLength / expectedLength) : null,
    targetMse: targetMse === null ? null : rounded(targetMse, 7),
    userMse: userMse === null ? null : rounded(userMse, 7),
    symmetricMse: targetMse === null || userMse === null ? null : rounded((targetMse + userMse) / 2, 7),
    userP95Distance: percentile(sortedUser, .95) === null ? null : rounded(percentile(sortedUser, .95)),
    coverageAt005: rounded(distancesAt(.05), 4),
    coverageAt010: rounded(distancesAt(.10), 4),
    startDistance: actualRoutes[0]?.[0] ? rounded(minDistanceToRoutes(actualRoutes[0][0], expectedRoutes)) : null,
    endDistance: actualRoutes.at(-1)?.at(-1) ? rounded(minDistanceToRoutes(actualRoutes.at(-1).at(-1), expectedRoutes)) : null,
    directionCosine: direction === null ? null : rounded(direction, 4),
  };
}

function targetCatalog() {
  return targetSets.all.map((task) => ({
    id: task.id,
    category: task.category,
    label: task.label,
    title: task.title,
    strokes: task.strokes.map((route) => route.map((point) => [rounded(point.x), rounded(point.y)])),
    completionGroups: task.completionGroups,
  }));
}

function exportPayload() {
  return {
    schema: dataset.schema,
    appVersion: VERSION,
    createdAt: dataset.createdAt,
    updatedAt: dataset.updatedAt ?? new Date().toISOString(),
    exportedAt: new Date().toISOString(),
    attempts: dataset.attempts,
    targets: targetCatalog(),
    summary: summaryForScope('all'),
  };
}

function summaryForScope(scope = state.scope) {
  const targets = targetSets[scope] ?? targetSets.all;
  const targetIds = new Set(targets.map((target) => target.id));
  const attempts = dataset.attempts.filter((attempt) => targetIds.has(attempt.targetId));
  const yes = attempts.filter((attempt) => attempt.verdict === 'yes').length;
  const no = attempts.filter((attempt) => attempt.verdict === 'no').length;
  const modes = ['stroke', 'whole'].map((mode) => ({ mode, count: attempts.filter((attempt) => attempt.mode === mode).length }));
  return { targets: targets.length, attempts: attempts.length, yes, no, modes };
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(exportPayload(), null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `fino-calibration-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  elements.dataNote.textContent = `${dataset.attempts.length} Versuche exportiert.`;
}

async function copyJson() {
  const text = JSON.stringify(exportPayload(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    elements.dataNote.textContent = `${dataset.attempts.length} Versuche in die Zwischenablage kopiert.`;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.append(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
    elements.dataNote.textContent = `${dataset.attempts.length} Versuche kopiert.`;
  }
}

function canvasPoint(event) {
  const rect = elements.canvas.getBoundingClientRect();
  return {
    x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
    y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
    pressure: Number.isFinite(event.pressure) && event.pressure > 0 ? clamp(event.pressure, 0, 1) : event.pointerType === 'mouse' ? .5 : .45,
    time: Math.max(0, performance.now() - state.activeStartedAt),
  };
}

function setBadge(text, stateName = '') {
  elements.canvasBadge.textContent = text;
  elements.canvasBadge.classList.toggle('is-drawing', stateName === 'drawing');
  elements.canvasBadge.classList.toggle('is-pending', stateName === 'pending');
}

function routePixels(route) {
  return route.map((point) => ({ x: point.x * state.viewport.width, y: point.y * state.viewport.height }));
}

function drawRoute(context, route, { color, width, alpha = 1, dash = [] } = {}) {
  if (!route?.length) return;
  const points = routePixels(route);
  context.save();
  // Preblend against this opaque board. WebKit can compound globalAlpha at
  // joins of dense polylines, leaving dark dots on an otherwise smooth guide.
  const channels = color.slice(1).match(/../g).map((hex, i) => Math.round(
    parseInt(hex, 16) * alpha + CANVAS_BACKGROUND[i] * (1 - alpha),
  ));
  context.globalAlpha = 1;
  context.strokeStyle = context.fillStyle = `rgb(${channels.join(',')})`;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  context.setLineDash(dash);
  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x, points[0].y, Math.max(5, width * 1.3), 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  }
  context.restore();
}

function drawUserStroke(context, stroke, { active = false } = {}) {
  if (!stroke?.length) return;
  const points = stroke.map((point) => ({ x: point.x * state.viewport.width, y: point.y * state.viewport.height }));
  context.save();
  context.strokeStyle = active ? '#c54f77' : '#294f77';
  context.fillStyle = context.strokeStyle;
  context.lineWidth = Math.max(5, Math.min(14, Math.min(state.viewport.width, state.viewport.height) * .018));
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x, points[0].y, context.lineWidth * .8, 0, Math.PI * 2);
    context.fill();
  } else {
    context.beginPath();
    context.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
    context.stroke();
  }
  context.restore();
}

function renderCanvas() {
  const context = elements.canvas.getContext('2d');
  if (!context) return;
  const { width, height, dpr } = state.viewport;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  context.fillStyle = `rgb(${CANVAS_BACKGROUND.join(',')})`;
  context.fillRect(0, 0, width, height);
  const target = currentTarget();
  if (!target) return;
  if (state.guideVisible) {
    const current = state.mode === 'stroke' ? state.strokeIndex : -1;
    target.strokes.forEach((route, index) => {
      const active = state.mode === 'whole' || index === current;
      drawRoute(context, route, active
        ? { color: '#4d9fb3', width: Math.max(7, Math.min(15, Math.min(width, height) * .018)), alpha: state.mode === 'whole' ? .34 : .58, dash: state.mode === 'whole' ? [5, 11] : [] }
        : { color: '#9eabb0', width: Math.max(4, Math.min(10, Math.min(width, height) * .012)), alpha: .18, dash: [3, 14] });
    });
  }
  state.wholeStrokes.forEach((stroke) => drawUserStroke(context, stroke));
  if (state.pending?.strokes) state.pending.strokes.forEach((stroke) => drawUserStroke(context, stroke));
  if (state.activeStroke) drawUserStroke(context, state.activeStroke, { active: true });
}

function resizeCanvas() {
  const rect = elements.canvas.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return;
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
  state.viewport = { width: rect.width, height: rect.height, dpr };
  const pixelWidth = Math.round(rect.width * dpr);
  const pixelHeight = Math.round(rect.height * dpr);
  if (elements.canvas.width !== pixelWidth || elements.canvas.height !== pixelHeight) {
    elements.canvas.width = pixelWidth;
    elements.canvas.height = pixelHeight;
  }
  renderCanvas();
}

function clearPending() {
  state.pending = null;
  state.wholeStrokes = [];
  state.activeStroke = null;
  state.activePointerId = null;
  elements.labelPanel.hidden = true;
  elements.discard.disabled = true;
  elements.finishWhole.hidden = state.mode !== 'whole';
  elements.reasonField.hidden = true;
  elements.reason.value = '';
  elements.no.textContent = 'Nein · nicht korrekt';
  setBadge('Stift bereit');
  renderCanvas();
}

function startPointer(event) {
  if (state.activePointerId !== null || state.pending) return;
  if (event.pointerType === 'touch' && !event.isPrimary) return;
  event.preventDefault();
  state.activePointerId = event.pointerId;
  state.activeStartedAt = performance.now();
  state.activePointerType = event.pointerType || 'unknown';
  state.activeStroke = [canvasPoint(event)];
  elements.canvas.setPointerCapture?.(event.pointerId);
  setBadge('Zeichnet …', 'drawing');
  renderCanvas();
}

function movePointer(event) {
  if (state.activePointerId !== event.pointerId || !state.activeStroke) return;
  event.preventDefault();
  const point = canvasPoint(event);
  const previous = state.activeStroke.at(-1);
  if (!previous || distance(previous, point) >= .001) state.activeStroke.push(point);
  renderCanvas();
}

function finishPointer(event) {
  if (state.activePointerId !== event.pointerId || !state.activeStroke) return;
  event.preventDefault();
  const endpoint = canvasPoint(event);
  if (distance(state.activeStroke.at(-1), endpoint) > .0002) state.activeStroke.push(endpoint);
  const stroke = state.activeStroke.map((point) => ({ ...point }));
  const pointerType = state.activePointerType;
  state.activePointerId = null;
  state.activeStroke = null;
  try { elements.canvas.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
  if (stroke.length < 2 && currentTarget().strokes[state.strokeIndex]?.length > 1) {
    elements.attemptStatus.textContent = 'Zu wenig Punkte — zeichne den Strich noch einmal.';
    setBadge('Stift bereit');
    renderCanvas();
    return;
  }
  if (state.mode === 'whole') {
    state.wholeStrokes.push(stroke);
    state.pendingPointerType = pointerType;
    setBadge('Beispiel bereit', 'pending');
    elements.finishWhole.hidden = false;
    elements.discard.disabled = false;
    elements.canvasHelp.textContent = "Weitere Striche sind möglich. Wenn das ganze Zeichen fertig ist, klicke auf „Beispiel abschließen“.";
  } else {
    state.pending = { strokes: [stroke], pointerType };
    elements.discard.disabled = false;
    elements.labelPanel.hidden = false;
    elements.canvasHelp.textContent = 'Prüfe deinen Versuch und wähle Ja oder Nein.';
    setBadge('Bewertung wählen', 'pending');
  }
  renderCanvas();
  updateLabels();
}

function cancelPointer(event) {
  if (state.activePointerId !== event.pointerId) return;
  state.activePointerId = null;
  state.activeStroke = null;
  setBadge('Stift bereit');
  renderCanvas();
}

function finishWhole() {
  if (state.mode !== 'whole' || !state.wholeStrokes.length || state.pending) return;
  const pointerType = state.pendingPointerType ?? state.activePointerType;
  state.pending = { strokes: state.wholeStrokes.map((stroke) => stroke.map((point) => ({ ...point }))), pointerType };
  elements.labelPanel.hidden = false;
  elements.finishWhole.hidden = true;
  elements.discard.disabled = false;
  elements.canvasHelp.textContent = 'Prüfe das Gesamtzeichen und wähle Ja oder Nein.';
  setBadge('Bewertung wählen', 'pending');
  updateLabels();
}

function updateLabels() {
  const target = currentTarget();
  if (!target) return;
  const attempts = state.mode === 'whole' ? currentTargetAttempts(target, 'whole') : currentStrokeAttempts(target, state.strokeIndex);
  const count = attempts.length;
  elements.attemptCount.textContent = `Versuch ${Math.min(ATTEMPTS_PER_TARGET, count + 1)} / ${ATTEMPTS_PER_TARGET}`;
  elements.attemptStatus.textContent = state.pending
    ? 'Versuch wartet auf deine Bewertung.'
    : count >= ATTEMPTS_PER_TARGET
      ? 'Dieser Abschnitt ist vollständig.'
      : 'Noch kein Versuch gespeichert.';
  elements.labelPanel.hidden = !state.pending;
  elements.discard.disabled = !state.pending && !state.wholeStrokes.length;
  elements.finishWhole.hidden = state.mode !== 'whole' || Boolean(state.pending) || !state.wholeStrokes.length;
}

function recordLabel(label) {
  if (!state.pending) return;
  const target = currentTarget();
  if (!target) return;
  const strokeIndex = state.mode === 'stroke' ? state.strokeIndex : null;
  const reason = label === 'no' ? elements.reason.value : '';
  const strokes = state.pending.strokes.map((stroke) => stroke.map((point) => ({ ...point })));
  const attempt = {
    id: `${target.id}-${state.mode}-${strokeIndex ?? 'whole'}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    targetId: target.id,
    category: target.category,
    label: target.label,
    mode: state.mode,
    strokeIndex,
    attemptNumber: (state.mode === 'whole' ? currentTargetAttempts(target, 'whole') : currentStrokeAttempts(target, state.strokeIndex)).length + 1,
    verdict: label,
    reason,
    guideVisible: state.guideVisible,
    pointerType: state.pending.pointerType ?? 'unknown',
    viewport: { width: Math.round(state.viewport.width), height: Math.round(state.viewport.height) },
    capturedAt: new Date().toISOString(),
    strokes: strokes.map((stroke) => stroke.map(compactPoint)),
    features: deriveFeatures(target, state.mode, strokeIndex ?? 0, strokes),
  };
  dataset.attempts.push(attempt);
  state.pending = null;
  state.wholeStrokes = [];
  state.pendingPointerType = null;
  elements.reason.value = '';
  elements.reasonField.hidden = true;
  persist();
  elements.dataNote.textContent = `${dataset.attempts.length} Versuche gespeichert.`;
  advanceAfterLabel();
}

function advanceAfterLabel() {
  const target = currentTarget();
  const completion = targetCompletion(target, state.mode);
  const finished = completion.count >= completion.total;
  if (state.mode === 'stroke' && !finished) {
    const next = firstOpenStroke(target);
    state.strokeIndex = next;
  } else if (finished) {
    if (state.targetIndex < activeTargets().length - 1) {
      state.targetIndex += 1;
      state.strokeIndex = firstOpenStroke(currentTarget());
    } else {
      state.strokeIndex = firstOpenStroke(target);
    }
  }
  clearPending();
  renderAll();
}

function discardCurrent() {
  if (!state.pending && !state.wholeStrokes.length) return;
  clearPending();
  elements.canvasHelp.textContent = state.mode === 'whole'
    ? 'Zeichne das Gesamtzeichen. Du kannst mehrere Striche verbinden.'
    : 'Zeichne den markierten Strich in einem Zug. Hebe den Stift danach ab.';
  updateLabels();
}

function setTarget(index, { preserveStroke = false } = {}) {
  const targets = activeTargets();
  state.targetIndex = clamp(index, 0, Math.max(0, targets.length - 1));
  state.strokeIndex = preserveStroke ? clamp(state.strokeIndex, 0, Math.max(0, (currentTarget()?.strokes?.length ?? 1) - 1)) : firstOpenStroke(currentTarget());
  clearPending();
  renderAll();
  persist();
}

function changeScope(value) {
  state.scope = targetSets[value] ? value : 'glyphs';
  state.targetIndex = 0;
  state.strokeIndex = firstOpenStroke(currentTarget());
  clearPending();
  renderAll();
  persist();
}

function changeMode(value) {
  state.mode = value === 'whole' ? 'whole' : 'stroke';
  state.targetIndex = 0;
  state.strokeIndex = firstOpenStroke(currentTarget());
  clearPending();
  renderAll();
  persist();
}

function renderTargetHeader() {
  const target = currentTarget();
  const targets = activeTargets();
  if (!target) return;
  const category = target.category === 'shapes' ? 'Form' : target.category === 'numbers' ? 'Zahl' : 'Buchstabe';
  elements.category.textContent = category;
  elements.label.textContent = target.label;
  elements.name.textContent = target.title ?? target.label;
  elements.counter.textContent = `${state.targetIndex + 1} / ${targets.length}`;
  elements.previous.disabled = state.targetIndex <= 0;
  elements.next.disabled = state.targetIndex >= targets.length - 1;
  if (state.mode === 'whole') {
    elements.canvasHelp.textContent = state.pending ? 'Prüfe das Gesamtzeichen und wähle Ja oder Nein.' : 'Zeichne das ganze Zeichen. Mehrere verbundene oder getrennte Striche sind erlaubt.';
  } else {
    elements.canvasHelp.textContent = state.pending ? 'Prüfe deinen Versuch und wähle Ja oder Nein.' : 'Zeichne den markierten Strich in einem Zug. Hebe den Stift danach ab.';
  }
}

function renderStrokeStrip() {
  const target = currentTarget();
  elements.strokeStrip.innerHTML = '';
  if (!target) return;
  if (state.mode === 'whole') {
    const chip = document.createElement('span');
    chip.className = `stroke-chip${targetCompletion(target, 'whole').count >= ATTEMPTS_PER_TARGET ? ' is-complete' : ' is-current'}`;
    chip.textContent = `Gesamt · ${targetCompletion(target, 'whole').count}/${ATTEMPTS_PER_TARGET}`;
    elements.strokeStrip.append(chip);
    return;
  }
  target.strokes.forEach((_, index) => {
    const done = currentStrokeAttempts(target, index).length >= ATTEMPTS_PER_TARGET;
    const chip = document.createElement('span');
    chip.className = `stroke-chip${index === state.strokeIndex ? ' is-current' : ''}${done ? ' is-complete' : ''}`;
    chip.textContent = `${index + 1} · ${Math.min(ATTEMPTS_PER_TARGET, currentStrokeAttempts(target, index).length)}/${ATTEMPTS_PER_TARGET}`;
    elements.strokeStrip.append(chip);
  });
}

function renderProgress() {
  const targets = activeTargets();
  const mode = state.mode;
  const total = targets.reduce((sum, target) => sum + (mode === 'whole' ? ATTEMPTS_PER_TARGET : target.strokes.length * ATTEMPTS_PER_TARGET), 0);
  const attempts = dataset.attempts.filter((attempt) => targets.some((target) => target.id === attempt.targetId) && attempt.mode === mode);
  const yes = attempts.filter((attempt) => attempt.verdict === 'yes').length;
  const no = attempts.filter((attempt) => attempt.verdict === 'no').length;
  elements.progressTotal.textContent = `${attempts.length} / ${total}`;
  elements.progressFill.style.width = `${total ? Math.min(100, attempts.length / total * 100) : 0}%`;
  elements.progressStats.innerHTML = `<span>Ja ${yes}</span><span>Nein ${no}</span><span>${Math.round(attempts.length / Math.max(1, total) * 100)} %</span>`;
  elements.targetList.innerHTML = '';
  targets.forEach((target, index) => {
    const completion = targetCompletion(target, mode);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `target-row${index === state.targetIndex ? ' is-current' : ''}${completion.count >= completion.total ? ' is-complete' : ''}`;
    row.innerHTML = `<strong>${escapeHtml(target.label)}</strong><small>${escapeHtml(target.title ?? '')}</small><span class="row-count">${completion.count}/${completion.total}</span>`;
    row.addEventListener('click', () => setTarget(index));
    elements.targetList.append(row);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function renderAll() {
  elements.scope.value = state.scope;
  elements.mode.value = state.mode;
  elements.guide.checked = state.guideVisible;
  renderTargetHeader();
  renderStrokeStrip();
  renderProgress();
  updateLabels();
  renderCanvas();
}

function toggleNoReason() {
  elements.reasonField.hidden = !elements.reasonField.hidden;
  elements.no.textContent = elements.reasonField.hidden ? 'Nein · nicht korrekt' : 'Nein speichern';
  if (!elements.reasonField.hidden) elements.reason.focus();
}

function restoreUi() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    const ui = raw?.ui;
    if (ui?.scope && targetSets[ui.scope]) state.scope = ui.scope;
    if (ui?.mode === 'whole' || ui?.mode === 'stroke') state.mode = ui.mode;
    if (typeof ui?.guideVisible === 'boolean') state.guideVisible = ui.guideVisible;
    if (Number.isInteger(ui?.targetIndex)) state.targetIndex = clamp(ui.targetIndex, 0, activeTargets().length - 1);
    if (Number.isInteger(ui?.strokeIndex)) state.strokeIndex = clamp(ui.strokeIndex, 0, Math.max(0, (currentTarget()?.strokes?.length ?? 1) - 1));
  } catch {
    // Defaults are fine when the saved UI state is not readable.
  }
  state.strokeIndex = state.mode === 'stroke' ? firstOpenStroke(currentTarget()) : 0;
}

elements.scope.addEventListener('change', () => changeScope(elements.scope.value));
elements.mode.addEventListener('change', () => changeMode(elements.mode.value));
elements.guide.addEventListener('change', () => {
  state.guideVisible = elements.guide.checked;
  renderCanvas();
  persist();
});
elements.export.addEventListener('click', downloadJson);
elements.copy.addEventListener('click', copyJson);
elements.reset.addEventListener('click', () => {
  if (!dataset.attempts.length || window.confirm('Alle Kalibrierungsdaten in diesem Browser löschen?')) {
    dataset.attempts.length = 0;
    dataset.createdAt = new Date().toISOString();
    persist();
    state.targetIndex = 0;
    state.strokeIndex = 0;
    clearPending();
    renderAll();
    elements.dataNote.textContent = 'Datensatz geleert.';
  }
});
elements.previous.addEventListener('click', () => setTarget(state.targetIndex - 1));
elements.next.addEventListener('click', () => setTarget(state.targetIndex + 1));
elements.discard.addEventListener('click', discardCurrent);
elements.finishWhole.addEventListener('click', finishWhole);
elements.yes.addEventListener('click', () => recordLabel('yes'));
elements.no.addEventListener('click', () => {
  if (elements.reasonField.hidden) {
    toggleNoReason();
    return;
  }
  recordLabel('no');
});
elements.reason.addEventListener('change', () => {
  if (!elements.reasonField.hidden) recordLabel('no');
});

elements.canvas.addEventListener('pointerdown', startPointer);
elements.canvas.addEventListener('pointermove', movePointer);
elements.canvas.addEventListener('pointerup', finishPointer);
elements.canvas.addEventListener('pointercancel', cancelPointer);
elements.canvas.addEventListener('lostpointercapture', cancelPointer);
['touchstart', 'touchmove', 'touchend', 'gesturestart', 'gesturechange', 'gestureend', 'contextmenu'].forEach((eventName) => {
  elements.canvas.addEventListener(eventName, (event) => event.preventDefault(), { passive: false });
});
window.addEventListener('resize', resizeCanvas);
if ('ResizeObserver' in window) new ResizeObserver(resizeCanvas).observe(elements.canvas);
document.addEventListener('keydown', (event) => {
  if (event.target.matches('select, input, textarea')) return;
  if (state.pending && event.key.toLowerCase() === 'y') recordLabel('yes');
  else if (state.pending && event.key.toLowerCase() === 'n') {
    if (elements.reasonField.hidden) toggleNoReason();
    else recordLabel('no');
  } else if (event.key === 'Escape') discardCurrent();
});

restoreUi();
renderAll();
resizeCanvas();
persist();

window.render_game_to_text = () => JSON.stringify({
  mode: 'calibration',
  coordinateSystem: 'canvas uses normalized coordinates: origin top-left, x right, y down',
  scope: state.scope,
  recordingMode: state.mode,
  target: { id: currentTarget()?.id ?? null, label: currentTarget()?.label ?? null, index: state.targetIndex + 1, total: activeTargets().length },
  strokeIndex: state.mode === 'stroke' ? state.strokeIndex : null,
  attempt: state.mode === 'whole' ? currentTargetAttempts(currentTarget(), 'whole').length : currentStrokeAttempts(currentTarget(), state.strokeIndex).length,
  pending: Boolean(state.pending),
  savedAttempts: dataset.attempts.length,
});

window.advanceTime = () => renderCanvas();
