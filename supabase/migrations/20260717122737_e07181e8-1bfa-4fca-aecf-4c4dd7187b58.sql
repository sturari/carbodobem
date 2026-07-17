
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
