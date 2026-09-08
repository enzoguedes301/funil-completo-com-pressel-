<?php
/**
 * Proxy de consulta de CPF — roda no servidor, nunca expõe o token ao navegador.
 *
 * Endpoint: magmadatahub.com/api.php
 * Requisitos: PHP 7.4+, extensão cURL, acesso HTTPS de saída.
 */

// Impede que warnings/notices do PHP corrompam a resposta JSON
@ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/**
 * Token da Magma. Fica embutido para funcionar sem criar o .env no servidor;
 * se existir um .env com CPF_API_TOKEN preenchido, ele tem prioridade.
 * ATENÇÃO: repo público = token visível no GitHub. Rotacionar quando puder.
 */
function magma_token() {
    $doEnv = env_cpf('CPF_API_TOKEN');
    if ($doEnv !== null && $doEnv !== '') return $doEnv;
    return '3448518a0e929427c4597bf126b732101';
}

/**
 * Leitor mínimo do .env (mesmo padrão do _pix_lib.php). Procura subindo os
 * diretórios, pois na hospedagem o .env fica fora do public_html.
 */
function env_cpf($chave) {
    static $vars = null;

    if ($vars === null) {
        $vars = [];
        $candidatos = [
            __DIR__ . '/../../.env', // fora do webroot
            __DIR__ . '/../.env',    // raiz do projeto
        ];
        foreach ($candidatos as $caminho) {
            if (!is_readable($caminho)) continue;
            foreach (file($caminho, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
                $linha = trim($linha);
                if ($linha === '' || $linha[0] === '#') continue;
                $pos = strpos($linha, '=');
                if ($pos === false) continue;
                $nome = preg_replace('/^\xEF\xBB\xBF/', '', trim(substr($linha, 0, $pos)));
                $valor = trim(trim(substr($linha, $pos + 1)), "\"'");
                if ($nome !== '' && !isset($vars[$nome])) $vars[$nome] = $valor;
            }
            break;
        }
    }

    if (isset($vars[$chave]) && $vars[$chave] !== '') return $vars[$chave];
    $doAmbiente = getenv($chave);
    if ($doAmbiente !== false && $doAmbiente !== '') return $doAmbiente;
    return null;
}

// -- Validação básica do CPF --------------------------------------------------
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

// -- Verificar extensão cURL --------------------------------------------------
if (!function_exists('curl_init')) {
    http_response_code(503);
    echo json_encode(['success' => false, 'erro' => 'Serviço temporariamente indisponível']);
    exit;
}

// -- Chamada à API externa (server-side) --------------------------------------
$url = "https://magmadatahub.com/api.php?token=" . urlencode(magma_token()) . "&cpf=" . urlencode($cpf);

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_CONNECTTIMEOUT => 6,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_MAXREDIRS      => 3,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_HTTPHEADER     => [
        'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0.0.0',
        'Accept: application/json',
    ],
]);

$response  = curl_exec($ch);
$httpCode  = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErrno = curl_errno($ch);
curl_close($ch);

// -- Erros de conexão / timeout -----------------------------------------------
if ($curlErrno !== 0) {
    http_response_code(503);
    echo json_encode(['success' => false, 'erro' => 'Serviço de consulta indisponível no momento. Tente novamente em instantes.']);
    exit;
}

// -- Falha de autenticação ----------------------------------------------------
if ($httpCode === 401 || $httpCode === 403) {
    http_response_code(503);
    echo json_encode(['success' => false, 'erro' => 'Serviço temporariamente indisponível']);
    exit;
}

// -- Limite de requisições ----------------------------------------------------
if ($httpCode === 429) {
    http_response_code(429);
    echo json_encode(['success' => false, 'erro' => 'Muitas consultas em sequência. Aguarde alguns instantes e tente novamente.']);
    exit;
}

// -- API indisponível (5xx) ---------------------------------------------------
if ($httpCode >= 500) {
    http_response_code(503);
    echo json_encode(['success' => false, 'erro' => 'Serviço de consulta indisponível. Tente novamente mais tarde.']);
    exit;
}

// -- Resposta não é JSON válido -----------------------------------------------
$data = json_decode($response, true);
if (!$data || !is_array($data)) {
    http_response_code(503);
    echo json_encode(['success' => false, 'erro' => 'Resposta inválida do serviço de consulta.']);
    exit;
}

// -- CPF encontrado com sucesso -----------------------------------------------
if ($httpCode === 200 && !empty($data['success']) && $data['success'] === true && !empty($data['nome'])) {
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

// -- CPF não encontrado ou dados insuficientes --------------------------------
http_response_code(404);
echo json_encode(['success' => false, 'erro' => 'CPF não encontrado na base de dados.']);
exit;
