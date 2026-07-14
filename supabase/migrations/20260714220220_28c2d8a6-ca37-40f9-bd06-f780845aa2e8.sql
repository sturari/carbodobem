-- Admin CRUD policies for produtos
CREATE POLICY produtos_admin_all ON public.produtos
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));