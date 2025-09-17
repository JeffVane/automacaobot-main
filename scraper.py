import re
from asyncio import timeout

import requests
from bs4 import BeautifulSoup

def extrair_contatos(url):
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
        }
        resposta = requests.get(url, headers=headers, timeout=10)
        soup = BeautifulSoup(resposta.text, 'html.parser')
        texto = soup.get_text()

        telefones = re.findall(r'\(?\d{2}\)?\s?\d{4,5}-?\d{4}', texto)
        emails = re.findall(r'\b[\w\.-]+@[\w\.-]+\.\w{2,4}\b', texto)
        whatsapps = re.findall(r'https://wa\.me/\d{10,13}', texto)

        return {
            "url": url,
            "telefones": list(set(telefones)),
            "emails": list(set(emails)),
            "whatsapps": list(set(whatsapps))
        }

    except Exception as e:
        print(f"Erro ao acessar {url}: {e}")
        return {
            "url": url,
            "telefones": [],
            "emails": [],
            "whatsapps": []
        }
