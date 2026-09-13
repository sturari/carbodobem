# 10 itens essenciais para o lançamento

Lista em ordem de prioridade, com o que já verifiquei no site e nos dados.

## Bloqueantes (sem isso não dá para vender)

1. **Publicar o site no domínio próprio.** Hoje ele não está publicado; o endereço carbodobem.com.br não serve o site e o Mercado Pago não tem para onde avisar que um pagamento foi aprovado.
2. **Dados legais da empresa.** Razão social e CNPJ ainda estão em branco nos Termos e na Privacidade. São obrigatórios por lei para venda online — preciso que você me envie os dois.
3. **Confirmar que o pagamento real funciona de ponta a ponta.** Nos dados existe apenas 1 pedido confirmado e 31 cancelados. Depois de publicar, fazer um pedido de valor baixo por Pix e um por cartão e confirmar que o status muda sozinho.
4. **Verificar se as chaves de produção do Mercado Pago estão em uso** (não as de teste) e se o endereço de aviso de pagamento está cadastrado no painel do Mercado Pago.

## Antes de divulgar

5. **Limpar o catálogo.** Existe uma categoria chamada "teste" e um produto sem foto aparecendo para o cliente.
6. **Rotina automática de limpeza de pedidos** (cancelar pendentes antigos e reconferir pagamentos). O código existe, mas ainda não há agendamento ativo chamando essa rotina.
7. **Testar os e-mails de verdade**: confirmação de pedido, "saiu para entrega" e "entregue", chegando na caixa de entrada e não no spam.
8. **Conferir o site inteiro no celular**, principalmente carrinho, escolha de horário e pagamento — é de onde vem a maior parte dos pedidos.
9. **Revisar textos, preços, taxa de entrega e áreas atendidas** com você, e checar título/descrição de cada página para aparecer bem no Google e no WhatsApp.
10. **Combinar a rotina de operação**: quem acompanha os pedidos no painel, em quanto tempo responder no WhatsApp/e-mail, e como fazer reembolso quando precisar.

## O que eu preciso de você

- Razão social e CNPJ.
- Confirmação de que atendimento@carbodobem.com.br já recebe mensagens.
- Foto do produto que está sem imagem e o que fazer com a categoria "teste".

## Detalhes técnicos

- `PUBLIC_APP_URL` e os segredos do Mercado Pago (prod/test, webhook, cron) já existem; `getPublicAppUrl` em `src/lib/mercadopago.server.ts` lê `PUBLIC_APP_URL` e o seletor de token escolhe prod/test.
- `pg_cron` não está instalado (`cron.job` inexistente), então `POST /api/public/cron/pedidos` nunca é chamado automaticamente — agendar via pg_cron ou agendador externo com `CRON_SECRET`.
- Dados: `pedidos` = 31 `cancelado` + 1 `pagamento_confirmado`; `produtos` ativos = 12, sendo 1 sem `imagem_url` e categoria `teste` presente.
- `src/lib/empresa.ts` tem `razaoSocial` e `cnpj` vazios, exibindo aviso nas páginas legais.
- GA4 `G-JYBX279K6D6` já carregado em `src/routes/__root.tsx`.
