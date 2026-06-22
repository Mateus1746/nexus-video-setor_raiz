import assert from 'node:assert';
import { test } from 'node:test';
import { TimeOrchestrator } from '../../src/node/orchestrator.js';

test('TimeOrchestrator advances virtual time ticks deterministically', () => {
  const orchestrator = new TimeOrchestrator({ fps: 60 });
  
  const tick = orchestrator.nextFrameTick();
  assert.strictEqual(tick, 16.67);
});
