# Guia de Execução Autônoma

This guide outlines essential integrations and practices for the headless recording system.

## Key APIs & Configurations

1. **Canvas Selector**: By default, the recorder looks for `#nox-canvas` or falls back to any generic `<canvas>`. Ensure your target canvas uses a compatible selector and handles resolution properly.
2. **WebGL `preserveDrawingBuffer`**: If using WebGL for the canvas context, you must instantiate it with `{ preserveDrawingBuffer: true }`. Otherwise, the headless browser may pull empty frames.
3. **`window.renderFrame(timeMs)`**: The content factory should expose `window.renderFrame` in the global scope to handle deterministic frame updates. It receives the target time in milliseconds.
4. **`initializeScene()`**: Your application should export or globally expose a scene initialization method (`initializeScene`) to set up assets, context, and shaders prior to recording.
5. **`window.__appReady`**: The application must set `window.__appReady = true` immediately after initialization (e.g., inside or after `initializeScene()`). This signals to the orchestrator that recording can begin.
6. **Timestamps in recorder-core.js**: We use `Math.round(timestampMs * 1000)` to eliminate floating-point inconsistencies when computing `timestampUs` for `VideoFrame`.
7. **NPM Run Build**: Running `npm run build` is required for compilation. The output must be statically accessible to the local server or integrated environment (usually outputting HTML/JS bundles for the target scene).
8. **Recorder Command**: The CLI records videos by taking standard arguments: `node tools/Engine-Headless-Recorder/src/node/record_video.js --duration=<seconds> --fps=<fps> --canvas=<selector> --output=pipeline/sync_drive/exports/output.mp4`. The entry page is auto-detected (`dist/index.html` for Vite, `index.html` for static).
9. **Assets & `fetch()` calls**: All assets loaded via `fetch()` or other network requests must be locally available during headless recording. Any missing assets should be copied to the `public/` (or target build) directory so that the headless browser can resolve them locally.
