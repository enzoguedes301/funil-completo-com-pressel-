<?php
// Roteador só para teste local (php -S). Imita a regra do .htaccess:
// /api/createPixPayment  ->  /api/createPixPayment.php
// Não vai para produção (começa com _ e está fora do deploy do .cpanel.yml).
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$root = __DIR__;

// /api/nome (sem extensão) -> /api/nome.php
if (preg_match('#^/api/([A-Za-z0-9_-]+)/?$#', $uri, $m)) {
    $php = $root . '/api/' . $m[1] . '.php';
    if (is_file($php)) { require $php; return true; }
}

// Arquivo real existe? Deixa o php -S servir (estáticos e .php diretos).
$file = $root . $uri;
if ($uri !== '/' && is_file($file)) { return false; }

// Raiz -> index.html
if ($uri === '/' ) { require $root . '/index.html'; return true; }

return false;
