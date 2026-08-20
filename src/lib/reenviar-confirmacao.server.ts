import { getPublicAppUrl } from "@/lib/mercadopago.server";

/**
 * Reenvia o e-mail de confirmação de um pedido de convidado (sem conta).
 * Segurança: só aceita pedidos com `user_id` NULL e exige que o e-mail
 * informado seja exatamente o e-mail do cliente do pedido — assim o link
 * de rastreio nunca é enviado para um endereço arbitrário.
 */
export async function reenviarConfirmacaoConvidado(params: {
  pedidoId: string;
  email: string;
}): Promise<{ ok: boolean; motivo?: "suprimido" }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: pedido, error } = await supabaseAdmin
    .from("pedidos")
    .select(
      `
      id, user_id, valor_total, horario_entrega, observacoes,
      clientes:cliente_id ( nome, email ),
      enderecos:endereco_id ( cep, rua, numero, complemento, bairro, cidade, uf ),
      itens_pedido ( quantidade, preco_unitario, produtos:produto_id ( nome ) )
      `,
    )
    .eq("id", params.pedidoId)
    .is("user_id", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!pedido) throw new Error("Pedido não encontrado.");

  const cliente = pedido.clientes as unknown as { nome: string; email: string } | null;
  const emailInformado = params.email.trim().toLowerCase();
  if (!cliente || cliente.email.trim().toLowerCase() !== emailInformado) {
    throw new Error("E-mail não corresponde ao pedido.");
  }

  const itens = ((pedido.itens_pedido ?? []) as Array<{
    quantidade: number;
    preco_unitario: number;
    produtos: { nome: string } | null;
  }>).map((it) => ({
    nome: it.produtos?.nome ?? "Item",
    quantidade: it.quantidade,
    preco_unitario: Number(it.preco_unitario),
  }));

  const subtotal = itens.reduce((s, it) => s + it.quantidade * it.preco_unitario, 0);
  const valorTotal = Number(pedido.valor_total);
  const taxaEntrega = Math.max(0, Number((valorTotal - subtotal).toFixed(2)));

  const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
  const result = await sendTemplateEmail("pedido-confirmado", cliente.email, {
    idempotencyKey: `pedido-confirmado-reenvio-${pedido.id}-${Date.now()}`,
    templateData: {
      nome_cliente: cliente.nome,
      pedido_id: pedido.id,
      itens,
      subtotal,
      taxa_entrega: taxaEntrega,
      valor_total: valorTotal,
      horario_entrega: pedido.horario_entrega,
      endereco: pedido.enderecos,
      observacoes: pedido.observacoes,
      tracking_url: `${getPublicAppUrl()}/pedido/${pedido.id}`,
    },
  });

  if (!result.sent) return { ok: false, motivo: "suprimido" };
  return { ok: true };
}
