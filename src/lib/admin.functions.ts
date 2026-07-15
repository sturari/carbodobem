import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const statusEnum = z.enum([
  "pendente",
  "pagamento_confirmado",
  "em_preparo",
  "saiu_para_entrega",
  "entregue",
  "cancelado",
]);


async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}


export const listarPedidosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("pedidos")
      .select(
        `
        id, status, valor_total, horario_entrega, observacoes,
        mercadopago_preference_id, mercadopago_payment_id, created_at,
        clientes:cliente_id ( nome, email, telefone ),
        enderecos:endereco_id ( cep, rua, numero, complemento, bairro, cidade, uf ),
        itens_pedido ( quantidade, preco_unitario, produtos:produto_id ( nome ) )
        `,
      )
      // Só exibe pedidos com pagamento processado pelo webhook do MP.
      // 'pendente' = aguardando pagamento; fica oculto do painel.
      .in("status", ["em_preparo", "saiu_para_entrega", "entregue", "cancelado"])
      .not("mercadopago_payment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const atualizarStatusPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z.object({ pedido_id: z.string().uuid(), status: statusEnum }).parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("pedidos")
      .update({ status: data.status })
      .eq("id", data.pedido_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verificarAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data, userId: context.userId };
  });


// ============ PRODUTOS ============

const produtoSchema = z.object({
  nome: z.string().min(1).max(200),
  categoria: z.string().min(1).max(80),
  descricao: z.string().max(2000).optional().nullable(),
  preco: z.number().nonnegative(),
  estoque: z.number().int().nonnegative(),
  gramatura_g: z.number().int().nonnegative().optional().nullable(),
  imagem_url: z.string().url().max(500).optional().nullable().or(z.literal("")),
  ativo: z.boolean(),
});

export const listarProdutosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("produtos")
      .select("*")
      .order("categoria", { ascending: true })
      .order("nome", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const criarProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => produtoSchema.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const payload = {
      ...data,
      imagem_url: data.imagem_url || null,
      descricao: data.descricao || null,
    };
    const { data: row, error } = await context.supabase
      .from("produtos")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const atualizarProduto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ id: z.string().uuid() })
      .merge(produtoSchema.partial())
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { id, ...updates } = data;
    if (updates.imagem_url === "") updates.imagem_url = null;
    const { data: row, error } = await context.supabase
      .from("produtos")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
