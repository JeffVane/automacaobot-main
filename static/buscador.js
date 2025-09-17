function iniciarBusca() {
    const termo = document.getElementById('termo').value;
    const limite = parseInt(document.getElementById('limite').value) || 50; // 🔥 Pega o limite definido no input

    const statusEl = document.getElementById('status-busca');
    const barra = document.getElementById('progresso-barra');
    const msg = document.getElementById('mensagem-status');
    const porcentagem = document.getElementById('progresso-porcentagem');
    const resultadoEl = document.getElementById('resultado');

    statusEl.style.display = 'block';
    barra.style.width = '0%';
    barra.classList.add('ativo'); // 🔥 Ativa o feixe
    porcentagem.innerText = '0%';
    msg.innerText = 'Iniciando busca...';
    resultadoEl.innerHTML = '';

    fetch('/api/iniciar-busca', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({termo: termo, limite: limite})
    });

    verificarStatus();
}


function verificarStatus() {
    const barra = document.getElementById('progresso-barra');
    const msg = document.getElementById('mensagem-status');
    const porcentagem = document.getElementById('progresso-porcentagem');
    const visaoEl = document.getElementById('lista-visao-atual');
    const resultadoEl = document.getElementById('resultado');

    const intervalo = setInterval(async () => {
        const res = await fetch('/api/status-busca');
        const data = await res.json();

        msg.innerText = data.mensagem;
        barra.style.width = data.progresso + '%';
        porcentagem.innerText = `${data.progresso}%`;

        // 🔥 Atualiza a lista do que está vendo
        if (data.parciais) {
            visaoEl.innerHTML = data.parciais.map(item => `
                <li>🏢 ${item.nome} — ${item.endereco}</li>
            `).join('');
        }

        if (data.status === 'concluido') {
            clearInterval(intervalo);
            msg.innerText = '✅ Busca finalizada!';
            barra.classList.remove('ativo');  // 🔥 Desativa o feixe
            exibirResultados(data.resultado);
        }

        if (data.status === 'erro') {
            clearInterval(intervalo);
            msg.innerText = '❌ ' + data.mensagem;
            barra.classList.remove('ativo');  // 🔥 Desativa o feixe
        }
    }, 1500);
}


function exibirResultados(lista) {
    const resultadoEl = document.getElementById('resultado');
    resultadoEl.innerHTML = lista.map((item, index) => `
        <div class="result-card fade-in" style="animation-delay: ${index * 0.1}s">
            <h3 class="result-title">
                <i class="fas fa-building"></i> ${item.nome}
            </h3>
            <div class="result-info">
                <div class="info-item">
                    <i class="fas fa-map-marker-alt info-icon"></i>
                    <span>${item.endereco}</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-phone info-icon"></i>
                    <span>${item.telefone}</span>
                </div>
                <div class="info-item">
                    <i class="fas fa-globe info-icon"></i>
                    <a href="${item.site}" target="_blank" class="info-link">${item.site}</a>
                </div>
            </div>
        </div>
    `).join('');
}

function verificarStatus() {
    const barra = document.getElementById('progresso-barra');
    const msg = document.getElementById('mensagem-status');
    const porcentagem = document.getElementById('progresso-porcentagem');
    const visaoEl = document.getElementById('lista-visao-atual');
    const resultadoEl = document.getElementById('resultado');

    const intervalo = setInterval(async () => {
        const res = await fetch('/api/status-busca');
        const data = await res.json();

        msg.innerText = data.mensagem;
        barra.style.width = data.progresso + '%';
        porcentagem.innerText = `${data.progresso}%`;

        // 🔥 Atualiza a lista do que está vendo
        if (data.parciais) {
            visaoEl.innerHTML = data.parciais.map(item => `
                <li>🏢 ${item.nome} — ${item.endereco}</li>
            `).join('');
        }

        if (data.status === 'concluido') {
            clearInterval(intervalo);
            msg.innerText = '✅ Busca finalizada!';
            exibirResultados(data.resultado);
        }

        if (data.status === 'erro') {
            clearInterval(intervalo);
            msg.innerText = '❌ ' + data.mensagem;
        }
    }, 1500);
}

function adicionarNovoContato() {
    const input = document.getElementById('novo-numero');
    const numero = input.value.trim();

    if (!numero || !/^\d{10,15}$/.test(numero)) {
        alert("Digite um número válido no formato internacional. Ex: 5511999999999");
        return;
    }

    // Evita duplicar se já estiver na lista
    if (!whatsappChatData[numero]) {
        whatsappChatData[numero] = {
            name: numero,  // você pode substituir por um nome real se tiver
            avatar: 'https://placehold.co/40x40/075e54/ffffff?text=WA',
            lastMessageSnippet: '',
            lastMessageTime: '',
            status: 'online',
            messages: []
        };
    }

    // Limpa campo e renderiza
    input.value = '';
    renderWhatsappSidebar();
    selecionarWhatsappCliente(numero);
}

