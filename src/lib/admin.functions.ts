import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const statusEnum = z.enum([
  "pendente",
  "em_preparo",
  "saiu_para_entrega",
  "entregue",
  "cancelado",
]);

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", {
    _user_id: ctx.userId,
    _role: "admin",
  });
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
    const { data } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: !!data, userId: context.userId };
  });
