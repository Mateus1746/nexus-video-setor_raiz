# 🌉 GUIA DE INTEGRAÇÃO: FÁBRICA DE CONTEÚDO WEB & RECORDER SOTA 2026

Para que uma fábrica de conteúdo escrita em linguagem Web (HTML5, Canvas, WebGL, Web Audio API) seja gravada com **Zero-Network Overhead** e **60fps determinísticos cravados**, ela precisa seguir duas regras de ouro: **Desacoplamento de Relógio** e **Exposição de Primitivos**.

---

### 1. CONTRATO DE INTERFACE GLOBAL
A sua fábrica de conteúdo não precisa carregar nenhuma biblioteca do gravador. Ela simplesmente precisa expor o elemento `<canvas>` (ou contexto OffscreenCanvas) e a função de renderização do frame no escopo do `window`.

No arquivo de inicialização da sua fábrica de conteúdo, registre os pontos de ancoragem:

```javascript
// Dentro do core da sua Fábrica de Conteúdo Web
const myCanvas = document.getElementById("canvas-focado");

// 1. Exponha a referência do canvas para a GPU do recorder acessar diretamente
window.__FACTORY_CANVAS__ = myCanvas;

// 2. Armazene a função que renderiza o frame atual da sua simulação/animação
window.__FACTORY_RENDER_FRAME__ = function(virtualTimeMs) {
  // Atualize sua lógica de física, Shaders, posições de SVG baseando-se estritamente em virtualTimeMs
  atualizarFisicaProcedural(virtualTimeMs);
  desenharNoCanvas(myCanvas);
};
```

---

### 2. O PULO DO GATO: ÁUDIO DETERMINÍSTICO (`OfflineAudioContext`)
Como o relógio do navegador headless será controlado artificialmente pelo orquestrador CDP, usar um `AudioContext` comum vai quebrar a sincronia. Sua fábrica deve gerar o áudio em memória usando o **`OfflineAudioContext`**, processando o áudio em lotes que casam exatamente com o frame rate.

#### Exemplo de Setup na Fábrica de Conteúdo:
```javascript
const FPS = 60;
const SAMPLE_RATE = 44100;
const FRAME_DURATION_S = 1 / FPS; // 0.016666s

// Crie o contexto offline simulando a duração total esperada do vídeo (ex: 10 segundos)
const durationSeconds = 10;
const offlineAudioCtx = new OfflineAudioContext(2, SAMPLE_RATE * durationSeconds, SAMPLE_RATE);

// Monte seus nós de sintetizador, osciladores ou trilhas de áudio normais nele
const oscillator = offlineAudioCtx.createOscillator();
oscillator.connect(offlineAudioCtx.destination);
oscillator.start(0);

// Exponha o contexto offline para o recorder
window.__FACTORY_OFFLINE_AUDIO__ = offlineAudioCtx;
```

---

### 3. O LOOP DE GRAVAÇÃO (O QUE ACONTECE EM SEGUNDO PLANO)
Quando o gravador inicializar o `chrome-headless-shell`, o script de automação executará o seguinte fluxo invisível via CDP:

1. O gravador injeta a ponte e lê `window.__FACTORY_CANVAS__`.
2. O gravador inicia o loop determinístico. A cada passo de `16.67ms`:
   * Ele chama `window.__FACTORY_RENDER_FRAME__(currentTime)`.
   * Ele força o `OfflineAudioContext` a renderizar o bloco equivalente de amostras de áudio:
     ```javascript
     // O recorder extrai o áudio síncronamente via renderização de bloco
     offlineAudioCtx.suspend(currentTime + FRAME_DURATION_S).then(() => {
       // Coleta os buffers de áudio brutos gerados naquele exato frame e envia ao WebCodecs AudioEncoder
     });
     ```
   * O frame visual do canvas é enviado para o `VideoEncoder`.
   * O Muxer WASM escreve os blocos combinados (`moof` + `mdat`) síncronamente no **OPFS** (`FileSystemSyncAccessHandle`).

---

### 4. VANTAGEM INDUSTRIAL
Seguindo este contrato simples, qualquer equipe de front-end pode construir fábricas de conteúdo ricas em HTML/CSS/Canvas sem precisar entender nada de ffmpeg, codecs ou infraestrutura de vídeo. O front-end entrega apenas arte e matemática determinística; o motor `Engine-Headless-Recorder` cuida da engenharia de baixo nível.
