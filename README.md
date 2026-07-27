# TripTrack 🚗

**Seu diário de bordo digital.** Um web app leve (Flask + SQLite) para registrar viagens de moto ponto a ponto — odômetro, horários e abastecimentos — e calcular automaticamente distância, tempo, velocidade média, consumo (km/L) e custo por quilômetro.

Pensado para uso no celular durante a viagem, nas paradas: o servidor sobe em `0.0.0.0`, então dá para acessar direto do navegador do telefone.

---

## Funcionalidades

- **App instalável (PWA)** — instala na tela inicial do celular e **abre offline** (o app shell é cacheado por um service worker). _O registro totalmente offline com sincronização é a próxima fase._
- **Registro ponto a ponto** — cada parada guarda descrição, KM do odômetro, data+hora (capturada automaticamente do aparelho, editável), cidade/UF e, opcionalmente, litros abastecidos e valor gasto.
- **Cálculo automático de resumo** ao finalizar a viagem:
  - Distância total (KM final − KM inicial)
  - Tempo total (a partir da data+hora dos pontos; funciona em viagens multi-dia)
  - Velocidade média (km/h)
  - Total de litros abastecidos e total gasto (R$)
  - Consumo médio (km/L)
  - Custo médio (R$/km)
- **Viagem de Ida e Volta** — ao registrar uma "Volta", é possível vinculá-la a uma viagem de "Ida" anterior para obter um **resumo combinado** (ida + volta somadas, com médias recalculadas).
- **Histórico** — página dedicada listando todas as viagens salvas com seus resumos completos.

---

## Stack

| Camada    | Tecnologia                     |
|-----------|--------------------------------|
| Backend   | Python 3.11 + Flask 3          |
| ORM / DB  | Flask-SQLAlchemy + SQLite      |
| Frontend  | HTML + CSS + JavaScript (vanilla) |

Sem build step, sem framework de frontend — tudo servido diretamente pelo Flask.

---

## Como rodar localmente

Pré-requisito: **Python 3.10+**.

```bash
# 1. Clonar o repositório
git clone https://github.com/sergioguimas/trip-track.git
cd trip-track

# 2. Criar e ativar um ambiente virtual
python -m venv .venv
# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# Linux / macOS
source .venv/bin/activate

# 3. Instalar as dependências
pip install -r requirements.txt

# 4. Rodar o app
python app.py
```

O banco `trips.db` é criado automaticamente na primeira execução (`db.create_all()`).

Acesse em **http://localhost:5000**.

### Acessar pelo celular

O app roda em `host='0.0.0.0'`, então basta descobrir o IP local da máquina (ex.: `ipconfig` no Windows / `ip addr` no Linux) e acessar `http://SEU_IP:5000` pelo navegador do celular, com o telefone na mesma rede Wi‑Fi.

> ⚠️ `debug=True` está ligado no `app.py` — ótimo para desenvolvimento, mas **não use em produção**.

---

## Como usar

1. **Nova Viagem** — dê um nome (ex.: `Téo x Valadares (Ida)`) e escolha o tipo:
   - **Nova**: viagem independente.
   - **Volta**: selecione no dropdown a viagem de Ida correspondente para gerar o resumo combinado ao final.
2. **Registrar pontos de parada** — a cada parada, informe descrição, KM do odômetro e horário. Se abasteceu, preencha litros e valor.
   - São necessários **pelo menos 2 pontos** (início e fim) para finalizar.
3. **Finalizar Viagem** — o app calcula e exibe o resumo, salvando tudo no banco.
4. **Histórico** — acesse `/historico` para ver todas as viagens registradas.

---

## Estrutura do projeto

```
TripTrack/
├── app.py                    # Backend Flask: modelos, rotas e cálculos
├── requirements.txt          # Dependências Python
├── trips.db                  # Banco SQLite (gerado em runtime, fora do Git)
├── templates/
│   ├── index.html            # Página principal (registro de viagem)
│   └── historico.html        # Página de histórico
├── static/
│   ├── script.js             # Lógica da tela de registro
│   ├── historico.js          # Lógica da tela de histórico
│   ├── style.css             # Estilos
│   ├── sw.js                 # Service worker (PWA / cache do app shell)
│   ├── manifest.webmanifest  # Web App Manifest
│   └── icons/                # Ícones do PWA (192, 512, maskable)
├── docs/
│   ├── API.md                # Documentação dos endpoints e modelo de dados
│   └── ROADMAP.md            # Planejamento, requisitos e roadmap
├── .gitignore
└── LICENSE
```

Para detalhes dos endpoints e do modelo de dados, veja [`docs/API.md`](docs/API.md); para o planejamento, [`docs/ROADMAP.md`](docs/ROADMAP.md).

---

## Licença

Distribuído sob os termos do arquivo [LICENSE](LICENSE).
