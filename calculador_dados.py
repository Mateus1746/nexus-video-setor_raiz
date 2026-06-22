#!/usr/bin/env python3
import sys
import argparse

def calcular_dados(preco_usd, preco_br_digital, preco_br_fisico, taxa_revenda):
    # Conversões e Cálculos
    cotacao_estimada = preco_br_digital / preco_usd
    
    # 1. Custo Real da Mídia Física (com revenda)
    preco_revenda = preco_br_fisico * (taxa_revenda / 100)
    custo_real_fisico = preco_br_fisico - preco_revenda
    
    # 2. Otimização de Gift Cards (para compras de R$ 50, R$ 100, R$ 250)
    # Queremos cobrir preco_br_digital com a menor sobra possível na PSN/Xbox
    valores_cards = [250, 100, 50, 30, 10]
    cards_necessarios = []
    resto = preco_br_digital
    
    for valor in valores_cards:
        while resto >= valor:
            cards_necessarios.append(valor)
            resto -= valor
    
    # Se ainda sobrou algo, adicionamos o menor card que cobre o resto
    if resto > 0:
        # Acha o menor card que seja maior ou igual ao resto
        for valor in reversed(valores_cards):
            if valor >= resto:
                cards_necessarios.append(valor)
                resto -= valor
                break
        else:
            # Caso não encontre (resto menor que todos, o que não deve ocorrer com o card de 10)
            cards_necessarios.append(10)
            resto -= 10
            
    total_gift_cards = sum(cards_necessarios)
    sobra_carteira = total_gift_cards - preco_br_digital
    
    # 3. Métricas de Poder de Compra (Salário Mínimo 2026 estimado em R$ 1.500,00)
    salario_minimo = 1500.00
    percentual_salario = (preco_br_digital / salario_minimo) * 100
    horas_trabalhadas = (preco_br_digital / (salario_minimo / 220)) # 220h mensais
    
    # Print do Output formatado para Overlays do Vídeo
    print("=" * 60)
    print(" 📊 DADOS OFICIAIS FORMATADOS PARA OVERLAY DE VÍDEO")
    print("=" * 60)
    print(f"Preço Base: ${preco_usd:.2f} USD")
    print(f"Preço BR Digital: R$ {preco_br_digital:.2f}")
    print(f"Preço BR Físico: R$ {preco_br_fisico:.2f}")
    print(f"Cotação Implícita (Dólar Gamer): R$ {cotacao_estimada:.2f}")
    print("-" * 60)
    print(" 🔥 DADOS DO HACK DA MÍDIA FÍSICA (REVENDA)")
    print(f"• Preço de Compra: R$ {preco_br_fisico:.2f}")
    print(f"• Estimativa de Revenda ({taxa_revenda}%): R$ {preco_revenda:.2f}")
    print(f"• CUSTO REAL DA EXPERIÊNCIA: R$ {custo_real_fisico:.2f}")
    print("-" * 60)
    print(" 💳 OTIMIZAÇÃO DE GIFT CARDS (COMPRA PARCELADA)")
    print(f"• Combinação Ideal de Cards: " + " + ".join([f"R$ {c}" for c in cards_necessarios]))
    print(f"• Total a Pagar em Cards: R$ {total_gift_cards:.2f}")
    print(f"• Sobra presa na carteira do Console: R$ {abs(sobra_carteira):.2f}")
    print("-" * 60)
    print(" 💸 IMPACTO ECONÔMICO (OUTRAGE METRICS)")
    print(f"• Compromete: {percentual_salario:.1f}% do Salário Mínimo (R$ {salario_minimo:.2f})")
    print(f"• Exige: {horas_trabalhadas:.1f} Horas de Trabalho no Brasil")
    print("=" * 60)
    print(" ✍️ TEXTOS DE OVERLAYS CURTOS (SÓ COPIAR E COLAR)")
    print("=" * 60)
    print(f"Overlay 1: GTA 6 CUSTA R$ {preco_br_digital:.0f} (MÉDIA DE 10 DIAS DE TRABALHO)")
    print(f"Overlay 2: MÍDIA FÍSICA R$ {preco_br_fisico:.0f} -> REVENDE POR R$ {preco_revenda:.0f} -> JOGO CUSTOU R$ {custo_real_fisico:.0f}")
    print(f"Overlay 3: PARCELE NA AMAZON EM 10X USANDO CARTÕES: " + " + ".join([f"R$ {c}" for c in cards_necessarios]))
    print("=" * 60)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Calculador de Métricas e Textos de Overlay para o GTA 6")
    parser.add_argument("--usd", type=float, default=80.0, help="Preço anunciado em USD (Ex: 80.0)")
    parser.add_argument("--digital", type=float, default=549.90, help="Preço digital oficial em BRL (Ex: 549.90)")
    parser.add_argument("--fisico", type=float, default=499.90, help="Preço físico estimado em BRL (Ex: 499.90)")
    parser.add_argument("--revenda", type=float, default=75.0, help="Percentual do valor recuperado na revenda (Ex: 75 para 75%%)")
    
    args = parser.parse_args()
    calcular_dados(args.usd, args.digital, args.fisico, args.revenda)
