
-- GRANTs explícitos (compensa migrações antigas sem grants)
GRANT INSERT ON public.clientes, public.enderecos, public.pedidos, public.itens_pedido TO anon, authenticated;
GRANT ALL ON public.clientes, public.enderecos, public.pedidos, public.itens_pedido TO service_role;

-- Recria políticas de INSERT
DROP POLICY IF EXISTS clientes_guest_insert ON public.clientes;
DROP POLICY IF EXISTS enderecos_guest_insert ON public.enderecos;
DROP POLICY IF EXISTS pedidos_guest_insert ON public.pedidos;
DROP POLICY IF EXISTS itens_pedido_guest_insert ON public.itens_pedido;

CREATE POLICY "clientes_public_insert" ON public.clientes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "enderecos_public_insert" ON public.enderecos
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "pedidos_public_insert" ON public.pedidos
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "itens_pedido_public_insert" ON public.itens_pedido
  FOR INSERT TO anon, authenticated WITH CHECK (true);
