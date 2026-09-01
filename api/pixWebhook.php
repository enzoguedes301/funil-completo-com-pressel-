<?php
/**
 * POST /api/pixWebhook
 * Recebe a confirmação da Skale. É apenas uma otimização: mesmo sem webhook
 * o funil anda, porque getPixPayment consulta a Skale a cada verificação.
 *
 * Nunca confiamos no status que chega no corpo da requisição: qualquer pessoa
 * pode chamar esta URL. Usamos o aviso só como gatilho e conferimos o
 * pagamento direto na Skale antes de liberar.
 */
require_once __DIR__ . '/_pix_lib.php';

preparar_requisicao();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    responder_json(405, ['success' => false, 'erro' => 'Método não permitido']);
}

$evento = corpo_json();
$dadosEvento = $evento['data'] ?? $evento;

$skaleId = $dadosEvento['id'] ?? null;
$orderId = $dadosEvento['order_id'] ?? ($dadosEvento['orderId'] ?? ($dadosEvento['metadata']['orderId'] ?? null));

// Localiza o pagamento. Os ids precisam existir: comparar contra null casaria
// com qualquer pagamento sem skaleTransactionId e confirmaria o PIX errado.
$dados = pix_load();
$indice = null;
foreach ($dados['payments'] as $i => $p) {
    if ($skaleId && ($p['skaleTransactionId'] ?? null) === $skaleId) { $indice = $i; break; }
    if ($orderId && ($p['orderId'] ?? null) === $orderId) { $indice = $i; break; }
}

if ($indice === null) {
    error_log('[Webhook] Pagamento não encontrado (id=' . $skaleId . ', orderId=' . $orderId . ')');
    responder_json(200, ['success' => true, 'message' => 'Webhook recebido']);
}

// Confirma na fonte, não no corpo do webhook.
$pagamento = $dados['payments'][$indice];
$pagamento['lastCheckedAt'] = null; // força a consulta agora
sincronizar_com_skale($pagamento);

responder_json(200, [
    'success' => true,
    'message' => 'Webhook processado',
    'orderId' => $pagamento['orderId'] ?? null,
    'status' => $pagamento['status'] ?? 'PENDING',
]);
