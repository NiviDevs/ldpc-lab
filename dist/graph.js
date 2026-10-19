export class TannerScene {
  constructor(canvas, tooltip, getState) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.tooltip = tooltip; this.getState = getState;
    this.angle = -0.28; this.tilt = 0.22; this.view = '3d'; this.selected = null; this.hovered = null; this.points = []; this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let down = null;
    canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, angle: this.angle, tilt: this.tilt }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (down && this.view === '3d') { this.angle = down.angle + (e.clientX - down.x) * .008; this.tilt = Math.max(-.6, Math.min(.8, down.tilt + (e.clientY - down.y) * .005)); }
      else this.hovered = this.hit(x, y);
    });
    canvas.addEventListener('pointerup', e => { if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) { const rect = canvas.getBoundingClientRect(); this.selected = this.hit(e.clientX - rect.left, e.clientY - rect.top); this.inspect(); } down = null; });
    canvas.addEventListener('pointerleave', () => { this.hovered = null; });
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    this.dragging = () => !!down;
    let last = 0;
    const loop = time => { if (!canvas.isConnected) { this.observer.disconnect(); return; } if (time - last > 30) { last = time; const r = canvas.getBoundingClientRect(); if (r.bottom > 0 && r.top < innerHeight && !document.hidden) this.draw(time); } this.frame = requestAnimationFrame(loop); };
    this.frame = requestAnimationFrame(loop);
  }
  resize() { const rect = this.canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2); this.w = rect.width; this.h = rect.height; this.canvas.width = this.w * dpr; this.canvas.height = this.h * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  hit(x, y) { return this.points.findLast(p => Math.hypot(x - p.x, y - p.y) < Math.max(p.r + 5, 10))?.id ?? null; }
  inspect() {
    const { experiment, iteration } = this.getState(); if (!experiment || !this.selected) { this.tooltip.hidden = true; return; }
    const { code, history, word } = experiment, frame = history[Math.min(iteration, history.length - 1)];
    const [kind, str] = this.selected.split('-'), i = Number(str);
    if (i >= (kind === 'v' ? code.n : code.m)) { this.selected = null; this.tooltip.hidden = true; return; }
    this.tooltip.hidden = false;
    this.tooltip.innerHTML = kind === 'v' ? `<b>Variable x${i + 1}</b><br>Sent ${word[i]} · estimate ${frame.bits[i]}<br>LLR ${frame.llr[i].toFixed(2)}<br>Checks ${code.variables[i].map(x => x + 1).join(', ')}` : `<b>Check c${i + 1} · ${frame.syndrome[i] ? 'unsatisfied' : 'satisfied'}</b><br>${code.checks[i].map(x => 'x' + (x + 1)).join(' ⊕ ')} = ${frame.syndrome[i]}`;
  }
  draw(time) {
    const { ctx: c, w, h } = this; if (!w) return;
    const { experiment, iteration, playing } = this.getState(); if (!experiment) return;
    const { code, history, word } = experiment, frame = history[Math.min(iteration, history.length - 1)];
    c.clearRect(0, 0, w, h); this.points = [];
    if (this.view === 'matrix') { this.matrix(code, frame); return; }
    if (!this.dragging() && !this.reduced) this.angle += .00065;
    const scale = Math.min(w * .32, h * .43), cx = w * .54, cy = h * .51;
    const project = (x, y, z) => {
      const xx = x * Math.cos(this.angle) + z * Math.sin(this.angle), zz = -x * Math.sin(this.angle) + z * Math.cos(this.angle);
      const yy = y * Math.cos(this.tilt) - zz * Math.sin(this.tilt), zzz = y * Math.sin(this.tilt) + zz * Math.cos(this.tilt);
      const perspective = 3.5 / (3.5 + zzz);
      return { x: cx + xx * scale * perspective, y: cy + yy * scale * perspective, depth: zzz, perspective };
    };
    // Two planes in true 3D; depth, perspective, and sphere lighting remain interactive.
    const variable = Array.from({ length: code.n }, (_, i) => {
      const columns = Math.ceil(code.n / 3), col = i % columns, row = Math.floor(i / columns);
      const x = (col / (columns - 1) - .5) * 2.05, z = (row - 1) * .62;
      return { ...project(x, -.48 - .04 * Math.cos(i), z), id: 'v-' + i, kind: 'v', index: i, r: Math.max(3.8, code.n === 24 ? 7.4 : code.n === 48 ? 5.2 : 3.8) };
    });
    const check = Array.from({ length: code.m }, (_, i) => {
      const columns = Math.ceil(code.m / 2), col = i % columns, row = Math.floor(i / columns);
      return { ...project((col / (columns - 1) - .5) * 1.8, .54, (row - .5) * .9), id: 'c-' + i, kind: 'c', index: i, r: code.n === 24 ? 6.8 : 4.8 };
    });
    const selected = this.selected ?? this.hovered;
    let selectedEdges = [];
    code.checks.forEach((neighbors, j) => neighbors.forEach(i => {
      const a = variable[i], b = check[j], highlighted = selected === a.id || selected === b.id;
      if (highlighted) selectedEdges.push([a, b]);
      const failed = frame.syndrome[j], alpha = selected ? (highlighted ? .65 : .055) : (failed ? .19 : .16);
      c.strokeStyle = failed ? `rgba(172,113,78,${alpha})` : `rgba(94,125,73,${alpha})`; c.lineWidth = highlighted ? 1.25 : .65;
      c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      if ((!this.reduced && (i + j * 3) % 7 === 0) || (playing && highlighted)) {
        const t = ((time / (playing ? 1300 : 4200)) + i * .117 + j * .2) % 1, u = iteration % 2 ? t : 1 - t;
        c.beginPath(); c.arc(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, 1.65, 0, Math.PI * 2); c.fillStyle = failed ? '#bb886a' : '#9ab27d'; c.fill();
      }
    }));
    // Faint floor ring grounds the floating graph without a decorative backdrop.
    c.save(); c.strokeStyle = '#c7d0b447'; c.lineWidth = .8; c.beginPath(); c.ellipse(cx, h * .79, scale * .9, scale * .105, -.08, 0, Math.PI * 2); c.stroke(); c.restore();
    this.points = [...variable, ...check].sort((a, b) => b.depth - a.depth);
    this.points.forEach(p => {
      const error = p.kind === 'v' ? frame.bits[p.index] !== word[p.index] : !!frame.syndrome[p.index];
      const active = selected === p.id || selectedEdges.some(edge => edge.includes(p)), faded = selected && !active;
      c.globalAlpha = faded ? .28 : 1;
      const radius = p.r * p.perspective;
      if (active) { c.strokeStyle = error ? '#bc88697a' : '#7f9b6590'; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, radius + 5, 0, Math.PI * 2); c.stroke(); }
      if (p.kind === 'v') {
        const gradient = c.createRadialGradient(p.x - radius * .35, p.y - radius * .45, 0, p.x, p.y, radius);
        gradient.addColorStop(0, error ? '#edc9aa' : '#e1ecd0'); gradient.addColorStop(.5, error ? '#c99574' : '#a6bd87'); gradient.addColorStop(1, error ? '#9f6b4f' : '#6c8853');
        c.beginPath(); c.arc(p.x, p.y, radius, 0, Math.PI * 2); c.fillStyle = gradient; c.shadowColor = '#62744525'; c.shadowBlur = 5; c.shadowOffsetY = 2; c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
        if (code.n <= 48) { c.font = `${Math.max(6, radius * .95)}px 'DM Mono',monospace`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = error ? '#805039' : '#52663d'; c.fillText(frame.bits[p.index], p.x, p.y + .5); }
      } else {
        c.save(); c.translate(p.x, p.y); c.rotate(-.08 + this.angle * .06); c.fillStyle = error ? '#c39372' : '#c2b299'; c.strokeStyle = error ? '#a26d4d' : '#aa997e'; c.lineWidth = .65; c.fillRect(-radius, -radius * .8, radius * 2, radius * 1.6); c.strokeRect(-radius, -radius * .8, radius * 2, radius * 1.6); c.fillStyle = '#efe7d7b0'; c.fillRect(-radius + 1, -radius * .8 + 1, radius * 2 - 2, 2); c.restore();
      }
      if (code.n === 24 && (p.index % (p.kind === 'v' ? 4 : 3) === 0 || active)) { c.font = "italic 10px 'Instrument Serif',Georgia"; c.textAlign = 'center'; c.fillStyle = error ? '#a27b5b' : '#8b9b77'; c.fillText((p.kind === 'v' ? 'x' : 'c') + (p.index + 1), p.x, p.y + radius + 12); }
      c.globalAlpha = 1;
    });
  }
  matrix(code, frame) {
    const c = this.ctx, cell = Math.min((this.w - 70) / code.n, (this.h - 165) / code.m, 18), width = cell * code.n, height = cell * code.m, left = (this.w - width) / 2, top = (this.h - height) / 2 + 6;
    code.H.forEach((row, j) => row.forEach((value, i) => {
      c.fillStyle = value ? (frame.syndrome[j] ? '#bd8c68' : '#7f9b65') : '#e6e9dc'; c.beginPath(); c.roundRect(left + i * cell + 1, top + j * cell + 1, cell - 2, cell - 2, Math.min(2, cell / 4)); c.fill();
      this.points.push({ id: `c-${j}`, x: left + i * cell + cell / 2, y: top + j * cell + cell / 2, r: cell / 2 });
    }));
    c.strokeStyle = '#a4b190'; c.lineWidth = 1;
    for (const x of [left - 8, left + width + 8]) { const dir = x < left ? 1 : -1; c.beginPath(); c.moveTo(x + dir * 5, top); c.lineTo(x, top); c.lineTo(x, top + height); c.lineTo(x + dir * 5, top + height); c.stroke(); }
    c.font = "9px 'DM Mono',monospace"; c.textAlign = 'center'; c.fillStyle = '#8c9b79'; c.fillText(`${code.m} × ${code.n}  ·  ${(300 / code.m).toFixed(1)}% nonzero  ·  rank ${code.n - code.k}`, this.w / 2, top + height + 23);
  }
}
