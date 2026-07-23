import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

/**
 * Retorna os pedidos criados pelo usuário autenticado, com itens e endereço.
 * Usa supabaseAdmin server-side, mas filtra estritamente por user_id da sessão
 * validada — nenhum cliente pode ver pedidos de outro.
 */
export const listarMeusPedidos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data, error } = await supabaseAdmin
      .from("pedidos")
      .select(
        `
        id, status, valor_total, horario_entrega, observacoes,
        mercadopago_payment_id, created_at,
        enderecos:endereco_id ( cep, rua, numero, complemento, bairro, cidade, uf ),
        itens_pedido ( quantidade, preco_unitario, produtos:produto_id ( nome, imagem_url ) )
        `,
      )
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const buscarMeuPedido = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ pedido_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: pedido, error } = await supabaseAdmin
      .from("pedidos")
      .select(
        `
        id, status, valor_total, horario_entrega, observacoes,
        mercadopago_payment_id, created_at,
        enderecos:endereco_id ( cep, rua, numero, complemento, bairro, cidade, uf ),
        itens_pedido ( quantidade, preco_unitario, produtos:produto_id ( nome, imagem_url ) )
        `,
      )
      .eq("id", data.pedido_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return pedido;
  });

/**
 * Busca pública de pedido — usada no link enviado por e-mail para
 * pedidos de convidado (sem `user_id`). Retorna somente pedidos cujo
 * `user_id` é NULL: pedidos vinculados a uma conta precisam de login.
 */
export const buscarPedidoConvidado = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ pedido_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: pedido, error } = await supabaseAdmin
      .from("pedidos")
      .select(
        `
        id, status, valor_total, horario_entrega, observacoes,
        mercadopago_payment_id, created_at, user_id,
        enderecos:endereco_id ( cep, rua, numero, complemento, bairro, cidade, uf ),
        itens_pedido ( quantidade, preco_unitario, produtos:produto_id ( nome, imagem_url ) )
        `,
      )
      .eq("id", data.pedido_id)
      .is("user_id", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return pedido;
  });
