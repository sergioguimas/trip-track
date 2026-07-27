import os
import uuid
from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime


def gerar_uuid():
    """ID gerado no servidor. Como o cliente também poderá gerar o UUID
    (registro offline), a sincronização vira um upsert idempotente por id."""
    return str(uuid.uuid4())

# --- Configuração do App e DB ---
basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__,
            static_folder='static',
            template_folder='templates')

# Configura o banco de dados SQLite
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'trips.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Inicializa a extensão SQLAlchemy
db = SQLAlchemy(app)

# --- Modelos do Banco de Dados ---

class Viagem(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=gerar_uuid)
    nome = db.Column(db.String(200), nullable=False)

    # Janela temporal da viagem (derivada do primeiro e do último ponto)
    data_inicio = db.Column(db.DateTime)
    data_fim = db.Column(db.DateTime)

    # Dados do Resumo
    distancia_total = db.Column(db.Float)
    tempo_total_horas = db.Column(db.Float)
    velocidade_media_kmh = db.Column(db.Float)
    total_litros_abastecidos = db.Column(db.Float)
    total_gasto_rs = db.Column(db.Float)
    consumo_medio_kml = db.Column(db.Float)
    custo_medio_rskm = db.Column(db.Float)

    # Controle de sincronização (facilita o sync offline futuro)
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)

    # Relacionamento
    pontos = db.relationship('Ponto', backref='viagem', lazy=True, cascade="all, delete-orphan")

    def to_dict_lista(self):
        # Converte o objeto para um dicionário (para enviar ao JS)
        return {
            "id": self.id,
            "nome": self.nome,
        }
    def to_dict_completo(self):
        """ (NOVO) Retorna todos os dados de resumo da viagem (usado no Histórico) """
        return {
            "id": self.id,
            "nome": self.nome,
            "data_inicio": self.data_inicio.isoformat() if self.data_inicio else None,
            "data_fim": self.data_fim.isoformat() if self.data_fim else None,
            "distancia_total": self.distancia_total,
            "tempo_total_horas": self.tempo_total_horas,
            "velocidade_media_kmh": self.velocidade_media_kmh,
            "total_litros_abastecidos": self.total_litros_abastecidos,
            "total_gasto_rs": round(self.total_gasto_rs or 0, 2),
            "consumo_medio_kml": self.consumo_medio_kml,
            "custo_medio_rskm": round(self.custo_medio_rskm or 0, 2)
        }

class Ponto(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=gerar_uuid)
    descricao = db.Column(db.String(200), nullable=False)
    km = db.Column(db.Float, nullable=False)
    datahora = db.Column(db.DateTime, nullable=False)  # data + hora completas
    litros = db.Column(db.Float)
    valor = db.Column(db.Float)
    cidade = db.Column(db.String(100))
    uf = db.Column(db.String(2))

    # Chave Estrangeira
    viagem_id = db.Column(db.String(36), db.ForeignKey('viagem.id'), nullable=False)

# --- Rotas da Aplicação ---

@app.route('/')
def index():
    # Carrega a página principal
    return render_template('index.html')

@app.route('/sw.js')
def service_worker():
    # Servido a partir da raiz para que o escopo do SW seja '/' (controla todo o app)
    resp = send_from_directory(app.static_folder, 'sw.js')
    resp.headers['Content-Type'] = 'application/javascript'
    resp.headers['Service-Worker-Allowed'] = '/'
    resp.headers['Cache-Control'] = 'no-cache'  # sempre revalida o SW
    return resp

@app.route('/api/viagens', methods=['GET'])
def get_viagens():
    # (ESTA É A NOVA ROTA)
    # Retorna a lista de viagens anteriores para o dropdown 'Volta'
    try:
        viagens = Viagem.query.order_by(Viagem.data_inicio.desc()).all()
        # Retorna uma lista simples de dicionários
        return jsonify([v.to_dict_lista() for v in viagens])
    except Exception as e:
        print(f"Erro ao buscar viagens: {e}")
        return jsonify({"erro": str(e)}), 500

@app.route('/api/finalizar_viagem', methods=['POST'])
def finalizar_viagem():
    # (ESTA ROTA FOI ATUALIZADA)
    # Recebe os dados, calcula o resumo e SALVA no DB
    try:
        data = request.json
        pontos_data = data.get('pontos', [])
        nome_viagem = data.get('nome', 'Viagem Sem Título')
        ida_id = data.get('ida_id')

        if len(pontos_data) < 2:
            return jsonify({"erro": "Viagem precisa de pelo menos 2 pontos"}), 400

        # 0. Normaliza a data+hora de cada ponto (ISO 8601 -> datetime)
        for p_data in pontos_data:
            p_data['datahora'] = parse_datahora(p_data.get('datahora'))

        # 1. Calcular o resumo
        resumo_volta = calcular_resumo(pontos_data)

        # 2. Criar o objeto Viagem com o resumo (nome + janela temporal)
        nova_viagem = Viagem(
            nome=nome_viagem,
            data_inicio=pontos_data[0]['datahora'],
            data_fim=pontos_data[-1]['datahora'],
            **resumo_volta
        )

        # 3. Adicionar os Pontos à Viagem
        for p_data in pontos_data:
            novo_ponto = Ponto(
                descricao=p_data['descricao'],
                km=p_data['km'],
                datahora=p_data['datahora'],
                litros=p_data.get('litros', 0),
                valor=p_data.get('valor', 0),
                cidade=(p_data.get('cidade') or None),
                uf=(p_data.get('uf') or None),
                viagem=nova_viagem # Associa o ponto à viagem
            )
            db.session.add(novo_ponto)

        # 4. Salvar tudo no banco de dados
        db.session.add(nova_viagem)
        db.session.commit()

       # 5. (NOVO) Lógica para Resumo Combinado
        if ida_id:
           viagem_ida = Viagem.query.get(ida_id)
           if viagem_ida:
               # Soma os totais
               dist_total = (viagem_ida.distancia_total or 0) + resumo_volta['distancia_total']
               tempo_total = (viagem_ida.tempo_total_horas or 0) + resumo_volta['tempo_total_horas']
               litros_total = (viagem_ida.total_litros_abastecidos or 0) + resumo_volta['total_litros_abastecidos']
               gasto_total = (viagem_ida.total_gasto_rs or 0) + resumo_volta['total_gasto_rs']
               
               # Recalcula as médias
               vel_media_comb = round(dist_total / tempo_total, 1) if tempo_total > 0 else 0
               kml_comb = round(dist_total / litros_total, 1) if litros_total > 0 else 0
               rskm_comb = round(gasto_total / dist_total, 2) if dist_total > 0 else 0

               resumo_combinado = {
                   "distancia_total": round(dist_total, 2),
                   "tempo_total_horas": round(tempo_total, 2),
                   "total_litros_abastecidos": round(litros_total, 2),
                   "total_gasto_rs": round(gasto_total, 2),
                   "velocidade_media_kmh": vel_media_comb,
                   "consumo_medio_kml": kml_comb,
                   "custo_medio_rskm": rskm_comb
               }
               
               return jsonify({
                   "resumo_volta": resumo_volta,
                   "resumo_combinado": resumo_combinado
               })
           else:
               # ida_id informado mas inexistente: avisa em vez de ignorar em silêncio
               resumo_volta['aviso'] = f"Viagem de ida (id {ida_id}) não encontrada; resumo combinado não gerado."

        # 5. Retornar o resumo para o frontend
        return jsonify(resumo_volta)

    except Exception as e:
        db.session.rollback() # Desfaz qualquer mudança em caso de erro
        print(f"Erro ao salvar viagem: {e}")
        return jsonify({"erro": str(e)}), 500
    
@app.route('/historico')
def historico():
    """ (NOVA ROTA) Página que mostra o histórico de viagens """
    return render_template('historico.html')

# --- API Endpoints ---
@app.route('/api/historico_viagens', methods=['GET'])
def get_historico_viagens():
    """ (NOVA API) Retorna TODAS as viagens com resumos completos """
    try:
        viagens = Viagem.query.order_by(Viagem.data_inicio.desc()).all()
        # Usa o novo método 'to_dict_completo'
        return jsonify([v.to_dict_completo() for v in viagens])
    except Exception as e:
        print(f"Erro ao buscar histórico: {e}")
        return jsonify({"erro": str(e)}), 500    
    
# --- Helpers ---
def parse_datahora(valor):
    """Converte a data+hora recebida do frontend (ISO 8601, ex.: '2026-07-27T14:30')
    em datetime. Se vier vazia, usa o horário atual do servidor como fallback."""
    if not valor:
        return datetime.now()
    return datetime.fromisoformat(valor)


# --- Função de Cálculo ---
def calcular_resumo(pontos):
    # 'pontos' já vem com 'datahora' como objeto datetime (ver finalizar_viagem)
    km_inicial = pontos[0]['km']
    km_final = pontos[-1]['km']
    distancia_total = round(km_final - km_inicial, 2)

    # Data+hora completas: a duração já lida com viagens multi-dia
    duracao = pontos[-1]['datahora'] - pontos[0]['datahora']
    tempo_total_horas = duracao.total_seconds() / 3600

    if tempo_total_horas < 0:
        tempo_total_horas = 0  # ordem de pontos inconsistente: evita tempo negativo

    total_litros = 0
    total_gasto = 0
    for p in pontos:
        # Garante que os valores existam e sejam números
        if p.get('litros') and isinstance(p['litros'], (int, float)):
            total_litros += p['litros']
        if p.get('valor') and isinstance(p['valor'], (int, float)):
            total_gasto += p['valor']

    velocidade_media = round(distancia_total / tempo_total_horas, 1) if tempo_total_horas > 0 else 0
    consumo_kml = round(distancia_total / total_litros, 1) if total_litros > 0 else 0
    custo_rskm = round(total_gasto / distancia_total, 2) if distancia_total > 0 else 0
    
    return {
        "distancia_total": distancia_total,
        "tempo_total_horas": round(tempo_total_horas, 2),
        "velocidade_media_kmh": velocidade_media,
        "total_litros_abastecidos": round(total_litros, 2),
        "total_gasto_rs": round(total_gasto, 2),
        "consumo_medio_kml": consumo_kml,
        "custo_medio_rskm": custo_rskm
    }

# --- Execução ---
if __name__ == '__main__':
    # (IMPORTANTE) Cria as tabelas do banco de dados se não existirem
    with app.app_context():
        db.create_all()
    
    # host='0.0.0.0' permite que o celular acesse o app
    app.run(debug=True, host='0.0.0.0', port=5000)