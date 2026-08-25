<?php
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    exit(0);
}

$newToken = "18faf22a-sh1-4b2c-b683-119568c255b8";
$newApiUrl = "https://api.amnesiatecnologia.lat/";

if (!isset($_GET['cpf_consulta'])) {
    echo json_encode(["error" => true, "message" => "Parâmetro ausente."]);
    exit;
}

$cpfParaConsultar = preg_replace('/\D/', '', $_GET['cpf_consulta']);
$urlCompleta = $newApiUrl . "?token=" . $newToken . "&cpf=" . urlencode($cpfParaConsultar);

$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => $urlCompleta,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_ENCODING => "",
    CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    CURLOPT_HTTPHEADER => [
        'Accept: application/json',
        'Connection: close'
    ],
]);

$responseApiExterna = curl_exec($curl);
$httpCodeApiExterna = curl_getinfo($curl, CURLINFO_HTTP_CODE);
$curlError = curl_error($curl);
curl_close($curl);

header("HTTP/1.1 200 OK");

if ($curlError) {
    echo json_encode(["error" => true, "message" => "Erro de conexão: " . $curlError]);
} else {
    $decodedResponse = json_decode($responseApiExterna, true);
    
    // Validamos se não há erro no JSON e se a nova estrutura ['DADOS']['cpf'] existe
    if (json_last_error() === JSON_ERROR_NONE && isset($decodedResponse['DADOS']['cpf'])) {
        
        $dados = $decodedResponse['DADOS']; // Facilita o acesso ao array aninhado
        
        // Retornamos os dados EXATAMENTE como o seu front-end já espera
        echo json_encode([
            "error" => false,
            "cpf" => $dados['cpf'],
            "nome" => $dados['nome'],
            "nome_mae" => $dados['nome_mae'] ?? '',
            "sexo" => $dados['sexo'] ?? '',
            "nascimento" => $dados['data_nascimento'] ?? '' // Mapeando de 'data_nascimento' para 'nascimento'
        ]);
        
    } else {
        echo json_encode([
            "error" => true, 
            "message" => "CPF não encontrado ou dados indisponíveis.", 
            "http_status" => $httpCodeApiExterna
        ]);
    }
}
exit;