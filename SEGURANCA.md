# 🔒 Guia Completo de Segurança Web & DevSecOps

## 1. Proteções Implementadas ✅

### **1.1 Bloqueio de Rastreamento (SEO / Web Crawlers)**

#### ✅ `robots.txt` (Criado)
- Localização: `/robots.txt` (raiz do projeto)
- Bloqueia **todos os crawlers** (`User-agent: *`)
- Desautoriza indexação completa (`Disallow: /`)
- Lista diretórios críticos: `/api`, `/.git`, `/.env`, `/node_modules`
- Bloqueia ferramentas de scraping conhecidas (AhrefsBot, SemrushBot, etc.)

#### ✅ Headers HTTP X-Robots-Tag
- **Implementado em:**
  - `server.js` (linhas ~285)
  - `.htaccess` (via `mod_headers`)
- **Headers enviados:**
  ```
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noocr
  ```
- Impede que search engines indexem, arquivem ou façam snippets do seu site

---

### **1.2 Proteção de Código-Fonte e Arquivos Sensíveis**

#### ✅ `.gitignore` (Já bem configurado)
```
.env                          # Variáveis de produção
.env.*                        # Todos os .env.*
pix_payments.json            # Dados de pagamento sensíveis
*.log                        # Logs (podem conter dados)
node_modules/                # Dependências (não versionar)
```

#### ✅ Bloqueio de Acesso Direto (`.htaccess`)
Bloqueados:
- `.git` (repositório)
- `.env` (credenciais)
- `.env.example` (template)
- `pix_payments.json` (dados)
- `node_modules/` (dependências)
- `*.map` (source maps)
- `server.js` (código backend)

#### ✅ Bloqueio de Source Maps
- **Em `server.js`:** Qualquer requisição a `*.map` retorna `403 Forbidden`
- **Em `.htaccess`:** Bloqueio adicional via `mod_rewrite`
- DevTools do navegador não conseguem acessar arquivo TypeScript/original

#### ✅ Desabilitação de Directory Listing
- **Em `.htaccess`:** `Options -Indexes`
- Ninguém pode listar conteúdo dos diretórios
- Acesso a `/api/` retorna erro, não lista arquivos

---

### **1.3 Mitigação de Bots Maliciosos e Scrapers**

#### ✅ Rate Limiting Implementado (server.js)
```javascript
// Máximo 30 requisições por minuto por IP
const MAX_REQUESTS_PER_WINDOW = 30;
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
```
- Bloqueia varreduras automatizadas
- Retorna HTTP 429 (Too Many Requests)
- Limpa automática de memória a cada 60s

#### ✅ Bloqueio de User-Agents Maliciosos (server.js)
Bloqueados:
- **Search engines:** Googlebot, Bingbot, Yandexbot, Baiduspider
- **Ferramentas de hacking:** Nmap, Masscan, Nikto, Nessus, SQLmap, Burp Suite
- **Scrapers:** Curl, Wget, Python, Scrapy, Selenium, Headless Chrome
- **Requisições sem User-Agent** (muito suspeitas)

#### ✅ Bloqueio de Diretórios Sensíveis (server.js)
Bloqueiam HTTP 403:
- `/.git`
- `/.env`
- `/node_modules`
- `/api/` (no backend, não afeta endpoints públicos)
- `/pix_payments.json`
- `/*.map`

---

## 2. Headers HTTP de Segurança Implementados

### **Implementados globalmente em:**
- ✅ `server.js` (Node.js)
- ✅ `.htaccess` (Apache)

### **Lista de Headers:**

```
X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noocr
  └─ Bloqueia indexação global por search engines

X-Content-Type-Options: nosniff
  └─ Impede MIME-type sniffing (proteção contra XSS)

X-Frame-Options: DENY
  └─ Bloqueia clickjacking (não pode ser carregado em <iframe>)

X-XSS-Protection: 1; mode=block
  └─ Ativa proteção XSS nativa do navegador

Referrer-Policy: strict-origin-when-cross-origin
  └─ Controla o envio de referrer para sites terceiros

Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
  └─ Desabilita APIs perigosas do navegador

Content-Security-Policy: default-src 'self'; ...
  └─ Controla quais scripts, estilos e recursos podem carregar
  └─ Bloqueia inline scripts não authorized
  └─ Permite apenas scripts do domínio `'self'` e APIs de confiança
```

---

## 3. Configuração em Nível de CDN/WAF (Cloudflare, Akamai, etc.)

### **Se você usar Cloudflare (Recomendado):**

1. **Acesse:** Cloudflare Dashboard → Seu domínio
2. **Vá em:** Security → Bots → Bot Management
3. **Configure:**
   - ✅ Enable Bot Management
   - ✅ Challenge Suspicious Bot Traffic
   - ✅ Block Known Bots
   - Customs rules para bloquear Scrapers

4. **Configurar Regras de WAF:**
   ```
   Regra: Bloquear requisições sem User-Agent
   Regra: Bloquear frequência > 30 req/min por IP
   Regra: Bloquear acesso a /.git, /.env, /node_modules
   Regra: Bloquear SQL injection patterns
   ```

5. **Caching:**
   - Page Rules: Cache Level = Cache Everything
   - Browser Cache TTL = 30 minutos

---

### **Se você usar outro CDN (Akamai, AWS CloudFront, etc.):**

**Akamai:**
- Edge Spoofing Protector
- Bot Manager
- Custom Rate Limiting Rules

**AWS CloudFront + WAF:**
```json
{
  "Rules": [
    {
      "Name": "RateLimitRule",
      "Priority": 1,
      "Action": "BLOCK",
      "Statement": {
        "RateBasedStatement": {
          "Limit": 1000,
          "AggregateKeyType": "IP"
        }
      }
    }
  ]
}
```

---

## 4. Configuração Específica: Hostgator

### **4.1 Upload do `.htaccess`**

1. Conecte via FTP / cPanel File Manager
2. Navegue até `public_html/`
3. Faça upload do arquivo `.htaccess` (este arquivo é simbiótico)
4. Teste acessando: `https://seu-site.com/.env` → deve retornar **403 Forbidden**

### **4.2 Ativar mod_rewrite (se necessário)**

1. Acesse **cPanel** → **Software/Services** → **Apache Handlers**
2. Procure por `htaccess`
3. Verifique se `mod_rewrite` está ativado
4. Se não estiver, entre em contato com suporte Hostgator

### **4.3 Ativar mod_headers**

1. cPanel → **Advanced** → **Apache Handlers**
2. Procure por `mod_headers` e `mod_expires`
3. Certifique-se de que estão ativados

### **4.4 Testar Proteções**

```bash
# Teste 1: Bloquear .env
curl -I https://seu-site.com/.env
# Esperado: 403 Forbidden

# Teste 2: Bloquear .git
curl -I https://seu-site.com/.git
# Esperado: 403 Forbidden

# Teste 3: Bloquear requisições sem User-Agent
curl -I -A "" https://seu-site.com/
# Esperado: 403 Forbidden (bloqueado no server.js)

# Teste 4: Simular Googlebot
curl -I -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://seu-site.com/
# Esperado: 403 Forbidden
```

---

## 5. Configuração de SSL/TLS (HTTPS)

### **Recomendado para Hostgator:**
1. Ative **Let's Encrypt SSL** (gratuito) via cPanel
2. Force HTTPS:
   - Em `.htaccess`, descomente:
     ```apache
     Header always set Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
     RewriteCond %{HTTPS} off
     RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
     ```

---

## 6. Monitoramento e Logs

### **Em `server.js`:**
Todos os bloqueios são logados:
- `[Bloqueio] Googlebot detectado: ...`
- `[Rate Limit] IP 192.168.1.1 foi bloqueado ...`
- `[Bloqueio] Bot detectado: ...`

### **Revisar Logs:**
1. cPanel → **Logs** → **Raw Access Logs**
2. Procure por padrões HTTP 403 (Forbidden)
3. Procure por bots conhecidos (curl, Scrapy, etc.)

### **Ferramentas de Monitoramento:**
- **Fail2ban** (Linux): Bloqueia IPs que tentam explorar
- **ModSecurity** (WAF): Detecta e bloqueia ataques
- **Cloudflare Analytics**: Monitoramento em tempo real

---

## 7. Checklist de Segurança

### **Antes de Colocar em Produção:**

- [ ] `robots.txt` criado e testado
- [ ] `.htaccess` enviado para `public_html/`
- [ ] Headers HTTP confirmados (curl test)
- [ ] Teste de acesso a `/.env` → 403
- [ ] Teste de acesso a `/.git` → 403
- [ ] Rate Limiting funcionando (>30 req/min = 429)
- [ ] Bot blocklist ativada
- [ ] SSL/HTTPS ativado
- [ ] Logs sendo monitorados
- [ ] Credenciais em `.env` (nunca no código)
- [ ] `pix_payments.json` não versionado
- [ ] `.gitignore` atualizado

### **Em Produção (Monitoramento Contínuo):**

- [ ] Revisar logs 1x/semana
- [ ] Verificar tentativas de acesso a `/.git`
- [ ] Monitorar taxa de requisições anômalas
- [ ] Atualizar WAF rules conforme novas ameaças aparecem
- [ ] Testar proteções mensalmente

---

## 8. Comandos Úteis para Teste

```bash
# Verificar todos os headers de segurança
curl -I https://seu-site.com/ | grep -i "x-\|content-security\|referrer-policy\|permissions-policy"

# Verificar robots.txt
curl -s https://seu-site.com/robots.txt

# Teste de Rate Limiting (30 requisições rápidas)
for i in {1..40}; do curl -s -w "%{http_code}\n" -o /dev/null https://seu-site.com/; done

# Teste com Bot User-Agent
curl -I -A "Mozilla/5.0 (compatible; Googlebot/2.1)" https://seu-site.com/

# Teste de Source Map
curl -I https://seu-site.com/js/app.js.map
# Esperado: 403 Forbidden
```

---

## 9. Alertas e Falsos Positivos

### **Se Usuários Legítimos Forem Bloqueados:**

1. Verifique User-Agent dele
2. Se for Curl, Wget ou Python: Explicar que é bot blocker
3. Se for navegador normal: Verificar IP (pode estar em range de datacenter)

### **Se Rate Limit for Muito Restritivo:**

Aumente em `server.js`:
```javascript
const MAX_REQUESTS_PER_WINDOW = 60; // Aumentou de 30 para 60
```

---

## 10. Recursos Adicionais

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Mozilla Web Security Guidelines](https://infosec.mozilla.org/guidelines/web_security)
- [Cloudflare DDoS Protection](https://www.cloudflare.com/ddos/)
- [Let's Encrypt SSL](https://letsencrypt.org/)

---

## ✅ Status de Implementação

| Proteção | Status | Arquivo |
|----------|--------|---------|
| robots.txt | ✅ Criado | `robots.txt` |
| Headers X-Robots-Tag | ✅ Implementado | `server.js`, `.htaccess` |
| Bloqueio .git/.env | ✅ Implementado | `.htaccess` |
| Bloqueio Source Maps | ✅ Implementado | `server.js`, `.htaccess` |
| Rate Limiting | ✅ Implementado | `server.js` |
| Bloqueio de Bots | ✅ Implementado | `server.js`, `.htaccess` |
| Directory Listing | ✅ Desabilitado | `.htaccess` |
| CSP Headers | ✅ Implementado | `server.js`, `.htaccess` |
| X-Frame-Options | ✅ Implementado | `server.js`, `.htaccess` |
| .gitignore | ✅ Verificado | `.gitignore` |

---

**Última atualização:** 2026-09-02  
**Responsável:** DevSecOps  
**Ambiente:** Hostgator (Apache + PHP)
