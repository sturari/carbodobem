
CREATE TABLE public._rls_test (id serial primary key, val text);
GRANT INSERT, SELECT ON public._rls_test TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public._rls_test_id_seq TO anon, authenticated;
ALTER TABLE public._rls_test ENABLE ROW LEVEL SECURITY;
CREATE POLICY p ON public._rls_test FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY r ON public._rls_test FOR SELECT TO anon USING (true);
