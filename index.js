require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

// Opcional: tenta localizar o Google Chrome instalado no Windows
function getWindowsChromePath() {
  const paths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe'
  ];
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

// Configuração HTTP rápida
const httpTimeout = parseInt(process.env.HTTP_TIMEOUT, 10) || 5000;
const http = axios.create({
  timeout: httpTimeout,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }
});

// Carrega o padrão Regex da variável de ambiente ou usa o padrão default (case-insensitive)
const defaultPattern = 'https:\\/\\/prestador\\.veloxcontactcenter\\.com\\.br\\/prestador\\/ConvitePrestador\\/VisualizarConvite\\?ChaveConvite=[a-f0-9\\-]+';
const inviteRegex = new RegExp(process.env.TARGET_REGEX || defaultPattern, 'i');

// Tabela de cálculo de prévia
function calcularPrevia(distanciaStr) {
  const distancia = parseInt(distanciaStr, 10) || 0;
  if (distancia <= 85) return 50;
  if (distancia <= 170) return 120;
  return 150;
}

// Processador assíncrono para o convite
async function processarConvite(url) {
  const inicio = Date.now();
  console.log(`[${new Date().toISOString()}] URL de convite capturada: ${url}`);

  try {
    // 1. GET no link do convite
    const responseGet = await http.get(url);
    const $ = cheerio.load(responseGet.data);

    // 2. Extração dos campos ocultos
    const id = $('#Id').val();
    const idAtendimentoConvite = $('#IdAtendimentoConvite').val();
    const idAtendimentoAcionamento = $('#IdAtendimentoAcionamento').val();
    const idAdesao = $('#IdAdesao').val();
    const idCidadeAtendimento = $('#IdCidadeAtendimento').val();
    const distanciaBaseOrigem = $('#DistanciaBaseOrigem').val();

    // Determina a URL de envio (resolvendo rotas relativas caso o action do formulário seja relativo)
    const actionAttr = $('#VisualizarConvite').attr('action');
    let actionUrl = url;
    if (actionAttr) {
      actionUrl = new URL(actionAttr, url).href;
    }

    // 3. Cálculo da Prévia
    const valorPrevia = calcularPrevia(distanciaBaseOrigem);

    // 4. Montagem do payload
    const payload = {
      Id: id,
      IdAtendimentoConvite: idAtendimentoConvite,
      IdAtendimentoAcionamento: idAtendimentoAcionamento,
      Previa: { Previa: valorPrevia },
      Aceito: true,
      IdAdesao: idAdesao,
      IdCidadeAtendimento: idCidadeAtendimento
    };

    // 5. POST de aceite imediato
    const responsePost = await http.post(actionUrl, payload);
    const duracao = Date.now() - inicio;

    console.log(`[SUCESSO] Aceite processado em ${duracao}ms | Status HTTP: ${responsePost.status}`);
  } catch (error) {
    const duracao = Date.now() - inicio;
    console.error(`[ERRO] Falha ao aceitar convite em ${duracao}ms:`, error.message);
  }
}

// Configurações do Puppeteer otimizadas
const puppeteerConfig = {
  headless: 'new',
  protocolTimeout: 360000,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--js-flags="--max-old-space-size=512"',
    '--disable-site-isolation-trials',
    '--disable-breakpad',
    '--memory-pressure-off',
    '--disable-background-networking',
    '--disable-sync',
    '--mute-audio'
  ]
};

// Se encontrar o Chrome local do Windows, utiliza ele diretamente
const systemChromePath = getWindowsChromePath();
if (systemChromePath) {
  console.log(`Utilizando navegador Chrome instalado em: ${systemChromePath}`);
  puppeteerConfig.executablePath = systemChromePath;
}

// Cliente WhatsApp Web
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: puppeteerConfig
});

client.on('qr', (qr) => {
  console.log('\n--- ESCANIE O QR CODE ABAIXO NO SEU WHATSAPP ---');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log(`[${new Date().toISOString()}] WhatsApp Web conectado e pronto para escuta em tempo real.`);
});

client.on('disconnected', (reason) => {
  console.warn('Conexão com WhatsApp perdida:', reason);
  console.log('Tentando reconectar...');
  setTimeout(() => {
    client.initialize();
  }, 5000);
});

// Registrar APENAS o evento 'message' (evitar duplo disparo com 'message_create')
client.on('message', (msg) => {
  if (!msg.body) return;

  const match = msg.body.match(inviteRegex);
  if (match) {
    const targetUrl = match[0];
    setImmediate(async () => {
      try {
        await processarConvite(targetUrl);
      } catch (err) {
        console.error('Erro assíncrono ao processar convite:', err.message);
      }
    });
  }
});

process.on('uncaughtException', (err) => {
  console.error('Exceção não tratada capturada:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Rejeição não tratada capturada:', reason);
});

client.initialize();