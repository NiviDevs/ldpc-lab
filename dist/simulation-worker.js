import { createCode, measurePoint } from './codec.js';
self.onmessage = ({ data }) => {
  const code = createCode(data.n);
  for (let ebn0 = -1; ebn0 <= 7; ebn0 += 0.5) {
    const point = measurePoint(code, ebn0, data.iterations, data.algorithm, 2371 + Math.round(ebn0 * 100), data.frames);
    self.postMessage({ ...point, id: data.id, done: ebn0 === 7 });
  }
};
