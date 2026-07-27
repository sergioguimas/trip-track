// Aguarda o HTML ser totalmente carregado
document.addEventListener('DOMContentLoaded', () => {

    // --- Variáveis Globais ---
    let currentTrip = {
        nome: "",
        pontos: []
    };

    let viagensAnteriores = [];

    // --- Seletores de Seções ---
    const secaoIniciar = document.getElementById('secao-iniciar');
    const secaoRegistro = document.getElementById('secao-registro');
    const secaoResumo = document.getElementById('secao-resumo');

    // --- Seletores de Elementos ---
    const btnIniciarViagem = document.getElementById('btn-iniciar-viagem');
    const inputNomeViagem = document.getElementById('nome-viagem');
    const tituloViagemAtual = document.getElementById('titulo-viagem-atual');
    const formPontoParada = document.getElementById('form-ponto-parada');
    const listaPontos = document.getElementById('lista-pontos');
    const btnFinalizarViagem = document.getElementById('btn-finalizar-viagem');
    const resumoConteudo = document.getElementById('resumo-conteudo');
    const btnNovaViagem = document.getElementById('btn-nova-viagem');

    const radiosTipoViagem = document.querySelectorAll('input[name="tipo-viagem"]');
    const blocoVolta = document.getElementById('bloco-volta');
    const selectViagemVolta = document.getElementById('select-viagem-volta');
    const inputDescricaoPonto = document.getElementById('ponto-descricao');

    async function carregarViagensAnteriores() {
    try {
        const response = await fetch('/api/viagens');
        if (!response.ok) throw new Error('Falha ao buscar viagens');

        viagensAnteriores = await response.json();

        selectViagemVolta.innerHTML = '<option value="">Selecione a viagem de ida...</option>';
        if (viagensAnteriores.length === 0) {
            selectViagemVolta.innerHTML = '<option value="">Nenhuma viagem anterior encontrada</option>';
        }

        viagensAnteriores.forEach(viagem => {
            const option = document.createElement('option');
            option.value = viagem.id;
            option.textContent = viagem.nome;
            selectViagemVolta.appendChild(option);
        });

        } catch (error) {
            console.error("Erro ao carregar viagens anteriores:", error);
            // Desabilita a opção 'Volta' se falhar
            document.getElementById('tipo-volta').disabled = true;
            document.querySelector('label[for="tipo-volta"]').textContent = "Volta (Indisponível)";
        }
    }

    // Popula o dropdown de "Volta" assim que a página carrega
    carregarViagensAnteriores();

    // --- Event Listeners ---

    // Botão: Iniciar Viagem
    btnIniciarViagem.addEventListener('click', () => {
        const nome = inputNomeViagem.value.trim();
        if (nome === "") {
            alert("Por favor, dê um nome para a viagem.");
            return;
        }
        
        currentTrip.nome = nome;
        tituloViagemAtual.textContent = `Viagem Atual: ${nome}`;
        
        // Limpa o input de descrição do ponto para um novo início
        document.getElementById('ponto-descricao').value = "Início";

        // Alterna as seções visíveis
        secaoIniciar.classList.add('hidden');
        secaoRegistro.classList.remove('hidden');
        secaoResumo.classList.add('hidden');
    });

    // Formulário: Adicionar Ponto de Parada
    formPontoParada.addEventListener('submit', (e) => {
        e.preventDefault(); // Impede o envio real do formulário

        const descricao = inputDescricaoPonto.value;
        const km = parseFloat(document.getElementById('ponto-km').value);
        const litros = parseFloat(document.getElementById('ponto-litros').value) || 0;
        const valor = parseFloat(document.getElementById('ponto-valor').value) || 0;

        // (NOVO) Pega o horário customizado
        const horarioCustom = document.getElementById('ponto-horario').value;

        if (descricao === "" || isNaN(km)) {
            alert("Descrição e KM são obrigatórios.");
            return;
        }

        // (NOVO) Lógica do Horário
        let horario;
        if (horarioCustom) {
            horario = horarioCustom; // Usa o horário do input "HH:MM"
        } else {
            // Se o input estiver vazio, pega o horário atual
            const agora = new Date();
            horario = agora.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        const ponto = { descricao, km, horario, litros, valor };
        currentTrip.pontos.push(ponto);
        renderizarPontos();

        // Limpa o formulário
        inputDescricaoPonto.value = "";
        document.getElementById('ponto-litros').value = "";
        document.getElementById('ponto-valor').value = "";
        document.getElementById('ponto-horario').value = ""; // (NOVO) Limpa o horário
        inputDescricaoPonto.focus(); // Foca na descrição para o próximo ponto
    });

    // (NOVO) Controla a exibição do dropdown de "Volta"
    radiosTipoViagem.forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (e.target.value === 'volta') {
                blocoVolta.classList.remove('hidden');
            } else {
                blocoVolta.classList.add('hidden');
            }
        });
    });

    // Botão: Finalizar Viagem
    btnFinalizarViagem.addEventListener('click', async () => {
        if (currentTrip.pontos.length < 2) {
            alert("Você precisa de pelo menos 2 pontos (início e fim) para finalizar.");
            return;
        }
        if (!confirm("Tem certeza que deseja finalizar esta viagem?")) {
            return;
        }

        try {
            // O objeto 'currentTrip' já contém o nome e todos os pontos
            const response = await fetch('/api/finalizar_viagem', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentTrip)
            });

            const resumo = await response.json();
            if (!response.ok) throw new Error(resumo.erro || "Erro desconhecido");

            // Se deu tudo certo, mostra o resumo
            mostrarResumo(resumo);

        } catch (error) {
            console.error("Erro ao finalizar viagem:", error);
            alert(`Não foi possível finalizar a viagem: ${error.message}`);
        }
    });

    // Botão: Registrar Nova Viagem (na tela de resumo)
    btnNovaViagem.addEventListener('click', () => {
        // Reseta tudo
        currentTrip = { nome: "", pontos: [] };
        inputNomeViagem.value = "";
        listaPontos.innerHTML = "";
        resumoConteudo.innerHTML = "";
        formPontoParada.reset();

        // (NOVO) Recarrega as viagens (para o caso da que acabamos de salvar)
        carregarViagensAnteriores(); 

        // Alterna as seções
        secaoIniciar.classList.remove('hidden');
        secaoRegistro.classList.add('hidden');
        secaoResumo.classList.add('hidden');
    });

    // --- Funções Auxiliares ---

    // Atualiza a lista de pontos no HTML
    function renderizarPontos() {
        listaPontos.innerHTML = ""; // Limpa a lista

        currentTrip.pontos.forEach(ponto => {
            const li = document.createElement('li');
            
            let abastecimentoHtml = "";
            if (ponto.litros > 0 || ponto.valor > 0) {
                abastecimentoHtml = `
                    <span class="abastecimento">
                        +${ponto.litros.toFixed(2)}L / R$ ${ponto.valor.toFixed(2)}
                    </span>
                `;
            }

            li.innerHTML = `
                <strong>${ponto.descricao}</strong> (${ponto.horario})
                <br>
                ${ponto.km.toFixed(1)} km
                ${abastecimentoHtml}
            `;
            listaPontos.appendChild(li);
        });

        // Rola a lista para o final
        listaPontos.scrollTop = listaPontos.scrollHeight;
    }

    // Preenche a seção de resumo com os dados do backend
    function mostrarResumo(resumo) {
        const avisoHtml = resumo.aviso
            ? `<p class="aviso">⚠️ ${resumo.aviso}</p>`
            : "";
        resumoConteudo.innerHTML = avisoHtml + `
            <div>
                <span>Distância Total:</span>
                <span>${resumo.distancia_total} km</span>
            </div>
            <div>
                <span>Tempo Total:</span>
                <span>${resumo.tempo_total_horas} horas</span>
            </div>
            <div>
                <span>Velocidade Média:</span>
                <span>${resumo.velocidade_media_kmh} km/h</span>
            </div>
            <div>
                <span>Combustível Total:</span>
                <span>${resumo.total_litros_abastecidos} L</span>
            </div>
            <div>
                <span>Gasto Total:</span>
                <span>R$ ${resumo.total_gasto_rs.toFixed(2)}</span>
            </div>
            <div>
                <span>Consumo Médio:</span>
                <span>${resumo.consumo_medio_kml} km/L</span>
            </div>
            <div>
                <span>Custo por KM:</span>
                <span>R$ ${resumo.custo_medio_rskm.toFixed(2)} / km</span>
            </div>
        `;

        // Alterna as seções
        secaoIniciar.classList.add('hidden');
        secaoRegistro.classList.add('hidden');
        secaoResumo.classList.remove('hidden');
    }

});