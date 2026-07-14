ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS mercadopago_payment_id text;
CREATE INDEX IF NOT EXISTS idx_pedidos_mp_payment_id ON public.pedidos (mercadopago_payment_id);