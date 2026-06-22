# Setor Zero - Esteira de Conteúdo GTA 6 (Pré-Venda)

Este projeto contém a infraestrutura e os roteiros necessários para rodar uma esteira rápida de publicação de conteúdo focado em conversão e arbitragem de tráfego para a pré-venda de **GTA 6 (dia 25 de Junho)**.

---

## 🛠️ Arquivos do Projeto
- [roteiros_pre_venda.md](file:///home/mateus/.gemini/projetos/nexus_media/video/setor_raiz/roteiros_pre_venda.md): Os 3 roteiros baseados em dados, estruturados para retenção algorítmica agressiva (ganchos de 3 segundos, retenção baseada em fatos e CTAs de afiliados).
- [calculador_dados.py](file:///home/mateus/.gemini/projetos/nexus_media/video/setor_raiz/calculador_dados.py): Script utilitário em Python para rodar assim que a Rockstar liberar os preços. Ele calcula em lote os custos de revenda, a combinação ideal de Gift Cards para evitar troco preso, métricas de outrage de poder de compra e gera os textos de overlay prontos para copiar e colar.

---

## 🚀 Guia Operacional do Dia 25

### Fase 1: Pré-requisitos (Fazer Antes do Dia 25)
1. **Cadastro nos Programas de Afiliados:**
   - Cadastre-se no **Amazon Associados** (Comissão de 8% fixa em Games/Eletrônicos no Brasil, sem teto de ganho).
   - Cadastre-se no **Mercado Livre Afiliados** (Comissão de 8% em venda direta de consoles e jogos).
   - Cadastre-se na **Nuuvem** ou portais agregadores de chaves se quiser comissionar Gift Cards alternativos (ou use a própria Amazon para Gift Cards de PSN/Xbox).
2. **Estoque de Mídia Bruta (B-Roll):**
   - Use geradores de vídeo por IA (como Runway, Luma Dream Machine, ou Stable Video Diffusion) ou frameworks de vídeo automatizados para gerar loops curtos de 5 a 10 segundos na estética de **Vice City / Synthwave / Retro-tech** (rosa neon, azul escuro, linhas de terminal de computador).
   - Tenha o trailer oficial de GTA 6 baixado em 4K e fragmentado em cortes rápidos de 2 a 3 segundos das cenas de maior ação.
3. **Template Mestre de Edição:**
   - Crie um template vertical no seu editor de preferência (CapCut, Premiere ou After Effects).
   - Configure a fonte: Use fontes pesadas e altamente legíveis (ex: Montserrat Black, Impact ou Outfit).
   - Deixe o espaço central reservado para os overlays de dados e legendas.

---

### Fase 2: O Dia do Anúncio (Execução Rápida)
Assim que a Rockstar revelar os preços e abrir a pré-venda:
1. **Rode o Calculador de Dados:**
   Execute o script passando os valores reais anunciados (em dólares e em reais):
   ```bash
   python3 calculador_dados.py --usd 80.0 --digital 549.90 --fisico 499.90 --revenda 75
   ```
2. **Gere os Textos de Transmissão:**
   - Pegue os outputs gerados na seção `✍️ TEXTOS DE OVERLAYS CURTOS` e jogue-os direto nas caixas de texto do seu template.
   - Use uma ferramenta de TTS (Text-to-Speech) de alta fidelidade (como ElevenLabs) para narrar o texto do roteiro escolhido em `roteiros_pre_venda.md` com os dados atualizados.
3. **Renderize e Publique em Lote:**
   - Com o template pronto, a substituição de dados e áudio leva menos de 5 minutos por vídeo.
   - Exporte 3 a 5 variações do mesmo vídeo (variando o gancho inicial ou a música de fundo) para testar a resposta do algoritmo.
   - Publique de forma massiva nos Shorts do YouTube, TikTok e Reels do Instagram nas primeiras 2 horas do anúncio.
4. **Insira os Links de Conversão:**
   - Fixe o primeiro comentário com o seu link encurtado redirecionando para a compra de Gift Cards parcelados ou pré-venda da mídia física na Amazon/Mercado Livre.

---

## 📈 Métricas de Sucesso
- **CTR de Links:** Fique de olho na quantidade de cliques em relação às visualizações.
- **Retenção dos Primeiros 3 Segundos:** Se a retenção cair drasticamente no gancho, mude a copy do gancho ou a imagem de impacto inicial nos próximos envios.
