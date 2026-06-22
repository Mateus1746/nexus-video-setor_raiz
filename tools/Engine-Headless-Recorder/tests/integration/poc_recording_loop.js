import { TimeOrchestrator } from '../../src/node/orchestrator.js';
import { CoreRecorder } from '../../src/browser/recorder-core.js';

async function runSimulation() {
  const orchestrator = new TimeOrchestrator({ fps: 60 });
  const recorder = new CoreRecorder({ fps: 60 });
  
  console.log("--- INICIANDO SIMULAÇÃO DE GRAVAÇÃO DETERMINÍSTICA ---");
  recorder.initialize();
  
  const totalFrames = 60; // 1 segundo de vídeo
  
  for (let frame = 1; frame <= totalFrames; frame++) {
    const virtualTick = orchestrator.nextFrameTick();
    
    // Simulação do comportamento: 
    // O backend orquestrador dita o tempo -> o browser grava o frame
    console.log(`[Frame ${frame.toString().padStart(2, '0')}] Virtual Time: ${virtualTick}ms | Status: ${recorder.status}`);
  }
  
  console.log("--- SIMULAÇÃO CONCLUÍDA COM SUCESSO ---");
}

runSimulation().catch(console.error);
