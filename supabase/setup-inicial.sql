-- Configuração inicial do banco no Supabase próprio (rodar UMA vez no SQL Editor).
-- Gerado a partir de supabase/migrations/ (em ordem) + criação do bucket de fotos.
-- Tudo roda numa transação: se der erro, nada é aplicado.
BEGIN;

-- ===== 20260714182706_05fdea2a-947e-462d-b319-091e9519247b.sql =====

-- =========== ENUMS ===========
CREATE TYPE public.status_pedido AS ENUM ('pendente','em_preparo','saiu_para_entrega','entregue','cancelado');

-- =========== PRODUTOS ===========
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  gramatura_g INTEGER,
  categoria TEXT NOT NULL,
  imagem_url TEXT,
  estoque INTEGER NOT NULL DEFAULT 0 CHECK (estoque >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.produtos TO anon, authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "produtos_public_read" ON public.produtos FOR SELECT TO anon, authenticated USING (ativo = TRUE);

-- =========== CLIENTES ===========
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.clientes TO anon, authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_guest_insert" ON public.clientes FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

-- =========== ENDERECOS ===========
CREATE TABLE public.enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  cep TEXT NOT NULL,
  rua TEXT NOT NULL,
  numero TEXT NOT NULL,
  complemento TEXT,
  bairro TEXT NOT NULL,
  cidade TEXT NOT NULL,
  uf CHAR(2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.enderecos TO anon, authenticated;
GRANT ALL ON public.enderecos TO service_role;
ALTER TABLE public.enderecos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enderecos_guest_insert" ON public.enderecos FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

-- =========== PEDIDOS ===========
CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id),
  endereco_id UUID NOT NULL REFERENCES public.enderecos(id),
  horario_entrega TIMESTAMPTZ NOT NULL,
  status public.status_pedido NOT NULL DEFAULT 'pendente',
  valor_total NUMERIC(10,2) NOT NULL CHECK (valor_total >= 0),
  observacoes TEXT,
  mercadopago_preference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.pedidos TO anon, authenticated;
GRANT ALL ON public.pedidos TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedidos_guest_insert" ON public.pedidos FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

-- =========== ITENS_PEDIDO ===========
CREATE TABLE public.itens_pedido (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES public.produtos(id),
  quantidade INTEGER NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(10,2) NOT NULL CHECK (preco_unitario >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT INSERT ON public.itens_pedido TO anon, authenticated;
GRANT ALL ON public.itens_pedido TO service_role;
ALTER TABLE public.itens_pedido ENABLE ROW LEVEL SECURITY;
CREATE POLICY "itens_pedido_guest_insert" ON public.itens_pedido FOR INSERT TO anon, authenticated WITH CHECK (TRUE);

-- =========== AREAS_COBERTURA (suporta CEP exato e faixas) ===========
CREATE TABLE public.areas_cobertura (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  descricao TEXT,
  cep_inicio TEXT NOT NULL,
  cep_fim TEXT NOT NULL,
  taxa_entrega NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (taxa_entrega >= 0),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.areas_cobertura TO anon, authenticated;
GRANT ALL ON public.areas_cobertura TO service_role;
ALTER TABLE public.areas_cobertura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "areas_public_read" ON public.areas_cobertura FOR SELECT TO anon, authenticated USING (ativo = TRUE);

-- =========== updated_at trigger ===========
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_produtos_updated BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE TRIGGER trg_pedidos_updated BEFORE UPDATE ON public.pedidos
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- =========== ÍNDICES ===========
CREATE INDEX idx_produtos_categoria ON public.produtos(categoria) WHERE ativo = TRUE;
CREATE INDEX idx_itens_pedido_pedido ON public.itens_pedido(pedido_id);
CREATE INDEX idx_areas_cep ON public.areas_cobertura(cep_inicio, cep_fim) WHERE ativo = TRUE;


-- ===== 20260714205336_ef0db89b-6f60-4279-985b-b6a0edc0d42b.sql =====
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS mercadopago_payment_id text;
CREATE INDEX IF NOT EXISTS idx_pedidos_mp_payment_id ON public.pedidos (mercadopago_payment_id);

-- ===== 20260714210459_18556523-4ba6-4db2-b426-f3a7ac0028b9.sql =====

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


-- ===== 20260714210522_797470b8-3a6c-4678-866c-e044ecf24c40.sql =====

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;


-- ===== 20260714211143_6ebb28a1-ba38-4890-9b61-d39794bde533.sql =====

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


-- ===== 20260714211312_35518799-5d27-4a4c-b3f8-8c3ac5e7a7a6.sql =====

CREATE TABLE public._rls_test (id serial primary key, val text);
GRANT INSERT, SELECT ON public._rls_test TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public._rls_test_id_seq TO anon, authenticated;
ALTER TABLE public._rls_test ENABLE ROW LEVEL SECURITY;
CREATE POLICY p ON public._rls_test FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY r ON public._rls_test FOR SELECT TO anon USING (true);


-- ===== 20260714211427_ad1c4231-25fd-4f79-bfb6-9f330fbaa3e7.sql =====
DROP TABLE IF EXISTS public._rls_test;

-- ===== 20260714220220_28c2d8a6-ca37-40f9-bd06-f780845aa2e8.sql =====
-- Admin CRUD policies for produtos
CREATE POLICY produtos_admin_all ON public.produtos
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ===== 20260715122004_9746bffb-694c-4192-8dbf-fae6903a138e.sql =====

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


-- ===== 20260715175821_a90ffbdd-5065-4569-a8e7-a16cc13b30b0.sql =====
ALTER TYPE public.status_pedido ADD VALUE IF NOT EXISTS 'pagamento_confirmado' BEFORE 'em_preparo';

-- ===== 20260715180652_d743032a-b03a-4de8-9778-e2890b0be237.sql =====

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pedidos_user_id_idx ON public.pedidos(user_id);

CREATE POLICY "pedidos owner read"
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);


-- ===== 20260717122737_e07181e8-1bfa-4fca-aecf-4c4dd7187b58.sql =====

CREATE POLICY "Admins can upload produtos images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'produtos' AND EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Admins can update produtos images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'produtos' AND EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
  )
)
WITH CHECK (
  bucket_id = 'produtos' AND EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Admins can delete produtos images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'produtos' AND EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
  )
);

CREATE POLICY "Admins can read produtos images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'produtos' AND EXISTS (
    SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'::public.app_role
  )
);


-- ===== 20260722150720_71ae5ff2-5a3e-4a52-b103-d078b38bccf0.sql =====

ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS pix_lock_until timestamptz;

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.rate_limits TO service_role;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
-- Sem policies: acesso somente via service_role (server-side).


-- ===== 20260816192535_a91cb3ec-3c30-40c7-972f-7679e0765261.sql =====
GRANT SELECT ON public.areas_cobertura TO anon, authenticated;
GRANT ALL ON public.areas_cobertura TO service_role;
NOTIFY pgrst, 'reload schema';

-- ===== Bucket privado das fotos dos produtos (criado pelo Lovable fora das migrações) =====
INSERT INTO storage.buckets (id, name, public) VALUES ('produtos', 'produtos', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
