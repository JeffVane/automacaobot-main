// static/conversas.js

// Dados para chats e contatos
let whatsappChatData = {};

let currentWhatsappClient = null; // Cliente selecionado atualmente para a aba de conversas

// <<<< VARIÁVEIS ADICIONADAS PARA CONTROLE DE SCROLL E ATUALIZAÇÕES >>>>
let lastScrollPosition = 0;
let isUserScrolling = false;
let scrollTimeout;
let updateInterval = 5000; // Começa com 5 segundos
let missedUpdatesCount = 0;
let updateIntervalId = null;
// <<<< FIM ADICIONADAS >>>>

// <<<< ADICIONADO AQUI >>>>
/**
 * Normaliza números de telefone brasileiros para o formato E.164 (+55DD9XXXXXXXX).
 * Esta é uma versão simplificada para o frontend, focando no '9' e no '+'.
 * DEVE ser consistente com a normalização do backend.
 * @param {string} phoneNumber
 * @returns {string|null}
 */
function normalizePhoneNumberFrontend(phoneNumber) {
    if (!phoneNumber) {
        return null;
    }

    // 1. Remove todos os caracteres não numéricos
    let digitsOnly = phoneNumber.replace(/\D/g, '');
    console.log(`[normalizePhoneNumberFrontend] Digits Only: ${digitsOnly}`);

    // 2. Garante o DDI (+55 para Brasil)
    if (!digitsOnly.startsWith('55')) {
        // Se tem 10 ou 11 dígitos, assume que são DDD + Número e adiciona '55'
        // Ex: 11987654321 -> 5511987654321
        // Ex: 1187654321 -> 551187654321 (depois o '9' será adicionado se for o caso)
        if (digitsOnly.length === 10 || digitsOnly.length === 11) {
            digitsOnly = '55' + digitsOnly;
            console.log(`[normalizePhoneNumberFrontend] Adicionado '55': ${digitsOnly}`);
        } else {
            // Se não começa com '55' e não tem 10 ou 11 dígitos,
            // não é um número brasileiro típico. Retorna com '+' se tiver dígitos.
            console.warn(`[normalizePhoneNumberFrontend] Número não começa com '55' e não parece um número brasileiro de 10/11 dígitos. Original: ${phoneNumber}`);
            return digitsOnly ? `+${digitsOnly}` : null;
        }
    }

    // 3. Lógica para o 9º dígito em celulares brasileiros
    // Um celular brasileiro no formato E.164 tem 13 dígitos: +55 DD 9 XXXXXXXX
    // Se tem 12 dígitos (55 + DD + 8 dígitos) e não tem '9' na 5ª posição (índice 4), adiciona o '9'.
    // Ex: 556188898193 (12 dígitos) -> Insere '9' para virar 5561988898193 (13 dígitos)
    if (digitsOnly.length === 12 && digitsOnly.startsWith('55') && digitsOnly[4] !== '9') {
        digitsOnly = digitsOnly.substring(0, 4) + '9' + digitsOnly.substring(4);
        console.log(`[normalizePhoneNumberFrontend] '9' adicionado: ${digitsOnly}`);
    }

    // 4. Garante que o número final começa com '+'
    const finalNumber = `+${digitsOnly}`;
    console.log(`[normalizePhoneNumberFrontend] Final Normalizado: ${finalNumber}`);
    return finalNumber;
}
// <<<< FIM ADICIONADO AQUI >>>>

// <<<< FUNÇÕES ADICIONADAS PARA CONTROLE DE SCROLL >>>>
// Função para salvar posição do scroll
function salvarPosicaoScroll() {
    const chatContainer = document.getElementById('chat-messages-display');
    if (chatContainer) {
        lastScrollPosition = chatContainer.scrollTop;
    }
}

// Função para restaurar posição do scroll
function restaurarPosicaoScroll() {
    const chatContainer = document.getElementById('chat-messages-display');
    if (chatContainer && !isUserScrolling) {
        chatContainer.scrollTop = lastScrollPosition;
    }
}

// Detecta quando o usuário está rolando manualmente
function detectarScrollUsuario() {
    const chatContainer = document.getElementById('chat-messages-display');
    if (!chatContainer) return;

    chatContainer.addEventListener('scroll', () => {
        isUserScrolling = true;
        clearTimeout(scrollTimeout);

        // Para de considerar que o usuário está rolando após 1 segundo de inatividade
        scrollTimeout = setTimeout(() => {
            isUserScrolling = false;
        }, 1000);
    });
}

// Verifica se o usuário está no final do chat
function usuarioNoFinalDoChat() {
    const chatContainer = document.getElementById('chat-messages-display');
    if (!chatContainer) return false;

    const scrollTop = chatContainer.scrollTop;
    const scrollHeight = chatContainer.scrollHeight;
    const clientHeight = chatContainer.clientHeight;

    // Considera que está no final se estiver a menos de 100px do fim
    return (scrollTop + clientHeight >= scrollHeight - 100);
}

// Função para rolar para o final do chat
function scrollParaFinal() {
    const chatContainer = document.getElementById('chat-messages-display');
    if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}
// <<<< FIM FUNÇÕES ADICIONADAS >>>>

/**
 * Renderiza a lista de chats e contatos na barra lateral do WhatsApp.
 */
function renderWhatsappSidebar() {
    const chatListEl = document.getElementById('chat-list-whatsapp');
    const contactListEl = document.getElementById('contact-list-whatsapp');

    chatListEl.innerHTML = '';
    contactListEl.innerHTML = '';

    // 🔁 Obter apenas os chats com mensagens
    const chatsComMensagens = Object.entries(whatsappChatData)
        .filter(([_, data]) => data.messages && data.messages.length > 0)
        .sort((a, b) => {
            // Ordena pela data da última mensagem (mais recente primeiro)
            const ultimaA = a[1].messages[a[1].messages.length - 1]?.timestamp || 0;
            const ultimaB = b[1].messages[b[1].messages.length - 1]?.timestamp || 0;
            return Number(ultimaB) - Number(ultimaA);
        });

    // 🟢 Renderiza chats ordenados
    for (const [id, chat] of chatsComMensagens) {
        const li = document.createElement('li');
        li.dataset.clientId = id; // O ID aqui já deve ser o número normalizado
        if (id === currentWhatsappClient) {
            li.classList.add('active-chat');
        }
        li.onclick = () => selecionarWhatsappCliente(id);

        li.innerHTML = `
            <div class="client-avatar-chat">
                <img src="${chat.avatar}" alt="Avatar ${chat.name}">
            </div>
            <div class="chat-info">
                <h4 class="chat-name">${chat.name}</h4>
                <p class="last-message-snippet">${chat.lastMessageSnippet || ''}</p>
            </div>
            ${chat.unread > 0 ? `<span class="unread-badge">${chat.unread}</span>` : ''}
            <span class="message-time">${chat.lastMessageTime || ''}</span>
        `;

        chatListEl.appendChild(li);
    }

    // 👤 Renderiza contatos que ainda não possuem mensagens
    for (const id in whatsappChatData) {
        const contact = whatsappChatData[id];
        if (!contact.messages || contact.messages.length === 0) {
            const li = document.createElement('li');
            li.dataset.clientId = id; // O ID aqui já deve ser o número normalizado
            li.onclick = () => alert(`Clicou no contato: ${contact.name}`);
            li.innerHTML = `
                <div class="client-avatar-chat">
                    <img src="${contact.avatar}" alt="Avatar ${contact.name}">
                </div>
                <div class="chat-info">
                    <h4 class="chat-name">${contact.name}</h4>
                    <p class="last-message-snippet">${contact.status || ''}</p>
                </div>
                <button class="delete-btn" onclick="event.stopPropagation(); excluirContato('${id}')">
                    <i class="fas fa-trash-alt"></i>
                </button>
            `;
            contactListEl.appendChild(li);
        }
    }
}


// <<<< MODIFICADO AQUI >>>>
async function carregarMensagens(numero_original) { // Renomeado 'numero' para 'numero_original'
    const numero = normalizePhoneNumberFrontend(numero_original); // Normaliza o número recebido

    if (!numero) {
        console.error(`[carregarMensagens] Número inválido ou não normalizável: ${numero_original}. Abortando carregamento.`);
        return false; // Retorna false se não conseguiu carregar
    }

    try {
        console.log(`[carregarMensagens] Buscando mensagens para o número (normalizado): ${numero}`);
        const res = await fetch(`/api/mensagens?numero=${encodeURIComponent(numero)}`);
        const mensagens = await res.json();
        console.log(`[carregarMensagens] Mensagens recebidas para ${numero}:`, mensagens);

        // Inicializa se ainda não existir
        // A chave no whatsappChatData AGORA é o número normalizado
        whatsappChatData[numero] = whatsappChatData[numero] || {
            name: numero, // Melhorar isso depois para o nome do lead
            avatar: 'https://placehold.co/40x40/075e54/ffffff?text=WA',
            lastMessageSnippet: '',
            lastMessageTime: '',
            status: 'online',
            messages: [],
            unread: 0 // campo de mensagens não lidas
        };

        const mensagensAntigas = whatsappChatData[numero].messages || [];
        const novaQtd = mensagens.length;
        const antigaQtd = mensagensAntigas.length;

        whatsappChatData[numero].messages = mensagens;

        if (mensagens.length > 0) {
            const ultima = mensagens[mensagens.length - 1];
            whatsappChatData[numero].lastMessageSnippet = ultima.text;
            whatsappChatData[numero].lastMessageTime = new Date(Number(ultima.timestamp) * 1000).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            // 🛑 Verifica se há novas mensagens recebidas e o chat não está aberto
            if (novaQtd > antigaQtd && numero !== currentWhatsappClient) {
                const novasMensagens = mensagens.slice(antigaQtd); // só as novas
                const novasRecebidas = novasMensagens.filter(m => m.sender === 'received').length;

                if (novasRecebidas > 0) {
                    whatsappChatData[numero].unread = (whatsappChatData[numero].unread || 0) + novasRecebidas;
                }
            }
        }

        renderWhatsappSidebar();
        return novaQtd > antigaQtd; // Retorna true se teve novas mensagens
    } catch (e) {
        console.error('Erro ao carregar mensagens:', e);
        return false;
    }
}
// <<<< FIM MODIFICADO AQUI >>>>


/**
 * Seleciona um cliente na barra lateral e exibe suas mensagens.
 * @param {string} clientId
 */
async function selecionarWhatsappCliente(clientId_original) {
    const clientId = normalizePhoneNumberFrontend(clientId_original);
    if (!clientId) {
        console.error(`[selecionarWhatsappCliente] Número inválido ou não normalizável: ${clientId_original}. Abortando seleção.`);
        return;
    }

    currentWhatsappClient = clientId;
    console.log(`[selecionarWhatsappCliente] Cliente selecionado (normalizado): ${clientId}`);

    document.querySelectorAll('#chat-list-whatsapp li').forEach(li => li.classList.remove('active-chat'));
    const selectedLi = document.querySelector(`#chat-list-whatsapp li[data-client-id="${clientId}"]`);
    if (selectedLi) {
        selectedLi.classList.add('active-chat');
    }

    if (!whatsappChatData[clientId] || !whatsappChatData[clientId].messages || whatsappChatData[clientId].messages.length === 0) {
        await carregarMensagens(clientId);
    }

    const client = whatsappChatData[clientId];

    const chatHeader = document.getElementById('chat-main-header');
    chatHeader.innerHTML = `
        <div class="chat-partner-info">
            <div class="client-avatar-chat">
                <img src="${client.avatar}" alt="Avatar ${client.name}">
            </div>
            <div class="partner-details">
                <h3 id="chat-partner-name">${client.name}</h3>
                <p id="chat-partner-status" class="status-text">${client.status || 'online'}</p>
            </div>
        </div>
        <div class="header-action-icons">
            <i class="fas fa-trash" title="Excluir contato" onclick="excluirContato('${clientId}')"></i>
            <i class="fas fa-search"></i>
            <i class="fas fa-ellipsis-v"></i>
        </div>
    `;

    renderWhatsappMessages(clientId, { forceScrollBottom: true });

    // Zera o contador localmente e atualiza a barra lateral
    whatsappChatData[clientId].unread = 0;
    renderWhatsappSidebar();

    // >>> ADIÇÃO NECESSÁRIA PARA PERSISTÊNCIA NO BACKEND <<<
    // AVISAR AO SERVIDOR QUE AS MENSAGENS FORAM LIDAS
    try {
        await fetch('/api/marcar-como-lido', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero: clientId })
        });
        console.log(`[selecionarWhatsappCliente] Mensagens para ${clientId} marcadas como lidas no backend.`);
    } catch (e) {
        console.error('Erro ao marcar mensagens como lidas no backend:', e);
    }

    // <<<< ADICIONADO: Reset configurações ao trocar de conversa >>>>
    updateInterval = 3000;
    missedUpdatesCount = 0;
    isUserScrolling = false;
    // <<<< FIM ADICIONADO >>>>
}



/**
 * Renderiza as mensagens do cliente selecionado.
 * @param {string} clientId
 * @param {object} options
 */
function renderWhatsappMessages(clientId, options = {}) {
    console.log(`[renderWhatsappMessages] Iniciando renderização para ${clientId}. Opções:`, options);
    const chatMessagesDisplay = document.getElementById('chat-messages-display');

    // <<<< ADICIONADO: Salva posição do scroll antes de atualizar >>>>
    const wasAtBottom = usuarioNoFinalDoChat();
    if (!wasAtBottom && !isUserScrolling && !options.forceScrollBottom) {
        salvarPosicaoScroll();
    }
    // <<<< FIM ADICIONADO >>>>

    chatMessagesDisplay.innerHTML = '';

    const messages = whatsappChatData[clientId]?.messages || [];
    console.log(`[renderWhatsappMessages] Mensagens para renderizar:`, messages);

    messages.forEach(msg => {
        console.log('  Renderizando mensagem:', msg);
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message-bubble', msg.sender); // msg.sender deve ser 'sent' ou 'received'
        messageDiv.innerHTML = `
            <p>${msg.text}</p>
            <span class="timestamp">${formatarTimestamp(msg.timestamp)}</span>
        `;
        chatMessagesDisplay.appendChild(messageDiv);
    });

    // <<<< MODIFICADO: Scroll inteligente >>>>
    if (options.forceScrollBottom || wasAtBottom) {
        scrollParaFinal();
        console.log('[renderWhatsappMessages] Scrollando para o final.');
    } else if (!isUserScrolling) {
        restaurarPosicaoScroll();
        console.log('[renderWhatsappMessages] Restaurando posição do scroll.');
    } else {
        console.log('[renderWhatsappMessages] Usuário está rolando, mantendo posição atual.');
    }
    // <<<< FIM MODIFICADO >>>>
}

function formatarTimestamp(timestamp) {
    try {
        // Converte para número se vier como string
        const date = new Date(Number(timestamp) * 1000);
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        console.error('Erro ao formatar timestamp:', timestamp, e);
        return timestamp; // Se der erro, exibe o original
    }
}


// <<<< MODIFICADO AQUI >>>>
/**
 * Envia uma nova mensagem.
 */
async function enviarWhatsappMensagem() {
    if (!currentWhatsappClient) {
        alert('Selecione uma conversa para enviar a mensagem.');
        return;
    }

    const messageInput = document.getElementById('message-input');
    const messageText = messageInput.value.trim();

    // Normaliza o número antes de enviar para o backend
    const numero = normalizePhoneNumberFrontend(currentWhatsappClient); // Usa o número normalizado

    if (!numero) {
        alert('Número do cliente inválido para envio.');
        return;
    }

    if (messageText) {
        try {
            console.log(`[enviarWhatsappMensagem] Enviando mensagem para ${numero}: ${messageText}`);
            const res = await fetch('/api/enviar-mensagem-personalizada', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ numero, mensagem: messageText })
            });

            const resultado = await res.json();
            if (!res.ok) {
                console.error('Erro ao enviar:', resultado);
                alert(`Erro ao enviar mensagem: ${resultado.erro || 'Erro desconhecido.'}`);
                return;
            }

            console.log('[enviarWhatsappMensagem] Mensagem enviada com sucesso para o backend. Resposta:', resultado);

            // Atualiza interface localmente
            // Garante que o whatsappChatData[numero] existe com a chave normalizada
            whatsappChatData[numero] = whatsappChatData[numero] || { messages: [] };
            whatsappChatData[numero].messages.push({
                sender: 'sent',
                text: messageText,
                timestamp: Math.floor(Date.now() / 1000) // Timestamp atual em segundos UNIX
            });

            renderWhatsappMessages(numero, { forceScrollBottom: true }); // Garante que scrolla
            renderWhatsappSidebar(); // Pode precisar reordenar se houver novas mensagens
            messageInput.value = '';

            // <<<< ADICIONADO: Otimiza atualizações após envio >>>>
            updateInterval = 2000;
            missedUpdatesCount = 0;
            // <<<< FIM ADICIONADO >>>>

        } catch (err) {
            console.error('Erro na requisição de envio de mensagem:', err);
            alert('Erro ao se comunicar com o servidor.');
        }
    }
}
// <<<< FIM MODIFICADO AQUI >>>>

// <<<< ADICIONADO: Função otimizada de atualização >>>>
async function atualizarConversasPeriodicamente() {
    // Não atualiza se a página não está visível
    if (document.hidden) return;

    try {
        console.log('[atualizarConversasPeriodicamente] Buscando números para atualização...');
        const res = await fetch('/api/numeros');
        const numeros_brutos = await res.json();
        console.log('[atualizarConversasPeriodicamente] Números para atualização (brutos):', numeros_brutos);

        let hasNewMessages = false;

        for (const numero_bruto of numeros_brutos) {
            const numero = normalizePhoneNumberFrontend(numero_bruto);
            if (!numero) {
                console.warn(`[atualizarConversasPeriodicamente] Número inválido para atualização: ${numero_bruto}. Pulando.`);
                continue;
            }

            const hadNewMessages = await carregarMensagens(numero);
            if (hadNewMessages) hasNewMessages = true;

            // Atualiza o chat aberto se for esse número
            if (numero === currentWhatsappClient) {
                renderWhatsappMessages(numero); // Remove forceScrollBottom para usar lógica inteligente
                console.log(`[atualizarConversasPeriodicamente] Chat ativo ${numero} re-renderizado.`);
            }
        }

        // <<<< ADICIONADO: Ajusta intervalo baseado na atividade >>>>
        if (hasNewMessages) {
            updateInterval = Math.max(2000, updateInterval - 1000);
            missedUpdatesCount = 0;
        } else {
            missedUpdatesCount++;
            if (missedUpdatesCount >= 3) {
                updateInterval = Math.min(10000, updateInterval + 1000);
            }
        }
        // <<<< FIM ADICIONADO >>>>

        renderWhatsappSidebar();
    } catch (e) {
        console.error('Erro ao atualizar conversas periodicamente:', e);
    }
}

// <<<< ADICIONADO: Gerenciamento inteligente de atualizações >>>>
function gerenciarAtualizacoesPorVisibilidade() {
    function iniciarAtualizacoes() {
        if (updateIntervalId) return;
        updateIntervalId = setInterval(() => {
            // Verifica se deve atualizar baseado no intervalo dinâmico
            const now = Date.now();
            if (!window.lastUpdateCheck || now - window.lastUpdateCheck >= updateInterval) {
                window.lastUpdateCheck = now;
                atualizarConversasPeriodicamente();
            }
        }, 1000); // Verifica a cada 1s, mas só atualiza quando necessário
    }

    function pararAtualizacoes() {
        if (updateIntervalId) {
            clearInterval(updateIntervalId);
            updateIntervalId = null;
        }
    }

    // Escuta mudanças de visibilidade da página
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            pararAtualizacoes();
        } else {
            iniciarAtualizacoes();
            // Força uma atualização imediata quando a página volta a ficar ativa
            setTimeout(atualizarConversasPeriodicamente, 500);
        }
    });

    // Inicia as atualizações
    iniciarAtualizacoes();
}
// <<<< FIM ADICIONADO >>>>

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Inicializa a sidebar
    renderWhatsappSidebar();

    // <<<< ADICIONADO: Configura detecção de scroll do usuário >>>>
    detectarScrollUsuario();
    // <<<< FIM ADICIONADO >>>>

    // Adiciona evento de clique ao botão de enviar mensagem
    const sendButton = document.getElementById('send-message-button');
    if (sendButton) {
        sendButton.addEventListener('click', enviarWhatsappMensagem);
    }

    // Adiciona evento de keypress para enviar mensagem com Enter
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                enviarWhatsappMensagem();
            }
        });
    }

    // Adiciona evento de clique para o banner de notificação (apenas para fechar)
    const notificationCloseBtn = document.querySelector('.notification-close');
    if (notificationCloseBtn) {
        notificationCloseBtn.addEventListener('click', () => {
            document.querySelector('.notification-banner').style.display = 'none';
        });
    }

    // <<<< MODIFICADO: Sistema de atualizações otimizadas >>>>
    gerenciarAtualizacoesPorVisibilidade();
    // <<<< FIM MODIFICADO >>>>
});

// <<<< MODIFICADO AQUI >>>>
// Carregamento inicial dos clientes com mensagens existentes
fetch('/api/clientes-mensagens')
    .then(res => res.json())
    .then(async clientes_brutos => { // Renomeado para clientes_brutos
        console.log('[DOMContentLoaded] Clientes com mensagens existentes (brutas):', clientes_brutos);
        // Normaliza cada número antes de carregar as mensagens
        const clientes_normalizados = [];
        for (const numero_bruto of clientes_brutos) {
            const numero_normalizado = normalizePhoneNumberFrontend(numero_bruto);
            if (numero_normalizado) {
                clientes_normalizados.push(numero_normalizado);
                await carregarMensagens(numero_normalizado);
            } else {
                console.warn(`[DOMContentLoaded] Não foi possível normalizar o número para carregamento inicial: ${numero_bruto}`);
            }
        }
        renderWhatsappSidebar();
        if (clientes_normalizados.length > 0) {
            // Seleciona o primeiro cliente normalizado
            selecionarWhatsappCliente(clientes_normalizados[0]);
        }
    })
    .catch(err => console.error("Erro ao buscar clientes na inicialização:", err)); // Erro mais específico

// <<<< FIM MODIFICADO AQUI >>>>

// <<<< ADICIONADO AQUI (movido para global) >>>>
// A função excluirContato foi movida para fora de selecionarWhatsappCliente
// para ser definida uma única vez e acessível globalmente (ex: pelos botões da sidebar).
function excluirContato(numero) {
    if (confirm(`Deseja realmente excluir o contato ${numero}?`)) {
        // Garante que o número está normalizado ao enviar para o backend
        const numeroNormalizado = normalizePhoneNumberFrontend(numero);
        if (!numeroNormalizado) {
            alert('Erro: Não foi possível normalizar o número para exclusão.');
            return;
        }

        fetch('/api/excluir-contato', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero: numeroNormalizado }) // Envia o número normalizado
        })
        .then(res => res.json())
        .then(() => {
            delete whatsappChatData[numeroNormalizado]; // Remove da cache do frontend
            currentWhatsappClient = null;

            document.getElementById('chat-main-header').innerHTML = '';
            document.getElementById('chat-messages-display').innerHTML = '';

            renderWhatsappSidebar();
        })
        .catch(err => {
            console.error('Erro ao excluir contato:', err);
            alert('Erro ao excluir o contato.');
        });
    }
}
// <<<< FIM ADICIONADO AQUI >>>>