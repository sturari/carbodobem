import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// Cache em memória com TTL curto. O catálogo muda pouco e as chamadas
// são per-request no Worker, então esse cache reduz round-trips ao banco
// durante rajadas (SSR + hidratação + reload rápido). É invalidado
// explicitamente pelo admin ao criar/atualizar produtos.
type ProdutoListado = {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  gramatura_g: number | null;
  categoria: string;
  imagem_url: string | null;
  estoque: number;
};

const TTL_MS = 60_000;
let cache: { data: { produtos: ProdutoListado[] }; expiresAt: number } | null = null;

export function invalidarCacheProdutos() {
  cache = null;
}

export const listarProdutos = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

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
  const payload = { produtos: (data ?? []) as ProdutoListado[] };
  cache = { data: payload, expiresAt: Date.now() + TTL_MS };
  return payload;
});
