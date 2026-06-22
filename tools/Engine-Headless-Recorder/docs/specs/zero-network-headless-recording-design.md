# DESIGN SPECIFICATION: ZERO-NETWORK HEADLESS RECORDING ENGINE
## Córtex Operacional SOTA - Junho de 2026
## Autor: Core Architect (Mentalidade Pragmática Fabio Akita)

---

### 1. DECLARAÇÃO DO PROBLEMA E OBJETIVO
Fábricas de conteúdo web modernas que geram áudio (Web Audio API) e vídeo de alta fidelidade (WebGL, Canvas, DOM complexo) sofrem com gargalos de renderização e codificação quando utilizam pipelines baseados em captura externa de frames (I/O de imagens em disco) ou transporte massivo de bytes por redes locais (WebSockets/IPC para processos Node.js e FFmpeg clonados). O Node.js, sendo single-threaded e dependente de Garbage Collection agressivo, atua como um gargalo severo ("carteiro de bytes"), causando cópias redundantes de memória e picos de latência.

**Objetivo:** Implementar um motor de gravação de vídeo e áudio em modo headless determinístico (`chrome-headless-shell`) com **Zero-Network Overhead**. Toda a captura, codificação de mídia e empacotamento em container (`muxing`) ocorre estritamente dentro da memória e do sandbox do navegador via **WebCodecs + Muxer WASM**, descarregando o arquivo final de forma assíncrona/bloqueante diretamente no armazenamento de alta performance do sistema operacional via **OPFS (Origin Private File System)**.

---

### 2. ARQUITETURA DE BAIXO NÍVEL (THE "CHEFÃO FINAL" STACK)

```
+-----------------------------------------------------------------------------------------+
| 🌐 CHROMIUM ENGINE (chrome-headless-shell)                                              |
|                                                                                         |
|  [Fábrica Web App] ---> (Audio Nodes & Canvas Track)                                    |
|                                     |                                                   |
|                                     v                                                   |
|                             [WebCodecs API]                                             |
|                     (VideoEncoder & AudioEncoder)                                       |
|                                     |                                                   |
|                             (Encoded Chunks)                                            |
|                                     v                                                   |
|                         [Web Worker (Isolated)]                                         |
|                 +-------------------------------------+                                 |
|                 |  Muxer Core (C++ compiled to WASM)  |                                 |
|                 |  Generates Fragmented MP4 (fMP4)    |                                 |
|                 +-------------------------------------+                                 |
|                                     |                                                   |
|                          (fMP4 Synchronous Write)                                       |
|                                     v                                                   |
|               [OPFS (Origin Private File System)]                                       |
|               (createSyncAccessHandle - High Speed)                                     |
+-----------------------------------------------------------------------------------------+
                                      |
                       (CDP Browser.setDownloadBehavior)
                                      v
+-----------------------------------------------------------------------------------------+
| 📁 DISCO LOCAL / HOST FILE SYSTEM                                                       |
|                                                                                         |
|        [Pasta Final de Destino] <--- output_fragmented.mp4                              |
+-----------------------------------------------------------------------------------------+
```

#### 2.1. Pipeline de Fluxo de Dados Core:
1. **Orquestrador de Tempo Virtual (CDP):** O script backend inicializa o navegador usando o binário dedicado `chrome-headless-shell` com as flags de tempo virtual ativas (`Emulation.setVirtualTimePolicy`). O relógio do computador é congelado. O tempo avança de forma síncrona a cada intervalo determinado (ex: `16.66ms` para 60fps).
2. **Captação Limpa:** Os nós brutos da Web Audio API (`AudioNode`) e o contexto gráfico (`OffscreenCanvas` ou `HTMLCanvasElement`) alimentam diretamente `VideoEncoder` e `AudioEncoder`.
3. **Internal Muxing (WASM):** À medida que o Chrome codifica os blocos por hardware (via Vulkan/SwiftShader), os `EncodedVideoChunk` e `EncodedAudioChunk` são despachados via `postMessage` para um **Web Worker** dedicado. Este worker roda um Muxer C++ compilado para WebAssembly (ex: baseado em `libavformat` ou biblioteca customizada fMP4).
4. **Escrita Bare-Metal via OPFS:** O Muxer WASM processa os blocos comprimidos e os escreve imediatamente no **Origin Private File System (OPFS)** utilizando um `FileSystemSyncAccessHandle`. Essa API opera em modo bloqueante e sínscrono, fornecendo velocidades de escrita equivalentes ao acesso direto ao sistema de arquivos do SO, ignorando as restrições normais de segurança do DOM.

---

### 3. MITIGAÇÃO DE ARMAVILHAS TÉCNICAS REAIS (PRAGMATIC RUNTIME)

#### 3.1. Restrição de Memória do WASM32 (O Limite de 4GB)
*   **Problema:** O WebAssembly de 32 bits possui um limite rígido de endereçamento de 4GB de RAM contígua. Muxers ingênuos acumulam a tabela de índices de frames (`moov atom`) na memória volátil antes de consolidar o container MP4 clássico. Para vídeos de longa duração, isso resulta em estouro de memória (`Out Of Memory`) e morte silenciosa do Web Worker.
*   **Solução:** O Muxer WASM deve obrigatoriamente operar no modo **Fragmented MP4 (fMP4)**. O vídeo é estruturado em sequências repetidas de fragmentos curtos independentes (`moof` + `mdat`), limpando os buffers de memória do WebAssembly continuamente. O `moov atom` inicial contém apenas metadados básicos de codec, e a tabela de índices de frames é distribuída ao longo do arquivo no disco.

#### 3.2. Infraestrutura e Falha de Hardware (Software Fallback)
*   **Problema:** Em servidores virtuais (VPS standard na nuvem sem GPU), o Chrome falha ao tentar alocar recursos de hardware da GPU para a WebCodecs API. Ele reverte silenciosamente para codificação via software utilizando o driver emulado `SwiftShader` (rodando em cima de bibliotecas como `libvpx` ou `OpenH264` na CPU). Isso gera picos severos de processamento no host Linux.
*   **Solução:**
    1.  O orquestrador deve configurar instâncias com suporte a aceleração gráfica por hardware (ex: instâncias equipadas com GPU acelerada via drivers Vulkan/NVIDIA).
    2.  As flags do Chromium devem expor explicitamente o pipeline gráfico correto: `--enable-features=Vulkan`, `--ignore-gpu-blocklist`, e `--disable-software-rasterizer`.

#### 3.3. Depuração no Escuro (Telemetry & Observabilidade)
*   **Problema:** Arquivos com tela verde, corrupção de cabeçalhos fMP4 ou drifts de áudio em microssegundos dentro de um Web Worker invisível e headless são impossíveis de diagnosticar com um simples `console.log`.
*   **Solução:** O Web Worker do Muxer deve exportar métricas estruturadas de telemetria via `postMessage` de volta ao contexto principal do script CDP em formato JSONL, incluindo:
    *   `timestamp_delta`: Diferença exata entre o relógio visual do frame do canvas e o carimbo de data/hora de áudio.
    *   `frame_type`: Sinalização explícita de Keyframes (I-Frames), P-Frames e B-Frames.
    *   `wasm_heap_usage`: Monitoramento ativo do consumo da memória heap do WebAssembly para detecção precoce de memory leaks.

---

### 4. CRITÉRIOS DE SUCESSO E VALIDAÇÃO
1.  **Zero Network Packets:** Monitoramento de loopback local deve comprovar que nenhum tráfego de WebSocket ou IPC contendo payloads de imagem/vídeo trafegou pelo backend orquestrador durante a execução.
2.  **Perfeição de FPS:** O arquivo `.mp4` (fMP4) resultante deve apresentar 60fps cravados em análise via `ffprobe`, mesmo sob simulação artificial de estresse de CPU na máquina host.
3.  **Sincronização de Áudio (Zero Drift):** O desvio entre o clock do sintetizador Web Audio API e os quadros de vídeo não deve exceder `10ms` ao longo de 1 hora contínua de gravação.

---

### 5. REGISTRO DE DECISÕES CRÍTICAS (TRACE LOG)

*   **[DECISION] ->** Adotar Muxing In-Browser via WASM com armazenamento OPFS.
*   **[RATIONALE] ->** Elimina o overhead de I/O de rede local e a sobrecarga de gerenciamento de buffers grandes na RAM do Node.js, otimizando o uso do hardware.
*   **[CONSEQUENCE] ->** Aumenta radicalmente a densidade de renderizações paralelas na mesma VPS, mas exige a compilação e manutenção de um core Muxer fMP4 em C++ via Emscripten.
