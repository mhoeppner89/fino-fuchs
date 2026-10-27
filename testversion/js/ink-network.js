/** Small CNN inference and pen-to-image conversion; no library or network dependency. */
export function rasterizeInk(strokes, { width = 300, height = 200, size = 28, extent = 20, thickness = 1.8 } = {}) {
  const paths = strokes.map((stroke) => stroke.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .map((p) => ({ x: p.x * width, y: p.y * height }))).filter((stroke) => stroke.length);
  const points = paths.flat();
  if (!points.length || points.length > 20000) return null;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const p of points) {
    left = Math.min(left, p.x); right = Math.max(right, p.x);
    top = Math.min(top, p.y); bottom = Math.max(bottom, p.y);
  }
  const span = Math.max(right - left, bottom - top);
  if (span < 14) return null;
  const zoom = extent / span, cx = (left + right) / 2, cy = (top + bottom) / 2;
  const side = size * 4, pixels = new Uint8Array(side * side), radius = thickness * 2;
  const stamp = (a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
    const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - radius));
    const x1 = Math.min(side - 1, Math.ceil(Math.max(a.x, b.x) + radius));
    const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - radius));
    const y1 = Math.min(side - 1, Math.ceil(Math.max(a.y, b.y) + radius));
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      const t = length ? Math.max(0, Math.min(1, ((x + 0.5 - a.x) * dx + (y + 0.5 - a.y) * dy) / length)) : 0;
      if ((x + 0.5 - a.x - t * dx) ** 2 + (y + 0.5 - a.y - t * dy) ** 2 <= radius * radius) pixels[y * side + x] = 1;
    }
  };
  for (const stroke of paths) {
    const path = stroke.map((p) => ({ x: ((p.x - cx) * zoom + size / 2) * 4, y: ((p.y - cy) * zoom + size / 2) * 4 }));
    if (path.length === 1) stamp(path[0], path[0]);
    for (let i = 1; i < path.length; i += 1) stamp(path[i - 1], path[i]);
  }
  const image = new Float32Array(size * size);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) image[Math.floor(y / 4) * size + Math.floor(x / 4)] += pixels[y * side + x] / 16;
  return image;
}

function convolution(input, side, channels, kernel, bias, outputs) {
  const area = side * side, result = new Float32Array(area * outputs);
  for (let out = 0; out < outputs; out += 1) {
    for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) {
      let sum = bias[out];
      for (let channel = 0; channel < channels; channel += 1) {
        const k = (out * channels + channel) * 9, source = channel * area;
        for (let ky = 0; ky < 3; ky += 1) {
          const yy = y + ky - 1;
          if (yy < 0 || yy >= side) continue;
          for (let kx = 0; kx < 3; kx += 1) {
            const xx = x + kx - 1;
            if (xx >= 0 && xx < side) sum += input[source + yy * side + xx] * kernel[k + ky * 3 + kx];
          }
        }
      }
      result[out * area + y * side + x] = Math.max(0, sum);
    }
  }
  return result;
}

function pool(input, side, channels) {
  const next = side / 2, result = new Float32Array(next * next * channels);
  for (let c = 0; c < channels; c += 1) for (let y = 0; y < next; y += 1) for (let x = 0; x < next; x += 1) {
    const index = c * side * side + y * 2 * side + x * 2;
    result[c * next * next + y * next + x] = Math.max(input[index], input[index + 1], input[index + side], input[index + side + 1]);
  }
  return result;
}

function dense(input, kernel, bias, relu) {
  const result = new Float32Array(bias.length);
  for (let out = 0; out < bias.length; out += 1) {
    let sum = bias[out];
    for (let i = 0; i < input.length; i += 1) sum += input[i] * kernel[out * input.length + i];
    result[out] = relu ? Math.max(0, sum) : sum;
  }
  return result;
}

export function createInkNetwork(metadata, buffer) {
  if (metadata.format !== 1 || metadata.architecture !== 'conv12-pool-conv24-pool-dense64' || buffer.byteLength % 4) throw new Error('Unsupported ink model.');
  const models = {};
  for (const [mode, model] of Object.entries(metadata.models)) {
    const weights = {};
    const expected = {
      'conv1.weight': [12,1,3,3], 'conv1.bias': [12], 'conv2.weight': [24,12,3,3], 'conv2.bias': [24],
      'dense.weight': [64,1176], 'dense.bias': [64], 'output.weight': [model.labels.length,64], 'output.bias': [model.labels.length],
    };
    for (const [name, shape] of Object.entries(expected)) {
      const spec = model.weights[name];
      if (!spec || JSON.stringify(spec.shape) !== JSON.stringify(shape) || spec.length !== shape.reduce((a,b) => a*b,1)
        || !Number.isInteger(spec.offset) || spec.offset < 0 || (spec.offset+spec.length)*4 > buffer.byteLength) throw new Error('Invalid ink model weights.');
      weights[name] = new Float32Array(buffer, spec.offset * 4, spec.length);
    }
    models[mode] = { labels: model.labels, weights };
  }
  if (!['numbers','letters','symbols'].every((mode) => models[mode])) throw new Error('Incomplete ink models.');
  return {
    predict(image, mode) {
      const model = models[mode];
      if (!model || image?.length !== 784) return [];
      const w = model.weights;
      let x = pool(convolution(image, 28, 1, w['conv1.weight'], w['conv1.bias'], 12), 28, 12);
      x = pool(convolution(x, 14, 12, w['conv2.weight'], w['conv2.bias'], 24), 14, 24);
      x = dense(x, w['dense.weight'], w['dense.bias'], true);
      const logits = dense(x, w['output.weight'], w['output.bias'], false);
      const peak = Math.max(...logits), exp = Array.from(logits, (value) => Math.exp(value - peak));
      const sum = exp.reduce((total, value) => total + value, 0);
      return exp.map((value, index) => ({ label: model.labels[index], score: value / sum })).sort((a, b) => b.score - a.score);
    },
  };
}
