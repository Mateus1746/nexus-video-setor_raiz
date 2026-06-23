import os
import subprocess
import wave
import contextlib
import sys

def render_story(factory, scene_id):
    print(f"🎬 Iniciando Renderização Headless para {factory} / {scene_id}...")
    
    # 1. Definir caminhos
    app_js_path = "web/app.js"

    audio_dir = f"pipeline/sync_drive/audio_ready/{factory}/{scene_id}"
    wav_path = None
    if os.path.exists(audio_dir):
        for f in os.listdir(audio_dir):
            if f.endswith('.wav'):
                wav_path = os.path.join(audio_dir, f)
                break

    if not wav_path or not os.path.exists(wav_path):
        print(f"❌ Erro: Áudio não encontrado no diretório {audio_dir}")
        sys.exit(1)

    # Verifica se a pasta de output existe e cria se não
    output_dir = "pipeline/sync_drive/exports"
    os.makedirs(output_dir, exist_ok=True)

    # Temporário local para o gravador headless antes de fazer o merge com ffmpeg
    temp_output_path = f"pipeline/sync_drive/exports/{factory}_{scene_id}_temp.mp4"
    final_output_path = f"pipeline/sync_drive/exports/{factory}_{scene_id}_final.mp4"

    # 2. Obter duração do áudio
    with contextlib.closing(wave.open(wav_path, 'r')) as f:
        frames = f.getnframes()
        rate = f.getframerate()
        duration = frames / float(rate)
    
    # Adicionar uma pequena folga de segurança na duração
    duration_rounded = round(duration + 0.2, 2)
    print(f"⏱️ Duração do áudio detectada: {duration_rounded}s")

    original_content = None
    # 3. Ler o app.js original para fazer backup se existir
    if os.path.exists(app_js_path):
        with open(app_js_path, 'r', encoding='utf-8') as f:
            original_content = f.read()

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

    try:
        # 5. Compilar os assets web se existir package.json
        if os.path.exists("package.json"):
            print("📦 Compilando assets do projeto (npm run build)...")
            subprocess.run(["npm", "run", "build"], check=True)
        else:
            print("📦 package.json não encontrado, pulando npm run build.")

        # 6. Executar o Engine-Headless-Recorder
        print("🎥 Executando Engine-Headless-Recorder...")
        recorder_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../tools/Engine-Headless-Recorder/src/node/record_video.js"))
        
        # Mapeia qual pasta web vai servir de base para o projeto
        web_folder = f"pipeline/sync_drive/staging/{factory}/web"
        if not os.path.exists(web_folder):
            print(f"⚠️ Pasta web {web_folder} não encontrada, usando raiz do projeto.")
            web_folder = factory

        cmd = [
            "node", recorder_path,
            web_folder,
            "--canvas=#video-canvas",
            f"--duration={duration_rounded}",
            "--fps=25",
            f"--output={temp_output_path}"
        ]
        
        print(f"🚀 Rodando comando: {' '.join(cmd)}")
        # Executar gravador
        subprocess.run(cmd, check=True)

        # 7. Merge final do vídeo com o áudio usando ffmpeg
        print("🔀 Unindo vídeo e áudio com FFmpeg...")
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-i", temp_output_path,
            "-i", wav_path,
            "-c:v", "copy",
            "-c:a", "aac",
            "-map", "0:v:0",
            "-map", "1:a:0",
            final_output_path
        ]
        subprocess.run(ffmpeg_cmd, check=True, capture_output=True)

        # Limpar arquivo temporário
        if os.path.exists(temp_output_path):
            os.remove(temp_output_path)

        print(f"🎉 Sucesso! Vídeo finalizado gravado e salvo em: {final_output_path}")
        return True

    finally:
        # 8. Restaurar o app.js original
        if original_content and os.path.exists(app_js_path):
            print("🧼 Restaurando o estado original de web/app.js...")
            with open(app_js_path, 'w', encoding='utf-8') as f:
                f.write(original_content)

            if os.path.exists("package.json"):
                subprocess.run(["npm", "run", "build"], check=True)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Uso: python render_headless.py <factory> <scene_id>")
        sys.exit(1)
    
    factory = sys.argv[1]
    scene_id = sys.argv[2]
    render_story(factory, scene_id)
