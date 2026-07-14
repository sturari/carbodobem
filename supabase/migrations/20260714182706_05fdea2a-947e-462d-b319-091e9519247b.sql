
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
