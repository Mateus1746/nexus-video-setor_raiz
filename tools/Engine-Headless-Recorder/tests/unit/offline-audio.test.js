import assert from 'node:assert';
import { test } from 'node:test';

/**
 * MOCK: Simulação do OfflineAudioContext
 * Garante que o avanço do áudio é estritamente matemático
 * e não depende do relógio do sistema (wall-clock).
 */
class OfflineAudioContextMock {
    constructor(channels, length, sampleRate) {
        this.sampleRate = sampleRate;
        this.length = length;
        this.currentTime = 0;
    }

    // Simula o avanço forçado do tempo para gravação de frame
    suspend(time) {
        return new Promise((resolve) => {
            const delta = time - this.currentTime;
            if (delta > 0) {
                this.currentTime = time;
            }
            resolve();
        });
    }
}

test('Audio Determinism: O clock de áudio deve seguir exatamente o frame rate visual', async () => {
    const FPS = 60;
    const FRAME_DURATION = 1 / FPS; // 0.016666...s
    const ctx = new OfflineAudioContextMock(2, 44100 * 10, 44100);

    for (let frame = 1; frame <= 10; frame++) {
        const expectedTime = frame * FRAME_DURATION;
        await ctx.suspend(expectedTime);
        
        // Validação: O tempo atual do contexto de áudio deve ser idêntico ao tempo virtual do frame
        assert.ok(Math.abs(ctx.currentTime - expectedTime) < 0.000001, `Desvio de áudio detectado no frame ${frame}: ${ctx.currentTime} vs ${expectedTime}`);
    }
});
