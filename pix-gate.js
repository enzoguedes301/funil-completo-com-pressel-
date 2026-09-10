/**
 * PixGate — trava de pagamento do funil.
 *
 * Regra única: o lead só avança quando o servidor (que consulta a Skale)
 * responder status CONFIRMED. Nenhuma página decide isso por conta própria.
 *
 * Uso:
 *   const pix = await PixGate.create({ amount, orderId, description });
 *   PixGate.watch(() => window.location.href = proximaPagina);
 *   // no botão "Já paguei":
 *   const { paid } = await PixGate.check();
 */
window.PixGate = (function () {
  let paymentId = null;
  let paid = false;
  let verifiable = true;
  let pollTimer = null;
  let lastStatus = 'PENDING';
  let onPaidFallback = null; // callback registrado em watch()
  let notified = false;      // garante que o avanço dispare uma única vez

  // Dispara o avanço no máximo uma vez, venha do polling ou do botão de teste
  function notifyPaid(result) {
    if (notified) return;
    notified = true;
    stop();
    if (typeof onPaidFallback === 'function') onPaidFallback(result);
  }

  // Coleta os parâmetros de origem (UTMify/anúncio) para anexar à venda na Skale.
  // Sem isto a transação chega no UTMify sem origem e a venda não é atribuída
  // a nenhum anúncio. Lê da URL (o funil propaga os params página a página) e
  // guarda no localStorage como rede de segurança, caso a query se perca.
  function coletarUtms() {
    var chaves = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','src','sck','fbclid','gclid','gbraid','wbraid','utmify_id'];
    var out = {};
    try {
      var url = new URLSearchParams(window.location.search);
      chaves.forEach(function (k) { var v = url.get(k); if (v) out[k] = v; });

      var salvos = {};
      try { salvos = JSON.parse(localStorage.getItem('utm_tracking') || '{}'); } catch (e) {}
      // A URL tem prioridade; o storage completa o que faltar.
      chaves.forEach(function (k) { if (!out[k] && salvos[k]) out[k] = salvos[k]; });

      if (Object.keys(out).length) {
        try { localStorage.setItem('utm_tracking', JSON.stringify(out)); } catch (e) {}
      }
    } catch (e) {}
    return out;
  }

  async function create(payload) {
    const response = await fetch('/api/createPixPayment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: payload.amount,
        orderId: payload.orderId,
        customerName: payload.customerName || 'Cliente',
        customerEmail: payload.customerEmail || '',
        customerDocument: payload.customerDocument || '',
        customerPhone: payload.customerPhone || '',
        description: payload.description || 'Pagamento',
        tracking: coletarUtms()
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.erro || 'Não foi possível gerar o PIX');
    }

    paymentId = data.paymentId;

    // Só aparece com ALLOW_MANUAL_PIX_CONFIRM=1 no servidor
    if (data.testMode) mostrarBotaoTeste();

    return data;
  }

  // ---------------------------------------------------------------
  // MODO TESTE — permite percorrer o funil inteiro sem pagar.
  // Nunca aparece em produção: depende do servidor liberar.
  // ---------------------------------------------------------------
  function mostrarBotaoTeste() {
    if (document.getElementById('pixGateTestBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'pixGateTestBtn';
    btn.type = 'button';
    btn.textContent = '🧪 Simular pagamento (teste)';
    btn.style.cssText = [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:99999',
      'background:#7c3aed', 'color:#fff', 'border:0', 'border-radius:999px',
      'padding:12px 20px', 'font:600 14px system-ui,sans-serif',
      'cursor:pointer', 'box-shadow:0 4px 16px rgba(0,0,0,.3)'
    ].join(';');

    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Confirmando...';

      try {
        const res = await fetch('/api/confirmPixPayment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId: paymentId })
        });
        const data = await res.json();

        if (!data.success) throw new Error(data.erro || 'Falhou');

        btn.textContent = '✓ Pago (teste)';
        const result = await check();
        if (result.paid) notifyPaid(result);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = '🧪 Simular pagamento (teste)';
        alert('Modo teste desligado no servidor.\n\nSuba assim:\n  $env:ALLOW_MANUAL_PIX_CONFIRM=\'1\'; node server.js');
      }
    });

    document.body.appendChild(btn);
  }

  // Consulta única ao servidor. Retorna { paid, status, verifiable }.
  async function check() {
    if (!paymentId) return { paid: false, status: 'NO_PAYMENT', verifiable: false };

    try {
      const response = await fetch('/api/getPixPayment?id=' + encodeURIComponent(paymentId), {
        cache: 'no-store'
      });
      const data = await response.json();

      if (data.success) {
        lastStatus = data.status;
        verifiable = data.verifiable !== false;
        paid = data.status === 'CONFIRMED';
      }
    } catch (e) {
      console.error('[PixGate] Falha ao verificar pagamento:', e);
    }

    return { paid: paid, status: lastStatus, verifiable: verifiable };
  }

  // Verifica em intervalo até confirmar. Chama onPaid uma única vez.
  function watch(onPaid, intervalMs) {
    stop();
    onPaidFallback = onPaid;
    pollTimer = setInterval(async () => {
      const result = await check();
      if (result.paid) notifyPaid(result);
    }, intervalMs || 4000);
  }

  function stop() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  function isPaid() {
    return paid;
  }

  function getPaymentId() {
    return paymentId;
  }

  // Monta a URL de destino preservando os parâmetros da jornada.
  function nextUrl(baseUrl) {
    const url = new URL(baseUrl, window.location.href);
    new URLSearchParams(window.location.search).forEach((value, key) => {
      if (!url.searchParams.has(key)) url.searchParams.append(key, value);
    });
    return url.toString();
  }

  return {
    create: create,
    check: check,
    watch: watch,
    stop: stop,
    isPaid: isPaid,
    getPaymentId: getPaymentId,
    nextUrl: nextUrl
  };
})();
