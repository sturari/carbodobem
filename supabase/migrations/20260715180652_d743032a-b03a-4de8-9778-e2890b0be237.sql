
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pedidos_user_id_idx ON public.pedidos(user_id);

CREATE POLICY "pedidos owner read"
  ON public.pedidos
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
