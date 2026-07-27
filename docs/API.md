# TripTrack — Documentação da API e Modelo de Dados

Referência técnica dos endpoints HTTP e do esquema do banco. Base URL local: `http://localhost:5000`.

---

## Modelo de dados

O banco é SQLite (`trips.db`), gerenciado via Flask-SQLAlchemy. Duas tabelas com relação 1‑N.

### `Viagem`

Representa uma viagem e guarda o resumo já calculado no momento em que foi finalizada.

| Campo                       | Tipo     | Observações                                       |
|-----------------------------|----------|---------------------------------------------------|
| `id`                        | String   | Chave primária — **UUID** (permite geração no cliente para sync offline) |
| `nome`                      | String   | Obrigatório                                       |
| `data_inicio`               | DateTime | Data+hora do primeiro ponto                       |
| `data_fim`                  | DateTime | Data+hora do último ponto                         |
| `distancia_total`           | Float    | Em km                                             |
| `tempo_total_horas`         | Float    | Em horas                                          |
| `velocidade_media_kmh`      | Float    | km/h                                             |
| `total_litros_abastecidos`  | Float    | Litros                                            |
| `total_gasto_rs`            | Float    | R$                                                |
| `consumo_medio_kml`         | Float    | km/L                                              |
| `custo_medio_rskm`          | Float    | R$/km                                             |
| `updated_at`                | DateTime | Atualizado automaticamente (apoia o sync futuro)  |
| `pontos`                    | relação  | 1‑N com `Ponto` (cascade delete-orphan)          |

### `Ponto`

Cada parada registrada dentro de uma viagem.

| Campo         | Tipo     | Observações                                       |
|---------------|----------|---------------------------------------------------|
| `id`          | String   | Chave primária — **UUID**                         |
| `descricao`   | String   | Obrigatório                                       |
| `km`          | Float    | Obrigatório — leitura do odômetro                 |
| `datahora`    | DateTime | Obrigatório — data+hora completas (ISO 8601)      |
| `litros`      | Float    | Opcional — litros abastecidos no ponto            |
| `valor`       | Float    | Opcional — valor gasto (R$) no ponto              |
| `cidade`      | String   | Opcional — cidade da parada (databook)            |
| `uf`          | String   | Opcional — UF (2 letras)                          |
| `viagem_id`   | String   | Chave estrangeira → `Viagem.id` (UUID)            |

> As tabelas são criadas automaticamente na inicialização via `db.create_all()`.
> `datahora` completa (data+hora) substituiu o antigo `horario` `"HH:MM"`, o que corrige o cálculo de tempo em viagens multi-dia.

---

## Endpoints

### Páginas (HTML)

| Método | Rota          | Descrição                          |
|--------|---------------|------------------------------------|
| `GET`  | `/`           | Tela principal de registro de viagem |
| `GET`  | `/historico`  | Tela de histórico de viagens       |

### API (JSON)

#### `GET /api/viagens`

Lista simplificada de viagens, usada para popular o dropdown de "Viagem de Ida" ao registrar uma Volta. Ordenada da mais recente para a mais antiga.

**Resposta `200`:**
```json
[
  { "id": 3, "nome": "Téo x Valadares (Ida)" },
  { "id": 1, "nome": "Ida ao Aeroporto" }
]
```

---

#### `GET /api/historico_viagens`

Retorna **todas** as viagens com o resumo completo. Usada pela página de histórico.

**Resposta `200`:**
```json
[
  {
    "id": "4391cd2f-....-uuid",
    "nome": "Téo x Valadares (Ida)",
    "data_inicio": "2026-07-27T08:00:00",
    "data_fim": "2026-07-27T10:45:00",
    "distancia_total": 210.5,
    "tempo_total_horas": 2.75,
    "velocidade_media_kmh": 76.5,
    "total_litros_abastecidos": 15.2,
    "total_gasto_rs": 89.32,
    "consumo_medio_kml": 13.8,
    "custo_medio_rskm": 0.42
  }
]
```

---

#### `POST /api/finalizar_viagem`

Recebe os pontos de uma viagem, calcula o resumo, **persiste** a viagem e seus pontos, e retorna o resumo. Se um `ida_id` for informado, também calcula e retorna um resumo combinado (ida + volta).

**Corpo da requisição:**
```json
{
  "nome": "Téo x Valadares (Volta)",
  "ida_id": "4391cd2f-....-uuid",
  "pontos": [
    { "descricao": "T. Otoni (Início)", "km": 12540.5, "datahora": "2026-07-27T08:00", "litros": 0, "valor": 0, "cidade": "Teófilo Otoni", "uf": "MG" },
    { "descricao": "Posto BR",          "km": 12680.0, "datahora": "2026-07-27T09:30", "litros": 15.2, "valor": 89.32 },
    { "descricao": "Chegada",           "km": 12751.0, "datahora": "2026-07-27T10:45", "cidade": "Gov. Valadares", "uf": "MG" }
  ]
}
```

| Campo     | Obrigatório | Descrição                                                        |
|-----------|-------------|------------------------------------------------------------------|
| `nome`    | Não         | Nome da viagem (default: `"Viagem Sem Título"`)                  |
| `ida_id`  | Não         | UUID de uma `Viagem` de ida para gerar o resumo combinado       |
| `pontos`  | **Sim**     | Lista de pontos; **mínimo 2**. Cada ponto: `descricao`, `km`, `datahora` (ISO 8601) (obrigatórios), `litros`, `valor`, `cidade`, `uf` (opcionais). Se `datahora` vier vazia, o servidor usa a hora atual. |

**Resposta `200` (viagem simples):** objeto de resumo.
```json
{
  "distancia_total": 210.5,
  "tempo_total_horas": 2.75,
  "velocidade_media_kmh": 76.5,
  "total_litros_abastecidos": 15.2,
  "total_gasto_rs": 89.32,
  "consumo_medio_kml": 13.8,
  "custo_medio_rskm": 0.42
}
```

**Resposta `200` (com `ida_id` válido):** resumo da volta + combinado.
```json
{
  "resumo_volta": { "...": "resumo da viagem atual" },
  "resumo_combinado": {
    "distancia_total": 421.0,
    "tempo_total_horas": 5.5,
    "total_litros_abastecidos": 30.4,
    "total_gasto_rs": 178.64,
    "velocidade_media_kmh": 76.5,
    "consumo_medio_kml": 13.8,
    "custo_medio_rskm": 0.42
  }
}
```

**Erros:**
| Código | Quando                                          | Corpo                                        |
|--------|-------------------------------------------------|----------------------------------------------|
| `400`  | Menos de 2 pontos                               | `{ "erro": "Viagem precisa de pelo menos 2 pontos" }` |
| `500`  | Falha ao salvar (rollback automático)           | `{ "erro": "<mensagem>" }`                    |

---

## Regras de cálculo (`calcular_resumo`)

- **Distância** = `km` do último ponto − `km` do primeiro ponto.
- **Tempo** = diferença entre a `datahora` do último e do primeiro ponto. Como agora é data+hora completa, funciona para viagens de qualquer duração (inclusive multi-dia); se o resultado for negativo (pontos fora de ordem), assume 0.
- **Velocidade média** = distância ÷ tempo (0 se tempo ≤ 0).
- **Total de litros / gasto** = soma dos campos `litros` e `valor` de todos os pontos.
- **Consumo (km/L)** = distância ÷ total de litros (0 se litros = 0).
- **Custo (R$/km)** = total gasto ÷ distância (0 se distância = 0).

> Como distância e tempo usam apenas o primeiro e o último ponto, os pontos devem estar em ordem cronológica/crescente de KM.
