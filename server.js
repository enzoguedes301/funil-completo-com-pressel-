require('dotenv').config();

const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');
const QRCode = require('qrcode');

// Credenciais ficam apenas no .env — nunca no código versionado.
const API_TOKEN = process.env.CPF_API_TOKEN || '';
const API_URL = 'https://magmadatahub.com/api.php';

// PIX Configuration
const PIX_STORAGE_FILE = path.join(__dirname, 'pix_payments.json');
const SKALE_API_KEY = process.env.SKALE_API_KEY || '';
const SKALE_API_URL = 'https://api.skalepayments.com.br'; // API Skale Production
const SKALE_WEBHOOK_URL = process.env.SKALE_WEBHOOK_URL || 'http://localhost:8080/api/pixWebhook'; // URL para confirmação

// Permite confirmar pagamento manualmente (apenas para testes locais).
// Em produção deixe DESLIGADO — senão qualquer pessoa avança sem pagar.
const ALLOW_MANUAL_PIX_CONFIRM = process.env.ALLOW_MANUAL_PIX_CONFIRM === '1';

// Rate Limiting simples por IP
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const MAX_REQUESTS_PER_WINDOW = 30; // máximo 30 requisições por minuto por IP

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }

  const requests = rateLimitMap.get(ip);
  const recentRequests = requests.filter(t => now - t < RATE_LIMIT_WINDOW);

  if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
    return false; // Bloqueado
  }

  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return true; // Liberado
}

// Limpeza periódica do mapa de rate limit
setInterval(() => {
  const now = Date.now();
  for (const [ip, requests] of rateLimitMap.entries()) {
    const recentRequests = requests.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (recentRequests.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, recentRequests);
    }
  }
}, 60000);

// Bloqueio de User-Agents maliciosos e ferramentas de hacking
const blockedUserAgents = [
  /googlebot/i,
  /bingbot/i,
  /slurp/i, // Yahoo
  /duckduckbot/i,
  /baiduspider/i,
  /yandexbot/i,
  /ahrefsbot/i,
  /semrushbot/i,
  /dotbot/i,
  /mj12bot/i,
  /appengine-google/i,
  /facebookexternalhit/i,
  /twitterbot/i,
  /linkedinbot/i,
  /whatsapp/i,
  /telegrambot/i,
  /slotovod/i,
  /masscan/i,
  /nmap/i,
  /nikto/i,
  /nessus/i,
  /openvas/i,
  /sqlmap/i,
  /havij/i,
  /acunetix/i,
  /burp/i,
  /metasploit/i,
  /w3af/i,
  /wfuzz/i,
  /curl/i,
  /wget/i,
  /python/i,
  /java/i,
  /perl/i,
  /ruby/i,
  /scrapy/i,
  /selenium/i,
  /phantomjs/i,
  /headlesschrome/i
];

// Diretórios sensíveis que devem retornar 403
const forbiddenPaths = [
  '/.git',
  '/.env',
  '/.env.example',
  '/.env.local',
  '/.env.production',
  '/.htaccess',
  '/.github',
  '/node_modules',
  '/config',
  '/.well-known',
  '/composer.json',
  '/package.json',
  '/package-lock.json',
  '/pix_payments.json',
  '/server.js',
  '/.aws',
  '/.ssh',
  '/backup',
  '/database',
  '/sql',
  '/.map'
];

// Um .env com o texto de exemplo ainda por preencher derruba o funil inteiro:
// o servidor manda "SUA_CHAVE_AQUI" para a Skale e nenhum PIX é gerado.
// Barramos isso no boot, em vez de descobrir pelo cliente que não conseguiu pagar.
function isChaveSkalePlausivel(chave) {
  const k = String(chave || '').trim();
  if (!k.startsWith('sk_')) return false;
  if (k.length < 32) return false;
  return !/sua[_ ]?chave|seu[_ ]?token|your[_ ]?key|aqui|placeholder|xxx/i.test(k);
}

if (!isChaveSkalePlausivel(SKALE_API_KEY)) {
  console.error('═'.repeat(70));
  console.error('⚠️  SKALE_API_KEY NÃO PARECE UMA CHAVE REAL');
  console.error(`   Valor carregado: ${JSON.stringify(String(SKALE_API_KEY).slice(0, 24))}`);
  console.error('   Nenhum PIX será gerado enquanto isso — o checkout vai recusar.');
  console.error('   Corrija SKALE_API_KEY no arquivo .env (ela começa com sk_).');
  console.error('═'.repeat(70));
}

// Inicializar arquivo de pagamentos PIX
function initPixStorage() {
  if (!fs.existsSync(PIX_STORAGE_FILE)) {
    fs.writeFileSync(PIX_STORAGE_FILE, JSON.stringify({ payments: [] }, null, 2));
  }
}

// Carregar pagamentos PIX
function loadPixPayments() {
  try {
    const data = fs.readFileSync(PIX_STORAGE_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return { payments: [] };
  }
}

// Salvar pagamentos PIX
function savePixPayments(data) {
  fs.writeFileSync(PIX_STORAGE_FILE, JSON.stringify(data, null, 2));
}

initPixStorage();

// Gerar QR Code real a partir do Brcode
async function generateRealQRCode(brcode) {
  try {
    return await QRCode.toDataURL(brcode, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
  } catch (err) {
    console.error(`[QR Code] Erro ao gerar: ${err.message}`);
    return null;
  }
}

// Integração Skale Payments - Criar transação PIX
async function createSkalePixTransaction(amount, orderId, customerName, customerEmail, description) {
  return new Promise((resolve, reject) => {
    const amountCentavos = Math.round(amount * 100);

    const payload = JSON.stringify({
      amount: amountCentavos,
      currency: 'BRL',
      paymentMethod: 'pix',
      customer: {
        name: customerName || 'Cliente Teste',
        email: customerEmail || 'cliente@example.com',
        phone: '(11) 99999-9999',
        document: {
          number: '11144477735',
          type: 'cpf'
        }
      },
      items: [
        {
          title: description || 'Frete Entrega',
          quantity: 1,
          unitPrice: amountCentavos,
          tangible: false
        }
      ],
      pix: {
        expiresInDays: 1
      },
      metadata: {
        orderId: orderId,
        source: 'web_checkout'
      },
      postbackUrl: SKALE_WEBHOOK_URL
    });

    const options = {
      hostname: 'api.skalepayments.com.br',
      path: '/transactions',
      method: 'POST',
      headers: {
        'X-API-Key': SKALE_API_KEY,
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          console.log(`[Skale PIX] Status ${res.statusCode}: ${orderId}`, JSON.stringify(response, null, 2));

          if (res.statusCode === 201 || res.statusCode === 200) {
            // O código EMV que o app do banco lê vem em pix.qrcode.
            // Sem ele não há pagamento possível — não inventamos um local.
            const pixKey = response.pix?.qrcode || response.pix?.brcode;

            if (!pixKey) {
              console.error('[Skale PIX] ❌ Resposta 200 sem brcode/qrcode:', JSON.stringify(response));
              reject(new Error('A Skale respondeu sem o código PIX (brcode)'));
              return;
            }

            console.log(`[Skale PIX] ✅ Chave (Brcode): ${pixKey.substring(0, 50)}...`);
            console.log(`[Skale PIX] ✅ Transaction ID: ${response.id}`);

            resolve({
              success: true,
              skaleTransactionId: response.id,
              pixKey: pixKey,
              // A Skale já devolve o PNG do QR pronto. Usar o dela é mais
              // confiável do que redesenhar o código por conta própria.
              qrCodeImage: response.pix?.qrcodeImage || null,
              expiresAt: response.pix?.expirationDate || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              status: response.status || 'waiting_payment'
            });
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            // Erro de credencial: o funil inteiro para aqui até trocar a chave.
            console.error('═'.repeat(70));
            console.error('[Skale PIX] ❌ CHAVE DE API RECUSADA PELA SKALE (HTTP ' + res.statusCode + ')');
            console.error(`  Mensagem da Skale: ${response.message || 'sem detalhe'}`);
            console.error(`  Chave em uso: ${String(SKALE_API_KEY).slice(0, 12)}...`);
            console.error('  Nenhum PIX será gerado enquanto isso. Pegue a chave em');
            console.error('  https://dashboard.skalepayments.com.br (Configurações -> API Keys)');
            console.error('  e coloque em SKALE_API_KEY no .env. Ela começa com sk_live_ ou sk_test_.');
            console.error('═'.repeat(70));
            reject(new Error('SKALE_AUTH: ' + (response.message || 'API key inválida')));
          } else {
            console.log(`[Skale PIX] ❌ Erro ${res.statusCode}:`, response.message || response);
            reject(new Error(response.message || `Erro Skale: ${res.statusCode}`));
          }
        } catch (e) {
          reject(new Error(`Erro ao fazer parse da resposta Skale: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[Skale PIX] Erro na requisição: ${err.message}`);
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

// Consultar status no Skale
async function getSkaleTransactionStatus(skaleTransactionId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.skalepayments.com.br',
      path: `/transactions/${skaleTransactionId}`,
      method: 'GET',
      headers: {
        'X-API-Key': SKALE_API_KEY
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (e) {
          reject(new Error(`Erro ao fazer parse: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Traduz o status da Skale para o status interno do funil.
// Só 'paid'/'approved' liberam o avanço.
function mapSkaleStatus(skaleStatus) {
  const s = String(skaleStatus || '').toLowerCase();
  if (s === 'paid' || s === 'approved') return 'CONFIRMED';
  if (['refused', 'refunded', 'chargedback', 'canceled', 'cancelled', 'failed', 'expired'].includes(s)) return 'FAILED';
  return 'PENDING';
}

// Intervalo mínimo entre duas consultas à Skale para o MESMO pagamento.
// Protege contra rate limit se muitos leads estiverem no checkout ao mesmo tempo
// ou se alguém ficar clicando em "Já paguei".
const SKALE_POLL_THROTTLE_MS = 3000;

// Consulta a Skale e persiste o resultado. É esta função que decide se o lead pagou.
// Roda no polling do /api/getPixPayment, então funciona mesmo sem webhook (localhost).
async function syncPaymentWithSkale(payment) {
  if (!payment.skaleTransactionId) return payment;
  if (payment.status === 'CONFIRMED') return payment;

  // Consultou agora há pouco? Devolve o status em cache.
  if (payment.lastCheckedAt) {
    const desde = Date.now() - new Date(payment.lastCheckedAt).getTime();
    if (desde >= 0 && desde < SKALE_POLL_THROTTLE_MS) return payment;
  }

  try {
    const remote = await getSkaleTransactionStatus(payment.skaleTransactionId);
    const remoteStatus = remote?.status || remote?.data?.status;
    const mapped = mapSkaleStatus(remoteStatus);

    payment.skaleStatus = remoteStatus || null;
    payment.lastCheckedAt = new Date().toISOString();

    if (mapped !== payment.status) {
      payment.status = mapped;
      if (mapped === 'CONFIRMED') {
        payment.paidAt = new Date().toISOString();
        console.log(`[Skale] ✅ Pagamento CONFIRMADO: ${payment.orderId} (${payment.skaleTransactionId})`);
      } else {
        console.log(`[Skale] Status de ${payment.orderId}: ${remoteStatus} -> ${mapped}`);
      }
    }

    const data = loadPixPayments();
    const stored = data.payments.find(p => p.id === payment.id);
    if (stored) {
      stored.status = payment.status;
      stored.skaleStatus = payment.skaleStatus;
      stored.lastCheckedAt = payment.lastCheckedAt;
      if (payment.paidAt) stored.paidAt = payment.paidAt;
      savePixPayments(data);
    }
  } catch (e) {
    console.warn(`[Skale] Não foi possível consultar ${payment.skaleTransactionId}: ${e.message}`);
  }

  return payment;
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;
  const userAgent = req.headers['user-agent'] || '';
  const clientIp = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress || '';

  // ============ SEGURANÇA: Headers HTTP globais ============
  // Bloqueio de indexação por search engines
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noocr');

  // Proteção contra ataques de segurança
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');

  // Content Security Policy: bloqueia inline scripts e recursos de fontes não confiáveis
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://api.skalepayments.com.br https://magmadatahub.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");

  // ============ SEGURANÇA: Bloqueio de Rate Limiting ============
  if (!checkRateLimit(clientIp)) {
    console.log(`[Rate Limit] IP ${clientIp} foi bloqueado por excesso de requisições`);
    res.writeHead(429, { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '60' });
    res.end('Muitas requisições. Tente novamente em 1 minuto.');
    return;
  }

  // ============ SEGURANÇA: Bloqueio de Diretórios Sensíveis ============
  if (forbiddenPaths.some(fp => pathname === fp || pathname.startsWith(fp + '/'))) {
    console.log(`[Bloqueio] Tentativa de acesso a diretório sensível: ${pathname} de ${clientIp}`);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado');
    return;
  }

  // ============ SEGURANÇA: Bloqueio de Source Maps ============
  if (pathname.endsWith('.map')) {
    console.log(`[Bloqueio] Tentativa de acesso a source map: ${pathname} de ${clientIp}`);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado');
    return;
  }

  // ============ SEGURANÇA: Bloqueio de Bots e Scrapers ============
  if (!userAgent) {
    // Requisição sem User-Agent é suspeita
    console.log(`[Bloqueio] Requisição sem User-Agent: ${pathname} de ${clientIp}`);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado');
    return;
  }

  // Verificar contra lista de bots bloqueados
  if (blockedUserAgents.some(botPattern => botPattern.test(userAgent))) {
    console.log(`[Bloqueio] Bot detectado: ${userAgent.substring(0, 100)} | Caminho: ${pathname} | IP: ${clientIp}`);
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Acesso negado');
    return;
  }

  // ============ CORS e OPTIONS ============
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle OPTIONS
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API: Criar Pagamento PIX (integrado com Skale)
  if (pathname === '/api/createPixPayment' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { amount, orderId, customerName, customerEmail, description } = JSON.parse(body);

        if (!amount || !orderId) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, erro: 'amount e orderId são obrigatórios' }));
          return;
        }

        const paymentId = `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // O PIX precisa vir da Skale. Sem ela não há como gerar um Brcode que
        // um banco aceite — o fallback local devolvia um UUID aleatório, e o
        // cliente ficava com um QR Code impossível de pagar.
        let skaleData = null;
        let skaleErro = null;

        if (!SKALE_API_KEY || !isChaveSkalePlausivel(SKALE_API_KEY)) {
          console.error('[Skale] SKALE_API_KEY não configurada — não é possível gerar PIX');
          res.writeHead(503);
          res.end(JSON.stringify({
            success: false,
            erro: 'Meio de pagamento não configurado. Tente novamente em instantes.'
          }));
          return;
        }

        try {
          console.log(`[Skale] Criando transação PIX para: ${orderId}`);
          skaleData = await createSkalePixTransaction(amount, orderId, customerName, customerEmail, description);
          console.log(`[Skale] Transação criada com sucesso: ${skaleData.skaleTransactionId}`);
        } catch (e) {
          skaleErro = e;
        }

        if (!skaleData || !skaleData.pixKey) {
          console.error(`[Skale] Falha ao criar PIX para ${orderId}: ${skaleErro?.message || 'resposta sem chave PIX'}`);
          res.writeHead(503);
          res.end(JSON.stringify({
            success: false,
            erro: 'Não foi possível gerar o PIX agora. Recarregue a página e tente de novo.'
          }));
          return;
        }

        const pixKey = skaleData.pixKey; // Código EMV real da Skale
        const expiresAt = skaleData.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString();

        // Preferimos a imagem oficial da Skale; só desenhamos por conta
        // própria se ela não vier.
        const qrCode = skaleData.qrCodeImage || await generateRealQRCode(pixKey);
        const pixCopyPaste = pixKey; // Código para copiar/colar

        const payment = {
          id: paymentId,
          orderId,
          skaleTransactionId: skaleData?.skaleTransactionId || null,
          amount,
          customerName,
          customerEmail,
          description,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          expiresAt,
          qrCode,
          pixCopyPaste,
          source: skaleData ? 'skale' : 'local'
        };

        const data = loadPixPayments();
        data.payments.push(payment);
        savePixPayments(data);

        console.log(`[API Response] Enviando ao frontend:`);
        console.log(`  - Chave PIX: ${pixCopyPaste}`);
        console.log(`  - QR Code: ${qrCode.substring(0, 50)}...`);
        console.log(`  - Source: ${skaleData ? 'SKALE' : 'LOCAL'}`);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          paymentId,
          amount,
          orderId,
          status: 'PENDING',
          expiresAt,
          qrCode,
          pixCopyPaste,
          source: payment.source,
          // Liga o botão "simular pagamento" no front (só em teste local)
          testMode: ALLOW_MANUAL_PIX_CONFIRM
        }));
      } catch (e) {
        console.error('Erro ao criar pagamento PIX:', e.message);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, erro: 'Erro ao processar requisição: ' + e.message }));
      }
    });
    return;
  }

  // API: Obter Status do Pagamento PIX
  if (pathname === '/api/getPixPayment' && req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const paymentId = query.id;
    if (!paymentId) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, erro: 'paymentId é obrigatório' }));
      return;
    }

    const data = loadPixPayments();
    const payment = data.payments.find(p => p.id === paymentId);

    if (!payment) {
      res.writeHead(404);
      res.end(JSON.stringify({ success: false, erro: 'Pagamento não encontrado' }));
      return;
    }

    // Consulta a Skale antes de responder: o status vem do provedor, não da página.
    // Se a consulta falhar, responde com o último status conhecido — o checkout
    // continua funcionando e tenta de novo no próximo polling.
    const responder = () => {
      res.writeHead(200);
      res.end(JSON.stringify({
        success: true,
        id: payment.id,
        orderId: payment.orderId,
        status: payment.status,
        amount: payment.amount,
        expiresAt: payment.expiresAt,
        paidAt: payment.paidAt || null,
        // false = PIX gerado localmente (Skale indisponível), não há como confirmar
        verifiable: Boolean(payment.skaleTransactionId)
      }));
    };

    syncPaymentWithSkale(payment).then(responder).catch((e) => {
      console.warn(`[Skale] Falha inesperada ao sincronizar ${payment.id}: ${e.message}`);
      responder();
    });
    return;
  }

  // API: Webhook do Skale (recebe confirmações de pagamento)
  if (pathname === '/api/pixWebhook' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const webhookData = JSON.parse(body);
        console.log('[Webhook Skale] Recebido:', webhookData);

        // Webhook do Skale retorna: id, status, order_id, amount, etc
        // Alguns eventos vêm aninhados em "data"
        const evt = webhookData.data || webhookData;
        const skaleId = evt.id;
        const status = evt.status;
        const orderId = evt.order_id || evt.orderId || evt.metadata?.orderId;

        if (mapSkaleStatus(status) === 'CONFIRMED') {
          // Buscar pagamento local.
          // Os ids precisam existir: comparar contra null/undefined casaria
          // com qualquer pagamento sem skaleTransactionId e confirmaria o PIX errado.
          const data = loadPixPayments();
          const payment =
            (skaleId && data.payments.find(p => p.skaleTransactionId === skaleId)) ||
            (orderId && data.payments.find(p => p.orderId === orderId)) ||
            null;

          if (!payment) {
            console.warn(`[Webhook] Pagamento não encontrado (id=${skaleId}, orderId=${orderId}) — nada foi confirmado`);
          }

          if (payment) {
            payment.status = 'CONFIRMED';
            payment.paidAt = new Date().toISOString();
            payment.skaleStatus = status;
            savePixPayments(data);

            console.log(`[Webhook] Pagamento confirmado: ${orderId}`);

            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              message: 'Pagamento confirmado via webhook Skale',
              orderId,
              status
            }));
            return;
          }
        }

        // Se status não é pagamento confirmado, apenas registre
        console.log(`[Webhook] Status: ${status} para pedido: ${orderId}`);
        res.writeHead(200);
        res.end(JSON.stringify({ success: true, message: 'Webhook recebido' }));
      } catch (e) {
        console.error('[Webhook] Erro:', e.message);
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, erro: 'Erro ao processar webhook' }));
      }
    });
    return;
  }

  // API: Confirmar Pagamento PIX (APENAS testes locais)
  // Desligado por padrão — só liga com ALLOW_MANUAL_PIX_CONFIRM=1
  if (pathname === '/api/confirmPixPayment' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (!ALLOW_MANUAL_PIX_CONFIRM) {
      console.warn('[Segurança] Tentativa de confirmar pagamento manualmente foi bloqueada');
      res.writeHead(403);
      res.end(JSON.stringify({
        success: false,
        erro: 'Confirmação manual desabilitada. O pagamento só é confirmado pela Skale.'
      }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { paymentId } = JSON.parse(body);

        if (!paymentId) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, erro: 'paymentId é obrigatório' }));
          return;
        }

        const data = loadPixPayments();
        const payment = data.payments.find(p => p.id === paymentId);

        if (!payment) {
          res.writeHead(404);
          res.end(JSON.stringify({ success: false, erro: 'Pagamento não encontrado' }));
          return;
        }

        payment.status = 'CONFIRMED';
        payment.paidAt = new Date().toISOString();
        savePixPayments(data);

        res.writeHead(200);
        res.end(JSON.stringify({
          success: true,
          message: 'Pagamento confirmado com sucesso',
          paymentId,
          status: 'CONFIRMED'
        }));
      } catch (e) {
        console.error('Erro ao confirmar pagamento:', e.message);
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, erro: 'Erro ao processar requisição' }));
      }
    });
    return;
  }

  // API: Consulta CPF (chamada real à magmadatahub.com)
  if (pathname === '/api/getCpf.php') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const cpf = (query.cpf || '').replace(/\D/g, '');

    // Validação básica
    if (cpf.length !== 11) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, erro: 'CPF inválido' }));
      return;
    }

    // Rejeitar sequências repetidas (111.111.111-11, etc)
    if (/^(\d)\1{10}$/.test(cpf)) {
      res.writeHead(400);
      res.end(JSON.stringify({ success: false, erro: 'CPF inválido' }));
      return;
    }

    // Fazer chamada à API real
    const apiUrl = `${API_URL}?token=${API_TOKEN}&cpf=${cpf}`;

    https.get(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0',
        'Accept': 'application/json'
      },
      timeout: 10000
    }, (apiRes) => {
      let data = '';

      apiRes.on('data', (chunk) => {
        data += chunk;
      });

      apiRes.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          console.log(`[CPF: ${cpf}] Status: ${apiRes.statusCode}, Resposta:`, jsonData);

          // Se a API retornou sucesso
          if (apiRes.statusCode === 200 && jsonData.success === true && jsonData.nome) {
            res.writeHead(200);
            res.end(JSON.stringify({
              success: true,
              nome: jsonData.nome,
              cpf: cpf,
              nascimento: jsonData.nascimento || '',
              nome_mae: jsonData.nome_mae || '',
              sexo: jsonData.sexo || ''
            }));
            return;
          }

          // CPF não encontrado ou erro da API
          console.warn(`[CPF: ${cpf}] Erro: ${jsonData.message || jsonData.erro}`);
          res.writeHead(apiRes.statusCode || 404);
          res.end(JSON.stringify({
            success: false,
            erro: jsonData.message || jsonData.erro || 'CPF não encontrado na base de dados'
          }));
        } catch (e) {
          console.error(`[CPF: ${cpf}] Erro ao fazer parse:`, e.message, 'Response:', data);
          res.writeHead(503);
          res.end(JSON.stringify({
            success: false,
            erro: 'Resposta inválida da API'
          }));
        }
      });
    }).on('error', (err) => {
      console.error('Erro na requisição à API:', err.message);
      res.writeHead(503);
      res.end(JSON.stringify({
        success: false,
        erro: 'Serviço temporariamente indisponível'
      }));
    }).on('timeout', () => {
      res.writeHead(503);
      res.end(JSON.stringify({
        success: false,
        erro: 'Timeout na consulta'
      }));
    });

    return;
  }

  // Servir arquivos estáticos
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);

  // Se a URL terminar com /, tentar index.html naquele diretório
  if (pathname.endsWith('/')) {
    filePath = path.join(__dirname, pathname, 'index.html');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Arquivo não encontrado');
      return;
    }

    // Detectar tipo de arquivo
    const ext = path.extname(filePath);
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`🔗 API conectada a: ${API_URL}`);
  console.log(`✨ Agora você pode consultar CPFs reais!\n`);
});
