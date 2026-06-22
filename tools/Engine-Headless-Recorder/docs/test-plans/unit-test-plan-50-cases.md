# Plano de Testes Unitários - Engine-Headless-Recorder (50 Casos)

Este documento detalha o plano de 50 testes unitários para o projeto `Engine-Headless-Recorder`, cobrindo suas áreas críticas para garantir robustez e determinismo, especialmente em cenários headless e com integração WASM.

## Estrutura dos Arquivos de Teste
Os testes serão organizados em arquivos `.test.js` dentro do diretório `tests/unit/` na raiz do projeto `Engine-Headless-Recorder`, espelhando a estrutura dos módulos testados.

---

### 1. Módulo `CoreRecorder` (`src/browser/recorder-core.js`) - 8 Testes
**Arquivo de Teste:** `tests/unit/recorder-core.test.js`

1.  **`should initialize with default options`**:
    *   **Objetivo:** Verificar se o construtor do `CoreRecorder` define as opções padrão (FPS, sampleRate, etc.) corretamente quando nenhuma opção é fornecida.
2.  **`should initialize with custom options`**:
    *   **Objetivo:** Assegurar que o `CoreRecorder` inicializa corretamente com valores válidos e personalizados para FPS e sampleRate.
3.  **`should calculate frameDurationMs correctly for standard FPS`**:
    *   **Objetivo:** Testar o cálculo de `frameDurationMs` para taxas de quadros comuns como 30 FPS e 60 FPS.
4.  **`should calculate frameDurationMs correctly for non-standard FPS`**:
    *   **Objetivo:** Verificar o cálculo de `frameDurationMs` para taxas de quadros não-padrão como 24 FPS, 25 FPS e 50 FPS.
5.  **`should handle zero or negative FPS gracefully`**:
    *   **Objetivo:** Validar que o `CoreRecorder` lida com valores inválidos (zero ou negativos) para FPS, seja lançando um erro ou aplicando um valor padrão sensato.
6.  **`should transition state from IDLE to RECORDING`**:
    *   **Objetivo:** Confirmar que o estado interno do recorder muda corretamente de `IDLE` para `RECORDING` quando o método `start()` é invocado.
7.  **`should transition state from RECORDING to STOPPED`**:
    *   **Objetivo:** Verificar que o estado interno do recorder muda corretamente de `RECORDING` para `STOPPED` quando o método `stop()` é invocado.
8.  **`should not allow invalid state transitions`**:
    *   **Objetivo:** Garantir que transições de estado ilícitas (ex: chamar `start()` enquanto já está gravando, ou `stop()` enquanto está idle) são impedidas ou tratadas com erro.

---

### 2. Módulo `TimeOrchestrator` (`src/node/orchestrator.js`) - 7 Testes
**Arquivo de Teste:** `tests/unit/time-orchestrator.test.js`

1.  **`should advance virtual time deterministically by one frame`**:
    *   **Objetivo:** Assegurar que o método `nextFrameTick` avança o `currentTime` exatamente pelo `frameDurationMs` configurado.
2.  **`should advance virtual time deterministically over multiple frames`**:
    *   **Objetivo:** Validar que `nextFrameTick` acumula o tempo corretamente ao longo de múltiplas invocações, sem desvios inesperados.
3.  **`should maintain precision with float rounding at 30 FPS`**:
    *   **Objetivo:** Verificar que o `currentTime` não sofre *drift* devido a erros de arredondamento de ponto flutuante após várias chamadas de `nextFrameTick` para 30 FPS.
4.  **`should maintain precision with float rounding at 60 FPS`**:
    *   **Objetivo:** Idem ao anterior, mas para 60 FPS, garantindo que a precisão seja mantida mesmo com valores de `frameDurationMs` menores.
5.  **`should handle initial current time correctly`**:
    *   **Objetivo:** Confirmar que o `currentTime` é inicializado em 0 ou no valor esperado após a criação do `TimeOrchestrator`.
6.  **`should reset time correctly`**:
    *   **Objetivo:** Testar o comportamento de reset do orquestrador, garantindo que o tempo virtual pode ser reiniciado.
7.  **`should calculate frame numbers correctly based on time`**:
    *   **Objetivo:** Verificar se a função que calcula o número do frame (`getFrameNumber` ou similar) retorna o índice correto do frame para um dado `currentTime`.

---

### 3. Integração JavaScript-WASM (Mocks do `fmp4_muxer_core.js` via `WASMHeapMock`) - 10 Testes
**Arquivo de Teste:** `tests/unit/wasm-memory.test.js`

1.  **`WASMHeapMock: should allocate memory via malloc`**:
    *   **Objetivo:** Verificar se a função `malloc` do mock retorna um ponteiro válido (não-nulo) e aloca o espaço esperado na memória simulada.
2.  **`WASMHeapMock: should free allocated memory`**:
    *   **Objetivo:** Assegurar que a função `free` do mock pode ser chamada sem erro para um ponteiro previamente alocado e que a memória é marcada como disponível.
3.  **`WASMHeapMock: should prevent double-free of memory`**:
    *   **Objetivo:** Testar o comportamento da função `free` quando chamada múltiplas vezes com o mesmo ponteiro, garantindo que ela não cause falhas ou corrupção de estado (idealmente, deveria lançar um erro no mock).
4.  **`WASMHeapMock: should correctly set and get integer values`**:
    *   **Objetivo:** Validar que `setValue` e `getValue` do mock funcionam corretamente para tipos inteiros (ex: `i32`), lendo e escrevendo os dados esperados.
5.  **`WASMHeapMock: should correctly set and get float values`**:
    *   **Objetivo:** Idem ao anterior, mas para tipos de ponto flutuante (ex: `f32`), garantindo a integridade dos dados.
6.  **`WASMHeapMock: should correctly transfer array buffer data to WASM heap`**:
    *   **Objetivo:** Simular o método `WASM.HEAPU8.set` e verificar se os dados de um `ArrayBuffer` são copiados para a memória simulada do WASM com integridade.
7.  **`WASMHeapMock: should correctly transfer array buffer data from WASM heap`**:
    *   **Objetivo:** Simular `WASM.HEAPU8.subarray` e garantir que os dados são lidos da memória WASM simulada para um `ArrayBuffer` JS com integridade.
8.  **`MuxResult structure: should correctly parse a mocked MuxResult pointer`**:
    *   **Objetivo:** Testar a capacidade do JS de "ler" uma estrutura `MuxResult` (contendo `ptr`, `size`, `type`) a partir de um ponteiro simulado na memória WASM.
9.  **`Memory leak prevention: should ensure all mallocs have corresponding frees`**:
    *   **Objetivo:** Um teste conceitual no mock para verificar que, ao final de uma operação, o número de alocações (`malloc`) é igual ao número de desalocações (`free`), sinalizando ausência de vazamentos de memória.
10. **`Pointer validation: should handle invalid WASM pointers gracefully`**:
    *   **Objetivo:** Testar chamadas a `getValue` ou `free` com ponteiros nulos ou fora dos limites da memória simulada, esperando tratamento de erro adequado.

---

### 4. Lógica do `muxer-worker.js` (Interface com WASM e OPFS) - 10 Testes
**Arquivo de Teste:** `tests/unit/muxer-worker.test.js`

1.  **`INIT_MUSE_STREAM: should initialize OPFS and get accessHandle`**:
    *   **Objetivo:** Mockar `navigator.storage.getDirectory()` e `createSyncAccessHandle()` para verificar se o worker inicializa o OPFS e obtém um `accessHandle` válido.
2.  **`INIT_MUSE_STREAM: should handle OPFS initialization failure`**:
    *   **Objetivo:** Simular falhas em `getDirectory()` ou `createSyncAccessHandle()` e verificar se o worker lida com esses erros de forma robusta.
3.  **`ENCODED_CHUNK: should allocate WASM memory for audio/video chunk`**:
    *   **Objetivo:** Verificar se `malloc` da API WASM é invocado com o tamanho correto para o chunk de áudio/vídeo recebido.
4.  **`ENCODED_CHUNK: should copy chunk data to WASM heap`**:
    *   **Objetivo:** Assegurar que os dados do chunk são copiados para a memória WASM simulada após a alocação, mantendo a integridade.
5.  **`ENCODED_CHUNK: should invoke WASM muxing function`**:
    *   **Objetivo:** Mockar a função `_mux_audio_video_chunk` do WASM e verificar se ela é chamada com os ponteiros e tamanhos corretos dos dados.
6.  **`ENCODED_CHUNK: should write muxed data to OPFS via accessHandle.write()`**:
    *   **Objetivo:** Mockar `accessHandle.write()` e verificar se os dados muxados são passados corretamente para o sistema de arquivos persistente do navegador.
7.  **`ENCODED_CHUNK: should free WASM memory after processing chunk`**:
    *   **Objetivo:** Garantir que a memória WASM alocada para o chunk de entrada e a saída muxada é liberada corretamente após o processamento.
8.  **`ENCODED_CHUNK: should ensure sequential writes to OPFS`**:
    *   **Objetivo:** Verificar que as chamadas a `accessHandle.write()` mantêm o `offset` de escrita correto, garantindo a integridade sequencial do arquivo.
9.  **`ENCODED_CHUNK: should handle accessHandle.write() failure`**:
    *   **Objetivo:** Simular uma falha na escrita para o OPFS e verificar o tratamento de erro do worker.
10. **`FINALIZE_MUSE_STREAM: should close OPFS accessHandle and clean up`**:
    *   **Objetivo:** Verificar se `accessHandle.close()` é chamado e outros recursos são limpos ao finalizar o stream.

---

### 5. Simulação do `OfflineAudioContext` (Determinismo de Áudio) - 7 Testes
**Arquivo de Teste:** `tests/unit/offline-audio.test.js`

1.  **`should correctly advance currentTime using suspend() for fixed duration`**:
    *   **Objetivo:** Testar que uma única chamada ao método `suspend()` avança o `currentTime` do `OfflineAudioContext` de forma precisa pela duração especificada.
2.  **`should accumulate currentTime accurately over multiple suspend() calls`**:
    *   **Objetivo:** Verificar que o `currentTime` se acumula com precisão após uma sequência de chamadas `suspend()`, sem erros cumulativos.
3.  **`should maintain zero drift for 44100Hz sampleRate`**:
    *   **Objetivo:** Confirmar que o `currentTime` corresponde ao valor esperado, sem *drift* de precisão, após muitas pequenas progressões para uma `sampleRate` de 44.1kHz.
4.  **`should maintain zero drift for 48000Hz sampleRate`**:
    *   **Objetivo:** Idem ao anterior, mas para uma `sampleRate` de 48kHz, garantindo o determinismo em diferentes configurações de áudio.
5.  **`should handle very short suspend durations`**:
    *   **Objetivo:** Testar o comportamento com durações de `suspend` muito curtas, que podem ser menores que o tamanho de bloco de processamento interno, para garantir que o tempo avança corretamente.
6.  **`should handle long suspend durations without overflow`**:
    *   **Objetivo:** Validar que o contexto de áudio simula grandes durações de tempo sem problemas de *overflow* ou perda de precisão de ponto flutuante.
7.  **`should reset currentTime after context re-initialization`**:
    *   **Objetivo:** Verificar que ao recriar ou "resetar" o `OfflineAudioContext`, o `currentTime` retorna a 0, assegurando um estado inicial limpo para novas simulações.

---

### 6. Estrutura de Boxes fMP4 (C++ Muxer - via mocks JS) - 8 Testes
**Arquivo de Teste:** `tests/unit/fmp4-boxes.test.js`

*(Estes testes assumem que a camada JS pode inspecionar a saída em bytes brutos do muxer WASM mockado, ou que o mock retorna dados estruturados que representam os boxes.)*

1.  **`should create a valid 'moof' box header`**:
    *   **Objetivo:** Verificar o tamanho e o tipo ('moof') do Box de Fragmento de Filme (Movie Fragment Box) mais externo.
2.  **`should contain 'mfhd' box with correct sequence_number within 'moof'`**:
    *   **Objetivo:** Validar a existência e o `sequence_number` correto do Box de Cabeçalho de Fragmento de Filme (Movie Fragment Header Box) dentro do 'moof'.
3.  **`should contain 'traf' box within 'moof'`**:
    *   **Objetivo:** Assegurar a existência do Box de Fragmento de Faixa (Track Fragment Box) dentro do 'moof'.
4.  **`should contain 'tfhd' box with correct track_id within 'traf'`**:
    *   **Objetivo:** Verificar a existência e o `track_id` correto do Box de Cabeçalho de Fragmento de Faixa (Track Fragment Header Box) dentro do 'traf'.
5.  **`should contain 'trun' box with correct data_offset and sample_count within 'traf'`**:
    *   **Objetivo:** Confirmar a existência, o `data_offset` e o `sample_count` corretos do Box de Execução de Faixa (Track Run Box) dentro do 'traf'.
6.  **`should correctly embed 'mdat' box after 'moof' with payload`**:
    *   **Objetivo:** Validar a presença do Box de Dados de Média (Media Data Box) e seu payload de dados brutos, garantindo que ele segue imediatamente o 'moof'.
7.  **`should handle different chunk sizes for 'trun' and 'mdat'`**:
    *   **Objetivo:** Testar com diferentes `sample_count` e tamanhos de payload correspondentes no `mdat`, verificando a consistência.
8.  **`should correctly update sequence_number across multiple moof/mdat pairs`**:
    *   **Objetivo:** Assegurar que o `sequence_number` do `mfhd` incrementa corretamente para fragmentos subsequentes, mantendo a ordem.

---