from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import random

def buscar_links_site_maps(termo):
    options = webdriver.ChromeOptions()
    options.add_argument('--disable-blink-features=AutomationControlled')
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option('useAutomationExtension', False)
    options.add_argument("--start-maximized")

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)
    driver.get("https://www.google.com/")
    time.sleep(random.uniform(2, 3))

    # Aceita cookies se aparecer
    try:
        aceitar = driver.find_element(By.XPATH, "//button/div[contains(text(),'Aceitar')]")
        aceitar.click()
        time.sleep(1)
    except:
        pass

    # Digita a busca
    barra = driver.find_element(By.NAME, "q")
    for letra in termo:
        barra.send_keys(letra)
        time.sleep(random.uniform(0.05, 0.15))
    barra.send_keys(Keys.ENTER)
    time.sleep(3)

    # Clica na aba "Maps"
    try:
        aba_maps = driver.find_element(By.PARTIAL_LINK_TEXT, "Maps")
        aba_maps.click()
        time.sleep(5)
    except Exception as e:
        print("Erro ao clicar na aba Maps:", e)
        driver.quit()
        return []

    # Aguarda os cartões carregarem
    cards = driver.find_elements(By.XPATH, '//a[contains(@aria-label, "Website")]')
    print(f"\n🔍 Encontrados {len(cards)} botões de site")

    links_site = []
    for card in cards:
        href = card.get_attribute('href')
        if href and href not in links_site:
            links_site.append(href)

    driver.quit()
    return links_site
