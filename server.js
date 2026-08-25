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
const SKALE_API_KEY = process.env.SKALE_API_KEY || 'seu_skale_api_key_aqui';
const SKALE_API_URL = 'https://api.skale.com.br'; // Ajuste conforme documentação da Skale

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

// Gerar string PIX para copy-paste (EMV)
function generatePixCopyPaste(amount, orderId) {
  const pixKey = '00000000-0000-0000-0000-000000000000'; // Chave PIX exemplo (UUID)
  const merchantName = 'MERCADO PAGAMENTO';
  const merchantCity = 'SAO PAULO';

  return `00020126360014br.gov.bcb.brcode01051.0.0` +
    `0300${String(merchantName).length.toString().padStart(2, '0')}${merchantName}` +
    `3013${merchantCity}` +
    `${String(String(amount.toFixed(2)).replace('.', '')).length.toString().padStart(2, '0')}${String(amount.toFixed(2)).replace('.', '')}`;
}

// Gerar QR Code (versão simplificada - em produção usar biblioteca qrcode)
function generateQrCodeString(amount, orderId) {
  return `PIX|${amount}|${orderId}|${Date.now()}`;
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

  // API: Criar Pagamento PIX
  if (pathname === '/api/createPixPayment' && req.method === 'POST') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const { amount, orderId, customerName, customerEmail, description } = JSON.parse(body);

        if (!amount || !orderId) {
          res.writeHead(400);
          res.end(JSON.stringify({ success: false, erro: 'amount e orderId são obrigatórios' }));
          return;
        }

        const paymentId = `PIX_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        const payment = {
          id: paymentId,
          orderId,
          amount,
          customerName,
          customerEmail,
          description,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          expiresAt,
          qrCode: generateQrCodeString(amount, orderId),
          pixCopyPaste: generatePixCopyPaste(amount, orderId)
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
          qrCode: payment.qrCode,
          pixCopyPaste: payment.pixCopyPaste
        }));
      } catch (e) {
        console.error('Erro ao criar pagamento PIX:', e.message);
        res.writeHead(400);
        res.end(JSON.stringify({ success: false, erro: 'Erro ao processar requisição' }));
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

  // API: Confirmar Pagamento PIX (para testing/webhook)
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
