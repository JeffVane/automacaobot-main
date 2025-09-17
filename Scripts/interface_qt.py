import sys
import csv
import os
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QWidget, QVBoxLayout, QPushButton,
    QTableWidget, QTableWidgetItem, QHeaderView, QFileDialog,
    QLineEdit, QHBoxLayout, QLabel, QFrame, QSplashScreen,
    QStackedWidget, QMessageBox, QProgressBar
)
from PyQt6.QtCore import Qt, QTimer, QSize, QPropertyAnimation, QEasingCurve
from PyQt6.QtWidgets import QSpinBox
from PyQt6.QtGui import QColor, QIcon, QPixmap, QFont, QPalette, QBrush, QLinearGradient, QAction
from PyQt6.QtCore import QUrl
from PyQt6.QtGui import QDesktopServices
from maps_search import buscar_dados_cards_maps



class ModernTableWidget(QTableWidget):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setAlternatingRowColors(True)
        self.setSelectionBehavior(QTableWidget.SelectionBehavior.SelectRows)
        self.setSelectionMode(QTableWidget.SelectionMode.SingleSelection)
        self.setEditTriggers(QTableWidget.EditTrigger.NoEditTriggers)
        self.setShowGrid(False)
        self.verticalHeader().setVisible(False)
        self.setStyleSheet("""
            QTableWidget {
                background-color: #fafafa;
                border-radius: 8px;
                padding: 5px;
                border: 1px solid #e0e0e0;
            }
            QTableWidget::item {
                padding: 10px;
                border-bottom: 1px solid #f0f0f0;
            }
            QTableWidget::item:selected {
                background-color: #e3f2fd;
                color: #1976d2;
            }
            QHeaderView::section {
                background-color: #f5f5f5;
                color: #424242;
                font-weight: bold;
                padding: 10px;
                border: none;
                border-bottom: 2px solid #e0e0e0;
            }
            QTableWidget::item:hover {
                background-color: #f1f8fe;
            }
        """)


class SearchBox(QLineEdit):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setPlaceholderText("Pesquisar leads...")
        self.setStyleSheet("""
            QLineEdit {
                background-color: #fff;
                border: 1px solid #e0e0e0;
                border-radius: 20px;
                padding: 10px 15px;
                font-size: 14px;
            }
            QLineEdit:focus {
                border: 1px solid #2196f3;
            }
        """)


class ModernButton(QPushButton):
    def __init__(self, text, icon=None, color="#2196f3", parent=None):
        super().__init__(text, parent)
        if icon:
            self.setIcon(QIcon(icon))

        self.color = color
        self.setStyleSheet(f"""
            QPushButton {{
                background-color: {color};
                color: white;
                border: none;
                border-radius: 20px;
                padding: 10px 20px;
                font-weight: bold;
                font-size: 14px;
            }}
            QPushButton:hover {{
                background-color: {self.adjust_color(color, -15)};
            }}
            QPushButton:pressed {{
                background-color: {self.adjust_color(color, -30)};
            }}
        """)
        self.setCursor(Qt.CursorShape.PointingHandCursor)

    def adjust_color(self, hex_color, amount):
        r = int(hex_color[1:3], 16)
        g = int(hex_color[3:5], 16)
        b = int(hex_color[5:7], 16)

        r = max(0, min(255, r + amount))
        g = max(0, min(255, g + amount))
        b = max(0, min(255, b + amount))

        return f"#{r:02x}{g:02x}{b:02x}"


class StatusBar(QFrame):
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setFixedHeight(30)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(10, 0, 10, 0)

        self.status_label = QLabel("Pronto")
        self.count_label = QLabel("")

        layout.addWidget(self.status_label)
        layout.addStretch()
        layout.addWidget(self.count_label)

        self.setStyleSheet("""
            QFrame {
                background-color: #f5f5f5;
                border-top: 1px solid #e0e0e0;
            }
            QLabel {
                color: #616161;
            }
        """)


class LeadViewer(QMainWindow):
    def __init__(self):
        super().__init__()

        # Configuração básica da janela
        self.setWindowTitle("Painel de Prospecção - Eleve Contábil")
        self.setMinimumSize(1000, 600)
        self.setStyleSheet("background-color: #ffffff; color: #424242;")

        # Widget central
        central_widget = QWidget()
        self.setCentralWidget(central_widget)

        # Layout principal
        main_layout = QVBoxLayout(central_widget)
        main_layout.setContentsMargins(20, 20, 20, 10)
        main_layout.setSpacing(15)

        # Cabeçalho
        header_layout = QHBoxLayout()
        logo_label = QLabel("📊 Eleve Contábil")
        logo_label.setStyleSheet("font-size: 24px; font-weight: bold; color: #1976d2;")
        header_layout.addWidget(logo_label)
        header_layout.addStretch()

        # Barra de pesquisa
        self.search_box = SearchBox()
        self.search_box.setMinimumWidth(300)
        self.spin_quantidade = QSpinBox()
        self.spin_quantidade.setRange(1, 100)
        self.spin_quantidade.setValue(20)  # valor padrão
        self.spin_quantidade.setPrefix("Qtd: ")
        self.spin_quantidade.setStyleSheet("""
            QSpinBox {
                padding: 5px 10px;
                border: 1px solid #ccc;
                border-radius: 10px;
                font-size: 13px;
                min-width: 80px;
            }
        """)
        header_layout.addWidget(self.spin_quantidade)

        self.search_box.textChanged.connect(self.filtrar_leads)
        header_layout.addWidget(self.search_box)

        main_layout.addLayout(header_layout)

        # Barra de ações
        actions_layout = QHBoxLayout()

        self.btn_buscar = ModernButton("🔍 Buscar Leads", color="#2196f3")
        self.btn_buscar.clicked.connect(self.carregar_leads)
        actions_layout.addWidget(self.btn_buscar)

        self.btn_exportar = ModernButton("📤 Exportar", color="#66bb6a")
        self.btn_exportar.clicked.connect(self.exportar_leads)
        actions_layout.addWidget(self.btn_exportar)

        self.btn_limpar = ModernButton("🗑️ Limpar", color="#ef5350")
        self.btn_limpar.clicked.connect(self.limpar_tabela)
        actions_layout.addWidget(self.btn_limpar)

        actions_layout.addStretch()

        main_layout.addLayout(actions_layout)

        # Conteúdo principal
        self.stack = QStackedWidget()

        # Estado vazio
        empty_widget = QWidget()
        empty_layout = QVBoxLayout(empty_widget)
        empty_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)

        empty_label = QLabel("Nenhum lead carregado")
        empty_label.setStyleSheet("font-size: 18px; color: #9e9e9e;")

        empty_sublabel = QLabel("Clique em 'Buscar Leads' para carregar os dados")
        empty_sublabel.setStyleSheet("font-size: 14px; color: #bdbdbd;")

        empty_layout.addStretch()
        empty_layout.addWidget(empty_label, alignment=Qt.AlignmentFlag.AlignCenter)
        empty_layout.addWidget(empty_sublabel, alignment=Qt.AlignmentFlag.AlignCenter)
        empty_layout.addStretch()

        # Tabela de leads
        self.tabela = ModernTableWidget()
        self.tabela.setColumnCount(4)
        self.tabela.setHorizontalHeaderLabels(["Nome", "Telefone", "Endereço", "Site"])
        self.tabela.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        self.tabela.horizontalHeader().setSectionResizeMode(1, QHeaderView.ResizeMode.ResizeToContents)
        self.tabela.horizontalHeader().setSectionResizeMode(2, QHeaderView.ResizeMode.Stretch)
        self.tabela.horizontalHeader().setSectionResizeMode(3, QHeaderView.ResizeMode.Stretch)
        self.tabela.cellClicked.connect(self.abrir_link_site)

        self.stack.addWidget(empty_widget)
        self.stack.addWidget(self.tabela)

        main_layout.addWidget(self.stack)

        # Status bar personalizada
        self.status_bar = StatusBar()
        main_layout.addWidget(self.status_bar)

        # Dados
        self.leads = []

        # Menu
        self.setup_menu()

    def abrir_link_site(self, row, column):
        if column == 3:  # Coluna do site
            item = self.tabela.item(row, column)
            if item:
                url = item.text().strip()
                if url and not url.startswith("http"):
                    url = "http://" + url  # Garante que seja um link válido

                if QUrl(url).isValid():
                    QDesktopServices.openUrl(QUrl(url))

    def setup_menu(self):
        menu_bar = self.menuBar()
        menu_bar.setStyleSheet("""
            QMenuBar {
                background-color: #f5f5f5;
                border-bottom: 1px solid #e0e0e0;
            }
            QMenuBar::item {
                padding: 6px 10px;
                background: transparent;
            }
            QMenuBar::item:selected {
                background-color: #e3f2fd;
                color: #1976d2;
            }
        """)

        arquivo_menu = menu_bar.addMenu("Arquivo")

        abrir_action = QAction("Abrir CSV...", self)
        abrir_action.triggered.connect(self.abrir_arquivo)
        arquivo_menu.addAction(abrir_action)

        exportar_action = QAction("Exportar CSV...", self)
        exportar_action.triggered.connect(self.exportar_leads)
        arquivo_menu.addAction(exportar_action)

        arquivo_menu.addSeparator()

        sair_action = QAction("Sair", self)
        sair_action.triggered.connect(self.close)
        arquivo_menu.addAction(sair_action)

        ajuda_menu = menu_bar.addMenu("Ajuda")

        sobre_action = QAction("Sobre", self)
        sobre_action.triggered.connect(self.mostrar_sobre)
        ajuda_menu.addAction(sobre_action)

    def carregar_leads(self):
        termo = self.search_box.text().strip()
        quantidade = self.spin_quantidade.value()  # <- obtém o valor do spin

        try:
            self.status_bar.status_label.setText("Carregando dados...")
            QApplication.processEvents()

            # Verifica se o usuário digitou algo para buscar
            if termo:
                # Busca com o robô, agora com limite
                self.leads = buscar_dados_cards_maps(termo, quantidade)


            else:
                # Fallback: carregar CSV local
                caminho = "Scripts/leads.csv"
                if not os.path.exists(caminho):
                    caminho = QFileDialog.getOpenFileName(
                        self, "Abrir arquivo CSV", "", "Arquivos CSV (*.csv)")[0]
                    if not caminho:
                        return

                with open(caminho, "r", encoding="utf-8") as file:
                    leitor = csv.DictReader(file)
                    self.leads = list(leitor)

            if not self.leads:
                QMessageBox.information(self, "Sem resultados", "Nenhum lead encontrado.")
                self.stack.setCurrentIndex(0)
                self.status_bar.status_label.setText("Nenhum lead encontrado")
                self.status_bar.count_label.setText("")
                return

            # Preenche a tabela
            self.tabela.setRowCount(len(self.leads))
            for linha, lead in enumerate(self.leads):
                self.tabela.setItem(linha, 0, QTableWidgetItem(lead.get("nome", "")))

                telefone_item = QTableWidgetItem(lead.get("telefone", ""))
                telefone_item.setForeground(QBrush(QColor("#1976d2")))
                fonte = QFont()
                fonte.setBold(True)
                telefone_item.setFont(fonte)
                telefone_item.setTextAlignment(Qt.AlignmentFlag.AlignCenter)
                telefone_item.setToolTip(lead.get("telefone", ""))
                self.tabela.setItem(linha, 1, telefone_item)

                self.tabela.setItem(linha, 2, QTableWidgetItem(lead.get("endereco", "")))
                self.tabela.setItem(linha, 3, QTableWidgetItem(lead.get("site", "")))

            # ⚠️ Adicione isso após preencher a tabela
            self.tabela.resizeRowsToContents()
            self.tabela.resizeColumnsToContents()
            self.tabela.setColumnWidth(0, 250)  # Nome
            self.tabela.setColumnWidth(1, 150)  # Telefone

            self.stack.setCurrentIndex(1)
            self.status_bar.status_label.setText("Leads carregados com sucesso")
            self.status_bar.count_label.setText(f"{len(self.leads)} leads encontrados")

        except Exception as e:
            QMessageBox.critical(self, "Erro", f"Erro ao carregar os leads: {str(e)}")
            self.status_bar.status_label.setText("Erro ao carregar leads")

    def abrir_arquivo(self):
        caminho = QFileDialog.getOpenFileName(
            self, "Abrir arquivo CSV", "", "Arquivos CSV (*.csv)")[0]
        if caminho:
            self.leads = []
            self.tabela.setRowCount(0)
            self.carregar_leads()

    def exportar_leads(self):
        if not self.leads:
            QMessageBox.warning(self, "Aviso", "Nenhum lead para exportar")
            return

        caminho = QFileDialog.getSaveFileName(
            self, "Exportar CSV", "", "Arquivos CSV (*.csv)")[0]

        if caminho:
            try:
                with open(caminho, "w", encoding="utf-8", newline="") as file:
                    escritor = csv.DictWriter(file, fieldnames=self.leads[0].keys())
                    escritor.writeheader()
                    escritor.writerows(self.leads)

                self.status_bar.status_label.setText("Leads exportados com sucesso")
                QMessageBox.information(self, "Sucesso", "Leads exportados com sucesso!")
            except Exception as e:
                QMessageBox.critical(self, "Erro", f"Erro ao exportar: {str(e)}")

    def limpar_tabela(self):
        if not self.leads:
            return

        self.leads = []
        self.tabela.setRowCount(0)
        self.stack.setCurrentIndex(0)
        self.status_bar.status_label.setText("Tabela limpa")
        self.status_bar.count_label.setText("")

    def filtrar_leads(self):
        texto = self.search_box.text().lower()

        if not self.leads:
            return

        if not texto:
            # Restaurar todos os leads
            self.tabela.setRowCount(len(self.leads))
            for linha, lead in enumerate(self.leads):
                self.tabela.setItem(linha, 0, QTableWidgetItem(lead.get("nome", "")))

                telefone_item = QTableWidgetItem(lead.get("telefone", ""))
                telefone_item.setForeground(QBrush(QColor("#1976d2")))
                fonte = QFont()
                fonte.setBold(True)
                telefone_item.setFont(fonte)
                self.tabela.setItem(linha, 1, telefone_item)

                self.tabela.setItem(linha, 2, QTableWidgetItem(lead.get("endereco", "")))
                site = lead.get("site", "")
                item_site = QTableWidgetItem(site)
                item_site.setForeground(QBrush(QColor("#1a73e8")))  # Azul Google
                item_site.setFont(QFont("Segoe UI", 9, QFont.Weight.Bold))
                item_site.setToolTip("Clique para abrir o site")
                self.tabela.setItem(linha, 3, item_site)
                item_site.setData(Qt.ItemDataRole.UserRole, site)
                item_site.setForeground(QBrush(QColor("#1a73e8")))
                item_site.setFont(QFont("Segoe UI", 9, QFont.Weight.Bold))

            self.status_bar.count_label.setText(f"{len(self.leads)} contatos encontrados")
            return

        # Filtrar leads
        leads_filtrados = [
            lead for lead in self.leads
            if texto in lead.get("nome", "").lower() or
               texto in lead.get("telefone", "").lower() or
               texto in lead.get("endereco", "").lower() or
               texto in lead.get("site", "").lower()
        ]

        self.tabela.setRowCount(len(leads_filtrados))
        for linha, lead in enumerate(leads_filtrados):
            self.tabela.setItem(linha, 0, QTableWidgetItem(lead.get("nome", "")))

            telefone_item = QTableWidgetItem(lead.get("telefone", ""))
            telefone_item.setForeground(QBrush(QColor("#1976d2")))
            fonte = QFont()
            fonte.setBold(True)
            telefone_item.setFont(fonte)
            self.tabela.setItem(linha, 1, telefone_item)

            self.tabela.setItem(linha, 2, QTableWidgetItem(lead.get("endereco", "")))
            self.tabela.setItem(linha, 3, QTableWidgetItem(lead.get("site", "")))

        self.status_bar.count_label.setText(f"{len(leads_filtrados)} de {len(self.leads)} leads encontrados")

    def mostrar_sobre(self):
        QMessageBox.about(
            self,
            "Sobre",
            """<h2>Painel de Prospecção - Eleve Contábil</h2>
            <p>Versão 2.0</p>
            <p>Um moderno visualizador de leads para gerenciamento de prospecção.</p>
            <p>&copy; 2025 Eleve Contábil. Todos os direitos reservados.</p>
            <h3>Created By Jefferson De Sousa Amorim</h3>"""
        )


if __name__ == "__main__":
    app = QApplication(sys.argv)

    # Definir fonte padrão
    fonte = QFont("Segoe UI", 10)
    app.setFont(fonte)

    # Splash Screen
    splash_pix = QPixmap(400, 300)
    splash_pix.fill(QColor("#ffffff"))
    splash = QSplashScreen(splash_pix)
    splash.show()

    app.processEvents()

    # Simular carregamento
    for i in range(1, 5):
        QTimer.singleShot(i * 300, lambda: None)
        app.processEvents()

    janela = LeadViewer()
    janela.show()
    splash.finish(janela)

    sys.exit(app.exec())