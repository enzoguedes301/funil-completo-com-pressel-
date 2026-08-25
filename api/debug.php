<?php
echo "PHP Version: " . phpversion() . "\n";
echo "cURL available: " . (function_exists('curl_version') ? 'YES' : 'NO') . "\n";
echo "file_get_contents HTTPS: " . (ini_get('allow_url_fopen') ? 'YES' : 'NO') . "\n";
echo "OpenSSL: " . (extension_loaded('openssl') ? 'YES' : 'NO') . "\n";

if (function_exists('curl_version')) {
    echo "cURL Version: " . curl_version()['version'] . "\n";
}

// Test real API
$token = 'CPF_API_TOKEN_REMOVIDO_DO_HISTORICO';
$url = "https://magmadatahub.com/api.php?token=" . urlencode($token) . "&cpf=00000000000";

echo "\n=== Testing API Call ===\n";
echo "URL: $url\n";

if (function_exists('curl_version')) {
    echo "Using cURL...\n";
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_TIMEOUT, 5);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);

    $response = curl_exec($ch);
    $errno = curl_errno($ch);
    $error = curl_error($ch);
    curl_close($ch);

    echo "Response: " . (empty($response) ? 'EMPTY' : substr($response, 0, 100)) . "...\n";
    echo "Error: " . ($errno ? "$errno - $error" : 'NONE') . "\n";
}
?>
