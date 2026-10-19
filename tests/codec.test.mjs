import test from 'node:test';
import assert from 'node:assert/strict';
import { createCode, encode, syndrome, makeExperiment, countErrors, decode, measurePoint, binaryCapacity, capacityThreshold, randomSource, transmit } from '../dist/codec.js';

test('all supported codes have regular (3,6) graphs and encode valid nonzero codewords', () => {
  for (const n of [24, 48, 96]) {
    const code = createCode(n);
    assert.ok(code.variables.every(row => row.length === 3));
    assert.ok(code.checks.every(row => row.length === 6));
    assert.equal(code.rate, code.k / n);
    assert.equal(code.k, n - code.pivots.length);
    for (let i = 0; i < code.k; i++) {
      const message = Array(code.k).fill(0); message[i] = 1;
      const word = encode(code, message);
      assert.deepEqual(syndrome(code, word), Array(code.m).fill(0));
      assert.deepEqual(code.free.map(j => word[j]), message);
    }
  }
});

test('sum-product on a tree combines independent evidence without self-feedback', () => {
  const code = { n: 3, checks: [[0,1],[1,2]], variables: [[0],[0,1],[1]] };
  const history = decode(code, [2,-3,2], 5);
  assert.deepEqual(history.at(-1).bits, [0,0,0]);
  assert.equal(history.at(-1).iteration, 2);
  for (const llr of history.at(-1).llr) assert.ok(Math.abs(llr - 1) < 1e-10);
});

test('default seminar sample corrects four channel errors in six iterations', () => {
  const e = makeExperiment();
  assert.equal(countErrors(e.word, e.history[0].bits), 4);
  assert.equal(e.history.at(-1).iteration, 6);
  assert.equal(countErrors(e.word, e.history.at(-1).bits), 0);
  assert.deepEqual(e.history.at(-1).syndrome, Array(e.code.m).fill(0));
});

test('noise is reproducible, SNR changes only its scale, and both decoders handle clean frames', () => {
  const code = createCode(), word = encode(code, Array(code.k).fill(1));
  const a = transmit(code, word, 1, randomSource(9)), b = transmit(code, word, 4, randomSource(9));
  word.forEach((bit, i) => assert.ok(Math.abs((a.received[i] - (1-2*bit))/a.sigma - (b.received[i] - (1-2*bit))/b.sigma) < 1e-12));
  for (const algorithm of ['sum-product','min-sum']) {
    const e = makeExperiment({ ebn0: 20, algorithm });
    assert.equal(countErrors(e.word, e.history.at(-1).bits), 0);
    assert.equal(e.history.length, 1);
  }
});

test('iteration budgets are respected and all messages remain finite', () => {
  for (const algorithm of ['sum-product','min-sum']) {
    const e = makeExperiment({ ebn0:-1, iterations:1, algorithm });
    assert.ok(e.history.length <= 2);
    assert.ok(e.history.every(h => h.llr.every(Number.isFinite)));
  }
});

test('BPSK capacity is monotonic, at most one, with correct rate-half threshold', () => {
  let previous = 0;
  for (const snr of [-8,-1,0,1,2,4,8,20]) {
    const c = binaryCapacity(snr,.5);
    assert.ok(c >= previous && c <= 1); previous = c;
  }
  assert.ok(Math.abs(capacityThreshold(.5) - .18706) < 1e-4);
  assert.ok(Math.abs(binaryCapacity(capacityThreshold(.5),.5) - .5) < 1e-9);
});

test('Monte Carlo counts are repeatable and include finite-sample denominators', () => {
  const code = createCode(), a = measurePoint(code,2,12,'sum-product',123,40), b = measurePoint(code,2,12,'sum-product',123,40);
  assert.deepEqual(a,b);
  assert.equal(a.totalBits, 960);
  assert.ok(a.rawErrors > a.decodedErrors);
  assert.ok(a.decodedErrors >= 0 && a.frameErrors <= 40);
});
