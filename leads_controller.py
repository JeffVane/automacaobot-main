import csv
import os

ARQUIVO_CSV = os.path.join(os.path.dirname(__file__), 'leads.csv')

CAMPOS = ["nome", "telefone", "endereco", "site"]

def salvar_leads_em_csv(lista_leads):
    leads_existentes = carregar_telefones_existentes()

    novos_leads = [lead for lead in lista_leads if lead['telefone'] not in leads_existentes]

    if not novos_leads:
        print("📭 Nenhum novo lead para salvar.")
        return

    arquivo_existe = os.path.isfile(ARQUIVO_CSV)

    with open(ARQUIVO_CSV, 'a', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=CAMPOS)

        if not arquivo_existe:
            writer.writeheader()

        for lead in novos_leads:
            writer.writerow(lead)

    print(f"✅ {len(novos_leads)} novo(s) lead(s) salvo(s) em leads.csv.")

def carregar_telefones_existentes():
    if not os.path.exists(ARQUIVO_CSV):
        return set()

    with open(ARQUIVO_CSV, 'r', encoding='utf-8') as csvfile:
        reader = csv.DictReader(csvfile)
        return set(row['telefone'] for row in reader)
