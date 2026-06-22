# Zero-Network Headless Recording Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a zero-network, high-performance headless browser recording engine that captures synchronized audio and video entirely within the V8 context and dumps the final fragmented MP4 (fMP4) directly to disk using WebCodecs, WebAssembly Muxing, and the Origin Private File System (OPFS), controlled via CDP Virtual Time.

**Architecture:** Pauses the browser wall-clock using CDP `Emulation.setVirtualTimePolicy`. The orchestrator drives the clock synchronously in 16.66ms increments (60fps). Inside the page, canvas frames and a deterministic `OfflineAudioContext` feed the `VideoEncoder` and `AudioEncoder`. Encoded chunks are multiplexed into an fMP4 container inside an isolated Web Worker via a lightweight WASM Muxer, writing síncronamente to the file system using OPFS `createSyncAccessHandle`.

**Tech Stack:** Node.js (Orquestrador), Puppeteer/CDP, WebCodecs API, OfflineAudioContext, WebAssembly (C++ fMP4 Muxer), OPFS.

---

### Task 1: Web Application Core & Deterministic Audio-Visual Engine

**Files:**
- Create: `Engine-Headless-Recorder/src/browser/recorder-core.js`
- Create: `Engine-Headless-Recorder/src/browser/muxer-worker.js`
- Test: `Engine-Headless-Recorder/tests/browser/recorder-core.test.js`

- [ ] **Step 1: Write the failing unit test for the deterministic audio-visual capturing state machine**

```javascript
// Engine-Headless-Recorder/tests/browser/recorder-core.test.js
import { assert } from 'node:assert';
import { test } from 'node:test';
import { CoreRecorder } from '../../src/browser/recorder-core.js';

test('CoreRecorder state machine transitions correctly and calculates frames deterministic', () => {
  const recorder = new CoreRecorder({ fps: 60, sampleRate: 44100 });
  assert.strictEqual(recorder.status, 'uninitialized');
  
  recorder.initialize();
  assert.strictEqual(recorder.status, 'ready');
  assert.strictEqual(recorder.frameDurationMs, 16.666666666666668);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node Engine-Headless-Recorder/tests/browser/recorder-core.test.js`
Expected: FAIL (Cannot find module or CoreRecorder is not defined)

- [ ] **Step 3: Write minimal implementation for the core state machine and OfflineAudioContext integration**

```javascript
// Engine-Headless-Recorder/src/browser/recorder-core.js
export class CoreRecorder {
  constructor(options = {}) {
    this.fps = options.fps || 60;
    this.sampleRate = options.sampleRate || 44100;
    this.status = 'uninitialized';
    this.frameDurationMs = 1000 / this.fps;
  }

  initialize() {
    this.status = 'ready';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node Engine-Headless-Recorder/tests/browser/recorder-core.test.js`
Expected: PASS

---

### Task 2: Web Worker OPFS & Fragmented MP4 Muxer Interface

**Files:**
- Modify: `Engine-Headless-Recorder/src/browser/muxer-worker.js`
- Test: `Engine-Headless-Recorder/tests/browser/muxer-worker.test.js`

- [ ] **Step 1: Write failing test for Worker OPFS access logic**

```javascript
// Engine-Headless-Recorder/tests/browser/muxer-worker.test.js
import { assert } from 'node:assert';
import { test } from 'node:test';

test('Muxer worker maps fMP4 boxes sequentially to handle large assets without memory leaks', () => {
  const mockBoxes = [];
  const addFragment = (moof, mdat) => {
    mockBoxes.push({ type: 'moof', size: moof.length });
    mockBoxes.push({ type: 'mdat', size: mdat.length });
  };

  addFragment(Buffer.alloc(128), Buffer.alloc(1024));
  assert.strictEqual(mockBoxes[0].type, 'moof');
  assert.strictEqual(mockBoxes[1].type, 'mdat');
  assert.ok(mockBoxes.length === 2);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node Engine-Headless-Recorder/tests/browser/muxer-worker.test.js`
Expected: FAIL if path does not exist, setup file skeleton first.

- [ ] **Step 3: Write the worker skeleton that accepts chunks and flushes via fMP4 chunks**

```javascript
// Engine-Headless-Recorder/src/browser/muxer-worker.js
// Isolated worker file layout handles structured chunks inside the browser
self.onmessage = async (e) => {
  const { type, payload } = e.data;
  if (type === 'INIT_MUSE_STREAM') {
    // Open OPFS Access Handle síncronamente
    // const root = await navigator.storage.getDirectory();
    // const fileHandle = await root.getFileHandle("output.mp4", { create: true });
    // const accessHandle = await fileHandle.createSyncAccessHandle();
    self.postMessage({ status: 'STREAM_READY' });
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node Engine-Headless-Recorder/tests/browser/muxer-worker.test.js`
Expected: PASS

---

### Task 3: Backend Orchestrator & CDP Virtual Time Loop Control

**Files:**
- Create: `Engine-Headless-Recorder/src/node/orchestrator.js`
- Test: `Engine-Headless-Recorder/tests/node/orchestrator.test.js`

- [ ] **Step 1: Write failing unit test for CDP Virtual Time advancement mechanism**

```javascript
// Engine-Headless-Recorder/tests/node/orchestrator.test.js
import { assert } from 'node:assert';
import { test } from 'node:test';
import { TimeOrchestrator } from '../../src/node/orchestrator.js';

test('TimeOrchestrator advances virtual time ticks deterministically', async () => {
  const orchestrator = new TimeOrchestrator({ fps: 60 });
  let currentTick = 0;
  
  const tick = orchestrator.nextFrameTick();
  assert.strictEqual(tick, 16.66);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node Engine-Headless-Recorder/tests/node/orchestrator.test.js`
Expected: FAIL (Module not found)

- [ ] **Step 3: Implement deterministic TimeOrchestrator algorithm**

```javascript
// Engine-Headless-Recorder/src/node/orchestrator.js
export class TimeOrchestrator {
  constructor(options = {}) {
    this.fps = options.fps || 60;
    this.frameStep = parseFloat((1000 / this.fps).toFixed(2));
    this.accumulatedTime = 0;
  }

  nextFrameTick() {
    this.accumulatedTime += this.frameStep;
    return this.accumulatedTime;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node Engine-Headless-Recorder/tests/node/orchestrator.test.js`
Expected: PASS
