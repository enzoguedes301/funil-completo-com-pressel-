<?php
/**
 * POST /api/createPixPayment
 * Cria a transação PIX na Skale e devolve o código copia-e-cola + QR Code.
 *
 * O PIX precisa vir da Skale. Sem ela não há como gerar um código que um
 * banco aceite — devolver um código inventado deixaria o cliente com um QR
 * impossível de pagar.
 */
require_once __DIR__ . '/_pix_lib.php';

preparar_requisicao();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    responder_json(405, ['success' => false, 'erro' => 'Método não permitido']);
}

$entrada = corpo_json();
$amount = isset($entrada['amount']) ? (float) $entrada['amount'] : 0;
$orderId = trim((string) ($entrada['orderId'] ?? ''));
$customerName = trim((string) ($entrada['customerName'] ?? '')) ?: 'Cliente';
$customerEmail = trim((string) ($entrada['customerEmail'] ?? '')) ?: 'cliente@example.com';
$description = trim((string) ($entrada['description'] ?? '')) ?: 'Pagamento';

// CPF e telefone do pagador. A Skale rejeita a transação se o documento não tiver
// 11 dígitos, então um valor ausente ou truncado cai no genérico em vez de
// derrubar a cobrança — é melhor um PIX gerado com dado incompleto do que nenhum.
$customerDocument = preg_replace('/\D/', '', (string) ($entrada['customerDocument'] ?? ''));
if (strlen($customerDocument) !== 11) {
    $customerDocument = '11144477735';
}
$customerPhone = trim((string) ($entrada['customerPhone'] ?? '')) ?: '(11) 99999-9999';

if ($amount <= 0 || $orderId === '') {
    responder_json(400, ['success' => false, 'erro' => 'amount e orderId são obrigatórios']);
}

if (!chave_skale_plausivel(skale_api_key())) {
    error_log('[Skale] SKALE_API_KEY ausente ou com texto de exemplo — nenhum PIX pode ser gerado');
    responder_json(503, [
        'success' => false,
        'erro' => 'Meio de pagamento não configurado. Tente novamente em instantes.'
    ]);
}

$centavos = (int) round($amount * 100);

$resposta = skale_request('POST', '/transactions', [
    'amount' => $centavos,
    'currency' => 'BRL',
    'paymentMethod' => 'pix',
    'customer' => [
        'name' => $customerName,
        'email' => $customerEmail,
        'phone' => $customerPhone,
        'document' => ['number' => $customerDocument, 'type' => 'cpf'],
    ],
    'items' => [[
        'title' => $description,
        'quantity' => 1,
        'unitPrice' => $centavos,
        'tangible' => false,
    ]],
    'pix' => ['expiresInDays' => 1],
    'metadata' => ['orderId' => $orderId, 'source' => 'web_checkout'],
]);

$corpo = $resposta['body'];

if ($resposta['status'] === 401 || $resposta['status'] === 403) {
    error_log('[Skale] CHAVE RECUSADA (HTTP ' . $resposta['status'] . '): ' . ($corpo['message'] ?? ''));
    responder_json(503, [
        'success' => false,
        'erro' => 'Não foi possível gerar o PIX agora. Recarregue a página e tente de novo.'
    ]);
}

if (($resposta['status'] !== 200 && $resposta['status'] !== 201) || !is_array($corpo)) {
    error_log('[Skale] Falha ao criar PIX para ' . $orderId . ' (HTTP ' . $resposta['status'] . ')');
    responder_json(503, [
        'success' => false,
        'erro' => 'Não foi possível gerar o PIX agora. Recarregue a página e tente de novo.'
    ]);
}

// O código EMV que o app do banco lê vem em pix.qrcode.
$pixKey = $corpo['pix']['qrcode'] ?? ($corpo['pix']['brcode'] ?? null);

if (!$pixKey) {
    error_log('[Skale] Resposta sem código PIX para ' . $orderId);
    responder_json(503, [
        'success' => false,
        'erro' => 'Não foi possível gerar o PIX agora. Recarregue a página e tente de novo.'
    ]);
}

// A Skale já devolve o PNG do QR pronto — é o mais confiável.
$qrCode = $corpo['pix']['qrcodeImage'] ?? $pixKey;
$expiresAt = $corpo['pix']['expirationDate'] ?? gmdate('c', time() + 1800);
$paymentId = 'PIX_' . round(microtime(true) * 1000) . '_' . bin2hex(random_bytes(5));

$pagamento = [
    'id' => $paymentId,
    'orderId' => $orderId,
    'skaleTransactionId' => $corpo['id'] ?? null,
    'amount' => $amount,
    'customerName' => $customerName,
    'customerEmail' => $customerEmail,
    'description' => $description,
    'status' => 'PENDING',
    'createdAt' => gmdate('c'),
    'expiresAt' => $expiresAt,
    'pixCopyPaste' => $pixKey,
    'source' => 'skale',
];

$dados = pix_load();
$dados['payments'][] = $pagamento;
pix_save($dados);

responder_json(200, [
    'success' => true,
    'paymentId' => $paymentId,
    'amount' => $amount,
    'orderId' => $orderId,
    'status' => 'PENDING',
    'expiresAt' => $expiresAt,
    'qrCode' => $qrCode,
    'pixCopyPaste' => $pixKey,
    'source' => 'skale',
    'testMode' => false,
]);
