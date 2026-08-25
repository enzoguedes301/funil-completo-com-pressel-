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

// FALLBACK: BASE DE DADOS LOCAL
$cpfsValidos = [
    '11144477735' => ['nome' => 'JOÃO SILVA SANTOS', 'nascimento' => '15/05/1990', 'mae' => 'MARIA SANTOS', 'sexo' => 'M'],
    '52998222191' => ['nome' => 'ANNA CAROLINA COSTA', 'nascimento' => '22/08/1995', 'mae' => 'SANDRA COSTA', 'sexo' => 'F'],
    '00000000000' => ['nome' => 'PEDRO OLIVEIRA FERREIRA', 'nascimento' => '10/03/1988', 'mae' => 'HELENA FERREIRA', 'sexo' => 'M'],
    '86070529500' => ['nome' => 'FERNANDA RIBEIRO SOUZA', 'nascimento' => '30/11/1992', 'mae' => 'ROSANA RIBEIRO', 'sexo' => 'F'],
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
    'dica' => 'Use um desses: 11144477735, 52998222191, 00000000000, 86070529500'
]);
exit;
?>
