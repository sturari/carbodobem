import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const listarProdutos = createServerFn({ method: "GET" }).handler(async () => {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  const supa = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });
  const { data, error } = await supa
    .from("produtos")
    .select("id, nome, descricao, preco, gramatura_g, categoria, imagem_url, estoque")
    .eq("ativo", true)
    .order("categoria")
    .order("nome");
  if (error) throw new Error(error.message);
  return { produtos: data ?? [] };
});
