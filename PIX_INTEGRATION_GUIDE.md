# 🎯 Guia de Integração PIX - Funnel Completo

## ✅ O que foi implementado

### 1. **API PIX no Server** (`server.js`)
- ✅ `POST /api/createPixPayment` - Cria novo pagamento PIX dinâmico
- ✅ `GET /api/getPixPayment?id=...` - Obtém status do pagamento
- ✅ `POST /api/confirmPixPayment` - Confirma pagamento (webhook)
- ✅ Armazenamento local em `pix_payments.json`

### 2. **Checkouts PIX Dinâmicos**
- ✅ `checkout-pix.html` - Checkout principal (design premium)
- ✅ `upsell-checkout-pix.html` - Checkout para upsells (design compacto)
- ✅ Ambos com QR Code dinâmico + copy-paste PIX
- ✅ Timer de expiração (30 minutos)
- ✅ Confirmação de pagamento em tempo real

### 3. **Redirecionadores**
- ✅ `pix-checkout-redirect.html` - Página intermediária de transição

---

## 🚀 Como Integrar no Seu Funnel

### **Fluxo Principal (Checkout de Cartão)**

**Arquivo:** `12.html` (antes de ir para conclusão)

Adicione este código JavaScript no final do arquivo 12.html:

```javascript
// Redirecionar para checkout PIX
document.getElementById('btnCheckout').addEventListener('click', function() {
    const params = getUrlParams(); // Já definido em 12.html
    
    const pixCheckoutUrl = new URL('pix-checkout-redirect.html', window.location.href);
    pixCheckoutUrl.searchParams.append('amount', '97.00'); // Valor do cartão
    pixCheckoutUrl.searchParams.append('nome', params.nome || 'Cliente');
    pixCheckoutUrl.searchParams.append('cpf', params.cpf || '');
    pixCheckoutUrl.searchParams.append('orderId', `CARD_${Date.now()}`);
    pixCheckoutUrl.searchParams.append('returnUrl', 'conclusao/index.html');
    
    window.location.href = pixCheckoutUrl.toString();
});
```

---

### **Upsells (ex: Ativação, Seguro, Imposto)**

#### Opção A: Substituir arquivo checkout existente

**Arquivo:** `upsell/ativacao/checkout/index.html`

Substitua por este conteúdo ou adicione:

```html
<!-- No botão de continuar -->
<button onclick="goToPixCheckout()">Continuar</button>

<script>
function goToPixCheckout() {
    const params = getUrlParams();
    
    const pixUrl = new URL('../../../upsell-checkout-pix.html', window.location.href);
    pixUrl.searchParams.append('amount', '25.00'); // Valor do upsell
    pixUrl.searchParams.append('productName', 'Ativar Conta');
    pixUrl.searchParams.append('nome', params.nome);
    pixUrl.searchParams.append('nextUrl', '../../seguro/'); // Próximo upsell
    
    window.location.href = pixUrl.toString();
}
</script>
```

#### Opção B: Criar redirecionador intermediário

**Arquivo:** `upsell/ativacao/checkout-redirect.html`

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Processando...</title>
    <style>
        body { display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #667eea; }
        .spinner { width: 50px; height: 50px; border: 4px solid #fff; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="spinner"></div>
    <script>
        const params = new URLSearchParams(window.location.search);
        const pixUrl = new URL('../../../upsell-checkout-pix.html', window.location.href);
        pixUrl.searchParams.append('amount', '25.00');
        pixUrl.searchParams.append('productName', 'Ativar Conta');
        for (const [k, v] of params) pixUrl.searchParams.append(k, v);
        setTimeout(() => { window.location.href = pixUrl.toString(); }, 500);
    </script>
</body>
</html>
```

---

## 📋 Parâmetros Disponíveis

### Checkout Principal
```
checkoutpix.html?
  amount=97.00                    // Valor em reais
  &nome=João Silva               // Nome do cliente
  &cpf=12345678900              // CPF (opcional)
  &orderId=ORDER_123            // ID do pedido
  &description=Cartão de Crédito // Descrição
  &returnUrl=conclusao/index.html // Redirecionamento após pagamento
```

### Checkout Upsells
```
upsell-checkout-pix.html?
  amount=25.00                  // Valor do upsell
  &productName=Ativar Conta     // Nome do produto
  &nome=João Silva              // Nome do cliente
  &email=joao@email.com         // Email (opcional)
  &nextUrl=../../seguro/        // Próximo upsell/página
```

---

## 🧪 Testando

### 1. Iniciar o servidor
```bash
node server.js
```

### 2. Acessar checkout principal
```
http://localhost:8080/checkout-pix.html?amount=97.00&nome=TestCliente
```

### 3. Confirmando pagamento para teste
```bash
# Copie o paymentId que aparece no console, então:
curl -X POST http://localhost:8080/api/confirmPixPayment \
  -H "Content-Type: application/json" \
  -d '{"paymentId":"PIX_XXXXX"}'
```

---

## 📊 Arquivo de Pagamentos

Os pagamentos são salvos em `pix_payments.json`:

```json
{
  "payments": [
    {
      "id": "PIX_1234567890_abc123def",
      "orderId": "ORDER_123",
      "amount": 97.00,
      "status": "CONFIRMED",
      "createdAt": "2025-08-25T10:30:00.000Z",
      "paidAt": "2025-08-25T10:35:00.000Z",
      "expiresAt": "2025-08-25T11:00:00.000Z"
    }
  ]
}
```

---

## 🔄 Fluxo Completo de Exemplo

### Usuario chega no index.html
```
index.html 
  → validacao.html (CPF)
  → 2.html (Análise)
  → 3.html → 5.html → 6.html → 7.html → 8.html → 9.html → 10.html → 11.html → 12.html
  → pix-checkout-redirect.html
  → checkout-pix.html (Pagamento PIX Principal)
  → [Se upsell de Ativação]
    → upsell/ativacao/index.html
    → upsell-checkout-pix.html (Pagamento PIX Ativação - R$25)
    → upsell/seguro/index.html
    → upsell-checkout-pix.html (Pagamento PIX Seguro)
    → ...
  → conclusao/index.html
```

---

## ⚙️ Configurações Avançadas

### Alterar valor do pagamento dinâmicamente

```javascript
// Em qualquer arquivo HTML
function goToCheckoutWithValue(amount) {
    const url = new URL('checkout-pix.html', window.location.href);
    url.searchParams.append('amount', amount);
    url.searchParams.append('nome', getUserName());
    window.location.href = url.toString();
}
```

### Capturar dados antes do checkout

```javascript
// Adicionar dados customizados
const pixUrl = new URL('checkout-pix.html', window.location.href);
pixUrl.searchParams.append('amount', cartTotal);
pixUrl.searchParams.append('orderId', generateOrderId());
pixUrl.searchParams.append('description', `Compra de ${productCount} produtos`);
window.location.href = pixUrl.toString();
```

---

## 🛠️ Troubleshooting

### QR Code não aparece
- Verifique se `qrcodejs` CDN está acessível
- Verifique console do navegador (F12) para erros

### Pagamento não confirma automaticamente
- Confirmação é manual via checkbox (para testes)
- Em produção, configurar webhook do seu gateway PIX

### Valores não aparecem
- Verifique se parâmetro `amount` está na URL
- Verifique se está em formato decimal (ex: 25.00)

### Parametros não são passados entre páginas
- Use `buildUrlWithParams()` que já está definido em todos os arquivos
- Verifique se `getUrlParams()` está no escopo

---

## 💡 Próximos Passos

### 1. **Integrar com Gateway Real**
Se está usando Skale ou outro:
- Atualizar `server.js` com credenciais da API
- Modificar `/api/createPixPayment` para chamar API real
- Implementar webhook para confirmar pagamentos

### 2. **Banco de Dados**
- Substituir `pix_payments.json` por MongoDB/MySQL
- Salvar dados do cliente junto com pagamento
- Registrar tentativas de pagamento

### 3. **Webhooks**
- Configurar endpoint `/api/pixWebhook` no server
- Gateway PIX envia confirmação automaticamente
- Atualizar status do pagamento em tempo real

### 4. **Analytics**
- Rastrear qual % de usuários vai para PIX vs cartão
- Medir tempo médio de conclusão do PIX
- Acompanhar taxa de conversão por upsell

---

## 📞 Suporte

Qualquer dúvida sobre integração, abra um issue ou revise:
- `server.js` - Endpoints da API
- `checkout-pix.html` - Checkout principal
- `upsell-checkout-pix.html` - Checkouts de upsells
