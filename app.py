from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os

app = Flask(__name__)
CORS(app) # Habilita CORS para todas as rotas. Em produção, considere restringir a origem.

# A chave de API será carregada das variáveis de ambiente do Render
openai.api_key = os.environ.get("OPENAI_API_KEY")

@app.route("/chat", methods=["POST"])
def chat():
    user_message = request.json.get("message")
    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    try:
        # Adiciona uma mensagem de sistema para dar contexto ao ChatGPT
        messages = [
            {"role": "system", "content": "Você é Thiago Callegari, um vendedor autorizado da Diskgas. Responda de forma prestativa e focada em ajudar o cliente com dúvidas sobre produtos, entrega ou o processo de compra. Mantenha um tom amigável e profissional. Não tente concluir a venda ou gerar Pix, apenas responda às perguntas."},
            {"role": "user", "content": user_message}
        ]

        response = openai.chat.completions.create(
            model="gpt-3.5-turbo", # Modelo do ChatGPT. Pode ser alterado para outros modelos.
            messages=messages
        )
        chat_response = response.choices[0].message.content
        return jsonify({"response": chat_response})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # O Render injetará a porta via variável de ambiente PORT
    app.run(host="0.0.0.0", port=os.environ.get("PORT", 5000))
