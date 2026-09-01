<?php
/**
 * GET /api/getCpf.php?cpf=00000000000
 * Consulta o CPF na MagmaDataHub.
 *
 * Antes este arquivo respondia com uma lista de 3 CPFs fixos: funcionava no
 * teste e falhava com todo cliente real. Agora faz a consulta de verdade,
 * igual ao que o server.js fazia no ambiente local.
 */
require_once __DIR__ . '/_pix_lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$cpf = preg_replace('/\D/', '', $_GET['cpf'] ?? '');

if (strlen($cpf) !== 11 || preg_match('/^(\d)\1{10}$/', $cpf)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'erro' => 'CPF inválido']);
    exit;
}

// A credencial vive apenas no .env, fora do código versionado.
$token = env_get('CPF_API_TOKEN', '');

if ($token === '') {
    error_log('[CPF] CPF_API_TOKEN ausente no .env — consulta não pode ser feita');
    http_response_code(503);
    echo json_encode(['success' => false, 'erro' => 'Serviço temporariamente indisponível']);
    exit;
}

$url = 'https://magmadatahub.com/api.php?token=' . urlencode($token) . '&cpf=' . urlencode($cpf);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 15);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Accept: application/json',
    'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0',
]);

$resposta = curl_exec($ch);
$http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$erroRede = curl_error($ch);
curl_close($ch);

if ($resposta === false) {
    error_log('[CPF] Falha de rede: ' . $erroRede);
    http_response_code(503);
    echo json_encode(['success' => false, 'erro' => 'Serviço temporariamente indisponível']);
    exit;
}

$dados = json_decode($resposta, true);

if (!is_array($dados)) {
    error_log('[CPF] Resposta não-JSON da API (HTTP ' . $http . ')');
    http_response_code(503);
    echo json_encode(['success' => false, 'erro' => 'Resposta inválida da API']);
    exit;
}

if ($http === 200 && !empty($dados['success']) && !empty($dados['nome'])) {
    echo json_encode([
        'success'    => true,
        'nome'       => $dados['nome'],
        'cpf'        => $cpf,
        'nascimento' => $dados['nascimento'] ?? '',
        // O front lê "mae"; mantemos "nome_mae" para quem espera o nome original.
        'mae'        => $dados['nome_mae'] ?? '',
        'nome_mae'   => $dados['nome_mae'] ?? '',
        'sexo'       => $dados['sexo'] ?? '',
    ]);
    exit;
}

http_response_code($http === 200 ? 404 : ($http ?: 503));
echo json_encode([
    'success' => false,
    'erro' => $dados['message'] ?? ($dados['erro'] ?? 'CPF não encontrado na base de dados'),
]);
