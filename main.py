from maps_search import buscar_dados_cards_maps

# Define o termo de busca
termo = "Clínica Odontológica no Goiás"

# Busca e extrai os dados dos cards do Google Maps
resultados = buscar_dados_cards_maps(termo)

# Exibe os resultados
if not resultados:
    print("⚠️ Nenhum resultado encontrado.")
else:
    print(f"\n📋 {len(resultados)} locais encontrados com sucesso:\n")
    for i, r in enumerate(resultados, 1):
        print(f"🔹 [{i}] {r['nome']}")
        print(f"📞 Telefone: {r['telefone']}")
        print(f"📍 Endereço: {r['endereco']}")
        print(f"🌐 Site: {r['site']}\n")
