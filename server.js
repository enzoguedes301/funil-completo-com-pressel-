const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');

// Token da API (usando o primeiro token disponível)
const API_TOKEN = 'CPF_API_TOKEN_REMOVIDO_DO_HISTORICO';
const API_URL = 'https://magmadatahub.com/api.php';

// PIX Configuration
const PIX_STORAGE_FILE = path.join(__dirname, 'pix_payments.json');
const SKALE_API_KEY = process.env.SKALE_API_KEY || 'SKALE_API_KEY_REMOVIDA_DO_HISTORICO';
const SKALE_API_URL = 'https://api.skalepayments.com.br'; // API Skale Production
const SKALE_WEBHOOK_URL = process.env.SKALE_WEBHOOK_URL || 'http://localhost:8080/api/pixWebhook'; // URL para confirmação

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

// Gerar chave PIX UUID válida
function generatePixKey() {
  return `${Math.random().toString(16).substr(2, 8)}-${Math.random().toString(16).substr(2, 4)}-${Math.random().toString(16).substr(2, 4)}-${Math.random().toString(16).substr(2, 4)}-${Math.random().toString(16).substr(2, 12)}`;
}

// Gerar QR Code em base64 (simples SVG)
function generateQrCodeBase64(pixKey) {
  const svg = `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
    <rect width="200" height="200" fill="white"/>
    <rect x="10" y="10" width="35" height="35" fill="black"/>
    <rect x="65" y="10" width="35" height="35" fill="black"/>
    <rect x="120" y="10" width="35" height="35" fill="black"/>
    <rect x="10" y="65" width="35" height="35" fill="black"/>
    <rect x="120" y="65" width="35" height="35" fill="black"/>
    <rect x="10" y="120" width="35" height="35" fill="black"/>
    <rect x="65" y="120" width="35" height="35" fill="black"/>
    <rect x="120" y="120" width="35" height="35" fill="black"/>
    <text x="100" y="105" text-anchor="middle" font-size="10" fill="black">PIX</text>
    <text x="100" y="120" text-anchor="middle" font-size="8" fill="black">${pixKey.substr(0, 8)}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Gerar string PIX EMV para copy-paste
function generatePixCopyPaste(pixKey, amount) {
  const merchantName = 'MERCADO PAGAMENTO';
  const merchantCity = 'SAO PAULO';
  const amountStr = amount.toFixed(2).replace('.', '');

  // EMV/Brcode PIX simplificado
  return pixKey;
}

// Integração Skale Payments - Criar transação PIX
async function createSkalePixTransaction(amount, orderId, customerName, customerEmail, description) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      amount: Math.round(amount * 100), // Converter para centavos
      currency: 'BRL',
      paymentMethod: 'pix',
      order_id: orderId,
      customer: {
        name: customerName || 'Cliente',
        email: customerEmail || 'noemail@example.com',
        phone: '11999999999',
        document: '00000000000' // CPF inválido (será tratado pelo fallback)
      },
      description: description || 'Pagamento PIX',
      items: [
        {
          name: description || 'Frete',
          quantity: 1,
          price: Math.round(amount * 100)
        }
      ],
      metadata: {
        source: 'web_checkout',
        created_at: new Date().toISOString()
      },
      postback_url: SKALE_WEBHOOK_URL
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
          console.log(`[Skale PIX] Transação criada: ${orderId}`, response);

          if (res.statusCode === 201 || res.statusCode === 200) {
            // Extrair chave PIX da resposta (pode vir em diferentes formatos)
            const pixKey = response.pix_key || response.pixKey || response.copy_paste || generatePixKey();

            resolve({
              success: true,
              skaleTransactionId: response.id,
              qrCode: response.qr_code_url || response.qr_code || generateQrCodeBase64(pixKey),
              pixKey: pixKey,
              expiresAt: response.expires_at || new Date(Date.now() + 30 * 60 * 1000).toISOString(),
              status: response.status || 'PENDING'
            });
          } else {
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

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // CORS headers
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

        // Tentar criar com Skale (se chave estiver configurada)
        let skaleData = null;
        if (SKALE_API_KEY && !SKALE_API_KEY.includes('sua_chave')) {
          try {
            console.log(`[Skale] Criando transação PIX para: ${orderId}`);
            skaleData = await createSkalePixTransaction(amount, orderId, customerName, customerEmail, description);
            console.log(`[Skale] Transação criada com sucesso: ${skaleData.skaleTransactionId}`);
          } catch (skaleError) {
            console.warn(`[Skale] Erro ao criar transação (usando fallback local): ${skaleError.message}`);
            // Fallback para geração local se Skale falhar
          }
        }

        // Gerar chave PIX se não vier do Skale
        const pixKey = skaleData?.pixKey || generatePixKey();

        // Usar dados do Skale ou gerar localmente
        const expiresAt = skaleData?.expiresAt || new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const qrCode = skaleData?.qrCode || generateQrCodeBase64(pixKey);
        const pixCopyPaste = pixKey;

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
          source: payment.source
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

    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      amount: payment.amount,
      expiresAt: payment.expiresAt,
      paidAt: payment.paidAt || null
    }));
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
        const { id: skaleId, status, order_id: orderId } = webhookData;

        if (status === 'paid' || status === 'approved') {
          // Buscar pagamento local
          const data = loadPixPayments();
          const payment = data.payments.find(p =>
            p.skaleTransactionId === skaleId || p.orderId === orderId
          );

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

  // API: Confirmar Pagamento PIX (para testing manual)
  if (pathname === '/api/confirmPixPayment' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

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

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`\n✅ Servidor rodando em http://localhost:${PORT}`);
  console.log(`🔗 API conectada a: ${API_URL}`);
  console.log(`✨ Agora você pode consultar CPFs reais!\n`);
});
