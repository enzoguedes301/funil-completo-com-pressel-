# 🚀 Setup Rápido - PIX no Funnel

## ✨ O que foi feito

Implementação completa de **API PIX dinâmica** com checkout modular para:
- ✅ Checkout principal (cartão)
- ✅ Todos os upsells (ativação, seguro, imposto, etc)
- ✅ QR Code dinâmico + Copy-paste PIX
- ✅ Timer de expiração automática
- ✅ Confirmação de pagamento em tempo real
- ✅ Armazenamento local de pagamentos

---

## 🎯 Arquivos Criados/Modificados

### Novos Arquivos
| Arquivo | Função |
|---------|--------|
| `checkout-pix.html` | Checkout PIX principal (design premium) |
| `upsell-checkout-pix.html` | Checkout PIX para upsells |
| `pix-checkout-redirect.html` | Página intermediária |
| `PIX_INTEGRATION_GUIDE.md` | Guia completo de integração |
| `pix_payments.json` | Armazenamento de pagamentos |

### Arquivos Modificados
| Arquivo | Alteração |
|---------|-----------|
| `server.js` | +3 endpoints PIX + storage |
| `upsell/ativacao/checkout/index.html` | Integração com PIX dinâmico |

---

## 🚦 Teste Rápido (1 minuto)

### 1️⃣ Iniciar servidor
```bash
cd c:\Users\luizt\funil-completo-com-pressel-
node server.js
```

Você verá:
```
✅ Servidor rodando em http://localhost:8080
🔗 API conectada a: https://magmadatahub.com/api.php
✨ Agora você pode consultar CPFs reais!
```

### 2️⃣ Acessar checkout PIX principal
```
http://localhost:8080/checkout-pix.html?amount=97&nome=TestClient
```

Você verá:
- 💰 Valor: R$ 97,00
- 📱 QR Code gerado automaticamente
- 🔑 Chave PIX para copy-paste
- ⏱️ Timer de 30 minutos

### 3️⃣ Testar upsell (Ativação)
```
http://localhost:8080/upsell-checkout-pix.html?amount=25&productName=Ativar%20Conta&nextUrl=conclusao/index.html
```

### 4️⃣ Confirmar pagamento (teste manual)
Abra DevTools (F12) → Console, copie o `paymentId` que aparece, depois:

```javascript
fetch('/api/confirmPixPayment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId: 'PIX_xxx_yyy' })
}).then(r => r.json()).then(console.log);
```

---

## 📍 Integração Passo a Passo

### Opção A: Checkout Principal (12.html → PIX)

**Arquivo:** `12.html`

Encontre o botão de continuar e adicione:

```javascript
document.getElementById('btnContinuar').addEventListener('click', function() {
    const params = getUrlParams(); // Já existe em 12.html
    
    // URL para checkout PIX
    const pixUrl = new URL('pix-checkout-redirect.html', window.location.href);
    pixUrl.searchParams.append('amount', '97.00');
    pixUrl.searchParams.append('nome', params.nome);
    pixUrl.searchParams.append('cpf', params.cpf);
    pixUrl.searchParams.append('returnUrl', 'conclusao/index.html');
    
    window.location.href = pixUrl.toString();
});
```

### Opção B: Upsells (Já Integrado!)

**Arquivo:** `upsell/ativacao/checkout/index.html` ✅ JÁ ESTÁ PRONTO

Basta clicar em "Continuar" que já vai para PIX dinâmico.

---

## 🧪 Casos de Teste

### Teste 1: Fluxo Completo
```
index.html 
  → validacao.html (insira CPF válido ex: 123.456.789-00)
  → 2.html (continuar)
  → ... (próximas páginas)
  → 12.html (Clique em continuar)
  → checkout-pix.html (PIX Principal - R$97)
  → conclusao/index.html (Sucesso!)
```

### Teste 2: Upsell Ativação
```
http://localhost:8080/upsell/ativacao/index.html?nome=TestUser
  → upsell/ativacao/checkout/index.html
  → upsell-checkout-pix.html (PIX - R$25)
  → upsell/seguro/index.html
```

### Teste 3: Pagamento
1. Abra checkout PIX
2. Copie a chave PIX
3. Abra DevTools (F12)
4. Copie o `paymentId` do console
5. Execute confirmação via API (ver seção acima)
6. Página redireciona automaticamente

---

## 💰 Valores de Teste

| Tipo | Valor | Arquivo |
|------|-------|---------|
| Cartão Principal | R$ 97,00 | `checkout-pix.html` |
| Ativação | R$ 25,00 | `upsell-checkout-pix.html` |
| Seguro | R$ 49,90 | `upsell-checkout-pix.html` |
| Imposto | R$ 39,90 | `upsell-checkout-pix.html` |

(Ajuste nos respectivos checkouts conforme necessário)

---

## 🔧 Customizações Rápidas

### Alterar valor do checkout principal
**Arquivo:** `checkout-pix.html` linha ~100
```javascript
const amount = parseFloat(params.amount) || 97.00; // ← Mude aqui
```

### Alterar timer de expiração
**Arquivo:** `server.js` linha ~49
```javascript
const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
// Para 1 hora: 60 * 60 * 1000
// Para 15 min: 15 * 60 * 1000
```

### Alterar tempo de verificação de pagamento
**Arquivo:** `checkout-pix.html` linha ~260
```javascript
pixCheckInterval = setInterval(checkPaymentStatus, 3000); // Verifica a cada 3s
```

---

## 📊 Dados de Pagamento

Todos os pagamentos são salvos em `pix_payments.json`:

```bash
# Ver todos os pagamentos
type pix_payments.json | findstr payment

# Limpar histórico (Windows)
echo { "payments": [] } > pix_payments.json
```

Estrutura:
```json
{
  "id": "PIX_1234567890_abc123def",
  "orderId": "ORDER_123",
  "amount": 97.00,
  "status": "PENDING|CONFIRMED",
  "createdAt": "2025-08-25T10:30:00.000Z",
  "expiresAt": "2025-08-25T11:00:00.000Z",
  "paidAt": "2025-08-25T10:35:00.000Z"
}
```

---

## 🌐 URLs Prontas

### Checkout Principal
```
http://localhost:8080/checkout-pix.html
http://localhost:8080/checkout-pix.html?amount=197&nome=João%20Silva
http://localhost:8080/checkout-pix.html?amount=97&nome=Cliente&cpf=12345678900&returnUrl=conclusao/index.html
```

### Checkout Upsells
```
http://localhost:8080/upsell-checkout-pix.html?amount=25&productName=Ativar
http://localhost:8080/upsell-checkout-pix.html?amount=49.90&productName=Seguro&nextUrl=upsell/imposto/
```

### Redirecionador
```
http://localhost:8080/pix-checkout-redirect.html?amount=97&nome=Cliente
```

---

## ❌ Troubleshooting

### Servidor não inicia
```bash
# Verificar se porta 8080 está em uso
netstat -ano | findstr :8080

# Usar outra porta
# Edite server.js linha 180: const PORT = 8081;
```

### QR Code não aparece
- Verifique conexão com CDN (qrcodejs)
- Abra DevTools (F12) → Console
- Procure por erros JavaScript

### Pagamento não confirma
- Verifique se `paymentId` está correto
- Veja em `pix_payments.json` se o registro existe
- Teste a API diretamente:
  ```bash
  curl -X GET http://localhost:8080/api/getPixPayment?id=PIX_xxx_yyy
  ```

### Parâmetros desaparecem
- Use `buildUrlWithParams()` que já existe
- Verifique se `getUrlParams()` está definido no escopo

---

## ✅ Checklist de Produção

Antes de ir para produção com PIX real:

- [ ] Integrar com gateway PIX real (Skale/Asaas/Braspag)
- [ ] Remover armazenamento em JSON (usar banco de dados)
- [ ] Configurar HTTPS (obrigatório para PIX)
- [ ] Implementar webhooks do gateway para confirmar pagamentos
- [ ] Adicionar logs de auditoria
- [ ] Testar com valores reais
- [ ] Configurar timeouts/retries
- [ ] Implementar retry automático para pagamentos
- [ ] Adicionar suporte a celular/desktop
- [ ] Configurar analytics e rastreamento

---

## 📞 Próximas Etapas

### 1. Integração com Skale
Se for usar Skale, atualizar `server.js`:
```javascript
const SKALE_API_KEY = process.env.SKALE_API_KEY;
const SKALE_API_URL = 'https://api.skale.com.br';

// Modificar createPixPayment para chamar API Skale
```

### 2. Banco de Dados
Substituir `pix_payments.json` por:
- MongoDB
- MySQL
- PostgreSQL

### 3. Webhooks
Implementar endpoint `/api/pixWebhook` para:
- Receber confirmações do gateway
- Atualizar status automaticamente
- Disparar eventos (email, SMS, etc)

### 4. Analytics
Adicionar tracking:
- Qual % de usuários escolhe PIX
- Tempo médio para confirmar PIX
- Taxa de abandono

---

## 💡 Tips

✅ Use URLs com parâmetros para testar diferentes valores
✅ Verifique DevTools (F12) → Network para debug
✅ `pix_payments.json` fica em tempo real (recarregue para ver)
✅ Timer é local, não sincroniza entre abas
✅ QR Code é regenerado a cada novo pagamento

---

**Pronto!** 🎉 Seu funnel agora tem PIX dinâmico funcionando!

Qualquer dúvida, revise `PIX_INTEGRATION_GUIDE.md` para detalhes técnicos.
