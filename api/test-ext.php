<?php
echo "=== Extensions Test ===\n\n";

$extensions = ['curl', 'openssl', 'fopen', 'json'];

foreach ($extensions as $ext) {
    echo "$ext: ";
    if (extension_loaded($ext)) {
        echo "✓ LOADED\n";
    } else {
        echo "✗ NOT LOADED\n";
    }
}

echo "\nLoaded Extensions:\n";
print_r(get_loaded_extensions());

echo "\n=== Trying to load curl ===\n";
if (!extension_loaded('curl')) {
    if (dl('php_curl.dll')) {
        echo "curl loaded successfully\n";
    } else {
        echo "Failed to load curl: " . error_get_last()['message'] . "\n";
    }
}

echo "\n=== Trying to load openssl ===\n";
if (!extension_loaded('openssl')) {
    if (dl('php_openssl.dll')) {
        echo "openssl loaded successfully\n";
    } else {
        echo "Failed to load openssl: " . error_get_last()['message'] . "\n";
    }
}

echo "\n=== Testing API Call ===\n";
if (function_exists('curl_init')) {
    $ch = curl_init("https://magmadatahub.com/api.php?token=CPF_API_TOKEN_REMOVIDO_DO_HISTORICO&cpf=00000000000");
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
    $resp = curl_exec($ch);
    echo "Response: " . substr($resp, 0, 100) . "\n";
    curl_close($ch);
}
?>
