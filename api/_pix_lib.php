<?php
/**
 * Núcleo do PIX em PHP — usado pelos endpoints createPixPayment,
 * getPixPayment e pixWebhook.
 *
 * Existe porque a hospedagem compartilhada executa PHP, não Node.
 * A regra de segurança é a mesma do server.js: o lead só avança quando a
 * Skale confirmar o pagamento. Nenhuma página decide isso sozinha.
 */

const SKALE_HOST = 'api.skalepayments.com.br';

// Intervalo mínimo entre duas consultas à Skale para o MESMO pagamento.
const SKALE_POLL_THROTTLE_SEC = 3;

/**
 * Lê uma variável do .env. O arquivo fica fora do public_html na Hostinger,
 * então procuramos subindo os diretórios.
 */
function env_get($chave, $padrao = null) {
    static $vars = null;

    if ($vars === null) {
        $vars = [];
        $candidatos = [
            __DIR__ . '/../../.env',  // fora do webroot (Hostinger)
            __DIR__ . '/../.env',     // raiz do projeto
        ];

        foreach ($candidatos as $caminho) {
            if (!is_readable($caminho)) continue;
            foreach (file($caminho, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linha) {
                $linha = trim($linha);
                if ($linha === '' || $linha[0] === '#') continue;
                $pos = strpos($linha, '=');
                if ($pos === false) continue;
                $nome = trim(substr($linha, 0, $pos));
                $valor = trim(substr($linha, $pos + 1));
                // Remove aspas e o BOM que o PowerShell costuma deixar
                $valor = trim($valor, "\"'");
                $nome = preg_replace('/^\xEF\xBB\xBF/', '', $nome);
                if ($nome !== '' && !isset($vars[$nome])) $vars[$nome] = $valor;
            }
            break;
        }
    }

    if (isset($vars[$chave]) && $vars[$chave] !== '') return $vars[$chave];
    $doAmbiente = getenv($chave);
    if ($doAmbiente !== false && $doAmbiente !== '') return $doAmbiente;
    return $padrao;
}

/**
 * Um .env ainda com o texto de exemplo derruba o funil inteiro: mandaríamos
 * "SUA_CHAVE_AQUI" para a Skale e nenhum PIX seria gerado.
 */
function chave_skale_plausivel($chave) {
    $k = trim((string) $chave);
    if (strpos($k, 'sk_') !== 0) return false;
    if (strlen($k) < 32) return false;
    return !preg_match('/sua[_ ]?chave|seu[_ ]?token|your[_ ]?key|aqui|placeholder|xxx/i', $k);
}

function skale_api_key() {
    // A pedido do usuário, a chave fica embutida como padrão para o PIX
    // funcionar sem criar o .env no servidor. Se um .env existir com
    // SKALE_API_KEY preenchida, ela tem prioridade (env_get devolve o .env
    // quando presente e cai neste padrão só quando ausente).
    // ATENÇÃO: repo público = chave visível no GitHub. Rotacionar quando puder.
    return env_get('SKALE_API_KEY', 'sk_a37c01ae03b89db3d53d5543912c696f1c3c89a163abb12f1c7f9d677eb373fd');
}

/** Caminho do arquivo de pagamentos. Preferimos fora do webroot. */
function pix_storage_path() {
    $fora = __DIR__ . '/../../pix_payments.json';
    $dirFora = dirname($fora);
    if (is_dir($dirFora) && is_writable($dirFora)) return $fora;
    return __DIR__ . '/../pix_payments.json';
}

function pix_load() {
    $caminho = pix_storage_path();
    if (!is_readable($caminho)) return ['payments' => []];
    $bruto = file_get_contents($caminho);
    $dados = json_decode($bruto, true);
    if (!is_array($dados) || !isset($dados['payments']) || !is_array($dados['payments'])) {
        return ['payments' => []];
    }
    return $dados;
}

/** Grava de forma atômica: dois checkouts simultâneos não corrompem o arquivo. */
function pix_save($dados) {
    $caminho = pix_storage_path();
    $temp = $caminho . '.' . getmypid() . '.tmp';
    $json = json_encode($dados, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (file_put_contents($temp, $json, LOCK_EX) === false) return false;
    return rename($temp, $caminho);
}

/** Traduz o status da Skale para o status interno. Só pago libera o avanço. */
function map_skale_status($status) {
    $s = strtolower(trim((string) $status));
    if ($s === 'paid' || $s === 'approved') return 'CONFIRMED';
    $ruins = ['refused', 'refunded', 'chargedback', 'canceled', 'cancelled', 'failed', 'expired'];
    if (in_array($s, $ruins, true)) return 'FAILED';
    return 'PENDING';
}

/**
 * Chamada HTTP à Skale. Retorna ['status' => int, 'body' => array|null].
 */
function skale_request($metodo, $caminho, $payload = null) {
    $url = 'https://' . SKALE_HOST . $caminho;
    $headers = [
        'X-API-Key: ' . skale_api_key(),
        'Accept: application/json',
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $metodo);
    curl_setopt($ch, CURLOPT_TIMEOUT, 25);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);

    if ($payload !== null) {
        $corpo = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $headers[] = 'Content-Type: application/json';
        $headers[] = 'Content-Length: ' . strlen($corpo);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $corpo);
    }

    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

    $resposta = curl_exec($ch);
    $http = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $erro = curl_error($ch);
    curl_close($ch);

    if ($resposta === false) {
        error_log('[Skale] Falha de rede: ' . $erro);
        return ['status' => 0, 'body' => null];
    }

    return ['status' => $http, 'body' => json_decode($resposta, true)];
}

/**
 * Consulta a Skale e persiste o resultado. É esta função que decide se o
 * lead pagou — o status vem do provedor, nunca da página.
 */
function sincronizar_com_skale(&$pagamento) {
    if (empty($pagamento['skaleTransactionId'])) return;
    if (($pagamento['status'] ?? '') === 'CONFIRMED') return;

    // Consultou agora há pouco? Mantém o status em cache (protege de rate limit).
    if (!empty($pagamento['lastCheckedAt'])) {
        $desde = time() - strtotime($pagamento['lastCheckedAt']);
        if ($desde >= 0 && $desde < SKALE_POLL_THROTTLE_SEC) return;
    }

    $r = skale_request('GET', '/transactions/' . rawurlencode($pagamento['skaleTransactionId']));
    if ($r['status'] === 0 || !is_array($r['body'])) return; // falhou: tenta no próximo polling

    $remoto = $r['body']['status'] ?? ($r['body']['data']['status'] ?? null);
    $mapeado = map_skale_status($remoto);

    $pagamento['skaleStatus'] = $remoto;
    $pagamento['lastCheckedAt'] = gmdate('c');

    if ($mapeado !== ($pagamento['status'] ?? '')) {
        $pagamento['status'] = $mapeado;
        if ($mapeado === 'CONFIRMED') $pagamento['paidAt'] = gmdate('c');
    }

    // Persiste no arquivo
    $dados = pix_load();
    foreach ($dados['payments'] as &$guardado) {
        if (($guardado['id'] ?? null) === $pagamento['id']) {
            $guardado['status'] = $pagamento['status'];
            $guardado['skaleStatus'] = $pagamento['skaleStatus'];
            $guardado['lastCheckedAt'] = $pagamento['lastCheckedAt'];
            if (isset($pagamento['paidAt'])) $guardado['paidAt'] = $pagamento['paidAt'];
            break;
        }
    }
    unset($guardado);
    pix_save($dados);
}

/** Cabeçalhos padrão dos endpoints JSON. */
function responder_json($httpCode, $dados) {
    http_response_code($httpCode);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($dados, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/** CORS + preflight, iguais aos do server.js. */
function preparar_requisicao() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(200);
        exit;
    }
}

function corpo_json() {
    $bruto = file_get_contents('php://input');
    $dados = json_decode($bruto, true);
    return is_array($dados) ? $dados : [];
}
