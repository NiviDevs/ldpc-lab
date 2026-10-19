# Project map

- `dist/index.html` and `dist/style.css`: responsive cream interface and presentation shell.
- `dist/app.js`: shared experiment state, animated playback, controls, CSV export, presentation routing.
- `dist/codec.js`: seeded random source, regular graph construction, GF(2) encoding, AWGN, LLR decoding, Monte Carlo, BPSK capacity.
- `dist/graph.js`: orbitable perspective-projected 3D Tanner graph, matrix, and node inspection.
- `dist/charts.js`: live signal, beliefs, convergence, BER, and capacity plots.
- `dist/simulation-worker.js`: background BER sweep.
- `dist/slides.js`: 16-slide seminar content and speaker notes shared with the PowerPoint generator.
- `scripts/make-deck.mjs`: PowerPoint output.
- `scripts/serve.mjs`: dependency-free local static server.
- `tests/codec.test.mjs`: seven focused scientific-model checks.
- `.openai/hosting.json`: private Site identity and static output directory.
