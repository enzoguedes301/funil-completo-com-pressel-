# SEQUÊNCIA COMPLETA DO FUNIL

## ENTRADA PRINCIPAL
```
http://localhost:8000
```

## FLUXO COMPLETO

### 1. PÁGINA INICIAL
- **http://localhost:8000** (index.html)
  - Botão: "Solicitar meu cartão"
  - Redireciona para: validacao.html

### 2. VALIDAÇÃO DE CPF
- **validacao.html**
  - Validação de CPF com fallback local
  - CPFs de Teste: 11144477735, 52998222191, 00000000000, 86070529500
  - Redireciona para: 2.html

### 3. ANÁLISE DE PERFIL
- **2.html**
  - Análise de Perfil do Cliente
  - Redireciona para: 3.html

### 4. SEQUÊNCIA PRINCIPAL DO FUNIL
- **3.html** (Crédito Aprovado!)
- **5.html**
- **6.html**
- **7.html**
- **8.html**
- **9.html**
- **fatura.html** (Escolha Data de Vencimento)
- **10.html**
- **11.html**
- **12.html** (Decisão - Branches para 13-x)
  - Opção 1 → 13-1.html
  - Opção 2 → 13-2.html
  - Opção 3 → 13.html
- **13-x.html** (conforme escolha anterior)
- **14-x.html** (conforme 13-x escolhido)
- **15-1.html** (Checkout PIX - Frete)
  - Pagamento PIX do Frete
  - Redireciona para: aprovado.html

### 5. CARTÃO APROVADO
- **aprovado.html**
  - Exibe: Cartão Aprovado com Limite
  - Botão: "Continuar"
  - Redireciona para: upsell-redirect.html

### 6. SEQUÊNCIA DE UPSELLS
- **upsell-redirect.html** (Controlador de Upsells)
  - Gerencia sequência com sessionStorage
  
**Ordem de Upsells:**
1. **upsell/ativacao/index.html** (R$ 25,00) - Amarelo
   - Checkout: upsell/ativacao/checkout/index.html
   
2. **upsell/imposto/index.html** (R$ 16,82) - Laranja
   - Checkout: upsell/imposto/checkout/index.html
   
3. **upsell/seguro/index.html** (R$ 17,90) - Verde
   - Checkout: upsell/seguro/checkout/index.html
   
4. **upsell/banking/index.html** (R$ 55,10) - Azul
   - Checkout: upsell/banking/checkout/index.html
   
5. **upsell/aumento/index.html** (R$ 65,00) - Amarelo Ouro
   - Checkout: upsell/aumento/checkout/index.html
   
6. **upsell/aumento/index.html** (Repetido - R$ 65,00)
   - Checkout: upsell/aumento/checkout/index.html

### 7. CONCLUSÃO
- **conclusao/index.html**
  - Página de Sucesso Final
  - Mostra checkmarks de todos os 5 upsells completados
  - Botão: "Ir para o Dashboard"
  - Redireciona para: **https://www.google.com** (sai da página local)

## RESUMO VISUAL

```
http://localhost:8000 (index.html)
         ↓
   validacao.html
         ↓
   2.html (Análise de Perfil)
         ↓
   3.html → 5.html → 6.html → 7.html → 8.html → 9.html
         ↓
   fatura.html → 10.html → 11.html → 12.html
         ↓
   13-x.html → 14-x.html → 15-1.html (Checkout PIX - Frete)
         ↓
   aprovado.html (Cartão Aprovado)
         ↓
   upsell-redirect.html (Controla Upsells)
         ↓
   ativacao → imposto → seguro → banking → aumento → aumento
         ↓
   conclusao/index.html (FIM - Sucesso)
         ↓
   https://www.google.com (Sai do site)
```

## CONFIGURAÇÕES IMPORTANTES

- **Servidor:** PHP (http://localhost:8000)
- **CPF Validação:** Fallback local com 4 CPFs de teste
- **Método de Pagamento:** PIX (Copia e Cola)
- **Parâmetros:** Preservados em toda a jornada via URL
- **SessionStorage:** Controla progresso de upsells

## DATAS DE CRIAÇÃO
- Funil Criado: 2026-08-24
- Versão: 1.0
- Status: ✅ Completo e Funcional
