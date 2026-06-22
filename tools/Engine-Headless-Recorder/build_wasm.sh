#!/bin/bash

# 🚨 SOTA COMPILATION SCRIPT - JUNE 2026
# Compila o Muxer fMP4 C++ para WebAssembly usando o Emscripten (emcc)

# Definição de caminhos locais
SRC_DIR="src/cpp"
OUT_DIR="src/browser"

echo "--- INICIANDO COMPILAÇÃO DO MUXER BARE-METAL (C++ -> WASM) ---"

# Verifica se o compilador Emscripten (emcc) está disponível no path do sistema
if ! command -v emcc &> /dev/null; then
    echo "❌ ERRO: O compilador Emscripten (emcc) não foi encontrado no PATH."
    echo "👉 Certifique-se de instalar e ativar o Emscripten SDK (emsdk) antes de rodar o build."
    exit 1
fi

# Comando de compilação otimizado para performance industrial
emcc "$SRC_DIR/fmp4_muxer.cpp" \
    -O3 \
    -s WASM=1 \
    -s EXPORTED_FUNCTIONS='["_create_fragment", "_create_initialization_segment", "_malloc", "_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["getValue", "setValue"]' \
    -s ENVIRONMENT='worker' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -o "$OUT_DIR/fmp4_muxer_core.js"

if [ $? -eq 0 ]; then
    echo "✅ COMPILAÇÃO CONCLUÍDA COM SUCESSO!"
    echo "📂 Artefatos gerados em $OUT_DIR/:"
    echo "   - fmp4_muxer_core.js (Glue Code Emscripten)"
    echo "   - fmp4_muxer_core.wasm (Binário WebAssembly de Alta Performance)"
else
    echo "❌ ERRO: Falha durante a execução do emcc."
    exit 1
fi
