const http = require('http');
const https = require('https');
const url = require('url');
const path = require('path');
const fs = require('fs');

// Token da API (usando o primeiro token disponível)
const API_TOKEN = 'CPF_API_TOKEN_REMOVIDO_DO_HISTORICO';
const API_URL = 'https://magmadatahub.com/api.php';

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
