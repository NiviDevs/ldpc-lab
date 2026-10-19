// Small regular LDPC codes for instruction, not a standards implementation.
export function randomSource(seed = 7) {
  let s = seed >>> 0;
  return () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function gaussian(random) {
  return Math.sqrt(-2 * Math.log(Math.max(1e-12, random()))) * Math.cos(2 * Math.PI * random());
}
export function rref(matrix) {
  const rows = matrix.map(r => [...r]), pivots = [];
  let p = 0;
  for (let col = 0; col < rows[0].length && p < rows.length; col++) {
    const found = rows.findIndex((row, i) => i >= p && row[col]);
    if (found < 0) continue;
    [rows[p], rows[found]] = [rows[found], rows[p]];
    for (let j = 0; j < rows.length; j++) if (j !== p && rows[j][col]) for (let k = col; k < rows[j].length; k++) rows[j][k] ^= rows[p][k];
    pivots.push(col); p++;
  }
  return { rows: rows.slice(0, p), pivots };
}
export function createCode(n = 24) {
  if (![24, 48, 96].includes(n)) throw new RangeError('Supported block lengths: 24, 48, 96');
  const m = n / 2, random = randomSource(n * 11);
  let H;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const sockets = Array.from({ length: 3 * n }, (_, i) => Math.floor(i / 6));
    for (let i = sockets.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [sockets[i], sockets[j]] = [sockets[j], sockets[i]]; }
    const candidate = Array.from({ length: m }, () => Array(n).fill(0));
    let valid = true;
    for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const row = sockets[3 * i + j]; if (candidate[row][i]) valid = false; candidate[row][i] = 1; }
    if (valid) { H = candidate; if (rref(H).pivots.length === m) break; }
  }
  // A deterministic Gallager construction is a fallback if socket matching fails.
  if (!H) {
    H = Array.from({ length: m }, () => Array(n).fill(0));
    for (let group = 0; group < 3; group++) {
      const bits = Array.from({ length: n }, (_, i) => i);
      for (let i = n - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [bits[i], bits[j]] = [bits[j], bits[i]]; }
      bits.forEach((bit, i) => { H[group * n / 6 + Math.floor(i / 6)][bit] = 1; });
    }
  }
  const { rows, pivots } = rref(H), free = Array.from({ length: n }, (_, i) => i).filter(i => !pivots.includes(i));
  const checks = H.map(row => row.flatMap((v, i) => v ? [i] : []));
  const variables = Array.from({ length: n }, (_, i) => checks.flatMap((row, j) => row.includes(i) ? [j] : []));
  return { n, m, H, rows, pivots, free, checks, variables, k: free.length, rate: free.length / n };
}
export function encode(code, message) {
  if (message.length !== code.k) throw new RangeError('Message length must equal k');
  const word = Array(code.n).fill(0);
  code.free.forEach((v, i) => { word[v] = message[i] & 1; });
  code.pivots.forEach((v, i) => { word[v] = code.free.reduce((s, bit) => s ^ (code.rows[i][bit] & word[bit]), 0); });
  return word;
}
export const syndrome = (code, bits) => code.checks.map(row => row.reduce((s, i) => s ^ bits[i], 0));
export const countErrors = (a, b) => a.reduce((s, bit, i) => s + (bit !== b[i] ? 1 : 0), 0);
export function transmit(code, word, ebn0, random) {
  const sigma = Math.sqrt(1 / (2 * code.rate * 10 ** (ebn0 / 10)));
  const received = word.map(bit => 1 - 2 * bit + sigma * gaussian(random));
  return { received, sigma, llr: received.map(y => 2 * y / sigma ** 2) };
}
const clip = x => Math.max(-24, Math.min(24, x));
export function decode(code, llr, maxIterations = 12, algorithm = 'sum-product') {
  let q = code.checks.map(row => row.map(i => clip(llr[i])));
  const first = llr.map(x => x < 0 ? 1 : 0);
  const history = [{ iteration: 0, bits: first, llr: [...llr], syndrome: syndrome(code, first) }];
  if (history[0].syndrome.every(x => x === 0)) return history;
  for (let iteration = 1; iteration <= maxIterations; iteration++) {
    const messages = code.checks.map((row, j) => row.map((_, edge) => {
      const others = q[j].filter((_, i) => i !== edge);
      if (algorithm === 'min-sum') return clip(0.8 * others.reduce((s, x) => s * (x < 0 ? -1 : 1), 1) * Math.min(...others.map(Math.abs)));
      const product = others.reduce((s, x) => s * Math.tanh(clip(x) / 2), 1);
      return clip(2 * Math.atanh(Math.max(-0.999999999, Math.min(0.999999999, product))));
    }));
    const posterior = llr.map((x, bit) => clip(x + code.variables[bit].reduce((s, check) => s + messages[check][code.checks[check].indexOf(bit)], 0)));
    const bits = posterior.map(x => x < 0 ? 1 : 0), parity = syndrome(code, bits);
    history.push({ iteration, bits, llr: posterior, syndrome: parity });
    if (parity.every(x => x === 0)) break;
    q = code.checks.map((row, check) => row.map((bit, edge) => clip(posterior[bit] - messages[check][edge])));
  }
  return history;
}
export function makeExperiment({ n = 24, ebn0 = 2, iterations = 12, seed = 7, algorithm = 'sum-product' } = {}) {
  const code = createCode(n), random = randomSource(seed);
  const message = Array.from({ length: code.k }, () => random() < 0.5 ? 0 : 1);
  const word = encode(code, message), channel = transmit(code, word, ebn0, random);
  const history = decode(code, channel.llr, iterations, algorithm);
  return { code, message, word, channel, history, ebn0, iterations, seed, algorithm };
}
export function measurePoint(code, ebn0, iterations, algorithm, seed, frames = 160) {
  const random = randomSource(seed), word = Array(code.n).fill(0);
  let rawErrors = 0, decodedErrors = 0, frameErrors = 0;
  for (let frame = 0; frame < frames; frame++) {
    const { llr } = transmit(code, word, ebn0, random);
    const history = decode(code, llr, iterations, algorithm);
    rawErrors += countErrors(word, history[0].bits);
    const errors = countErrors(word, history.at(-1).bits);
    decodedErrors += errors; if (errors) frameErrors++;
  }
  return { ebn0, rawErrors, decodedErrors, frameErrors, totalBits: frames * code.n, frames };
}
// BPSK-constrained AWGN capacity: I(X;Y), in bits per real channel use.
// Fixed Gaussian quadrature by deterministic midpoint integration.
export function binaryCapacity(ebn0, rate) {
  const gamma = rate * 10 ** (ebn0 / 10), sigma = Math.sqrt(1 / (2 * gamma));
  let expected = 0, weight = 0;
  for (let z = -8; z <= 8; z += 0.04) {
    const p = Math.exp(-z * z / 2), llr = 2 * (1 + sigma * z) / sigma ** 2;
    expected += p * (Math.max(0, -llr) + Math.log1p(Math.exp(-Math.abs(llr)))) / Math.LN2;
    weight += p;
  }
  return Math.max(0, Math.min(1, 1 - expected / weight));
}
export function capacityThreshold(rate) {
  let lo = -8, hi = 12;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (binaryCapacity(mid, rate) < rate) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
