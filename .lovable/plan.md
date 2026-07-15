Plano para resolver o pagamento de vez mantendo Mercado Pago

Problemas encontrados
- O botão Pagar hoje faz duas estratégias ao mesmo tempo: abre uma aba `about:blank` antecipada e, se algo falha no handle do popup, tenta redirecionar também a visualização. Isso explica a aba vazia + tentativa dentro do preview.
- O atalho `/checkout?dev=1` causa erro de hidratação: no servidor aparece “carrinho vazio”, mas no cliente o item é injetado depois. Isso pode bagunçar estado, totais e chamadas com `itens` vazio.
- O fluxo está dividido em duas chamadas separadas: primeiro cria pedido, depois cria preferência MP usando dados do carrinho no frontend. Se o carrinho limpar, hidratar errado ou ficar vazio, a preferência/pedido fica inconsistente.
- O banco mostra 9 pedidos `pendente`, 8 com `mercadopago_preference_id` e 0 com `mercadopago_payment_id`. Ou seja: as preferências são criadas, mas nenhum pagamento aprovado está atualizando o pedido.
- A URL pública usada no Mercado Pago está fixa para um domínio `.lovable.app`, enquanto os testes estão acontecendo em outro host/preview. Isso pode atrapalhar `back_urls` e `notification_url` durante testes.
- O webhook exige assinatura válida. Isso é bom para produção, mas pode estar rejeitando notificações se o segredo configurado no Mercado Pago não for exatamente o mesmo, se o webhook do checkout sandbox não estiver usando esse segredo, ou se o evento recebido tiver formato diferente.
- A página de sucesso assume `approved` como padrão quando não recebe status, podendo mostrar “Pedido recebido” mesmo antes do webhook confirmar pagamento.
- O envio de e-mail está falhando por domínio não verificado, mas não bloqueia o pedido; é ruído nos logs, não parece ser a causa principal do pagamento.

O que vou reconstruir

1. Criar um fluxo único de pagamento
- Trocar o par `criarPedido` + `criarPreferenciaMP` por uma função única de checkout.
- Essa função vai receber os dados do checkout, validar tudo no servidor, criar o pedido, buscar preços reais no banco e criar a preferência no Mercado Pago na mesma operação lógica.
- O frontend não vai mais enviar preço para o Mercado Pago; só produto/quantidade. O servidor será a fonte da verdade.

2. Remover a abertura antecipada de `about:blank`
- O clique em Pagar não abrirá mais uma aba vazia.
- Depois que o Mercado Pago retornar a URL, o app fará uma destas ações:
  - em produção: redirecionar a janela atual para o Mercado Pago;
  - no preview/iframe: mostrar um botão/link real “Abrir Mercado Pago” já com a URL pronta, para abrir em nova aba sem bloqueio e sem `about:blank`.

3. Corrigir o atalho `/checkout?dev=1`
- Evitar renderização diferente entre servidor e cliente.
- Garantir que o item Salmão esteja pronto antes de permitir finalizar, sem cair em `itens` vazio.
- Manter o atalho apenas para teste no Lovable.

4. Tornar URLs de retorno e webhook consistentes
- Centralizar a base pública usada em `back_urls` e `notification_url`.
- Em preview, usar a origem atual quando seguro; em produção, usar a URL pública configurada.
- Evitar URL fixa desatualizada dentro do código.

5. Fortalecer Mercado Pago sandbox/produção
- Validar explicitamente se o token usado é sandbox ou produção e escolher `sandbox_init_point`/`init_point` de forma consistente.
- Retornar mensagens claras quando o token estiver ausente ou incompatível.
- Não expor tokens no frontend.

6. Melhorar confirmação de pagamento
- Ajustar a página de sucesso para não assumir pagamento aprovado por padrão.
- Se voltar do Mercado Pago com `payment_id` ou `collection_id`, consultar/confirmar status no backend e atualizar o pedido se necessário, como fallback ao webhook.
- Manter o webhook como caminho principal para produção.

7. Revisar webhook
- Manter validação de assinatura em produção.
- Melhorar logs e tratamento de formatos diferentes do Mercado Pago.
- Garantir que status `approved` atualize pedido para aparecer no admin.
- Se necessário, aceitar uma rota de fallback segura para consulta de status no retorno do checkout, sem depender apenas do webhook.

8. Validar ponta a ponta
- Testar `/checkout?dev=1` com Salmão automático.
- Testar criação de pedido/preferência.
- Verificar que não aparece aba `about:blank`.
- Verificar que pedido só aparece no admin depois de status aprovado.
- Conferir logs do backend para erros de Mercado Pago e webhook.

Resultado esperado
- Um único fluxo previsível: checkout cria pedido + preferência, usuário abre Mercado Pago, retorno/sucesso confirma status, webhook atualiza o pedido, admin mostra apenas pedidos pagos.
- Sem popup vazio, sem carrinho vazio no dev shortcut, sem sucesso falso antes da confirmação.