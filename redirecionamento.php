<?php
// Nome do arquivo: redirecionador.php (ou como preferir)

// 1. Iniciar ou retomar a sessão para usar cookies de sessão e a variável $_SESSION.
// É crucial que não haja NENHUM output (nem mesmo espaços em branco ou linhas vazias) antes de session_start().
session_start();

// 2. Definir a sequência de páginas para as quais redirecionar.
// Os caminhos começam com '/' para serem relativos à raiz do seu domínio.
$listaDePaginas = [
    '/upsell/ativacao',  // Primeira visita (índice 0)
    '/upsell/imposto',   // Segunda visita (índice 1)
    '/upsell/seguro',    // Terceira visita (índice 2)
    '/upsell/banking',  // Quarta visita (índice 3) - 'ativacao' novamente, conforme solicitado
    '/upsell/aumento',   // Quinta visita (índice 4)
    '/upsell/aumento'    // Sexta visita (índice 5)
];

// 3. Obter o índice da página atual/próxima da sessão.
// Se 'indice_pagina_redirecionamento' não existir na sessão, começa com 0 (a primeira página da lista).
// Este índice representa a página para a qual vamos redirecionar NESTA requisição.
$indicePaginaAtual = $_SESSION['indice_pagina_redirecionamento'] ?? 0;

// 4. Determinar a URL para a qual redirecionar.
// Certifique-se de que o índice não esteja fora dos limites da array (embora o módulo na próxima etapa previna isso para loops).
if ($indicePaginaAtual >= count($listaDePaginas)) {
    // Isso não deve acontecer se o módulo estiver correto, mas é uma segurança.
    $indicePaginaAtual = 0; 
}
$urlDeRedirecionamento = $listaDePaginas[$indicePaginaAtual];

// 5. Atualizar o índice na sessão para a PRÓXIMA visita.
// Incrementa o índice e usa o operador de módulo (%) para voltar ao início (0)
// quando o final da lista for alcançado, criando um ciclo.
$_SESSION['indice_pagina_redirecionamento'] = ($indicePaginaAtual + 1) % count($listaDePaginas);

// 6. Realizar o redirecionamento.
// É crucial que não haja NENHUM output (nem mesmo espaços em branco ou linhas vazias) antes desta chamada header().
header("Location: " . $urlDeRedirecionamento);

// 7. Encerrar o script para garantir que nada mais seja executado e o redirecionamento ocorra imediatamente.
exit;
?>