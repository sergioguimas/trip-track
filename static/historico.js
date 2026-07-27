document.addEventListener('DOMContentLoaded', () => {
    const listaHistorico = document.getElementById('lista-historico');

    /**
     * Busca as viagens na API e as renderiza na tela
     */
    async function carregarHistorico() {
        try {
            const response = await fetch('/api/historico_viagens');
            if (!response.ok) throw new Error('Falha ao carregar histórico');

            const viagens = await response.json();

            if (viagens.length === 0) {
                listaHistorico.innerHTML = '<p>Nenhuma viagem registrada ainda.</p>';
                return;
            }

            // Limpa o "Carregando..."
            listaHistorico.innerHTML = '';

            // Cria um card para cada viagem
            viagens.forEach(viagem => {
                const card = document.createElement('div');
                card.className = 'trip-card';
                
                // Formata os valores para exibição
                const gastoTotal = (viagem.total_gasto_rs || 0).toFixed(2);
                const custoKm = (viagem.custo_medio_rskm || 0).toFixed(2);

                // Data da viagem (a partir de data_inicio, se existir)
                const dataFmt = viagem.data_inicio
                    ? new Date(viagem.data_inicio).toLocaleDateString('pt-BR')
                    : "";
                const dataHtml = dataFmt ? `<p class="trip-data">${dataFmt}</p>` : "";

                card.innerHTML = `
                    <h3>${viagem.nome}</h3>
                    ${dataHtml}
                    <div class="resumo-dados">
                        <div><span>Distância Total:</span><span>${viagem.distancia_total} km</span></div>
                        <div><span>Tempo Total:</span><span>${viagem.tempo_total_horas} horas</span></div>
                        <div><span>Velocidade Média:</span><span>${viagem.velocidade_media_kmh} km/h</span></div>
                        <div><span>Combustível Total:</span><span>${viagem.total_litros_abastecidos} L</span></div>
                        <div><span>Gasto Total:</span><span>R$ ${gastoTotal}</span></div>
                        <div><span>Consumo Médio:</span><span>${viagem.consumo_medio_kml} km/L</span></div>
                        <div><span>Custo por KM:</span><span>R$ ${custoKm} / km</span></div>
                    </div>
                `;
                listaHistorico.appendChild(card);
            });

        } catch (error) {
            console.error("Erro ao carregar histórico:", error);
            listaHistorico.innerHTML = '<p style="color: #f87171;">Erro ao carregar o histórico de viagens.</p>';
        }
    }

    // --- Inicialização da Página ---
    carregarHistorico();
});