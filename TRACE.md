# TRACE

### Decisão: Eliminação Completa do Google Colab e Automação Local Unificada (SOTA 2026)
`[DECISION] -> [RATIONALE] -> [CONSEQUENCE]`
* **DECISION**: Migrar o fluxo de áudio do Colab para síntese local via Kokoro (usando os DNAs de voz `.pt` no Drive) e utilizar o `Engine-Headless-Recorder` no lugar de compilação por CPU do FFmpeg.
* **RATIONALE**: A esteira anterior exigia sincronização manual e processamento externo lento. Com o Kokoro local e a gravação via Puppeteer Headless Canvas, alcançamos velocidades de renderização acima de **~85 FPS** de forma 100% automatizada e offline.
* **CONSEQUENCE**: Pipeline unificado e executado em um único comando: `uv run python conductor/run_pipeline.py`.
