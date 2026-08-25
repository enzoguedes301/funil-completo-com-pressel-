<?php
header('Content-Type: application/json; charset=utf-8');

$cpf = preg_replace('/\D/', '', $_GET['cpf'] ?? '');

if (strlen($cpf) !== 11) {
    http_response_code(400);
    echo json_encode(['success' => false, 'erro' => 'CPF inválido']);
    exit;
}

if (preg_match('/^(\d)\1{10}$/', $cpf)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'erro' => 'CPF inválido']);
    exit;
}

$token = 'CPF_API_TOKEN_REMOVIDO_DO_HISTORICO';
$url = "https://magmadatahub.com/api.php?token=" . urlencode($token) . "&cpf=" . urlencode($cpf);

$response = @file_get_contents($url, false, stream_context_create([
    'http' => ['timeout' => 10],
    'ssl' => ['verify_peer' => false]
]));

if ($response) {
    $data = json_decode($response, true);
    if ($data['success'] && !empty($data['nome'])) {
        echo json_encode([
            'success'    => true,
            'nome'       => $data['nome'],
            'cpf'        => $cpf,
            'nascimento' => $data['nascimento'] ?? '',
            'mae'        => $data['nome_mae'] ?? '',
            'sexo'       => $data['sexo'] ?? '',
        ]);
        exit;
    }
}

http_response_code(404);
echo json_encode(['success' => false, 'erro' => 'CPF não encontrado']);
?>
