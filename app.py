"""
Argolo Consultoria e Tecnologia - Servidor Flask
Permite rodar a landing page localmente ou em serviços como Render, Railway ou VPS.
Também fornece uma API para recebimento de mensagens do formulário de contato.
"""

from flask import Flask, render_template, request, jsonify, send_from_directory
import os
import json
from datetime import datetime

# Definir diretório base
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(
    __name__,
    static_folder=BASE_DIR,
    static_url_path=''
)

# Caminho para salvar leads/mensagens recebidas
LEADS_FILE = os.path.join(BASE_DIR, 'leads_recebidos.json')

def salvar_lead(dados):
    """Armazena os leads recebidos em um arquivo JSON local."""
    leads = []
    if os.path.exists(LEADS_FILE):
        try:
            with open(LEADS_FILE, 'r', encoding='utf-8') as f:
                leads = json.load(f)
        except Exception:
            leads = []

    dados['data_hora'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    leads.append(dados)

    with open(LEADS_FILE, 'w', encoding='utf-8') as f:
        json.dump(leads, f, ensure_ascii=False, indent=2)

@app.route('/')
def home():
    """Serve a página principal (landing page)."""
    return send_from_directory(BASE_DIR, 'index.html')

@app.route('/api/contact', methods=['POST'])
def api_contact():
    """
    Endpoint para recepção das mensagens do formulário.
    Valida e salva o contato.
    """
    try:
        data = request.get_json() or request.form.to_dict()

        nome = data.get('nome', '').strip()
        email = data.get('email', '').strip()
        telefone = data.get('telefone', '').strip()
        servico = data.get('servico', '').strip()
        mensagem = data.get('mensagem', '').strip()

        if not nome or not email or not mensagem:
            return jsonify({
                'success': False,
                'message': 'Por favor, preencha todos os campos obrigatórios (*).'
            }), 400

        lead_info = {
            'nome': nome,
            'email': email,
            'telefone': telefone,
            'servico': servico,
            'mensagem': mensagem
        }

        salvar_lead(lead_info)

        return jsonify({
            'success': True,
            'message': 'Mensagem registrada com sucesso! Nossa equipe entrará em contato.'
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro interno ao processar mensagem: {str(e)}'
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"[*] Argolo Consultoria e Tecnologia - Servidor iniciado!")
    print(f"[*] Acesse em: http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=True)
