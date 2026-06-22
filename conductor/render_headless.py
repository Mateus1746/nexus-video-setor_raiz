import os
import subprocess
import wave
import contextlib
import sys

def render_story(factory, scene_id):
    print(f"🎬 Iniciando Renderização Headless para {factory} / {scene_id}...")
    
    # 1. Definir caminhos
    app_js_path = "web/app.js"
    wav_path = f"pipeline/sync_drive/audio_ready/{factory}/{scene_id}/{scene_id}.wav"
    output_path = f"pipeline/sync_drive/exports/{factory}_{scene_id}.mp4"

    if not os.path.exists(wav_path):
        print(f"❌ Erro: Áudio não encontrado em {wav_path}")
        return False

    # 2. Obter duração do áudio
    with contextlib.closing(wave.open(wav_path, 'r')) as f:
        frames = f.getnframes()
        rate = f.getframerate()
        duration = frames / float(rate)
    
    # Adicionar uma pequena folga de segurança na duração
    duration_rounded = round(duration + 0.2, 2)
    print(f"⏱️ Duração do áudio detectada: {duration_rounded}s")

    # 3. Ler o app.js original para fazer backup
    with open(app_js_path, 'r', encoding='utf-8') as f:
        original_content = f.read()

    try:
        # 4. Modificar app.js com os novos defaults
        modified_content = original_content
        # Substituir os fallbacks de factory e scene
        modified_content = modified_content.replace(
            "const factory = urlParams.get('factory') || 'politica_direita';",
            f"const factory = urlParams.get('factory') || '{factory}';"
        )
        modified_content = modified_content.replace(
            "const sceneId = urlParams.get('scene') || 'staging';",
            f"const sceneId = urlParams.get('scene') || '{scene_id}';"
        )
        modified_content = modified_content.replace(
            "const isRecording = urlParams.get('recording') === 'true';",
            "const isRecording = urlParams.get('recording') === 'true' || urlParams.get('headless') === 'true';"
        )

        with open(app_js_path, 'w', encoding='utf-8') as f:
            f.write(modified_content)
        
        # 5. Compilar os assets web
        print("📦 Compilando assets do projeto (npm run build)...")
        subprocess.run(["npm", "run", "build"], check=True)

        # 6. Executar o Engine-Headless-Recorder
        print("🎥 Executando Engine-Headless-Recorder...")
        recorder_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../tools/Engine-Headless-Recorder/src/node/record_video.js"))
        
        cmd = [
            "node", recorder_path,
            "setor_raiz/dist",
            "--canvas=#video-canvas",
            f"--duration={duration_rounded}",
            "--fps=25",
            f"--output={output_path}"
        ]
        
        print(f"🚀 Rodando comando: {' '.join(cmd)}")
        # Executar gravador
        subprocess.run(cmd, check=True)
        print(f"🎉 Sucesso! Vídeo gravado e salvo em: {output_path}")
        return True

    finally:
        # 7. Restaurar o app.js original
        print("🧼 Restaurando o estado original de web/app.js...")
        with open(app_js_path, 'w', encoding='utf-8') as f:
            f.write(original_content)
        subprocess.run(["npm", "run", "build"], check=True)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python render_headless.py <factory> <scene_id>")
        sys.exit(1)
    
    factory = sys.argv[1]
    scene_id = sys.argv[2]
    render_story(factory, scene_id)
