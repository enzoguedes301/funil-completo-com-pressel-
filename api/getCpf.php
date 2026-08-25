<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

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

// TENTA API REAL PRIMEIRO
$token = 'CPF_API_TOKEN_REMOVIDO_DO_HISTORICO';
$url = "https://magmadatahub.com/api.php?token=" . urlencode($token) . "&cpf=" . urlencode($cpf);

if (function_exists('curl_init')) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 8,
        CURLOPT_SSL_VERIFYPEER => false,
    ]);

    $response  = curl_exec($ch);
    $httpCode  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 200) {
        $data = json_decode($response, true);
        if ($data && !empty($data['success']) && !empty($data['nome'])) {
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
}

// FALLBACK: BASE DE DADOS LOCAL (CPFs válidos na API real)
$cpfsValidos = [
    '11144477735' => ['nome' => 'NOME REMOVIDO', 'nascimento' => '01/01/1900', 'mae' => 'NOME REMOVIDO', 'sexo' => 'Masculino'],
    '00000000000' => ['nome' => 'NOME REMOVIDO', 'nascimento' => '01/01/1900', 'mae' => 'NOME REMOVIDO', 'sexo' => 'Feminino'],
    '00000000000' => ['nome' => 'NOME REMOVIDO', 'nascimento' => '01/01/1900', 'mae' => 'NOME REMOVIDO', 'sexo' => 'Masculino'],
];

if (isset($cpfsValidos[$cpf])) {
    $dados = $cpfsValidos[$cpf];
    echo json_encode([
        'success'    => true,
        'nome'       => $dados['nome'],
        'cpf'        => $cpf,
        'nascimento' => $dados['nascimento'],
        'mae'        => $dados['mae'],
        'sexo'       => $dados['sexo'],
    ]);
    exit;
}

http_response_code(404);
echo json_encode([
    'success' => false,
    'erro' => 'CPF não encontrado',
    'dica' => 'CPFs válidos para teste: 11144477735, 00000000000 ou 00000000000'
]);
exit;
?>
