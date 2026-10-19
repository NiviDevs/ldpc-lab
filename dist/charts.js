import { binaryCapacity, capacityThreshold, countErrors } from './codec.js';
const green = '#65713f', copper = '#af643c';
function context(canvas) {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2), w = rect.width, h = rect.height;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const c = canvas.getContext('2d'), fontSize = w < 390 ? 12 : 14;
  c.setTransform(dpr, 0, 0, dpr, 0, 0); c.font = `${fontSize}px 'DM Mono',monospace`; c.lineJoin = 'round';
  return { c, w, h, fontSize, left: 56, right: w - 18, top: 34, bottom: h - 48 };
}
function axes(p, { xmin, xmax, ymin, ymax, xticks, yticks, log = false, xlabel, ylabel }) {
  const { c, left: l, right: r, top: t, bottom: b, w, h } = p;
  const xx = x => l + (x - xmin) / (xmax - xmin) * (r - l), yy = y => b - ((log ? Math.log10(y) - Math.log10(ymin) : y - ymin) / (log ? Math.log10(ymax) - Math.log10(ymin) : ymax - ymin)) * (b - t);
  c.lineWidth = .8; c.strokeStyle = '#ccbf9e'; c.fillStyle = '#756b59'; c.textAlign = 'right'; c.textBaseline = 'middle';
  for (const [value, label] of yticks) { const y = yy(value); c.beginPath(); c.moveTo(l, y); c.lineTo(r, y); c.stroke(); c.fillText(label, l - 8, y); }
  c.textAlign = 'center';
  for (const [value, label] of xticks) { const x = xx(value); c.fillText(label, x, b + 19); }
  c.fillStyle = '#665c4d'; c.font = `${p.fontSize}px 'DM Mono',monospace`; c.fillText(xlabel, (l + r) / 2, h - 9);
  c.textAlign = 'left'; c.fillText(ylabel, l, 15);
  c.save(); c.strokeStyle = '#b8aa88'; c.lineWidth = 1; c.beginPath(); c.moveTo(l, t); c.lineTo(l, b); c.lineTo(r, b); c.stroke(); c.restore();
  return { xx, yy };
}
function path(c, points, color, dashed = false, width = 1.5) {
  c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dashed ? [3, 4] : []); c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.setLineDash([]);
}
function dot(c, x, y, color, r = 2.5) { c.fillStyle = color; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
export function drawSignal(canvas, experiment) {
  const p = context(canvas), { c } = p, { word, channel, code } = experiment, n = code.n;
  const maximum = Math.max(2, ...channel.received.map(Math.abs)); const bound = Math.ceil(maximum);
  const ticks = [...new Set([1, Math.round(n / 4), Math.round(n / 2), Math.round(3 * n / 4), n])];
  const { xx, yy } = axes(p, { xmin: 0, xmax: n - 1, ymin: -bound, ymax: bound, xticks: ticks.map(i => [i - 1, String(i)]), yticks: [[-bound, String(-bound)], [-1, '−1'], [0, '0'], [1, '+1'], [bound, '+' + bound]].filter((a,i,arr)=>arr.findIndex(b=>b[0]===a[0])===i), xlabel: 'TRANSMITTED BIT', ylabel: 'AMPLITUDE' });
  const sent = []; word.forEach((bit, i) => { if (i) sent.push([xx(i - .5), yy(1 - 2 * word[i - 1])]); sent.push([xx(i ? i - .5 : 0), yy(1 - 2 * bit)]); sent.push([xx(i === n - 1 ? i : i + .5), yy(1 - 2 * bit)]); });
  path(c, sent, '#8c9164', true, 1.5);
  path(c, channel.received.map((y, i) => [xx(i), yy(y)]), copper, false, 1.2);
  channel.received.forEach((y, i) => dot(c, xx(i), yy(y), (y < 0 ? 1 : 0) !== word[i] ? '#b46e50' : '#bd9174', 1.8));
}
export function drawBeliefs(canvas, experiment, frame) {
  const p = context(canvas), { c } = p, n = experiment.code.n, bound = 24;
  const { xx, yy } = axes(p, { xmin: -.6, xmax: n - .4, ymin: -bound, ymax: bound, xticks: [1, Math.ceil(n / 2), n].map(i => [i - 1, String(i)]), yticks: [[-24, '−24'], [-12, '−12'], [0, '0'], [12, '+12'], [24, '+24']], xlabel: 'VARIABLE NODE', ylabel: 'LOG-LIKELIHOOD RATIO' });
  const width = Math.max(1.3, (p.right - p.left) / n * .65);
  frame.llr.forEach((v, i) => { const value = Math.max(-24, Math.min(24, v)), error = frame.bits[i] !== experiment.word[i], y = yy(value); c.fillStyle = error ? copper : green; c.globalAlpha = .8; c.beginPath(); c.roundRect(xx(i) - width / 2, Math.min(y, yy(0)), width, Math.max(1, Math.abs(y - yy(0))), Math.min(1.5, width / 2)); c.fill(); }); c.globalAlpha = 1;
}
export function drawConvergence(canvas, experiment, iteration) {
  const p = context(canvas), { c } = p, { code, history, word, iterations } = experiment;
  const { xx, yy } = axes(p, { xmin: 0, xmax: Math.max(2, iterations), ymin: 0, ymax: Math.max(code.m, countErrors(word, history[0].bits), 4), xticks: [0, Math.floor(iterations / 2), iterations].map(i => [i, String(i)]), yticks: [0, Math.floor(code.m / 2), code.m].map(i => [i, String(i)]), xlabel: 'DECODING ITERATION', ylabel: 'COUNT' });
  const visible = history.slice(0, iteration + 1);
  path(c, visible.map(s => [xx(s.iteration), yy(countErrors(word, s.bits))]), copper);
  path(c, visible.map(s => [xx(s.iteration), yy(s.syndrome.reduce((a, b) => a + b, 0))]), green);
  for (const s of visible) { dot(c, xx(s.iteration), yy(countErrors(word, s.bits)), copper, 2); dot(c, xx(s.iteration), yy(s.syndrome.reduce((a,b)=>a+b,0)), green, 2); }
  if (visible.length) { c.strokeStyle = '#a4b18b70'; c.setLineDash([2, 3]); c.beginPath(); c.moveTo(xx(iteration), p.top); c.lineTo(xx(iteration), p.bottom); c.stroke(); c.setLineDash([]); }
}
export function drawBER(canvas, experiment, data) {
  const p = context(canvas), { c } = p, { xx, yy } = axes(p, { xmin: -1, xmax: 7, ymin: 1e-4, ymax: 1, log: true, xticks: [-1, 1, 3, 5, 7].map(x => [x, String(x)]), yticks: [[1,'10⁰'], [.1,'10⁻¹'], [.01,'10⁻²'], [.001,'10⁻³'], [.0001,'10⁻⁴']], xlabel: 'Eb/N₀ (dB)', ylabel: 'BIT ERROR RATE · LOG SCALE' });
  const threshold = capacityThreshold(experiment.code.rate);
  c.fillStyle = '#dee5d435'; c.fillRect(p.left, p.top, xx(threshold) - p.left, p.bottom - p.top);
  path(c, [[xx(threshold), p.top],[xx(threshold), p.bottom]], '#bdc6ac', true, 1);
  c.save(); c.font = `${p.fontSize - 1}px 'DM Mono',monospace`; c.fillStyle = '#756b59'; c.textAlign = 'left'; c.fillText('CAPACITY', xx(threshold) + 5, p.top + 14); c.restore();
  if (data.length) {
    const raw = data.map(d => [xx(d.ebn0), yy(Math.max(.0001, d.rawErrors / d.totalBits))]);
    const decoded = data.map(d => [xx(d.ebn0), yy(Math.max(.0001, (d.decodedErrors || 1) / d.totalBits))]);
    path(c, raw, '#bea486', true, 1.2); path(c, decoded, green, false, 1.8);
    data.forEach((d, i) => {
      if (d.decodedErrors) dot(c, ...decoded[i], green, 2.3);
      else { const [x,y] = decoded[i]; c.strokeStyle = green; c.lineWidth = 1; c.beginPath(); c.moveTo(x,y-4); c.lineTo(x,y+3); c.moveTo(x-2,y+1); c.lineTo(x,y+3); c.lineTo(x+2,y+1); c.stroke(); }
    });
  } else { c.fillStyle = '#756b59'; c.textAlign = 'center'; c.fillText('SIMULATING…', (p.left + p.right) / 2, (p.top + p.bottom) / 2); }
  path(c, [[xx(experiment.ebn0), p.top], [xx(experiment.ebn0), p.bottom]], '#c99b7744', true, 1);
}
export function drawCapacity(canvas, experiment) {
  const p = context(canvas), { c } = p, rate = experiment.code.rate;
  const { xx, yy } = axes(p, { xmin: -1, xmax: 7, ymin: 0, ymax: 1, xticks: [-1,1,3,5,7].map(x=>[x,String(x)]), yticks: [[0,'0'],[.25,'.25'],[.5,'.50'],[.75,'.75'],[1,'1.0']], xlabel: 'Eb/N₀ (dB)', ylabel: 'BITS / REAL CHANNEL USE' });
  const points = Array.from({ length: 81 }, (_, i) => { const snr = -1 + i / 10; return [xx(snr), yy(binaryCapacity(snr, rate))]; });
  c.fillStyle = '#dae5cd50'; c.beginPath(); c.moveTo(p.left, p.bottom); points.forEach(([x,y])=>c.lineTo(x,y)); c.lineTo(p.right,p.bottom); c.closePath(); c.fill();
  path(c, points, green, false, 1.8); path(c, [[p.left, yy(rate)], [p.right, yy(rate)]], copper, true, 1);
  const capacity = binaryCapacity(experiment.ebn0, rate); dot(c, xx(experiment.ebn0), yy(capacity), green, 4);
  path(c, [[xx(experiment.ebn0), p.bottom], [xx(experiment.ebn0), yy(capacity)]], '#a9b895', true, 1);
  c.fillStyle = copper; c.textAlign = 'right'; c.fillText('R = ' + rate.toFixed(2), p.right - 4, yy(rate) - 7);
}
