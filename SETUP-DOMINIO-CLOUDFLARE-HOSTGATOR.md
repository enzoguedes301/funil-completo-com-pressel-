# 🌐 Setup Completo: Dynadot + Cloudflare + Hostgator

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    SEU DOMÍNIO (Dynadot)                        │
│                     seu-dominio.com.br                          │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    Apontar DNS para:
                  Cloudflare Nameservers
                             │
         ┌───────────────────┴────────────────────┐
         │                                        │
    ┌────▼──────────────────┐         ┌──────────▼──────────────┐
    │    🛡️ CLOUDFLARE      │         │                        │
    │  (Proxy + Segurança)  │         │  Benefícios:           │
    │                       │         │  ✅ SSL/HTTPS grátis   │
    │  - Bot Management     │         │  ✅ DDoS Protection    │
    │  - Rate Limiting      │         │  ✅ WAF Rules          │
    │  - Cache              │         │  ✅ Analytics          │
    │  - Workers (APIs)     │         │  ✅ Bloqueia bots      │
    └────┬──────────────────┘         └──────────────────────────┘
         │
         │ Apontar A Record para:
         │ IP da Hostgator
         │
    ┌────▼──────────────────────────────────────────────────────┐
    │           🏠 HOSTGATOR (Hospedagem)                       │
    │                                                            │
    │  - Apache + PHP                                           │
    │  - Servidor compartilhado                                 │
    │  - Seu .htaccess + segurança                             │
    │  - Banco de dados MySQL                                  │
    └────────────────────────────────────────────────────────────┘
```

---

## PASSO 1: Comprar Hospedagem Hostgator

### 1.1 Acessar Hostgator
- Vá para: https://www.hostgator.com/
- Escolha um plano (recomendado: Business ou Cloud)
- **Não registre um domínio com eles** - você já tem um na Dynadot
- Finalizar compra

### 1.2 Dados importantes a anotar
Após comprar, você receberá:
```
📧 Email de boas-vindas com:
├── Nome de usuário cPanel
├── Senha cPanel
├── URL cPanel: cpanel.seu-ip.hostgator.com
├── IP do servidor (ex: 123.456.789.000)
├── Nameservers Hostgator (não vamos usar, Cloudflare será proxy)
└── Dados FTP/SSH
```

**Guarde estes dados!** ⚠️

---

## PASSO 2: Configurar Cloudflare

### 2.1 Criar Conta Cloudflare
1. Vá para: https://www.cloudflare.com/
2. Clique em **"Sign up"** (ou faça login se já tiver)
3. Escolha o plano **FREE** (gratuito)
4. Confirme email

### 2.2 Adicionar Domínio no Cloudflare
1. Dashboard Cloudflare → **"Add a site"**
2. Insira seu domínio: `seu-dominio.com.br`
3. Cloudflare vai **verificar DNS automaticamente**
4. Escolha plano **FREE** (próxima tela)
5. Cloudflare vai gerar 2 **Nameservers** como estes:
   ```
   kristin.ns.cloudflare.com
   nico.ns.cloudflare.com
   ```
   **COPIE ESTES NOMES!** ⚠️

### 2.3 Configurar Apontamento de DNS (Dynadot → Cloudflare)
1. Acesse: https://www.dynadot.com/
2. Login na sua conta
3. Vá para: **"My Domains"** → Seu domínio → **"DNS"**
4. Procure por **"Nameservers"** ou **"Use Custom Nameservers"**
5. Remova os nameservers atuais (se houver)
6. Adicione os **2 Nameservers do Cloudflare:**
   ```
   kristin.ns.cloudflare.com
   nico.ns.cloudflare.com
   ```
7. **Salvar** e aguarde propagação (5-30 minutos)

### 2.4 Verificar Propagação DNS
Volte ao Cloudflare:
1. Dashboard → Seu domínio
2. Espere aparecer: ✅ **"Great news! Nameservers are pointed to Cloudflare"**

---

## PASSO 3: Apontar Cloudflare para Hostgator

### 3.1 Configurar DNS Records no Cloudflare
1. Dashboard Cloudflare → **"DNS"** (menu esquerdo)
2. Você deve ter um **A Record** já criado, mas vamos verificar/editar

### 3.2 Adicionar/Editar A Record
1. Clique em **"Add record"** (ou edite existente)
2. Configure assim:

   ```
   Type: A
   Name: @ (raiz do domínio) ou seu-dominio.com.br
   IPv4 address: 123.456.789.000 (IP do seu servidor Hostgator)
   TTL: Auto
   Proxy status: ⚡ Proxied (importante!)
   ```

3. **Salvar**

### 3.3 Adicionar WWW (opcional mas recomendado)
1. Clique em **"Add record"** novamente
2. Configure:
   ```
   Type: CNAME
   Name: www
   Target: seu-dominio.com.br
   TTL: Auto
   Proxy status: ⚡ Proxied
   ```

3. **Salvar**

**DNS Records Finais (exemplo):**
```
Type  | Name                | Content              | Proxy
------|---------------------|----------------------|-------
A     | seu-dominio.com.br  | 123.456.789.000      | ⚡ Proxied
CNAME | www                 | seu-dominio.com.br   | ⚡ Proxied
```

---

## PASSO 4: Configurar SSL/HTTPS no Cloudflare

### 4.1 Ativar SSL
1. Dashboard Cloudflare → **"SSL/TLS"** (menu esquerdo)
2. Escolha **"Full"** (não "Flexible")
3. Cloudflare vai gerar certificado automaticamente (grátis)

### 4.2 Forçar HTTPS
1. Cloudflare → **"SSL/TLS"** → **"Edge Certificates"**
2. Ative: **"Always Use HTTPS"** ✅
3. Ative: **"Automatic HTTPS Rewrites"** ✅

---

## PASSO 5: Configurar Hospedagem Hostgator

### 5.1 Acessar cPanel
1. Abra: `cpanel.seu-ip.hostgator.com` (ou link no email)
2. Login com credenciais recebidas

### 5.2 Adicionar Domínio no cPanel
1. cPanel → **"Addon Domains"** (ou "Parked Domains")
2. Clique em **"Add Domain"**
3. Insira seu domínio: `seu-dominio.com.br`
4. cPanel vai criar pasta pública automaticamente (geralmente `/public_html/seu-dominio/`)
5. **Confirmar**

### 5.3 Confirmar Raiz Pública
Verifique onde seus arquivos devem ir:
- Geralmente: `/public_html/` para domínio raiz
- Ou: `/public_html/seu-dominio/` se for addon domain

---

## PASSO 6: Upload de Arquivos para Hostgator

### 6.1 Via FTP (recomendado)
1. Baixe FileZilla: https://filezilla-project.org/
2. Conecte com dados FTP do email Hostgator:
   ```
   Host: seu-ip.hostgator.com (ou ftp.seu-dominio.com.br)
   Username: seu-usuario-ftp
   Password: sua-senha-ftp
   Port: 21
   ```

### 6.2 Upload de Arquivos
1. Na esquerda (seu PC): navegue até seu projeto
2. Na direita (servidor): vá para `/public_html/`
3. Upload de:
   - `index.html` e páginas
   - `upsell/` (pasta inteira)
   - `api/` (pasta inteira com arquivos PHP)
   - `.htaccess` (arquivo de segurança)
   - `robots.txt`
   - **Não faça upload:** `.env`, `.git`, `node_modules/`, `server.js`

### 6.3 Permissões de Arquivo
Após upload, configure permissões (cPanel):
1. cPanel → **"File Manager"**
2. Navegue para `/public_html/`
3. Clique direito em pasta → **"Change Permissions"**
   ```
   Pastas: 755
   Arquivos: 644
   .htaccess: 644
   ```

---

## PASSO 7: Configurar .env em Produção (Hostgator)

### ⚠️ NÃO FAÇA UPLOAD DO `.env` VIA FTP

Em vez disso, crie via cPanel:

1. cPanel → **"File Manager"**
2. Vá para `/public_html/`
3. Criar novo arquivo: `.env`
4. Adicionar conteúdo:
   ```env
   PORT=8080
   SKALE_API_KEY=sk_live_sua_chave_real
   CPF_API_TOKEN=seu_token_real
   ALLOW_MANUAL_PIX_CONFIRM=
   ```

**Alternativa (via SSH):**
```bash
ssh seu-usuario@seu-ip.hostgator.com
cd public_html/
nano .env
# Adicione as variáveis
# Ctrl+X, Y, Enter para salvar
```

---

## PASSO 8: Testar Domínio

### 8.1 Verificar DNS (aguarde propagação)
```bash
# Terminal/CMD
nslookup seu-dominio.com.br
# Deve retornar IP do Cloudflare (proxy)

# ou
dig seu-dominio.com.br
```

### 8.2 Acessar Site
1. Abra navegador: `https://seu-dominio.com.br`
2. Deve carregar seu site ✅
3. Verificar SSL (cadeado verde) 🔒

### 8.3 Testar Proteções de Segurança
```bash
# Teste 1: Bloquear .env
curl -I https://seu-dominio.com.br/.env
# Esperado: 403 Forbidden ✅

# Teste 2: Bloquear .git
curl -I https://seu-dominio.com.br/.git
# Esperado: 403 Forbidden ✅

# Teste 3: Headers de segurança
curl -I https://seu-dominio.com.br/ | grep "X-Robots-Tag"
# Esperado: X-Robots-Tag: noindex, nofollow... ✅

# Teste 4: Simular bot
curl -I -A "Googlebot/2.1" https://seu-dominio.com.br/
# Esperado: 403 Forbidden ✅
```

---

## PASSO 9: Configurar WAF e Bot Protection (Cloudflare)

### 9.1 Ativar Bot Management
1. Cloudflare → **"Security"** → **"Bots"**
2. Ativar **"Bot Management"** (plano pago, mas teste está ok)
3. Escolher modo:
   - ✅ **Challenge Suspicious Bot Traffic** (recomendado)
   - ✅ **Block Known Bots**

### 9.2 Configurar WAF Rules
1. Cloudflare → **"Security"** → **"WAF"**
2. Criar nova regra:
   ```
   Name: Block Sensitive Paths
   Rule: (cf.uri_path contains "/.git" OR contains "/.env" OR contains "/node_modules")
   Action: Block
   ```

3. Criar regra de Rate Limiting:
   ```
   Name: Rate Limit API
   Rule: (cf.uri_path contains "/api/")
   Action: Managed Challenge
   Rate Limit: 100 requests per 10 seconds
   ```

### 9.3 Modo Segurança
1. Cloudflare → **"Security Level"** → Escolher **"High"**
2. Cloudflare → **"Challenge Passage"** → 30 minutos

---

## PASSO 10: Verificar Logs e Monitoramento

### 10.1 Logs Cloudflare
1. Cloudflare Dashboard → **"Analytics"** → **"Logs"**
2. Procurar por:
   - Requisições bloqueadas (status 403)
   - Bots detectados
   - Tráfego suspeito

### 10.2 Logs Hostgator (cPanel)
1. cPanel → **"Logs"** → **"Raw Access Logs"**
2. Analisar requisições HTTP
3. Procurar por User-Agents maliciosos

---

## Checklist Final

- [ ] Domínio comprado na Dynadot ✅
- [ ] Hosting comprado na Hostgator ✅
- [ ] Conta Cloudflare criada ✅
- [ ] Nameservers Dynadot apontando para Cloudflare ✅
- [ ] A Record Cloudflare apontando para Hostgator ✅
- [ ] SSL/HTTPS ativo no Cloudflare ✅
- [ ] Domínio adicionado em cPanel Hostgator ✅
- [ ] Arquivos enviados via FTP ✅
- [ ] .env criado via cPanel (SEM upload FTP) ✅
- [ ] robots.txt e .htaccess no lugar ✅
- [ ] Testes de segurança passando ✅
- [ ] Bot Management ativo no Cloudflare ✅
- [ ] WAF Rules configuradas ✅
- [ ] Site acessível via HTTPS ✅
- [ ] Cadeado 🔒 verde no navegador ✅

---

## Troubleshooting

### ❌ Domínio não resolve
```bash
# Verificar DNS
nslookup seu-dominio.com.br

# Se retornar Cloudflare, ok. Se não:
1. Aguarde 30 minutos (propagação DNS)
2. Limpe cache DNS: ipconfig /flushdns (Windows)
3. Verifique Dynadot → Nameservers estão corretos
```

### ❌ HTTPS não funciona
```
1. Vá a Cloudflare → SSL/TLS
2. Mude para "Full (strict)"
3. Aguarde certificado ser gerado (5 min)
```

### ❌ Site em branco (erro 500)
```
1. cPanel → Error Logs
2. Verificar se .htaccess está correto
3. Verificar se .env está no lugar
4. Verificar permissões de pasta (755)
```

### ❌ Bots conseguem acessar .env
```
1. Verificar .htaccess está em /public_html/
2. Verifique se mod_rewrite está ativo (cPanel)
3. Teste: curl -I https://seu-dominio.com.br/.env
```

---

## Próximos Passos

1. **Monitorar Logs:** Revisar Cloudflare analytics 1x/semana
2. **Atualizar SEGURANCA.md:** Com instruções específicas do Cloudflare
3. **Backup Automático:** Configurar backup no cPanel
4. **Monitoramento:** Considerar Uptimerobot para alertas

---

**Salve este documento!** Ele será sua referência. 📌
