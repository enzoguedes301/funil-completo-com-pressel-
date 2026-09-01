<?php
/**
 * GET /api/getPixPayment?id=PIX_...
 * Devolve o status do pagamento, consultando a Skale antes de responder.
 *
 * É este endpoint que faz o funil andar sem webhook: o front chama de tempos
 * em tempos e só avança quando o status vira CONFIRMED.
 */
require_once __DIR__ . '/_pix_lib.php';

preparar_requisicao();

$paymentId = trim((string) ($_GET['id'] ?? ''));

if ($paymentId === '') {
    responder_json(400, ['success' => false, 'erro' => 'paymentId é obrigatório']);
}

$dados = pix_load();
$pagamento = null;
foreach ($dados['payments'] as $p) {
    if (($p['id'] ?? null) === $paymentId) { $pagamento = $p; break; }
}

if ($pagamento === null) {
    responder_json(404, ['success' => false, 'erro' => 'Pagamento não encontrado']);
}

// Se a consulta à Skale falhar, respondemos com o último status conhecido —
// o checkout continua funcionando e tenta de novo no próximo polling.
sincronizar_com_skale($pagamento);

responder_json(200, [
    'success' => true,
    'id' => $pagamento['id'],
    'orderId' => $pagamento['orderId'] ?? null,
    'status' => $pagamento['status'] ?? 'PENDING',
    'amount' => $pagamento['amount'] ?? null,
    'expiresAt' => $pagamento['expiresAt'] ?? null,
    'paidAt' => $pagamento['paidAt'] ?? null,
    // false = não há transação na Skale, logo não há como confirmar
    'verifiable' => !empty($pagamento['skaleTransactionId']),
]);
