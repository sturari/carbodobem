GRANT SELECT ON public.areas_cobertura TO anon, authenticated;
GRANT ALL ON public.areas_cobertura TO service_role;
NOTIFY pgrst, 'reload schema';