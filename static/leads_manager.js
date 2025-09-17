// static/leads_manager.js

/**
 * Função para normalizar números de telefone para o formato E.164 (+55DD9XXXXXXXX)
 * @param {string} phoneNumber - O número de telefone a ser normalizado.
 * @returns {string|null} O número normalizado ou null se inválido.
 */

let selectedTemplatesByUser = {};
let selectedLeadPhonesForBulk = new Set(); // NOVO: Conjunto para armazenar telefones para envio em massa
let bulkSelectedTemplate = null; // NOVO: Armazena o template selecionado para envio em massa

// static/leads_manager.js (adicione estas funções novas)

/**
 * Alterna a seleção de um lead individual para envio em massa.
 * @param {HTMLInputElement} checkbox - O elemento checkbox.
 * @param {string} phoneNumber - O número de telefone normalizado do lead.
 */
function toggleLeadSelection(checkbox, phoneNumber) {
    if (checkbox.checked) {
        selectedLeadPhonesForBulk.add(phoneNumber);
    } else {
        selectedLeadPhonesForBulk.delete(phoneNumber);
    }
    // console.log("Leads selecionados para massa:", Array.from(selectedLeadPhonesForBulk)); // Descomente para depurar
}

/**
 * Seleciona ou deseleciona todos os leads para envio em massa.
 * @param {HTMLInputElement} masterCheckbox - O checkbox mestre "Selecionar Todos".
 */
function toggleSelectAll(masterCheckbox) {
    const checkboxes = document.querySelectorAll('#pending-leads-list .lead-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.checked = masterCheckbox.checked;
        toggleLeadSelection(checkbox, checkbox.dataset.phone); // Atualiza o conjunto
    });
}

function normalizePhoneNumberFrontend(phoneNumber) {
    if (!phoneNumber) {
        return null;
    }

    // 1. Remove todos os caracteres não numéricos
    let digitsOnly = phoneNumber.replace(/\D/g, '');
    console.log(`[normalizePhoneNumberFrontend] Digits Only: ${digitsOnly}`);

    // 2. Garante o DDI (+55 para Brasil)
    if (!digitsOnly.startsWith('55')) {
        if (digitsOnly.length === 10 || digitsOnly.length === 11) {
            digitsOnly = '55' + digitsOnly;
            console.log(`[normalizePhoneNumberFrontend] Adicionado '55': ${digitsOnly}`);
        } else {
            console.warn(`[normalizePhoneNumberFrontend] Número sem +55: ${phoneNumber}. Normalização pode ser incompleta.`);
            return digitsOnly ? `+${digitsOnly}` : null;
        }
    }

    // 3. Lógica para o 9º dígito em celulares brasileiros
    if (digitsOnly.length === 12 && digitsOnly.startsWith('55') && digitsOnly[4] !== '9') {
        digitsOnly = digitsOnly.substring(0, 4) + '9' + digitsOnly.substring(4);
        console.log(`[normalizePhoneNumberFrontend] '9' adicionado: ${digitsOnly}`);
    }

    // 4. Garante que o número final começa com '+'
    const finalNumber = `+${digitsOnly}`;
    console.log(`[normalizePhoneNumberFrontend] Final Normalizado: ${finalNumber}`);
    return finalNumber;
}

// ====================================================================================
// NOVAS ADIÇÕES E MODIFICAÇÕES PARA SELEÇÃO DE TEMPLATE
// ====================================================================================

let availableTemplates = []; // Variável global para armazenar os modelos disponíveis

/**
 * Carrega os modelos de mensagem aprovados do backend e popula os seletores.
 */
/**
 * Carrega os modelos de mensagem aprovados do backend e popula os seletores.
 */
async function loadAvailableTemplates() {
    try {
        const response = await fetch('/api/whatsapp_templates');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        availableTemplates = await response.json();
        // console.log("Modelos de template carregados:", availableTemplates);

        // Preenche os seletores individuais nos cards de leads
        document.querySelectorAll('.template-select').forEach(selectElement => {
            const currentSelectedValue = selectElement.value;
            selectElement.innerHTML = '<option value="">Selecione um Template Padrão</option>';
            availableTemplates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.name;
                option.textContent = template.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                selectElement.appendChild(option);
            });

            const leadPhoneNumberId = selectElement.id.replace('template-select-', '');
            const leadPhoneNumber = '+' + leadPhoneNumberId;

            if (selectedTemplatesByUser[leadPhoneNumber]) {
                selectElement.value = selectedTemplatesByUser[leadPhoneNumber];
            } else if (currentSelectedValue) {
                selectElement.value = currentSelectedValue;
            }
        });

        // NOVO: Preenche o seletor de template para envio em massa
        const bulkSelectElement = document.getElementById('bulk-template-select');
        if (bulkSelectElement) {
            bulkSelectElement.innerHTML = '<option value="">Selecione um Template para Envio em Massa</option>';
            availableTemplates.forEach(template => {
                const option = document.createElement('option');
                option.value = template.name;
                option.textContent = template.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                bulkSelectElement.appendChild(option);
            });
            // Mantém a seleção anterior se houver
            if (bulkSelectedTemplate) {
                bulkSelectElement.value = bulkSelectedTemplate;
            }
        }


    } catch (error) {
        console.error('Erro ao carregar modelos de template:', error);
        alert('Erro ao carregar modelos de template. Alguns recursos podem não estar disponíveis.');
    }
}

/**
 * Função para carregar e exibir leads pendentes.
 */
async function loadPendingLeads() {
    const pendingLeadsListDiv = document.getElementById('pending-leads-list');
    const pendingLeadsCountBadge = document.getElementById('pending-leads-count'); // Badge no título da aba
    const tabPendingLeadsCountBadge = document.getElementById('tab-pending-leads-count'); // NOVO: Badge na barra de abas
    const noPendingLeadsMessage = document.getElementById('no-pending-leads-message');

    console.log(`[loadPendingLeads] pendingLeadsListDiv:`, pendingLeadsListDiv);
    console.log(`[loadPendingLeads] pendingLeadsCountBadge:`, pendingLeadsCountBadge);
    console.log(`[loadPendingLeads] tabPendingLeadsCountBadge:`, tabPendingLeadsCountBadge);
    console.log(`[loadPendingLeads] noPendingLeadsMessage:`, noPendingLeadsMessage);

    if (!pendingLeadsListDiv) {
        console.error("ERRO: Elemento 'pending-leads-list' não encontrado no DOM. Verifique seu ID no dashboard.html.");
        return;
    }
    if (!pendingLeadsCountBadge) {
        console.warn("AVISO: Elemento 'pending-leads-count' não encontrado. Contagem de leads pendentes (título) pode não ser atualizada.");
    }
    if (!tabPendingLeadsCountBadge) {
        console.warn("AVISO: Elemento 'tab-pending-leads-count' não encontrado. Contagem de leads pendentes (aba) pode não ser atualizada.");
    }

    pendingLeadsListDiv.innerHTML = '';

    try {
        const response = await fetch('/api/pending_leads');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const leads = await response.json();

        if (pendingLeadsCountBadge) {
            pendingLeadsCountBadge.textContent = leads.length;
        }
        if (tabPendingLeadsCountBadge) {
            tabPendingLeadsCountBadge.textContent = leads.length;
        }

        if (leads.length === 0) {
            if (noPendingLeadsMessage) {
                noPendingLeadsMessage.textContent = "Nenhum lead pendente no momento.";
                noPendingLeadsMessage.style.display = 'block';
                // noPendingLeadsMessage.remove() ou pendingLeadsListDiv.appendChild(noPendingLeadsMessage);
                // Dependendo de como você quer que ele persista no DOM.
            } else {
                pendingLeadsListDiv.innerHTML = '<p class="no-leads-message">Nenhum lead pendente no momento.</p>';
            }
        } else {
            leads.forEach(lead => {
                const leadCard = createLeadCard(lead, 'pending');
                pendingLeadsListDiv.appendChild(leadCard);
            });
            if (noPendingLeadsMessage) { // Certifica-se que a mensagem desapareça se houver leads
                 noPendingLeadsMessage.style.display = 'none';
            }
        }
        // CHAMAR loadAvailableTemplates AQUI PARA POPULAR OS NOVOS SELECTS
        await loadAvailableTemplates();

    } catch (error) {
        console.error('Erro ao carregar leads pendentes:', error);
        pendingLeadsListDiv.innerHTML = '<p class="error-message">Erro ao carregar leads pendentes. Tente novamente mais tarde.</p>';
        if (pendingLeadsCountBadge) {
            pendingLeadsCountBadge.textContent = '0';
        }
        if (tabPendingLeadsCountBadge) {
            tabPendingLeadsCountBadge.textContent = '0';
        }
    }
}

/**
 * Função para carregar e exibir todos os leads salvos.
 */
async function loadAllLeads() {
    const allLeadsListDiv = document.getElementById('all-leads-list');
    const noAllLeadsMessage = document.getElementById('no-all-leads-message');

    if (!allLeadsListDiv) {
        console.error("ERRO: Elemento 'all-leads-list' não encontrado no DOM. Verifique seu ID no dashboard.html.");
        return;
    }
    if (!noAllLeadsMessage) {
        console.warn("AVISO: Elemento 'no-all-leads-message' não encontrado no DOM. A mensagem de 'nenhum lead' pode não funcionar.");
    }

    allLeadsListDiv.innerHTML = '';
    if (noAllLeadsMessage) {
        noAllLeadsMessage.style.display = 'none';
    }

    try {
        const response = await fetch('/api/leads_salvos');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const leads = await response.json();

        if (leads.length === 0) {
            if (noAllLeadsMessage) {
                noAllLeadsMessage.textContent = "Nenhum lead salvo no sistema ainda.";
                noAllLeadsMessage.style.display = 'block';
            }
        } else {
            leads.forEach(lead => {
                const leadCard = createLeadCard(lead, 'all');
                allLeadsListDiv.appendChild(leadCard);
            });
            if (noAllLeadsMessage) {
                noAllLeadsMessage.style.display = 'none';
            }
        }
        // CHAMAR loadAvailableTemplates AQUI PARA POPULAR OS NOVOS SELECTS SE EXISTIREM EM CARDS 'ALL'
        // (Apenas se você decidir que cards 'all' também terão opção de enviar templates, o que é menos comum)
        // await loadAvailableTemplates(); // Removido por padrão, pode adicionar se for o caso.

    } catch (error) {
        console.error('Erro ao carregar todos os leads:', error);
        allLeadsListDiv.innerHTML = '<p class="error-message">Erro ao carregar histórico de leads. Tente novamente mais tarde.</p>';
        if (noAllLeadsMessage) {
            noAllLeadsMessage.style.display = 'none'; // Esconde a mensagem de "nenhum lead" se houver erro
        }
    }
}

/**
 * Atualiza o template selecionado para o envio em massa.
 * @param {string} templateName - O nome do template selecionado.
 */
function updateBulkTemplateSelection(templateName) {
    bulkSelectedTemplate = templateName;
    console.log("Template selecionado para envio em massa:", bulkSelectedTemplate);
}

/**
 * Envia o template selecionado em massa para todos os leads marcados.
 */
async function sendBulkWhatsAppTemplates() {
    if (selectedLeadPhonesForBulk.size === 0) {
        alert("Nenhum lead selecionado para envio em massa.");
        return;
    }

    if (!bulkSelectedTemplate) {
        alert("Por favor, selecione um template no seletor de envio em massa.");
        return;
    }

    if (!confirm(`Tem certeza que deseja enviar o template "${bulkSelectedTemplate}" para ${selectedLeadPhonesForBulk.size} leads selecionados?`)) {
        return;
    }

    const totalLeads = selectedLeadPhonesForBulk.size;
    let sentCount = 0;
    let failedCount = 0;

    // Desabilitar botões e mostrar feedback de progresso (opcional, mas recomendado)
    const sendButton = document.querySelector('.send-bulk-template-btn');
    const markButton = document.querySelector('.mark-bulk-contacted-btn');
    sendButton.disabled = true;
    if (markButton) markButton.disabled = true; // Desabilita também o de marcar como contatado

    // Mensagem de progresso temporária
    const originalSendButtonText = sendButton.innerHTML;
    sendButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enviando (0/${totalLeads})`;

    for (const phoneNumber of Array.from(selectedLeadPhonesForBulk)) {
        try {
            // Reutiliza a lógica de sendSelectedWhatsAppTemplate para cada número
            const leadCard = document.querySelector(`.lead-card[data-phone="${phoneNumber}"]`);
            const leadName = leadCard ? leadCard.querySelector('h3').textContent.replace('<i class="fas fa-building"></i> ', '').trim() : '';

            const response = await fetch('/api/enviar-template', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    numero: phoneNumber,
                    nome_lead: leadName,
                    template_name: bulkSelectedTemplate
                })
            });

            const result = await response.json();
            if (response.ok) {
                sentCount++;
                // Opcional: Remover o checkbox do lead contatado da seleção em massa após sucesso
                // selectedLeadPhonesForBulk.delete(phoneNumber);
                console.log(`Template '${bulkSelectedTemplate}' enviado para ${phoneNumber}`);
            } else {
                failedCount++;
                console.error(`Erro ao enviar template para ${phoneNumber}: ${result.erro || JSON.stringify(result)}`);
            }
        } catch (error) {
            failedCount++;
            console.error(`Erro de conexão ao enviar template para ${phoneNumber}:`, error);
        }
        sendButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Enviando (${sentCount}/${totalLeads})`;
        await new Promise(resolve => setTimeout(resolve, 200)); // Pequeno delay para não sobrecarregar
    }

    alert(`Envio em massa concluído!
    Sucessos: ${sentCount}
    Falhas: ${failedCount}`);

    // Limpar seleção e recarregar
    selectedLeadPhonesForBulk.clear();
    bulkSelectedTemplate = null; // Limpa o template selecionado para massa
    document.getElementById('master-checkbox').checked = false; // Desmarca o master checkbox
    document.getElementById('bulk-template-select').value = ''; // Reseta o seletor de template em massa

    await loadPendingLeads(); // Recarrega os leads pendentes para refletir as mudanças
    await loadAllLeads(); // Recarrega todos os leads, pois os contatados agora são "all"

    // Reabilitar botões
    sendButton.disabled = false;
    if (markButton) markButton.disabled = false;
    sendButton.innerHTML = originalSendButtonText;
}

/**
 * Marca todos os leads selecionados como contatados.
 */
async function markSelectedAsContacted() {
    if (selectedLeadPhonesForBulk.size === 0) {
        alert("Nenhum lead selecionado para marcar como contatado.");
        return;
    }

    if (!confirm(`Tem certeza que deseja marcar ${selectedLeadPhonesForBulk.size} leads selecionados como contatados e removê-los da fila de pendentes?`)) {
        return;
    }

    const totalLeads = selectedLeadPhonesForBulk.size;
    let successCount = 0;
    let failedCount = 0;

    // Desabilitar botões e mostrar feedback de progresso
    const sendButton = document.querySelector('.send-bulk-template-btn');
    const markButton = document.querySelector('.mark-bulk-contacted-btn');
    sendButton.disabled = true;
    if (markButton) markButton.disabled = true;

    const originalMarkButtonText = markButton.innerHTML;
    markButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Marcando (${successCount}/${totalLeads})`;

    for (const phoneNumber of Array.from(selectedLeadPhonesForBulk)) {
        try {
            const response = await fetch('/api/remove_pending_lead', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ telefone: phoneNumber })
            });

            const result = await response.json();
            if (response.ok) {
                successCount++;
                console.log(`Lead ${phoneNumber} marcado como contatado.`);
                delete selectedTemplatesByUser[phoneNumber]; // Limpa a seleção individual também
            } else {
                failedCount++;
                console.error(`Erro ao marcar ${phoneNumber} como contatado: ${result.erro || JSON.stringify(result)}`);
            }
        } catch (error) {
            failedCount++;
            console.error(`Erro de conexão ao marcar ${phoneNumber} como contatado:`, error);
        }
        markButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Marcando (${successCount}/${totalLeads})`;
        await new Promise(resolve => setTimeout(resolve, 50)); // Pequeno delay
    }

    alert(`Marcação em massa concluída!
    Sucessos: ${successCount}
    Falhas: ${failedCount}`);

    // Limpar seleção e recarregar
    selectedLeadPhonesForBulk.clear();
    bulkSelectedTemplate = null;
    document.getElementById('master-checkbox').checked = false;
    document.getElementById('bulk-template-select').value = '';

    await loadPendingLeads();
    await loadAllLeads();

    // Reabilitar botões
    sendButton.disabled = false;
    if (markButton) markButton.disabled = false;
    markButton.innerHTML = originalMarkButtonText;
}

/**
 * Cria um card de lead HTML.
 * @param {Object} lead - O objeto lead.
 * @param {string} type - Tipo de lista ('pending' para pendentes, 'all' para todos).
 * @returns {HTMLElement} O elemento do card de lead.
 */
/**
 * Cria um card de lead HTML.
 * ...
 */
function createLeadCard(lead, type) {
    const card = document.createElement('div');
    card.className = 'lead-card';
    card.setAttribute('data-name', (lead.nome || '').toLowerCase());
    card.setAttribute('data-address', (lead.endereco || '').toLowerCase());
    card.setAttribute('data-phone', (lead.telefone || '').toLowerCase());
    card.setAttribute('data-site', (lead.site || '').toLowerCase());
    card.setAttribute('data-category', (lead.categoria || '').toLowerCase());

    const hasPhoneNumber = lead.telefone && lead.telefone !== 'Telefone não encontrado' && lead.telefone.trim() !== '';

    // Gera um ID único para o seletor baseado no telefone normalizado
    const normalizedPhone = normalizePhoneNumberFrontend(lead.telefone);
    // IMPORTANTE: O `normalizePhoneNumberFrontend` deve retornar o número no formato E.164 (ex: +5511987654321)
    // Se ele não retornar o "+", certifique-se de que ele seja adicionado em algum lugar antes de usar no `data-phone`.
    // Para o ID HTML, removemos o "+", pois IDs não devem começar com caracteres especiais.
    const normalizedPhoneForId = normalizedPhone ? normalizedPhone.replace(/\D/g, '') : '';
    const selectId = `template-select-${normalizedPhoneForId}`;

    card.innerHTML = `
        <h3><i class="fas fa-building"></i> ${lead.nome}</h3>
        <p><i class="fas fa-map-marker-alt"></i> ${lead.endereco}</p>
        <p><i class="fas fa-phone"></i> ${lead.telefone || 'Telefone não encontrado'}</p>
        <p><i class="fas fa-globe"></i> ${lead.site ? `<a href="${lead.site}" target="_blank">${lead.site}</a>` : 'Site não disponível'}</p>
        <p><i class="fas fa-tag"></i> ${lead.categoria || 'Não especificado'}</p>
        <div class="actions">
            ${type === 'pending' && hasPhoneNumber ? `
                <div class="bulk-checkbox-container">
                    <input type="checkbox"
                           class="lead-checkbox"
                           data-phone="${normalizedPhone}"
                           ${selectedLeadPhonesForBulk.has(normalizedPhone) ? 'checked' : ''}
                           onclick="toggleLeadSelection(this, '${normalizedPhone}')">
                    <label>Selecionar para Envio em Massa</label>
                </div>

                <button class="action-btn whatsapp" onclick="openWhatsAppChat('${lead.telefone}', '${lead.nome}')">
                    <i class="fab fa-whatsapp"></i> Abrir WhatsApp (Manual)
                </button>
                <button class="action-btn custom-message-btn" onclick="openCustomMessageModal('${lead.telefone}', '${lead.nome}')">
                    <i class="fas fa-comment-dots"></i> Enviar Mensagem Personalizada
                </button>

                <div class="template-selector-group">
                    <select id="${selectId}" class="template-select" onchange="saveTemplateSelection('${lead.telefone}', this.value)">
                        <option value="">Selecione um Template Padrão</option>
                    </select>
                    <button class="action-btn send-template-btn" onclick="sendSelectedWhatsAppTemplate('${lead.telefone}', '${lead.nome}', '${selectId}')">
                        <i class="fas fa-paper-plane"></i> Enviar Template
                    </button>
                </div>

                <button class="action-btn view-all" onclick="markAsContacted('${lead.telefone}')">
                    <i class="fas fa-check-circle"></i> Marcar como Contatado
                </button>
            ` : (type === 'pending' ? '<p class="no-phone-message">Sem telefone para contato direto.</p>' : '')}
            ${type === 'all' ? `
                <button class="action-btn view-all" onclick="viewLeadDetails('${encodeURIComponent(lead.nome)}', '${encodeURIComponent(lead.endereco)}')">
                    <i class="fas fa-info-circle"></i> Detalhes
                </button>
            ` : ''}
        </div>
    `;
    return card;
}

/**
 * Salva a seleção do template de um lead no objeto global.
 * @param {string} phoneNumber - O número de telefone normalizado do lead.
 * @param {string} templateName - O nome do template selecionado.
 */
function saveTemplateSelection(phoneNumber, templateName) { // <<< ADICIONE ESTA NOVA FUNÇÃO >>>
    const normalizedPhone = normalizePhoneNumberFrontend(phoneNumber);
    if (normalizedPhone) {
        selectedTemplatesByUser[normalizedPhone] = templateName;
        // console.log(`[saveTemplateSelection] Seleção salva para ${normalizedPhone}: ${templateName}`); // Descomente para depurar
    }
}

/**
 * Abre o chat do WhatsApp diretamente no navegador.
 * Permite ao usuário editar e enviar manualmente.
 * @param {string} phoneNumber - O número de telefone no formato E.164.
 * @param {string} [leadName=''] - O nome do lead para personalizar a mensagem inicial.
 */
function openWhatsAppChat(phoneNumber, leadName = '') {
    const cleanedNumber = normalizePhoneNumberFrontend(phoneNumber);
    if (!cleanedNumber) {
        alert("Número de telefone inválido para abrir o WhatsApp.");
        return;
    }

    let message = '';
    if (leadName) {
        message = `Olá ${leadName},\n\nGostaria de apresentar nossos serviços da Bloco 244.`; // Ajustado o nome da empresa
    } else {
        message = 'Olá, tudo bem? Gostaria de apresentar nossos serviços da Bloco 244.'; // Ajustado o nome da empresa
    }

    const encodedMessage = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?phone=${cleanedNumber.replace('+', '')}&text=${encodedMessage}`, '_blank');
}

/**
 * Abre um modal (neste caso, um prompt simples) para o usuário digitar uma mensagem personalizada.
 * @param {string} phoneNumber - O número de telefone do lead.
 * @param {string} leadName - O nome do lead.
 */
function openCustomMessageModal(phoneNumber, leadName) {
    const defaultMessage = `Olá ${leadName},\n\nGostaria de apresentar nossos serviços da Bloco 244.`; // Ajustado o nome da empresa
    const message = prompt(`Edite a mensagem para ${leadName} (${phoneNumber}):`, defaultMessage);

    if (message !== null) {
        sendCustomWhatsAppMessage(phoneNumber, message);
    }
}

/**
 * Envia uma mensagem de texto livre personalizada via API do backend.
 * ATENÇÃO: A API do WhatsApp Business da Meta só permite texto livre dentro de 24h
 * após a última interação do usuário. Para primeiro contato, use templates.
 * @param {string} phoneNumber - O número de telefone do lead.
 * @param {string} message - A mensagem de texto livre a ser enviada.
 */
async function sendCustomWhatsAppMessage(phoneNumber, message) {
    const normalizedPhoneNumber = normalizePhoneNumberFrontend(phoneNumber);
    if (!normalizedPhoneNumber) {
        alert("Não foi possível enviar a mensagem: número de telefone inválido.");
        return;
    }

    try {
        const response = await fetch('/api/enviar-mensagem-personalizada', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                numero: normalizedPhoneNumber,
                mensagem: message
            })
        });

        const result = await response.json();
        if (response.ok) {
            alert('Mensagem personalizada enviada com sucesso! O lead foi movido da fila de pendentes.');
            await loadPendingLeads();
            await loadAllLeads();
        } else {
            alert(`Erro ao enviar mensagem personalizada: ${result.erro || 'Erro desconhecido.'}`);
        }
    } catch (error) {
        console.error('Erro ao enviar mensagem personalizada:', error);
        alert('Erro de conexão ao enviar mensagem personalizada. Verifique sua conexão ou o servidor.');
    }
}


/**
 * Envia um template de mensagem via WhatsApp API (Meta Business API).
 * @param {string} phoneNumber - O número de telefone do lead.
 * @param {string} [leadName=''] - O nome do lead para personalizar o template no backend.
 * @param {string} selectId - O ID do elemento <select> que contém o nome do template.
 */
async function sendSelectedWhatsAppTemplate(phoneNumber, leadName = '', selectId) {
    const selectElement = document.getElementById(selectId);
    const templateName = selectElement.value; // Pega o valor (nome do template) do seletor

    if (!templateName) {
        alert("Por favor, selecione um modelo de mensagem antes de enviar.");
        return;
    }

    if (!confirm(`Tem certeza que deseja enviar o template "${templateName}" para ${leadName || phoneNumber}?`)) {
        return;
    }

    const normalizedPhoneNumber = normalizePhoneNumberFrontend(phoneNumber);
    if (!normalizedPhoneNumber) {
        alert("Não foi possível enviar o template: número de telefone inválido.");
        return;
    }

    try {
        const response = await fetch('/api/enviar-template', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                numero: normalizedPhoneNumber,
                nome_lead: leadName,
                template_name: templateName // <<< ENVIANDO O NOME DO TEMPLATE ESCOLHIDO >>>
            })
        });

        const result = await response.json();
        if (response.ok) {
            alert(`Template '${templateName}' enviado com sucesso! O lead foi movido da fila de pendentes.`);
            // Limpa a seleção guardada para este lead, pois ele foi contatado
            delete selectedTemplatesByUser[normalizedPhoneNumber]; // <<< ADICIONE ESTA LINHA >>>

            await loadPendingLeads();
            await loadAllLeads();
        } else {
            alert(`Erro ao enviar template: ${result.erro || JSON.stringify(result)}`);
        }
    } catch (error) {
        console.error('Erro ao enviar template:', error);
        alert('Erro de conexão ao enviar template.');
    }
}


/**
 * Marca um lead como contatado, removendo-o da fila de pendentes.
 * @param {string} phoneNumber - O número de telefone do lead a ser removido.
 */
async function markAsContacted(phoneNumber) {
    if (!confirm(`Tem certeza que deseja marcar este lead (${phoneNumber}) como contatado e removê-lo da fila de pendentes?`)) {
        return;
    }

    const normalizedPhoneNumber = normalizePhoneNumberFrontend(phoneNumber);
    if (!normalizedPhoneNumber) {
        alert("Não foi possível marcar como contatado: número de telefone inválido.");
        return;
    }

    try {
        const response = await fetch('/api/remove_pending_lead', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ telefone: normalizedPhoneNumber })
        });

        const result = await response.json();
        if (response.ok) {
            alert('Lead marcado como contatado e removido da fila de pendentes.');
            // Limpa a seleção guardada para este lead
            delete selectedTemplatesByUser[normalizedPhoneNumber]; // <<< ADICIONE ESTA LINHA >>>

            await loadPendingLeads();
            await loadAllLeads();
        } else {
            alert(`Erro ao marcar como contatado: ${result.erro || JSON.stringify(result)}`);
        }
    } catch (error) {
        console.error('Erro ao marcar como contatado:', error);
        alert('Erro de conexão ao marcar como contatado.');
    }
}

/**
 * Função de filtro para leads.
 * @param {string} listId - O ID da div que contém a lista de leads (ex: 'pending-leads-list').
 * @param {string} searchTerm - O termo de busca para filtrar.
 */
function filterLeads(listId, searchTerm) {
    const listContainer = document.getElementById(listId);
    if (!listContainer) {
        console.error(`ERRO: O container de lista com ID "${listId}" não foi encontrado.`);
        return;
    }

    const leadCards = listContainer.getElementsByClassName('lead-card');
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    let foundLeads = 0;

    Array.from(leadCards).forEach(card => {
        const name = card.getAttribute('data-name');
        const address = card.getAttribute('data-address');
        const phone = card.getAttribute('data-phone');
        const site = card.getAttribute('data-site');
        const category = card.getAttribute('data-category');

        if (name.includes(lowerCaseSearchTerm) ||
            address.includes(lowerCaseSearchTerm) ||
            phone.includes(lowerCaseSearchTerm) ||
            site.includes(lowerCaseSearchTerm) ||
            category.includes(lowerCaseSearchTerm)) {
            card.style.display = 'flex';
            foundLeads++;
        } else {
            card.style.display = 'none';
        }
    });

    const noLeadsMessageId = listId === 'pending-leads-list' ? 'no-pending-leads-message' : 'no-all-leads-message';
    const noLeadsMessage = document.getElementById(noLeadsMessageId);

    if (!noLeadsMessage) {
        console.error(`ERRO: A mensagem "nenhum lead" com ID "${noLeadsMessageId}" não foi encontrada.`);
        return;
    }

    if (foundLeads === 0 && leadCards.length > 0) {
        noLeadsMessage.textContent = "Nenhum lead encontrado com este filtro.";
        noLeadsMessage.style.display = 'block';
    } else if (leadCards.length === 0) {
        noLeadsMessage.textContent = listId === 'pending-leads-list' ? "Nenhum lead pendente no momento." : "Nenhum lead salvo no sistema ainda.";
        noLeadsMessage.style.display = 'block';
    } else {
        noLeadsMessage.style.display = 'none';
    }
}

/**
 * Função para exibir detalhes de um lead (pode ser um modal ou nova aba).
 * @param {string} name - Nome do lead.
 * @param {string} address - Endereço do lead.
 */
function viewLeadDetails(name, address) {
    const decodedName = decodeURIComponent(name);
    const decodedAddress = decodeURIComponent(address);
    alert(`Detalhes do Lead:\nNome: ${decodedName}\nEndereço: ${decodedAddress}\n\n(Implementar exibição mais completa aqui!)`);
}

// Função para iniciar o polling
function startPolling() {
    const pollingInterval = 100000; // Intervalo de polling em milissegundos (5 segundos)

    setInterval(async () => {
        console.log("Polling: Verificando leads pendentes...");
        await loadPendingLeads(); // Esta função agora também recarrega os templates
    }, pollingInterval);
}

// Funções de inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
    const pendingLeadsCountBadge = document.getElementById('pending-leads-count');
    const tabPendingLeadsCountBadge = document.getElementById('tab-pending-leads-count');

    if (pendingLeadsCountBadge || tabPendingLeadsCountBadge) {
        fetch('/api/pending_leads')
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(leads => {
                const count = leads.length;
                if (pendingLeadsCountBadge) {
                    pendingLeadsCountBadge.textContent = count;
                }
                if (tabPendingLeadsCountBadge) {
                    tabPendingLeadsCountBadge.textContent = count;
                }
            })
            .catch(error => {
                console.error('Erro ao atualizar badge(s) de leads pendentes na inicialização:', error);
                if (pendingLeadsCountBadge) {
                    pendingLeadsCountBadge.textContent = 'Erro';
                }
                if (tabPendingLeadsCountBadge) {
                    tabPendingLeadsCountBadge.textContent = 'Erro';
                }
            });
    }

    startPolling();
    console.log("Polling iniciado para leads pendentes.");

    // Carregar leads pendentes e todos os leads ao carregar a página
    loadPendingLeads(); // Esta chamada já irá chamar loadAvailableTemplates() internamente
    loadAllLeads(); // Se os cards "all" também tiverem selects de template, adicione loadAvailableTemplates() aqui também
});