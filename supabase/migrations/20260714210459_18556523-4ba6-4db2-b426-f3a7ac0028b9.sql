
-- 1) Reset áreas de cobertura para Brasília (Plano Piloto)
DELETE FROM public.areas_cobertura;

INSERT INTO public.areas_cobertura (descricao, cep_inicio, cep_fim, taxa_entrega, ativo) VALUES
  ('Asa Sul',    '70200000', '70399999', 15.00, true),
  ('Setor Militar Urbano (SMU)', '70630000', '70679999', 15.00, true),
  ('Noroeste',   '70680000', '70699999', 15.00, true),
  ('Asa Norte',  '70700000', '70999999', 15.00, true),
  ('Lago Norte', '71500000', '71599999', 15.00, true),
  ('Lago Sul',   '71600000', '71699999', 15.00, true);

-- 2) User roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
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

CREATE POLICY "user_roles self read"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "user_roles admin manage"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Acesso administrativo aos pedidos e tabelas relacionadas
CREATE POLICY "pedidos admin read"
  ON public.pedidos FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "pedidos admin update"
  ON public.pedidos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "itens_pedido admin read"
  ON public.itens_pedido FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "clientes admin read"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "enderecos admin read"
  ON public.enderecos FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
