# Auditoria completa + próximos passos para fechar o desenvolvimento

Testei todas as rotas no navegador, rodei a suíte de testes e consultei o banco. Abaixo o que está funcionando, o que está quebrado e a ordem de execução.

## O que testei e está OK
- Home, /auth, /privacidade, /termos, /admin (redireciona para login), /checkout (carrinho vazio) carregam com status 200, sem erros de console e sem requisições falhando.
- Atalho `/checkout?dev=1` funciona: chega no passo de horário com turnos (09-12, 12-15, 15-18) e regra de 45 min.
- Suíte de testes: 21 testes passando (cálculo de pedido, estoque, cobertura de CEP, assinatura do webhook).
- Banco: 12 produtos ativos, nenhum com estoque zero, 6 áreas de cobertura ativas, 1 admin cadastrado.

## Problemas confirmados (em ordem de gravidade)

1. A página de sucesso do pagamento nunca aparece.
   `/checkout/sucesso` renderiza "Carrinho vazio" em vez do status do pedido. Motivo: no roteamento, `checkout.sucesso` virou rota filha de `checkout`, e a tela de checkout não renderiza o ponto de saída para rotas filhas. Ou seja: quem volta do Mercado Pago cai numa tela de carrinho vazio, sem confirmação e sem limpar o carrinho.

2. Nenhum pedido jamais foi confirmado como pago.
   No banco: 31 pedidos `pendente` (8 já com ID de pagamento do Mercado Pago), 1 cancelado, zero em `pagamento_confirmado`. O último pedido é de 19/07. Conclusão: o webhook não está atualizando status.

3. A URL usada no webhook e nos retornos aponta para um endereço que não serve o site.
   Não existe `PUBLIC_APP_URL` configurada, então o código cai num endereço fixo `project--...lovable.app` — e o site ainda não foi publicado. O Mercado Pago não tem para onde notificar. O domínio próprio (carbodobem.com.br) também não está em uso nessa configuração.

4. `/meus-pedidos` fica em tela branca por vários segundos antes de decidir se redireciona para login. Sem estado visível de "verificando sessão" nem fallback se a sessão falhar.

5. 31 pedidos pendentes antigos acumulados, sem nenhuma rotina de expiração/cancelamento automático. Isso vai poluir relatórios e travar estoque na prática.

6. Um produto sem imagem e uma categoria de teste ("teste") aparecendo no catálogo público.

## Plano de execução

### Etapa 1 — Consertar o retorno do pagamento (bloqueante)
- Reorganizar as rotas para que a página de sucesso deixe de ser filha do checkout (ou fazer o checkout renderizar rotas filhas), garantindo que `/checkout/sucesso` renderize de verdade.
- Confirmar que a página lê o pedido pelo parâmetro, mostra status real (aprovado / pendente / recusado) e só esvazia o carrinho quando aprovado.
- Teste no navegador acessando a URL com um pedido real do banco.

### Etapa 2 — Fazer a confirmação de pagamento funcionar de ponta a ponta
- Definir uma base de URL pública correta e única (domínio próprio quando publicado; preview durante testes) usada em `back_urls` e `notification_url`.
- Publicar o site para que a URL de webhook responda.
- Adicionar logs claros no webhook e uma rota interna de conferência que consulta o Mercado Pago pelo ID do pagamento e corrige o status do pedido — fallback caso a notificação falhe.
- Reconciliar os 8 pedidos que já têm ID de pagamento: consultar o status real e atualizar.
- Confirmar o segredo do webhook cadastrado no painel do Mercado Pago.

### Etapa 3 — Higiene de dados e operação
- Rotina para expirar/cancelar pedidos pendentes antigos (ex.: pendente há mais de 24h vira cancelado).
- Remover/renomear a categoria "teste" e preencher a imagem do produto faltante.
- Painel admin: garantir que pedidos confirmados apareçam e que reembolso/sincronização estejam visíveis com status atualizado.

### Etapa 4 — Frontend restante
- `/meus-pedidos`: estado de "verificando login" imediato, redirecionamento rápido e mensagem de erro se a sessão expirar.
- Revisar a tela do pedido público (`/pedido/{id}`) com os mesmos estados de status.
- Metadados por página (título/descrição/og) revisados em todas as rotas de conteúdo.

### Etapa 5 — Testes automatizados dos fluxos críticos
- Testes para: retorno do Mercado Pago (aprovado/pendente/recusado), webhook atualizando status, reemissão de Pix e parcelamento acima de R$ 200.
- Um teste de navegador cobrindo o caminho completo: catálogo → carrinho → checkout convidado → pagamento → sucesso.

## Detalhes técnicos
- Conflito de rotas: `src/routes/checkout.tsx` não tem `<Outlet />` e `routeTree.gen.ts` já registra `CheckoutRouteWithChildren`. Renomear para uma rota irmã (`checkout-sucesso`) mantendo redirecionamento, ou adicionar layout com `Outlet`.
- `getPublicAppUrl` em `src/lib/mercadopago.server.ts` usa fallback fixo; adicionar `PUBLIC_APP_URL` como segredo e priorizar o domínio de produção.
- Reconciliação via `GET https://api.mercadopago.com/v1/payments/{id}` + `mapMercadoPagoStatus`, usando cliente admin do backend.
- Expiração de pendentes: função de servidor protegida + rota `api/public` com segredo, agendada por cron.
- Segredos já presentes: tokens e chaves públicas de teste/produção do Mercado Pago, segredo do webhook, chave de e-mail. Falta apenas `PUBLIC_APP_URL`.
