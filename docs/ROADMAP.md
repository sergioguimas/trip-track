# TripTrack — Planejamento, Requisitos e Roadmap

> Documento vivo. Registra a visão, a viabilidade técnica e o roadmap acordados.
> Última revisão: 2026-07-27.

## Visão

Diário de bordo digital **mobile-first** para registrar viagens de **moto** (uso pessoal, com possibilidade futura de abrir para outras pessoas). O registro acontece **durante a viagem, nas paradas** — muitas vezes **sem sinal de internet** — então o app precisa funcionar offline e sincronizar sozinho depois.

### Os 3 pilares (o porquê)

1. **Desempenho** — acompanhar tempo, velocidade média, distância, combustível (litros e R$) de cada viagem.
2. **Databook / histórico** — acervo do quanto já rodou: total de km, cidades por onde passou, totais acumulados.
3. **Evolução no tempo** — a velocidade média melhorou? o consumo caiu? está gastando mais ou menos tempo?

## Modelo de "viagem" (confirmado)

Uma **Viagem** é uma sequência ordenada de **Pontos**: o primeiro é a saída (A), o último é a chegada (B), e tudo no meio são paradas — **independente de quanto tempo dure** (pode ser multi-dia). Esse é o modelo que já existe; só precisa ser estendido, não reestruturado.

---

## Requisitos

### Funcionais

| # | Requisito | Pilar | Status |
|---|-----------|-------|--------|
| RF01 | Registrar viagem com nome e pontos ordenados (saída → paradas → chegada) | 1 | ✅ existe |
| RF02 | Cada ponto: descrição, KM, data+hora, cidade/UF, litros e valor (opcionais) | 1/2 | 🟡 estender |
| RF03 | Capturar automaticamente a data+hora do dispositivo a cada ponto (editável) | 1 | 🟡 parcial |
| RF04 | Calcular resumo (distância, tempo, vel. média, litros, gasto, km/L, R$/km) | 1 | ✅ existe |
| RF05 | Viagem de "Volta" vinculada a uma "Ida" com resumo combinado | 1 | ✅ existe |
| RF06 | Registrar viagem completa **offline** e sincronizar ao voltar a conexão | — | ❌ v1 |
| RF07 | Editar/remover ponto durante o registro | UX | ❌ v1 |
| RF08 | Databook: totais acumulados (km, viagens, cidades distintas, litros, R$, tempo) | 2 | ❌ |
| RF09 | Lista de cidades visitadas | 2 | ❌ |
| RF10 | Gráficos de evolução no tempo (velocidade, consumo, custo, tempo) | 3 | ❌ |
| RF11 | Comparativo "esta viagem vs sua média histórica" | 3 | ❌ |
| RF12 | Editar/excluir viagem já salva | UX | ❌ backlog |

### Não-funcionais

- **Mobile-first / PWA instalável** — abre pela tela inicial e funciona offline.
- **Offline-first no registro** — escrita local-primeiro (IndexedDB), sync automático.
- **Single-user** por ora (SQLite), arquitetado para virar multiusuário depois.
- **Sem dependências pesadas** — manter frontend vanilla; libs só onde pagam por si (IndexedDB, gráficos).

---

## Viabilidade técnica

### Mudanças no modelo de dados (fundação — habilita tudo)

**Buracos atuais que travam os pilares 2 e 3:**

1. `Viagem` **não tem data** → impossível plotar evolução no tempo (pilar 3). **Adicionar `data_inicio`/`data_fim`.**
2. `Ponto.horario` é texto `"HH:MM"` → cálculo de tempo quebra em viagens multi-dia. **Trocar por `datahora` (data+hora completa).**

**Esquema-alvo:**

- **Viagem**: `id` (UUID), `nome`, `data_inicio`, `data_fim`, campos de resumo (atuais), `updated_at`. *(futuro: `user_id`, `veiculo_id`)*
- **Ponto**: `id` (UUID), `descricao`, `km`, `datahora`, `litros`, `valor`, `cidade`, `uf`, `viagem_id` (FK).

**Decisão barata desde já:** usar **UUID** + `updated_at` nas tabelas mesmo antes do offline — torna a sincronização (idempotente via upsert por UUID) simples em vez de dolorosa. Requer uma migration dos dados de teste existentes.

### Arquitetura offline-first (v1)

- **Recorte:** offline vale para o **caminho de escrita (registro)**. Databook e evolução (leitura) podem ser online-first.
- **Service worker + manifest** → app instalável e app shell abre offline.
- **IndexedDB** como fonte local: toda escrita vai primeiro pro dispositivo; cada viagem nasce `sync_status: pendente`. *(avaliar lib `idb`/`Dexie` para sanidade sobre a API crua.)*
- **Sync automático** no evento `online` (e/ou Background Sync API): envia pendentes ao `/api/finalizar_viagem`, tornado **idempotente** (upsert por UUID). Marca como sincronizado.
- **Resumo instantâneo offline:** replicar `calcular_resumo` em JS para feedback imediato; servidor recalcula como fonte-da-verdade no sync (devem bater).
- **Conflitos:** mínimos — single-user, viagens só são criadas; UUID resolve reenvios/duplicatas.
- **Ida+Volta combinada offline:** computar client-side ou adiar o combinado até o sync (decisão de implementação).

### Riscos / decisões em aberto

- Duplicação da lógica de cálculo (JS + Python): mitigar mantendo o servidor autoritativo e o client como provisório.
- IndexedDB cru vs lib (`idb`/`Dexie`): decidir na Fase 2.
- Estratégia de migration dos dados de teste atuais (sem data): definir placeholder ou descartar.

---

## Roadmap

### v1 — "Usável na estrada" (MVP)
Meta: instalar no celular, **registrar uma viagem completa offline**, sincronizar sozinho ao voltar o sinal, ver resumo e histórico.

- **Fase 0 — Higiene**
  - Corrigir bug do dropdown de "Volta" (`static/script.js:254` — chamada fora do escopo do `DOMContentLoaded`)
  - Tratar `ida_id` inválido com aviso (hoje é ignorado em silêncio)
  - Corrigir README (moto/veículo, não carro)
- **Fase 1 — Fundação de dados**
  - `data_inicio`/`data_fim` na Viagem
  - `datahora` (data+hora) no Ponto + captura automática do dispositivo
  - `cidade`/`uf` no Ponto (manual)
  - UUID + `updated_at` + migration dos dados existentes
- **Fase 2 — Offline-first do registro**
  - Manifest + service worker (instalável, shell offline)
  - IndexedDB (escrita local-primeiro) + resumo calculado em JS
  - Sync automático + endpoint idempotente
  - Editar/remover ponto durante o registro (RF07)

### v1.1 — Evolução (pilar 3)
- Gráficos de tendência (velocidade, consumo, custo/km, tempo)
- Comparativo "esta viagem vs média histórica"

### v1.2 — Databook (pilar 2)
- Painel de agregados (km total, nº viagens, cidades distintas, litros/R$, tempo na estrada)
- Lista de cidades visitadas

### Backlog / futuro
- Editar/excluir viagem salva (RF12)
- Geolocalização assistindo marcações (autopreencher cidade via reverse-geocode)
- Mapa da trajetória
- "Hall da Fama" de destaques
- Multiusuário (auth, `user_id`, provável migração SQLite → Postgres) e abertura para outras pessoas

---

## Ideias em aberto (a encaixar)
- _(reservado para: metas de consumo, alertas, exportar dados, categorias de viagem, clima, etc. — a definir)_
