from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
import time
import random

import sys
import os

print(f"Python executable: {sys.executable}")
print(f"Current working directory: {os.getcwd()}")


# 🔥 Função robusta para encontrar elementos com vários seletores
def encontrar_elemento(driver, lista_xpaths):
    for xpath in lista_xpaths:
        try:
            return driver.find_element(By.XPATH, xpath)
        except:
            continue
    return None


# 🔥 Função de scroll inteligente
def scroll_ate_pegar_cards(driver, scroll_area, limite_desejado):
    tentativas = 0
    cards = []

    # Loop para scrollar até que o número de cards desejado seja atingido
    # ou o limite de tentativas seja alcançado (evita loops infinitos)
    while tentativas < 50:  # Mantendo o limite de 50 tentativas para evitar scroll infinito
        # Scroll para o final da área de scroll
        driver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scroll_area)
        time.sleep(random.uniform(1.5, 2.5))  # Pequena pausa para carregamento

        # Coleta todos os cards de locais (links que contêm '/place/')
        cards_atuais = driver.find_elements(By.XPATH, '//a[contains(@href, "/place/")]')

        # Filtra por cards únicos para evitar reprocessamento do mesmo card
        # Uma abordagem simples é usar o href como identificador único
        novos_cards_encontrados = []
        existing_hrefs = {card.get_attribute('href') for card in cards}
        for card_atual in cards_atuais:
            href_atual = card_atual.get_attribute('href')
            if href_atual and href_atual not in existing_hrefs:
                novos_cards_encontrados.append(card_atual)
                existing_hrefs.add(href_atual)

        cards.extend(novos_cards_encontrados)

        print(f"🔍 Cards carregados até agora: {len(cards)}")

        if len(cards) >= limite_desejado:
            print(f"🎯 Alcançado o limite desejado de {limite_desejado} cards.")
            break

        # Verifica se chegamos ao final da lista de resultados
        # (geralmente há uma mensagem "Você atingiu o final da lista" ou similar)
        try:
            end_of_list = driver.find_element(By.XPATH,
                                              "//*[contains(text(), 'Você atingiu o final da lista') or contains(text(), 'End of list')]")
            if end_of_list:
                print("🏁 Fim da lista de resultados atingido.")
                break
        except:
            pass  # Continua se a mensagem de fim de lista não for encontrada

        tentativas += 1

    if len(cards) == 0:
        print(
            "⚠️ Nenhum card encontrado após tentativas de scroll. Tentando clicar manualmente no primeiro item da lista.")
        try:
            primeiro = driver.find_element(By.XPATH, '(//div[@role="article"])[1]')
            driver.execute_script("arguments[0].scrollIntoView(true);", primeiro)
            primeiro.click()
            time.sleep(4)
            # Tentar coletar cards novamente após o clique, se for o caso
            cards = driver.find_elements(By.XPATH, '//a[contains(@href, "/place/")]')
        except:
            print("❌ Não foi possível clicar no primeiro item ou coletar cards após clique.")

    return cards


# 🔥 Função principal
def buscar_dados_cards_maps(termo, limite=50, username=None, status_buscas=None):
    options = webdriver.ChromeOptions()
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument("--start-maximized")
    # Adicionar opção para rodar headless em produção, mas manter visível para depuração
    # options.add_argument("--headless")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.get("https://www.google.com/")
    time.sleep(2)

    # Aceita cookies
    try:
        # XPaths comuns para o botão "Aceitar tudo" dos cookies do Google
        aceitar_xpaths = [
            "//button[./div[contains(text(),'Aceitar tudo')]]",
            "//button[./span[contains(text(),'Aceitar tudo')]]",
            "//button[./div[contains(text(),'I agree')]]",  # Para caso o idioma seja inglês
            "//button[text()='Aceitar']",
            "//div[text()='Aceitar tudo']"
        ]
        aceitar_button = encontrar_elemento(driver, aceitar_xpaths)
        if aceitar_button:
            aceitar_button.click()
            print("✅ Cookies aceitos.")
            time.sleep(1)  # Pequena pausa após clicar
    except Exception as e:
        print(f"⚠️ Não foi possível aceitar os cookies (provavelmente já aceitos ou elemento não encontrado): {e}")
        pass  # Ignora se não encontrar o botão de aceitar cookies

    # Pesquisa o termo
    try:
        barra = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.NAME, "q"))
        )
        barra.send_keys(termo)
        barra.send_keys(Keys.ENTER)
        time.sleep(3)
        print(f"✅ Termo '{termo}' pesquisado.")
    except Exception as e:
        print(f"❌ Erro ao pesquisar o termo: {e}")
        driver.quit()
        return []

    # Abre aba Maps
    try:
        # XPaths para a aba "Maps" ou "Mapas"
        aba_maps_xpaths = [
            "//a[contains(@aria-label, 'Maps') or contains(text(), 'Maps') or contains(text(), 'Mapas')]",
            "//a[starts-with(@href, 'https://www.google.com/maps')]",
            "//div[@role='navigation']//a[contains(@href, '/maps')]"
        ]
        aba_maps = encontrar_elemento(driver, aba_maps_xpaths)
        if aba_maps:
            aba_maps.click()
            time.sleep(random.uniform(6, 8))
            print("✅ Aba 'Maps' clicada.")
        else:
            print("❌ Não foi possível encontrar a aba Maps.")
            driver.quit()
            return []
    except Exception as e:
        print(f"❌ Erro ao clicar na aba Maps: {e}")
        driver.quit()
        return []

    # Faz o scroll para carregar os cards
    cards = []
    try:
        # Espera até que a área de scroll principal esteja visível
        scroll_area = WebDriverWait(driver, 20).until(  # Aumentado o tempo de espera
            EC.presence_of_element_located((By.XPATH, '//div[@role="feed"]'))
        )
        print("✅ Área de scroll 'feed' encontrada.")
        cards = scroll_ate_pegar_cards(driver, scroll_area, limite)
        print(f"✅ Total de cards encontrados após scroll: {len(cards)}")

    except Exception as e:
        print(f"❌ Erro ao identificar a área de scroll ou rolar: {e}")
        driver.quit()
        return []

    resultados = []  # Esta lista será retornada no final

    if status_buscas and username:
        status_buscas[username]['parciais'] = []  # Limpa resultados parciais anteriores

    # 🔍 Processa os cards
    print(f"Iniciando o processamento de {min(len(cards), limite)} cards...")
    for i, card in enumerate(cards[:limite]):  # Limita ao 'limite' especificado
        try:
            # Rola para o card para garantir que esteja visível antes de clicar
            driver.execute_script("arguments[0].scrollIntoView(true);", card)
            time.sleep(random.uniform(0.5, 1.0))  # Pequena pausa antes de clicar

            # Tenta clicar no card. Se o clique não funcionar, avança.
            try:
                card.click()
                time.sleep(random.uniform(3.5, 5))  # Espera carregar os detalhes
            except Exception as click_e:
                print(
                    f"⚠️ Não foi possível clicar no card {i + 1} (provavelmente elemento stale ou sobreposto): {click_e}")
                # Se não conseguiu clicar, tenta continuar para o próximo card
                continue

                # XPaths para extração de dados detalhados do card clicado
            nome = encontrar_elemento(driver, [
                '//h1[contains(@class, "DUwDvf")]',
                '//h1[@data-testid="hero-title"]',  # Novo XPath possível
                '//*[@id="QA0Szd"]//h1',
                '//h1'
            ])
            nome = nome.text.strip() if nome else "Nome não encontrado"  # .strip() para remover espaços em branco

            endereco = encontrar_elemento(driver, [
                '//button[contains(@data-item-id, "address")]',
                '//div[contains(@class, "rogA2c")]//div[contains(@class, "Io6YTe") and @aria-label]',
                # XPath mais específico para endereço
                '//div[contains(@class, "Io6YTe")][1]'
                # Tenta pegar o primeiro div com essa classe (geralmente o endereço)
            ])
            endereco = endereco.text.strip() if endereco else "Endereço não encontrado"

            telefone = encontrar_elemento(driver, [
                '//button[contains(@data-item-id, "phone")]',
                '//a[contains(@href, "tel:")]'  # Direto no link tel
            ])
            telefone = telefone.text.strip() if telefone else "Telefone não encontrado"

            site = encontrar_elemento(driver, [
                '//a[contains(@data-item-id, "authority")]',
                '//a[contains(@data-item-id, "website")]',  # Outro XPath para site
                '//a[contains(@href, "http") and contains(@aria-label, "site")]'
            ])
            site = site.get_attribute('href') if site else "Site não encontrado"

            # Você pode adicionar mais campos aqui, como:
            # rating = encontrar_elemento(driver, ['//span[@aria-label="Rating"]'])
            # rating = rating.text.strip() if rating else "Não encontrado"

            # Categoria, se houver:
            categoria = encontrar_elemento(driver, [
                '//button[contains(@jsaction, "category.click")]',
                '//div[contains(@class, "fontBodyMedium") and @aria-label="Category"]'
            ])
            categoria = categoria.text.strip() if categoria else "Não encontrado"

            lead_data = {
                "nome": nome,
                "telefone": telefone,
                "endereco": endereco,
                "site": site,
                "categoria": categoria  # Adicionado categoria
                # "rating": rating # Se você quiser adicionar
            }

            resultados.append(lead_data)  # Adiciona o lead processado à lista de resultados

            # Atualiza o status da busca para o frontend
            if status_buscas and username:
                # O progresso é agora uma porcentagem do processamento dos CARDS,
                # e não apenas da rolagem.
                progresso_atual_processamento = int(((i + 1) / limite) * 100)
                # Combina com a porcentagem já atingida na rolagem (que foi 80%)
                # Ajusta conforme o progresso da busca geral no app.py
                status_buscas[username]["progresso"] = int(80 + (progresso_atual_processamento * 0.20))  # Ajuste aqui
                status_buscas[username]["mensagem"] = f"Processando: {nome} ({i + 1}/{limite})"

                # Adiciona o lead completo aos parciais para visualização em tempo real
                status_buscas[username]["parciais"].append(lead_data)

            # Retorna para a lista de resultados para continuar processando
            # Este passo é crucial para evitar que o Selenium tente processar o próximo
            # card ainda na tela de detalhes do card anterior.
            try:
                # Tenta encontrar o botão "voltar"
                voltar_button = encontrar_elemento(driver, [
                    '//button[contains(@aria-label, "Voltar") or contains(@aria-label, "Back to results")]',
                    '//img[@aria-label="Voltar"]',  # Para o ícone de seta
                    '//button[contains(@jsaction, "pane.back")]'
                ])
                if voltar_button:
                    voltar_button.click()
                    time.sleep(random.uniform(2, 3))  # Espera a lista carregar
                    print(f"✅ Voltou para a lista após processar card {i + 1}.")
                else:
                    # Se não encontrar o botão voltar, pode tentar navegar via URL ou
                    # recarregar a página (menos eficiente, mas pode ser um fallback)
                    print("⚠️ Botão 'Voltar' não encontrado, tentando outra abordagem para retornar à lista.")
                    # Poderíamos adicionar aqui: driver.get(current_maps_url_list_view)
                    # Mas é complexo manter a URL exata da lista. Clicar no card e voltar é o ideal.
                    # Se o botão voltar falhar, o script pode tentar processar elementos na página de detalhes
                    # do próximo card, o que pode levar a erros. É um ponto a monitorar.
            except Exception as back_e:
                print(f"❌ Erro ao voltar para a lista de resultados após card {i + 1}: {back_e}")
                # Neste ponto, se não conseguir voltar, o próximo card pode não ser clicável corretamente.
                # Pode ser necessário um tratamento de erro mais robusto ou parar a busca.
                break  # Para a busca se não conseguir voltar para a lista

        except Exception as e:
            print(f"❌ Erro geral ao processar card {i + 1}: {e}")
            # Tenta voltar para a lista mesmo com erro para continuar com o próximo card
            try:
                voltar_button = encontrar_elemento(driver, [
                    '//button[contains(@aria-label, "Voltar") or contains(@aria-label, "Back to results")]',
                    '//img[@aria-label="Voltar"]',
                    '//button[contains(@jsaction, "pane.back")]'
                ])
                if voltar_button:
                    voltar_button.click()
                    time.sleep(random.uniform(2, 3))
            except:
                pass  # Ignora erro ao tentar voltar se já houve um erro principal
            continue  # Continua para o próximo card

    driver.quit()
    print("✅ Navegador fechado.")
    return resultados  # Retorna a lista de todos os leads extraídos