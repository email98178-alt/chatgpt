
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const dotenv = require("dotenv");
const OpenAI = require("openai");
const cors = require('cors');
const crypto = require('crypto');

// Carrega as variáveis de ambiente do .env
dotenv.config();

const app = express();

// --- Middlewares Globais ---
app.use(express.json());
app.use(cors());

// Serve arquivos estáticos da pasta public e da raiz (ajuste conforme sua estrutura)
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, '.')));

// Criação do Servidor HTTP acoplado ao Express
const server = http.createServer(app);

// Inicialização do Socket.IO ligado ao mesmo servidor HTTP
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'messages.json');

// --- Lógica de Persistência de Mensagens (Chat) ---
let messages = [];
if (fs.existsSync(DATA_FILE)) {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    messages = JSON.parse(data);
    console.log(`Carregadas ${messages.length} mensagens do arquivo.`);
  } catch (err) {
    console.error('Erro ao carregar mensagens:', err);
    messages = [];
  }
}

function saveMessages() {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
  } catch (err) {
    console.error('Erro ao salvar mensagens:', err);
  }
}

// --- Lógica de Rotação de CPFs (Checkout Pix) ---
const RAW_CPFS = `
44397019819
39547070800
40674272803
54475044812
48593734804
57203412857
40674315898
57780527824
56796660011
56187213840
59624560846
53456489803
61834296358
50100162819
41397043814
26363381878
49013538850
16987627800
55475630801
18549491870
26021851838
36697830832
49086515827
47966258874
33093894808
41253109800
33474853864
46204876864
22502370850
36391625875
36859238895
47980286812
11413677690
41738614867
48379659899
28328634856
46378334854
29803001876
31584922885
32318078831
35855242811
38802049858
34856940880
41934743801
54813742858
16105005806
42966173890
15835388799
48056039848
52915315841
17995095830
38003206812
35689019860
33461321885
38297519821
47164853827
40317574841
27778158876
41308958854
31536155861
45422577892
28587348876
14514924806
28964589807
30815071892
46035405827
50965146847
46515238894
50418961867
54353139886
50067186840
35585249851
97983420625
42665985802
50365804860
40568388879
33594671836
38359128871
29048245885
48153626884
30968265871
47955912888
39373914871
41741185823
59604208802
40763023892
73717940104
38448375823
43606380860
13670641807
39101082884
41648328865
42344228861
43865149880
46616908852
37273605859
13334074838
27187389876
30768121817
40066661870
32804853802
41687395896
38739138879
41537514806
39320215847
32214240861
52723531880
34212053888
40687884902
31182865801
30537351809
41311871837
32246638801
50656445866
54684628850
35731831823
36224735840
49323517801
44729532856
34064199847
15304487869
31053012837
43919131860
45761813866
53497042811
31094522864
50316992801
50172661862
54827745897
57313046880
40597295824
40066723817
28875870802
25348443859
28868396907
44680077883
42128157889
40782592864
37925623837
57639934893
50686629841
15749179869
53633653830
34853851828
37028760812
37646013889
44990865820
30410594873
39066289813
46482647898
52824083840
42831949807
45749382850
58159208863
31674565828
10348872895
41310710880
45037282888
11997502470
12279192470
25170907850
26941345802
48265471882
48050395820
56403921851
25751130839
28367857801
45749347869
13239227805
52942846852
54907738803
27446738898
45528427819
30928743829
40870236806
28826234884
11884463630
37228680847
34840424861
90034758810
40831769890
42672711860
56111399810
48900522833
33138499899
48338504866
21988301831
39645155827
10045818827
27616015808
44027151801
36336497860
48181736818
58938043843
33362389864
39505147830
53072907803
42938477821
93552963472
23243905826
46980926802
49242760811
50788933850
31515235874
40964306840
45851485825
49200846840
40502313870
57508012844
10714123889
29116115864
56811526858
39547127845
40661621855
16698863874
26381903813
28128248839
31713365880
35647357806
35597650807
52854233840
35773968819
30543676811
32547138859
44054167888
46284437854
44341721828
44319719808
54019921814
34482697869
43979940802
47970412858
52268125823
49705114897
18342001806
13121143831
18559584811
29281451840
32728281840
43186054850
47613392848
19233106748
48006195803
41341318800
50159553830
46795540880
51521572844
56616103862
32400183813
37341007800
40652799841
47850943899
26395392808
15553079810
13287426877
12970322846
12403959812
43513610858
42886105830
41713600803
45543392893
49056155857
`;

const LISTA_CPFS = RAW_CPFS.trim().split(/\s+/);
let currentCpfIndex = 0;

function getNextCpf() {
  if (LISTA_CPFS.length === 0 || (LISTA_CPFS.length === 1 && LISTA_CPFS[0] === "")) return null;
  const cpf = LISTA_CPFS[currentCpfIndex];
  currentCpfIndex = (currentCpfIndex + 1) % LISTA_CPFS.length;
  return cpf;
}

const WOOVI_API_URL = 'https://api.woovi.com/api/v1';
const WOOVI_APP_ID = process.env.WOOVI_APP_ID;

// OpenAI API Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// --- Rotas HTTP (ChatGPT) ---
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Or another suitable model
      messages: [{
        role: "user",
        content: message
      }],
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error("Erro ao chamar a API do OpenAI:", error.response ? error.response.data : error.message);
    res.status(500).json({ error: "Erro ao processar sua solicitação com a IA." });
  }
});

// --- Rotas HTTP (Checkout) ---

// Rota principal para carregar o seu checkout
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat', 'index.html'));
}); // <-- Veja se esse }); não foi apagado por engano!

// Rota para gerar o Pix
app.post('/api/pix', async (req, res) => {
  try {
    const { payer_name, payer_cpf, payer_phone, amount } = req.body;

    if (!payer_name || !amount) {
      return res.status(400).json({ success: false, message: 'Campos obrigatórios ausentes.' });
    }

    const valueInCents = Math.round(parseFloat(amount.replace(',', '.')) * 100);
    const correlationID = crypto.randomUUID();
    const cpfParaUsar = getNextCpf();
    
    if (!cpfParaUsar) {
      throw new Error('Lista de CPFs está vazia.');
    }

    const payload = {
      correlationID: correlationID,
      value: valueInCents,
      comment: `Pagamento de ${payer_name}`,
      customer: {
        name: payer_name,
        taxID: cpfParaUsar.replace(/\D/g, ''),
        email: 'cliente@email.com',
        phone: payer_phone ? payer_phone.replace(/\D/g, '') : ''
      }
    };

    const response = await axios.post(`${WOOVI_API_URL}/charge`, payload, {
      headers: {
        'Authorization': WOOVI_APP_ID,
        'Content-Type': 'application/json'
      }
    });

    if (response.data && response.data.charge) {
      return res.json({
        success: true,
        pixCode: response.data.charge.brCode,
        correlationID: correlationID
      });
    } else {
      throw new Error('Resposta inválida da Woovi');
    }

  } catch (error) {
    console.error('Erro ao gerar PIX:', error.response ? error.response.data : error.message);
    res.status(500).json({ 
      success: false, 
      message: 'Erro ao processar o pagamento Pix.',
      error: error.response ? error.response.data : error.message
    });
  }
});

// --- Eventos do Socket.IO (Chat) ---
const users = {}; 

io.on('connection', (socket) => {
  console.log(`Usuário conectado: ${socket.id}`);

  socket.on('join', ({ userId, isAdmin }) => {
    users[userId] = socket.id;
    socket.join(userId);
    console.log(`${isAdmin ? 'Admin' : 'Usuário'} ${userId} entrou.`);

    if (isAdmin) {
      socket.join('admins');
      socket.emit('chat_history', messages);
    }
  });

  socket.on('send_message', (data) => {
    const { userId, text, sender } = data;
    const message = { userId, text, sender, timestamp: new Date().toISOString() };
    messages.push(message);
    saveMessages();
    
    console.log(`Mensagem de ${sender} (${userId}): ${text}`);

    // Enviar para o usuário destino (ou admin que está na sala do usuário)
    socket.to(userId).emit('receive_message', message);

    // Enviar para todos os outros admins
    socket.to('admins').emit('new_message_for_admin', message);
  });

  socket.on('disconnect', () => {
    console.log(`Usuário desconectado: ${socket.id}`);
    for (const userId in users) {
      if (users[userId] === socket.id) {
        delete users[userId];
        break;
      }
    }
  });
});

// --- Inicialização do Servidor Único ---
// IMPORTANTE: Usamos 'server.listen' em vez de 'app.listen' para que o Socket.IO funcione corretamente.
server.listen(PORT, () => {
  console.log(`Servidor unificado rodando na porta ${PORT}`);
});
