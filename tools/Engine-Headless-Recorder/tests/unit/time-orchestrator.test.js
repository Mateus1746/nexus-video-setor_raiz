import assert from 'node:assert';
import { test } from 'node:test';
import { TimeOrchestrator } from '../../src/node/orchestrator.js';

test('TimeOrchestrator: should advance virtual time by one frame', () => {
    const orchestrator = new TimeOrchestrator({ fps: 60 });
    assert.strictEqual(orchestrator.nextFrameTick(), 16.67);
});

test('TimeOrchestrator: should advance virtual time over multiple frames', () => {
    const orchestrator = new TimeOrchestrator({ fps: 60 });
    orchestrator.nextFrameTick();
    assert.strictEqual(orchestrator.nextFrameTick(), 33.34);
});

test('TimeOrchestrator: should maintain precision at 30 FPS', () => {
    const orchestrator = new TimeOrchestrator({ fps: 30 });
    assert.strictEqual(orchestrator.nextFrameTick(), 33.33);
});

test('TimeOrchestrator: should maintain precision at 60 FPS', () => {
    const orchestrator = new TimeOrchestrator({ fps: 60 });
    // 61 ticks (1 initial + 60 frame advancements)
    // 16.67 * 61 = 1016.87
    for(let i = 0; i < 60; i++) orchestrator.nextFrameTick();
    assert.strictEqual(orchestrator.nextFrameTick(), 1016.87);
});

test('TimeOrchestrator: should handle initial current time correctly', () => {
    const orchestrator = new TimeOrchestrator({ fps: 60 });
    assert.strictEqual(orchestrator.accumulatedTime, 0);
});

test('TimeOrchestrator: should reset time correctly', () => {
    const orchestrator = new TimeOrchestrator({ fps: 60 });
    orchestrator.nextFrameTick();
    orchestrator.accumulatedTime = 0;
    assert.strictEqual(orchestrator.nextFrameTick(), 16.67);
});

test('TimeOrchestrator: should calculate frame numbers correctly', () => {
    const orchestrator = new TimeOrchestrator({ fps: 60 });
    // 16.67ms is frame 1
    orchestrator.nextFrameTick();
    const frameNumber = Math.round(orchestrator.accumulatedTime / 16.67);
    assert.strictEqual(frameNumber, 1);
});
