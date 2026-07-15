
-- 1) Remove políticas "WITH CHECK true" abertas ao anon
DROP POLICY IF EXISTS "clientes_public_insert" ON public.clientes;
DROP POLICY IF EXISTS "enderecos_public_insert" ON public.enderecos;
DROP POLICY IF EXISTS "pedidos_public_insert" ON public.pedidos;
DROP POLICY IF EXISTS "itens_pedido_public_insert" ON public.itens_pedido;

-- 2) Cria schema privado e move has_role
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, anon, service_role;

-- 3) Recria políticas que usavam public.has_role
DROP POLICY IF EXISTS "clientes admin read" ON public.clientes;
CREATE POLICY "clientes admin read" ON public.clientes
FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "enderecos admin read" ON public.enderecos;
CREATE POLICY "enderecos admin read" ON public.enderecos
FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "itens_pedido admin read" ON public.itens_pedido;
CREATE POLICY "itens_pedido admin read" ON public.itens_pedido
FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "pedidos admin read" ON public.pedidos;
CREATE POLICY "pedidos admin read" ON public.pedidos
FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "pedidos admin update" ON public.pedidos;
CREATE POLICY "pedidos admin update" ON public.pedidos
FOR UPDATE TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "produtos_admin_all" ON public.produtos;
CREATE POLICY "produtos_admin_all" ON public.produtos
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "user_roles admin manage" ON public.user_roles;
CREATE POLICY "user_roles admin manage" ON public.user_roles
FOR ALL TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "user_roles self read" ON public.user_roles;
CREATE POLICY "user_roles self read" ON public.user_roles
FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR private.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Remove has_role do schema public (exposta via PostgREST)
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
