import assert from 'node:assert';
import { test } from 'node:test';
import { CoreRecorder } from '../../src/browser/recorder-core.js';

test('CoreRecorder state machine transitions correctly and calculates frames deterministic', () => {
  const recorder = new CoreRecorder({ fps: 60, sampleRate: 44100 });
  assert.strictEqual(recorder.status, 'uninitialized');
  
  recorder.initialize();
  assert.strictEqual(recorder.status, 'ready');
  assert.strictEqual(recorder.frameDurationMs, 16.666666666666668);
});
