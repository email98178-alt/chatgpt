/**
 * INTEGRAÇÃO COM CHATGPT - DISKGAS
 * 
 * Este script integra o ChatGPT ao seu site Diskgas.
 * Ele intercepta as mensagens do usuário e envia para o backend que comunica com a OpenAI.
 * 
 * CONFIGURAÇÃO:
 * 1. Substitua 'https://your-backend-url.onrender.com' pela URL real do seu backend Render
 * 2. Adicione este script ao seu HTML ANTES da tag </body>
 */

const CHATGPT_API_URL = "https://your-backend-url.onrender.com/chat"; // ← CONFIGURE AQUI

// Armazenar o contexto da conversa para manter histórico
let conversationHistory = [];

/**
 * Função para enviar mensagem ao ChatGPT via backend
 */
async function getChatGPTResponse(userMessage) {
  try {
    const response = await fetch(CHATGPT_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: userMessage }),
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error("Erro ao comunicar com ChatGPT:", error);
    return "Desculpe, não consegui processar sua mensagem no momento. Tente novamente mais tarde.";
  }
}

/**
 * Interceptar o envio de mensagens do usuário
 * Esta função substitui a função doSend() original
 */
const originalDoSend = window.doSend;

window.doSend = async function() {
  const text = inputEl.value.trim();
  
  if (!text) return;

  // Adicionar mensagem do usuário ao chat
  addMsg(text, "user");
  inputEl.value = "";
  inputEl.style.height = "auto";
  inputEl.blur();
  sendBtnEl.disabled = true;

  // Armazenar no histórico
  conversationHistory.push({ role: "user", content: text });

  // Mostrar indicador de digitação
  setTyping(true);

  // Obter resposta do ChatGPT
  const agentResponse = await getChatGPTResponse(text);

  // Ocultar indicador de digitação
  setTyping(false);

  // Adicionar resposta do agente ao chat
  addMsg(agentResponse, "agent");

  // Armazenar no histórico
  conversationHistory.push({ role: "assistant", content: agentResponse });

  // Salvar histórico no localStorage
  saveChatHistory();
};

/**
 * Restaurar histórico de conversa ao carregar a página
 */
function restoreConversationHistory() {
  const saved = localStorage.getItem("diskgas_conversation_history");
  if (saved) {
    try {
      conversationHistory = JSON.parse(saved);
    } catch (e) {
      console.error("Erro ao restaurar histórico:", e);
      conversationHistory = [];
    }
  }
}

/**
 * Salvar histórico de conversa no localStorage
 */
function saveChatHistory() {
  localStorage.setItem("diskgas_conversation_history", JSON.stringify(conversationHistory));
}

/**
 * Limpar histórico de conversa
 */
function clearConversationHistory() {
  conversationHistory = [];
  localStorage.removeItem("diskgas_conversation_history");
}

// Restaurar histórico ao carregar a página
document.addEventListener("DOMContentLoaded", restoreConversationHistory);
