import assert from 'node:assert';
import { test } from 'node:test';
import { CoreRecorder } from '../../src/browser/recorder-core.js';

test('CoreRecorder: should initialize with default options', () => {
    const recorder = new CoreRecorder();
    assert.strictEqual(recorder.fps, 60);
});

test('CoreRecorder: should initialize with custom options', () => {
    const recorder = new CoreRecorder({ fps: 30, sampleRate: 48000 });
    assert.strictEqual(recorder.fps, 30);
});

test('CoreRecorder: should calculate frameDurationMs correctly for 60 FPS', () => {
    const recorder = new CoreRecorder({ fps: 60 });
    assert.strictEqual(recorder.frameDurationMs, 1000 / 60);
});

test('CoreRecorder: should calculate frameDurationMs correctly for 30 FPS', () => {
    const recorder = new CoreRecorder({ fps: 30 });
    assert.strictEqual(recorder.frameDurationMs, 1000 / 30);
});

test('CoreRecorder: should handle zero FPS gracefully', () => {
    const recorder = new CoreRecorder({ fps: 0 });
    assert.strictEqual(recorder.frameDurationMs, Infinity);
});

test('CoreRecorder: should transition state from IDLE to RECORDING', () => {
    const recorder = new CoreRecorder();
    recorder.status = 'IDLE';
    recorder.start();
    assert.strictEqual(recorder.status, 'RECORDING');
});

test('CoreRecorder: should transition state from RECORDING to STOPPED', () => {
    const recorder = new CoreRecorder();
    recorder.status = 'RECORDING';
    recorder.stop();
    assert.strictEqual(recorder.status, 'STOPPED');
});

test('CoreRecorder: should not allow invalid state transitions', () => {
    const recorder = new CoreRecorder();
    recorder.status = 'IDLE';
    assert.throws(() => recorder.stop(), /Invalid state transition/);
});
