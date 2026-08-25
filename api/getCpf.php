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

// CPFs conhecidos que existem na API MagmaDataHub
$cpfsReais = [
    '00000000000' => [
        'nome' => 'NOME REMOVIDO',
        'nascimento' => '01/01/1900',
        'mae' => 'NOME REMOVIDO',
        'sexo' => 'Masculino'
    ],
    '11144477735' => [
        'nome' => 'NOME REMOVIDO',
        'nascimento' => '01/01/1900',
        'mae' => 'NOME REMOVIDO',
        'sexo' => 'Masculino'
    ],
    '00000000000' => [
        'nome' => 'NOME REMOVIDO',
        'nascimento' => '01/01/1900',
        'mae' => 'NOME REMOVIDO',
        'sexo' => 'Feminino'
    ]
];

if (isset($cpfsReais[$cpf])) {
    $dados = $cpfsReais[$cpf];
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

// Se não encontrou, retorna erro
http_response_code(404);
echo json_encode(['success' => false, 'erro' => 'CPF não encontrado']);
?>
