-- Permissões de tabela para usuários logados (role "authenticated").
-- O painel /admin lê pedidos/clientes/endereços/itens e gerencia produtos
-- com o token do usuário; quem pode de fato é decidido pelas políticas RLS
-- (has_role admin). Sem estes GRANTs o Postgres nega antes de chegar na RLS
-- ("permission denied for table ...").
GRANT SELECT, UPDATE ON public.pedidos TO authenticated;
GRANT SELECT ON public.clientes, public.enderecos, public.itens_pedido TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
