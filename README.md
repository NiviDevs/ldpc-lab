# LDPC · The Signal Lab

A warm, Gruvbox-inspired digital communication seminar and interactive laboratory, with large text and charts for projection. The browser app uses local fonts, Canvas graphics, and native Web Workers. It makes no external runtime requests.

## Run

```sh
npm run dev
```

Open http://localhost:4173. Node 20 or later is recommended. The static app needs an HTTP server because its simulation uses JavaScript modules and a Web Worker; do not double-click `index.html`.

## Deploy on Vercel

The complete source is local in this directory. Vercel hosts a separate online copy.

Import this directory's Git repository into Vercel, or run `npx vercel` from this directory and sign in. The included `vercel.json` selects **Other** as the framework, serves `dist`, and skips installation and building. No environment variables or backend are needed. If importing a parent repository, set the Vercel Root Directory to `DCS_Presentation/ldpc-lab`.

## Present

Use **Present** for the 16-slide browser presentation. Left/right arrows navigate, Escape closes it, and the fullscreen button expands it. The live-demo slide returns to the lab. Use **Download seminar deck** for an editable PowerPoint with speaker notes. The deck is at `dist/assets/LDPC-Seminar.pptx`.

Suggested sequence: introduce parity and Hamming (7,4), explain the sparse matrix and Tanner graph, show soft information and message passing, run the default sample, compare measured BER with capacity, then discuss applications. Allow approximately 18–22 minutes, including 2–3 minutes in the lab.

## Explore

- Drag the graph to orbit its 3D layout. Click a node to highlight its neighbors. Switch to the actual parity-check matrix or expand the scene.
- Adjust Eb/N₀, block length, maximum iterations, or decoder. Generate a new noise sample, or keep the seed fixed to compare SNR settings.
- Play, pause, step, or scrub decoding. The default sample has four raw errors and recovers the original codeword after six iterations.
- Switch between channel evidence, measured BER and convergence, and BPSK-constrained capacity. Export the current frame and every decoding iteration as CSV.

## Scientific model

`codec.js` constructs deterministic regular (3,6) parity-check matrices with 24, 48, or 96 variables. Gaussian elimination over GF(2) gives the actual dimension, free coordinates, and a valid systematic codeword. This is a teaching construction, not a 5G, Wi-Fi, or DVB-S2 code.

BPSK maps 0 to +1 and 1 to −1. The channel is real AWGN with `sigma² = 1 / (2 R 10^(EbN0_dB/10))`; Eb/N₀ refers to information-bit energy. Channel LLRs equal `2y/sigma²`. The decoder uses a flooding schedule, sum-product or normalized min-sum with factor 0.8, and internal message clipping at ±24. It stops at a zero syndrome or the iteration limit. A zero syndrome does not prove correct recovery; the UI compares the estimate with the known transmitted word to show actual errors.

The BER worker tests 160 independent all-zero frames at each of 17 Eb/N₀ points from −1 to 7 dB. All-zero transmission is valid for the BER of a linear code on this symmetric channel and decoder. Both plotted curves count **coded-bit** errors; the raw curve is the received hard decision on the same coded channel, not an uncoded equal-throughput benchmark. Data points are noisy, especially for small blocks. Down arrows place zero observed errors at 1/N as a plotting indicator, not an estimate or statistical confidence bound. BER runs change with block length, decoder, and iteration budget; changing sample seed or the current SNR only changes the single-frame example and SNR cursor.

The capacity view evaluates binary-input BPSK mutual information by numerical Gaussian integration. The displayed threshold solves `C_BPSK(Eb/N₀,R) = R`, with information-bit energy normalization. At rate 1/2 this is approximately 0.187 dB. It is an asymptotic channel limit, not this finite code's performance. The −1.59 dB wideband Gaussian limit is a different operating limit.

## Regenerate the deck

```sh
npm install
npm run deck
```

The generator reuses `dist/slides.js`, the browser presentation content, and included chart captures. PowerPoint text, shapes, and speaker notes remain editable; captured simulation plots are images. The runtime app has no npm dependency. `pptxgenjs` is used only to create the deck. An override supplies its patched `image-size` dependency.

## Verification

`npm test` runs seven checks covering valid encoding, regular graph degrees, a tree decoder with independently calculable LLRs, the reproducible four-error recovery example, noise scaling, both decoder modes, iteration bounds, capacity, and Monte Carlo counts. Desktop and mobile browser verification also covers plot updates, playback, controls, matrix view, CSV export, and presentation navigation.

## References and fonts

- R. G. Gallager, *Low-Density Parity-Check Codes*, 1962. DOI: https://doi.org/10.1109/TIT.1962.1057683
- C. E. Shannon, *A Mathematical Theory of Communication*, 1948. DOI: https://doi.org/10.1002/j.1538-7305.1948.tb01338.x
- 3GPP TS 38.212: https://www.3gpp.org/dynareport/38212.htm
- ETSI EN 302 307-1: https://www.etsi.org/deliver/etsi_en/302300_302399/30230701/01.04.01_60/en_30230701v010401p.pdf
- DM Sans, DM Mono, and Instrument Serif are distributed under the SIL Open Font License; see `dist/assets/OFL.txt`.
